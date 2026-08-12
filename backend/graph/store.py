from neo4j import GraphDatabase
from backend.config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

class InMemGraphStore:
    def __init__(self):
        # Format: {agent_id: {role: str, ACCESSES: set(), USES: set(), CALLS: set(), CONNECTS_TO: set()}}
        self.db = {}

    def add_agent(self, agent_id: str, role: str):
        if agent_id not in self.db:
            self.db[agent_id] = {
                "role": role,
                "ACCESSES": set(),
                "USES": set(),
                "CALLS": set(),
                "CONNECTS_TO": set()
            }
        else:
            self.db[agent_id]["role"] = role

    def add_relationship(self, agent_id: str, rel_type: str, node_type: str, target_name: str):
        if agent_id not in self.db:
            # Create agent with unknown role initially
            self.add_agent(agent_id, "Unknown Agent")
        
        # Add to the appropriate relationship bucket
        if rel_type in ["ACCESSES", "USES", "CALLS", "CONNECTS_TO"]:
            self.db[agent_id][rel_type].add((node_type, target_name))

    def get_agent_profile(self, agent_id: str):
        if agent_id not in self.db:
            return None
        
        agent_data = self.db[agent_id]
        profile = {
            "agent_id": agent_id,
            "role": agent_data["role"],
            "ACCESSES": [name for _, name in agent_data["ACCESSES"]],
            "USES": [name for _, name in agent_data["USES"]],
            "CALLS": [name for _, name in agent_data["CALLS"]],
            "CONNECTS_TO": [name for _, name in agent_data["CONNECTS_TO"]]
        }
        return profile

    def get_all_profiles(self):
        profiles = []
        for agent_id in self.db:
            profiles.append(self.get_agent_profile(agent_id))
        return profiles

    def clear(self):
        self.db.clear()


class Neo4jGraphStore:
    def __init__(self):
        self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        # Verify connection
        with self.driver.session() as session:
            session.run("RETURN 1")

    def add_agent(self, agent_id: str, role: str):
        query = (
            "MERGE (a:Agent {id: $agent_id}) "
            "SET a.role = $role"
        )
        with self.driver.session() as session:
            session.run(query, agent_id=agent_id, role=role)

    def add_relationship(self, agent_id: str, rel_type: str, node_type: str, target_name: str):
        # Sanitize rel_type to protect cypher query injection (internal parameters only)
        if rel_type not in ["ACCESSES", "USES", "CALLS", "CONNECTS_TO"]:
            raise ValueError(f"Invalid relationship type: {rel_type}")
            
        query = (
            f"MERGE (a:Agent {{id: $agent_id}}) "
            f"MERGE (t:{node_type} {{name: $target_name}}) "
            f"MERGE (a)-[r:{rel_type}]->(t)"
        )
        with self.driver.session() as session:
            session.run(query, agent_id=agent_id, target_name=target_name)

    def get_agent_profile(self, agent_id: str):
        query = (
            "MATCH (a:Agent {id: $agent_id}) "
            "RETURN a.role as role"
        )
        with self.driver.session() as session:
            res = session.run(query, agent_id=agent_id).single()
            if not res:
                return None
            role = res["role"]

        # Fetch capabilities
        profile = {
            "agent_id": agent_id,
            "role": role,
            "ACCESSES": [],
            "USES": [],
            "CALLS": [],
            "CONNECTS_TO": []
        }
        
        for rel in ["ACCESSES", "USES", "CALLS", "CONNECTS_TO"]:
            q = (
                f"MATCH (a:Agent {{id: $agent_id}})-[:{rel}]->(t) "
                "RETURN t.name as name"
            )
            with self.driver.session() as session:
                records = session.run(q, agent_id=agent_id)
                profile[rel] = [record["name"] for record in records]
                
        return profile

    def get_all_profiles(self):
        query = "MATCH (a:Agent) RETURN a.id as id"
        agent_ids = []
        with self.driver.session() as session:
            records = session.run(query)
            agent_ids = [r["id"] for r in records]
            
        profiles = []
        for aid in agent_ids:
            prof = self.get_agent_profile(aid)
            if prof:
                profiles.append(prof)
        return profiles

    def clear(self):
        query = "MATCH (n) DETACH DELETE n"
        with self.driver.session() as session:
            session.run(query)

    def close(self):
        self.driver.close()


# Singleton driver manager
graph_store = None
try:
    print("[Noctis Graph] Connecting to Neo4j...")
    graph_store = Neo4jGraphStore()
    print("[Noctis Graph] Connected to Neo4j successfully.")
except Exception as e:
    print(f"[Noctis Graph] Neo4j connection failed: {e}. Falling back to In-Memory Graph Store.")
    graph_store = InMemGraphStore()
