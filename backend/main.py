import os
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

import asyncio
import time
import random
import json
import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config import HOST, PORT
from backend.db.session import get_db, DbSession
from backend.graph.store import graph_store
from backend.pipeline.engine import run_pipeline

app = FastAPI(title="Noctis Backend Services", version="1.0.0")

# Setup CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pipeline serialization locks and timestamps to space out events by at least 1.5s
pipeline_lock = asyncio.Lock()
last_pipeline_time = 0.0

async def execute_spaced_pipeline(db: DbSession, agent_id: str, event_type: str, payload: dict):
    """
    Ensures that event ingestion runs with a spacing of at least 1.5 seconds.
    If events are fired in rapid succession, it queues them.
    """
    global last_pipeline_time
    async with pipeline_lock:
        now = time.time()
        elapsed = now - last_pipeline_time
        if elapsed < 1.5:
            sleep_time = 1.5 - elapsed
            await asyncio.sleep(sleep_time)
        
        # Run the pipeline
        event = run_pipeline(db, agent_id, event_type, payload)
        last_pipeline_time = time.time()
        return event


# --- REQUEST SCHEMAS ---
class DBQueryRequest(BaseModel):
    agent_id: str
    query_scope: str  # "single_row" | "full_table"
    ticket_id: Optional[str] = None
    rows_returned: Optional[int] = 1
    purpose: Optional[str] = "incident_resolution"

class SendEmailRequest(BaseModel):
    agent_id: str
    recipient: str
    subject: str
    body_summary: str
    attachment_type: Optional[str] = "none"  # "customer_data" | "credentials" | "none"

class SupportTicketRequest(BaseModel):
    agent_id: str
    contains_injection: bool = False
    ticket_body: str

class AgentChatRequest(BaseModel):
    """A demo connector representing a customer's own AI agent workspace."""
    prompt: str


# --- SIMULATION ENDPOINTS (Writes to shared log store) ---

@app.post("/sim/db-query")
async def sim_db_query(req: DBQueryRequest, db: DbSession = Depends(get_db)):
    payload = {
        "query_scope": req.query_scope,
        "ticket_id": req.ticket_id,
        "rows_returned": req.rows_returned,
        "purpose": req.purpose,
        "client_sdk": "LangChain-Python-v0.1"
    }
    event = await execute_spaced_pipeline(db, req.agent_id, "db-query", payload)
    
    # Return mock customer records response
    rows = []
    for i in range(min(req.rows_returned, 5)):  # Return max 5 sample rows for display
        rows.append({
            "customer_id": f"CUST-00{i+random.randint(10, 99)}",
            "name": random.choice(["Jane Doe", "John Smith", "Bob Vance", "Alice Johnson"]),
            "email": f"user{i}@external.com",
            "billing_status": "Active"
        })
    
    return {
        "status": "Success",
        "event_id": event["id"],
        "rows_returned": req.rows_returned,
        "data": rows
    }

@app.post("/sim/send-email")
async def sim_send_email(req: SendEmailRequest, db: DbSession = Depends(get_db)):
    payload = {
        "recipient": req.recipient,
        "subject": req.subject,
        "body_summary": req.body_summary,
        "attachment_type": req.attachment_type,
        "client_sdk": "LangChain-Python-v0.1"
    }
    event = await execute_spaced_pipeline(db, req.agent_id, "send-email", payload)
    return {
        "status": "Email Sent",
        "event_id": event["id"],
        "recipient": req.recipient
    }

@app.post("/sim/support-ticket")
async def sim_support_ticket(req: SupportTicketRequest, db: DbSession = Depends(get_db)):
    payload = {
        "ticket_body": req.ticket_body,
        "contains_injection": req.contains_injection,
        "client_sdk": "CrewAI-Python-v0.2"
    }
    event = await execute_spaced_pipeline(db, req.agent_id, "support-ticket", payload)
    
    # Check if the injection triggers a mock secondary activity inside support agent
    # Trigger db-query + send-email automatically if injection is present, replicating the action
    if req.contains_injection:
        async def trigger_injected_flow():
            await asyncio.sleep(2.0)  # Wait for ticket process to settle
            # Trigger Database read
            db_payload = DBQueryRequest(
                agent_id=req.agent_id,
                query_scope="single_row",
                ticket_id="T-INJECTED",
                rows_returned=4500,
                purpose="unauthorized_export"
            )
            # Fetch local DB session helper manually
            from backend.db.session import DbSession
            with DbSession() as s_db:
                await sim_db_query(db_payload, s_db)
                
            await asyncio.sleep(2.0)
            # Trigger outbound email
            email_payload = SendEmailRequest(
                agent_id=req.agent_id,
                recipient="external-address@attacker-domain.com",
                subject="Exported Billing History",
                body_summary="Attacking script forwarded account export.",
                attachment_type="customer_data"
            )
            with DbSession() as s_db:
                await sim_send_email(email_payload, s_db)

        # Trigger async secondary tasks representing the hijacked agent
        asyncio.create_task(trigger_injected_flow())
        
    return {
        "status": "Ticket Processed",
        "event_id": event["id"],
        "contains_injection": req.contains_injection
    }


