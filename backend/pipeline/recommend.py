import datetime
import json
from backend.db.session import DbSession

def generate_recommendation(risk_analysis: dict) -> str:
    """
    Translates risk rules into action items.
    """
    rules = risk_analysis.get("matched_rules", [])
    recommendations = []
    
    for rule in rules:
        if "Rule (a)" in rule:
            recommendations.append("Restrict external send capability / require approval for external recipients.")
        elif "Rule (b)" in rule:
            recommendations.append("Restrict query scope / enforce row-level filtering.")
        elif "Rule (c)" in rule:
            recommendations.append("Flag for manual review — possible prompt injection. Do not auto-approve pending human review.")
            
    if not recommendations:
        if risk_analysis.get("risk_level") == "High":
            recommendations.append("Revoke API credentials immediately and investigate.")
        elif risk_analysis.get("risk_level") == "Medium":
            recommendations.append("Review agent capabilities and request token refresh.")
        else:
            recommendations.append("Enforce standard access policy limits.")
            
    return " ".join(recommendations)

def save_and_deduplicate_finding(db: DbSession, agent_id: str, risk_analysis: dict, event_id: int):
    """
    Saves a finding. If a finding already exists for this agent within a 3-second window, 
    merges them into a single consolidated row in SQLite.
    """
    risk_level = risk_analysis.get("risk_level", "Low")
    explanation = risk_analysis.get("explanation", "")
    recommendation = generate_recommendation(risk_analysis)
    
    # 3-second threshold (ISO comparison is direct in SQLite text fields)
    threshold_time = (datetime.datetime.utcnow() - datetime.timedelta(seconds=3)).isoformat()
    
    # Find any active finding for this agent in the 3-second window
    existing = db.fetch_all(
        "SELECT * FROM findings WHERE agent_id = ? AND timestamp >= ? AND status = 'Active' ORDER BY timestamp DESC LIMIT 1",
        (agent_id, threshold_time)
    )
    
    if existing:
        existing_finding = existing[0]
        print(f"[Noctis Pipeline] Deduplication active: Merging finding for agent {agent_id}.")
        
        # Merge Risk Levels (High > Medium > Low)
        level_map = {"Low": 1, "Medium": 2, "High": 3}
        current_map_val = level_map.get(risk_level, 1)
        existing_map_val = level_map.get(existing_finding["risk_level"], 1)
        
        merged_risk = risk_level if current_map_val > existing_map_val else existing_finding["risk_level"]
            
        # Merge Explanations (avoid duplicates)
        new_exp_sentences = [s.strip() for s in explanation.split(".") if s.strip()]
        old_exp_sentences = [s.strip() for s in existing_finding["explanation"].split(".") if s.strip()]
        
        combined_exp = list(old_exp_sentences)
        for sentence in new_exp_sentences:
            if sentence not in combined_exp:
                combined_exp.append(sentence)
        merged_explanation = ". ".join(combined_exp) + "."
        
        # Merge Recommendations
        new_rec_sentences = [r.strip() for r in recommendation.split(".") if r.strip()]
        old_rec_sentences = [r.strip() for r in existing_finding["recommendation"].split(".") if r.strip()]
        
        combined_rec = list(old_rec_sentences)
        for sentence in new_rec_sentences:
            if sentence not in combined_rec:
                combined_rec.append(sentence)
        merged_recommendation = ". ".join(combined_rec) + "."
        
        # Merge Events Involved
        events = json.loads(existing_finding["events_involved"])
        if event_id not in events:
            events.append(event_id)
            
        # Update SQLite record
        new_timestamp = datetime.datetime.utcnow().isoformat()
        db.execute(
            "UPDATE findings SET risk_level = ?, explanation = ?, recommendation = ?, events_involved = ?, timestamp = ? WHERE id = ?",
            (merged_risk, merged_explanation, merged_recommendation, json.dumps(events), new_timestamp, existing_finding["id"])
        )
    else:
        # Create a new finding in SQLite
        new_timestamp = datetime.datetime.utcnow().isoformat()
        db.execute(
            "INSERT INTO findings (agent_id, timestamp, risk_level, explanation, recommendation, status, events_involved) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (agent_id, new_timestamp, risk_level, explanation, recommendation, "Active", json.dumps([event_id]))
        )
