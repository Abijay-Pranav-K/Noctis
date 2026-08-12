import re

# Heuristic checks to discover agents (non-human access patterns)
def discover_agent(agent_id: str, payload: dict) -> bool:
    """
    Returns True if the event is determined to originate from an AI agent.
    - Matches common agent ID patterns.
    - Checks headers/payload metadata for automation indicators.
    """
    if not agent_id:
        return False
        
    # Pattern 1: ID matches agent naming convention
    if re.search(r'(agent|bot|assistant|copilot|automator)', agent_id, re.IGNORECASE):
        return True
        
    # Pattern 2: Agent signatures in user-agent or metadata
    client_sdk = payload.get("client_sdk", "") or payload.get("user_agent", "")
    if any(sig in str(client_sdk).lower() for sig in ["langchain", "llamaindex", "autogen", "crewai", "openai-sdk"]):
        return True
        
    # Pattern 3: Machine-speed flags or automation tags
    if payload.get("is_automated") is True:
        return True
        
    return False
