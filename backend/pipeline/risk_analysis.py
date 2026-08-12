from backend.config import APPROVED_DOMAINS

def analyze_risk(agent_profile: dict, current_event: dict, llm_reasoning: dict) -> dict:
    """
    Applies static rules and merges them with LLM reasoning.
    Returns a dict with: risk_level, explanation, matched_rules
    """
    event_type = current_event.get("event_type", "")
    payload = current_event.get("payload", {})
    
    risk_level = "Low"
    explanations = []
    matched_rules = []
    
    # --- RULE A: Data Access + External Communication ---
    # Triggered if agent has read customer database before OR current payload contains data, 
    # and agent is emailing outside approved domains.
    if event_type == "send-email":
        recipient = payload.get("recipient", "")
        attachment = payload.get("attachment_type", "none")
        domain = recipient.split("@")[-1] if "@" in recipient else ""
        
        # Check if domain is external
        is_external = domain not in APPROVED_DOMAINS
        
        # Check if agent has history of accessing customer database in its profile
        has_accessed_data = len(agent_profile.get("ACCESSES", [])) > 0 or attachment == "customer_data"
        
        if is_external and has_accessed_data:
            risk_level = "High"
            matched_rules.append("Rule (a): Data Access + External Communication")
            explanations.append(
                f"Agent read customer records, then sent an email containing customer data to {recipient} — a domain not in the approved company/partner allowlist."
            )

    # --- RULE B: Query Scope >> Task Requirement ---
    # Triggered if query scope is 'single_row' but rows returned > 10x expected (e.g. > 10 rows)
    if event_type == "db-query":
        scope = payload.get("query_scope", "single_row")
        rows = payload.get("rows_returned", 1)
        
        if scope == "single_row" and rows > 10:
            # Escalate risk level to Medium (unless already High)
            if risk_level != "High":
                risk_level = "Medium"
            matched_rules.append("Rule (b): Scope Violation")
            explanations.append(
                f"Agent accessed {rows:,} customer records to resolve a single-ticket request ({payload.get('ticket_id', 'Unknown')}). Access scope exceeds task requirement by ~{rows-1}x."
            )

    # --- RULE C: Action Inconsistent with Declared Role ---
    # Uses LLM reasoning output to trigger possible prompt injection or manipulation
    if llm_reasoning.get("risk_level") == "High" or "prompt injection" in llm_reasoning.get("matched_pattern", "").lower():
        risk_level = "High"
        matched_rules.append("Rule (c): Action Inconsistent / Agent Manipulation")
        explanations.append(llm_reasoning.get("explanation", ""))

    # If no rules fired but LLM reasoner flagged something, use LLM findings
    if not matched_rules and llm_reasoning.get("risk_level") != "Low":
        risk_level = llm_reasoning.get("risk_level", "Low")
        matched_rules.append("LLM Reasoning")
        explanations.append(llm_reasoning.get("explanation", ""))

    # If nothing triggered at all, keep it Low
    if not explanations:
        explanations.append("No risk patterns detected. Event conforms to agent baseline profile.")
        
    return {
        "risk_level": risk_level,
        "explanation": " ".join(explanations),
        "matched_rules": matched_rules
    }
