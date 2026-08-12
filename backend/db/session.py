import os
import sqlite3
import json
import datetime

DB_FILE = "./noctis.db"

def get_db_connection():
    """
    Returns a connection to the SQLite database.
    Enforces row factory so we can access columns by name.
    """
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    Initializes database tables if they do not exist.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Events Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL
    );
    """)
    
    # Create Findings Table with detailed audit capabilities
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        explanation TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        events_involved TEXT NOT NULL,
        risk_score INTEGER DEFAULT 10,
        execution_type TEXT DEFAULT 'Autonomous AI Agent',
        affected_data TEXT DEFAULT 'General Corporate logs',
        audit_log TEXT
    );
    """)
    
    conn.commit()
    conn.close()
    print("[Noctis DB] Database tables initialized successfully with Audit columns.")

# Initialize at module load
init_db()

# Yield-based context manager for routes
class DbSession:
    def __init__(self):
        self.conn = get_db_connection()
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        
    def close(self):
        self.conn.close()
        
    def execute(self, query: str, params=()):
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        self.conn.commit()
        return cursor
        
    def fetch_all(self, query: str, params=()):
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
        
    def fetch_one(self, query: str, params=()):
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None

def get_db():
    db = DbSession()
    try:
        yield db
    finally:
        db.close()

