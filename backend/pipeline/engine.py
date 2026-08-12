import json
import datetime
from backend.db.session import DbSession
from backend.graph.store import graph_store
from backend.pipeline.discover import discover_agent
from backend.pipeline.profile import update_agent_profile
from backend.pipeline.reason import run_reason_stage
from backend.pipeline.risk_analysis import analyze_risk
from backend.pipeline.recommend import save_and_deduplicate_finding

def run_pipeline(db: DbSession, agent_id: str, event_type: str, payload: dict) -> dict:
    """
    Saves the event and runs it through the 5-stage pipeline:
    1. DISCOVER
    2. PROFILE
    3. REASON
    4. RISK ANALYSIS
    5. RECOMMEND (with de-duplication)
    """
    # 1. Insert and save the event using sqlite3
    timestamp = datetime.datetime.utcnow().isoformat()
    payload_str = json.dumps(payload)
    
    cursor = db.execute(
        "INSERT INTO events (agent_id, timestamp, event_type, payload) VALUES (?, ?, ?, ?)",
        (agent_id, timestamp, event_type, payload_str)
    )
    event_id = cursor.lastrowid
    
    event_dict = {
        "id": event_id,
        "agent_id": agent_id,
        "timestamp": timestamp,
        "event_type": event_type,
        "payload": payload
    }
    
    # Check if the event matches an Agent profile (Discover pass)
    is_agent = discover_agent(agent_id, payload)
    
    if is_agent:
        # Profile Stage: update graph representation
        update_agent_profile(agent_id, event_type, payload)
        
        # Get active graph capability profile
        profile = graph_store.get_agent_profile(agent_id)
        
        # Reason Stage: LangGraph evaluation
        llm_reasoning = run_reason_stage(agent_id, profile["role"], profile, event_dict)
        
        # Risk Analysis Stage: Rules + Reasoner evaluation
        risk_analysis = analyze_risk(profile, event_dict, llm_reasoning)
        
        # Recommend Stage: Write finding + deduplicate (3s window)
        save_and_deduplicate_finding(db, agent_id, risk_analysis, event_id)
        
    return event_dict
