from backend.graph.store import graph_store

def update_agent_profile(agent_id: str, event_type: str, payload: dict):
    """
    Parses event details to update the agent's capability profile in the graph store.
    """
    # 1. Deduce and set the agent's role based on agent_id prefix or payload metadata
    role = "AI System Agent"
    if "support-agent" in agent_id:
        role = "Customer Support Assistant"
    elif "marketing-agent" in agent_id:
        role = "Marketing Automator"
    elif "ops-agent" in agent_id:
        role = "Operations Monitoring Agent"
    
    # Custom role passed in payload override
    role = payload.get("role", role)
    graph_store.add_agent(agent_id, role)
    
    # 2. Update graph relationships based on event types
    if event_type == "db-query":
        db_name = payload.get("db_name", "Customer Database")
        graph_store.add_relationship(agent_id, "ACCESSES", "Data", db_name)
        graph_store.add_relationship(agent_id, "USES", "Tool", "SQL Client")
        graph_store.add_relationship(agent_id, "CALLS", "API", "Database Connection Pool")
        
    elif event_type == "send-email":
        graph_store.add_relationship(agent_id, "USES", "Tool", "Email Client")
        graph_store.add_relationship(agent_id, "CONNECTS_TO", "System", "SMTP Email Server")
        
        # If sending customer data or sensitive attachments, log access to it
        attachment = payload.get("attachment_type", "none")
        if attachment != "none":
            graph_store.add_relationship(agent_id, "ACCESSES", "Data", f"Attachment: {attachment}")
            
    elif event_type == "support-ticket":
        graph_store.add_relationship(agent_id, "USES", "Tool", "CRM System")
        graph_store.add_relationship(agent_id, "CALLS", "API", "Ticketing Endpoint")
        
    # Generic backup log
    system_conn = payload.get("target_system")
    if system_conn:
        graph_store.add_relationship(agent_id, "CONNECTS_TO", "System", system_conn)
