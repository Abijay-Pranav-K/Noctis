import os
from dotenv import load_dotenv

load_dotenv()

# Server Settings
HOST = "0.0.0.0"
PORT = 8000

# Security Settings
APPROVED_DOMAINS = ["yourcompany.com"]

# Databases
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/noctis")
SQLITE_FALLBACK_URL = "sqlite:///./noctis.db"

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# Gemini API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