@app.post("/enterprise/agent-chat")
async def enterprise_agent_chat(req: AgentChatRequest, db: DbSession = Depends(get_db)):
    """Translate a test-company request into the logs its connected agents emit.

    This endpoint is deliberately a connector/demo surface: Noctis does not execute
    customer actions in production; it receives the resulting audit events.
    """
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="A company-agent request is required")
    lower = prompt.lower()

    if any(token in lower for token in ["ignore prior", "prompt injection", "attacker", "jailbreak"]):
        event = await execute_spaced_pipeline(db, "support-agent-02", "support-ticket", {
            "ticket_body": prompt,
            "contains_injection": True,
            "client_sdk": "Company-Agent-Connector-v1",
            "role": "Customer Support Assistant"
        })
        return {
            "status": "accepted", "event_id": event["id"], "risk_hint": "High-risk manipulation pattern sent for review",
            "message": "The support agent received the request. Noctis recorded a possible prompt-injection attempt and is monitoring its follow-on activity."
        }

    if any(token in lower for token in ["export", "all customer", "billing records", "email them", "send customer"]):
        agent_id = "support-agent-01"
        query_event = await execute_spaced_pipeline(db, agent_id, "db-query", {
            "query_scope": "single_row", "ticket_id": "CHAT-REQUEST", "rows_returned": 4500,
            "purpose": "company_agent_request", "client_sdk": "Company-Agent-Connector-v1", "role": "Customer Support Assistant"
        })
        email_event = await execute_spaced_pipeline(db, agent_id, "send-email", {
            "recipient": "vendor@outside.example", "subject": "Requested customer export", "body_summary": prompt,
            "attachment_type": "customer_data", "client_sdk": "Company-Agent-Connector-v1", "role": "Customer Support Assistant"
        })
        return {
            "status": "accepted", "event_id": email_event["id"], "risk_hint": "High-risk data handling pattern sent for review",
            "message": f"The company agent produced database and email audit events (starting with event {query_event['id']}). Noctis identified the abnormal data access and external sharing path."
        }

    event = await execute_spaced_pipeline(db, "support-agent-01", "db-query", {
        "query_scope": "single_row", "ticket_id": "CHAT-4821", "rows_returned": 1,
        "purpose": "ticket_lookup", "client_sdk": "Company-Agent-Connector-v1", "role": "Customer Support Assistant"
    })
    return {
        "status": "accepted", "event_id": event["id"], "risk_hint": "Normal company activity logged",
        "message": "The company support agent completed a scoped ticket lookup. Noctis received the audit log and found no abnormal behavior."
    }

@app.get("/sim/events")
def get_sim_events(db: DbSession = Depends(get_db), limit: int = 50):
    """
    Returns the raw corporate event feed
    """
    events = db.fetch_all("SELECT * FROM events ORDER BY timestamp DESC LIMIT ?", (limit,))
    for evt in events:
        evt["payload"] = json.loads(evt["payload"])
    return events


# --- NOCTIS DASHBOARD ENDPOINTS (Read-only access to findings) ---

@app.get("/noctis/health")
def get_health_status(db: DbSession = Depends(get_db)):
    """
    Returns connection and diagnostics status of database engines.
    """
    db_status = "Connected"
    try:
        db.fetch_all("SELECT 1")
    except Exception:
        db_status = "Disconnected"
        
    from backend.graph.store import Neo4jGraphStore
    is_neo4j = isinstance(graph_store, Neo4jGraphStore)
    graph_status = "Neo4j Connected (Port 7687)" if is_neo4j else "Active (In-Memory Fallback)"
    
    return {
        "status": "Healthy",
        "database": db_status,
        "graph_store": graph_status,
        "db_file": "noctis.db (SQLite)"
    }

@app.get("/noctis/db-logs")
def get_database_transaction_logs():
    """
    Returns the real-time list of SQL operations executed on the SQLite database.
    """
    from backend.db.session import SQL_LOGS
    return SQL_LOGS

@app.get("/noctis/agents")
def get_discovered_agents(db: DbSession = Depends(get_db)):
    """
    Returns unique list of discovered agents, active roles, last active time, 
    and computed overall risk status based on active findings.
    """
    profiles = graph_store.get_all_profiles()
    results = []
    
    for profile in profiles:
        agent_id = profile["agent_id"]
        role = profile["role"]
        
        # Check active findings for this agent in SQLite
        findings = db.fetch_all("SELECT risk_level FROM findings WHERE agent_id = ? AND status = 'Active'", (agent_id,))
        
        # Compute overall risk level
        risk_level = "Low"
        if any(f["risk_level"] == "High" for f in findings):
            risk_level = "High"
        elif any(f["risk_level"] == "Medium" for f in findings):
            risk_level = "Medium"
            
        # Get last active timestamp
        last_event = db.fetch_one("SELECT timestamp FROM events WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 1", (agent_id,))
        last_active = last_event["timestamp"] if last_event else datetime.datetime.utcnow().isoformat()
        
        results.append({
            "agent_id": agent_id,
            "role": role,
            "risk_level": risk_level,
            "last_active": last_active
        })
        
    return results

@app.get("/noctis/agents/{agent_id}")
def get_agent_details(agent_id: str, db: DbSession = Depends(get_db)):
    """
    Returns complete profile graph nodes, timeline, and findings list for a specific agent.
    """
    profile = graph_store.get_agent_profile(agent_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Agent profile not found")
        
    findings = db.fetch_all("SELECT * FROM findings WHERE agent_id = ? ORDER BY timestamp DESC", (agent_id,))
    for f in findings:
        f["events_involved"] = json.loads(f["events_involved"])
        
    timeline = db.fetch_all("SELECT * FROM events WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 20", (agent_id,))
    for evt in timeline:
        evt["payload"] = json.loads(evt["payload"])
    
    return {
        "profile": profile,
        "findings": findings,
        "timeline": timeline
    }

@app.get("/noctis/findings")
def get_all_findings(db: DbSession = Depends(get_db)):
    """
    Returns history of all findings.
    """
    findings = db.fetch_all("SELECT * FROM findings ORDER BY timestamp DESC")
    for f in findings:
        f["events_involved"] = json.loads(f["events_involved"])
    return findings

@app.post("/noctis/findings/{finding_id}/review")
def review_finding(finding_id: int, username: str = "security.ops@yourcompany.com", role: str = "Lead Security Operations Analyst", db: DbSession = Depends(get_db)):
    """
    Human-in-the-loop audit: sets finding status to 'Reviewed — Action Recommended'.
    Logs reviewer email, role, timestamp, and details.
    """
    finding = db.fetch_one("SELECT * FROM findings WHERE id = ?", (finding_id,))
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
        
    audit_data = {
        "reviewer": username,
        "role": role,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "remediation_status": "Approved Remediation: Row-Level DB Filtering & SMTP Outbound Guardrails Enforced."
    }
    
    db.execute(
        "UPDATE findings SET status = 'Reviewed — Action Recommended', audit_log = ? WHERE id = ?", 
        (json.dumps(audit_data), finding_id)
    )
    
    updated = db.fetch_one("SELECT * FROM findings WHERE id = ?", (finding_id,))
    updated["events_involved"] = json.loads(updated["events_involved"])
    return updated


# --- DEMO CONTROLS ---

@app.post("/sim/clear")
def clear_all_stores(db: DbSession = Depends(get_db)):
    """
    Resets databases and graph stores to a clean state.
    """
    db.execute("DELETE FROM events")
    db.execute("DELETE FROM findings")
    graph_store.clear()
    return {"status": "Success", "message": "All databases and graphs cleared successfully."}


# --- BACKGROUND BENIGN EVENT GENERATOR ---

async def generate_benign_activity():
    """
    Asynchronous loop that simulates standard non-malicious operations.
    Runs every 8 seconds, picking one of 3 baseline agents.
    """
    # Wait for the server to spin up fully
    await asyncio.sleep(5.0)
    print("[Noctis Simulator] Benign generator thread active.")
    
    benign_agents = [
        {"agent_id": "support-agent-03", "role": "Customer Support Assistant"},
        {"agent_id": "ops-agent-01", "role": "Operations Monitoring Agent"},
        {"agent_id": "marketing-agent-02", "role": "Marketing Automator"}
    ]
    
    # Establish local DB Session for background thread
    from backend.db.session import DbSession
    
    while True:
        try:
            agent = random.choice(benign_agents)
            agent_id = agent["agent_id"]
            
            # Select random task
            task_type = random.choice(["db-query", "send-email", "sys-check"])
            
            with DbSession() as db:
                if task_type == "db-query":
                    # Support Agent reading a single ticket
                    ticket_num = random.randint(3000, 5000)
                    payload = {
                        "query_scope": "single_row",
                        "ticket_id": f"T-{ticket_num}",
                        "rows_returned": 1,
                        "purpose": "ticket_lookup",
                        "role": agent["role"]
                    }
                    await execute_spaced_pipeline(db, agent_id, "db-query", payload)
                    
                elif task_type == "send-email":
                    # Marketing Agent sending newsletter or status update to internal partner
                    payload = {
                        "recipient": f"partner-{random.randint(1,5)}@yourcompany.com",
                        "subject": "Weekly Newsletter Sync",
                        "body_summary": "Syncing content draft templates.",
                        "attachment_type": "none",
                        "role": agent["role"]
                    }
                    await execute_spaced_pipeline(db, agent_id, "send-email", payload)
                    
                else:
                    # Ops Agent checking infrastructure API
                    payload = {
                        "target_system": "API-Gateway-Core",
                        "status": "healthy",
                        "role": agent["role"]
                    }
                    await execute_spaced_pipeline(db, agent_id, "ops-check", payload)
                    
        except Exception as e:
            print(f"[Noctis Background Sim] Error in benign generator: {e}")
            
        await asyncio.sleep(random.randint(7, 10))


@app.on_event("startup")
async def startup_event():
    # Start the benign background worker
    asyncio.create_task(generate_benign_activity())
