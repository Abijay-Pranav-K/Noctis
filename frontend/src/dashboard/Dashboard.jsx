import React, { useState, useEffect } from 'react';

export default function Dashboard() {
  // --- Authentication State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('security.ops@yourcompany.com');
  const [password, setPassword] = useState('password123');
  const [selectedRole, setSelectedRole] = useState('Lead Security Operations Analyst');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStep, setAuthStep] = useState('');

  // --- Dashboard Data State ---
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [agentDetails, setAgentDetails] = useState(null);
  const [allFindings, setAllFindings] = useState([]);
  const [previousFindingIds, setPreviousFindingIds] = useState(new Set());
  const [newlyAddedFindingIds, setNewlyAddedFindingIds] = useState(new Set());
  const [expandedFindingId, setExpandedFindingId] = useState(null);
  const [dbStatus, setDbStatus] = useState('Checking...');
  const [graphStatus, setGraphStatus] = useState('Checking...');

  // 1. Poll for general agent lists and all findings every 3 seconds (only if logged in)
  useEffect(() => {
    if (!isLoggedIn) return;
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // 2. Fetch specific agent details when selected
  useEffect(() => {
    if (isLoggedIn && selectedAgentId) {
      fetchAgentDetails(selectedAgentId);
    } else {
      setAgentDetails(null);
    }
  }, [selectedAgentId, isLoggedIn]);

  const handleLogin = (e) => {
    e.preventDefault();
    setIsAuthenticating(true);
    
    // Simulate high-tech security authentication stages
    setAuthStep('Connecting to Identity Gateway...');
    setTimeout(() => {
      setAuthStep('Verifying security token keys...');
      setTimeout(() => {
        setAuthStep('Decrypting Operations Center workspace...');
        setTimeout(() => {
          setIsLoggedIn(true);
          setIsAuthenticating(false);
          setAuthStep('');
        }, 800);
      }, 800);
    }, 800);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedAgentId(null);
    setAgentDetails(null);
  };

  const fetchData = async () => {
    try {
      // Fetch agents
      const agentsRes = await fetch('http://localhost:8000/noctis/agents');
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData);
        
        // Auto-select first agent if none is selected
        if (agentsData.length > 0 && !selectedAgentId) {
          setSelectedAgentId(agentsData[0].agent_id);
        }
      }

      // Fetch all findings for flash detection
      const findingsRes = await fetch('http://localhost:8000/noctis/findings');
      if (findingsRes.ok) {
        const findingsData = await findingsRes.json();
        setAllFindings(findingsData);

        // Compute newly added findings for highlight animation
        const currentIds = new Set(findingsData.map(f => f.id));
        if (previousFindingIds.size > 0) {
          const newIds = new Set();
          for (let id of currentIds) {
            if (!previousFindingIds.has(id)) {
              newIds.add(id);
            }
          }
          if (newIds.size > 0) {
            setNewlyAddedFindingIds(newIds);
            // Clear the highlighted animation class after 3s
            setTimeout(() => {
              setNewlyAddedFindingIds(new Set());
            }, 3000);
          }
        }
        setPreviousFindingIds(currentIds);
      }

      // Fetch database connection health status
      try {
        const healthRes = await fetch('http://localhost:8000/noctis/health');
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setDbStatus(`${healthData.database} (${healthData.db_file})`);
          setGraphStatus(healthData.graph_store);
        }
      } catch (err) {
        setDbStatus('Disconnected');
        setGraphStatus('Error connecting to backend');
      }

    } catch (e) {
      console.error("Error polling dashboard data", e);
    }
  };

  const fetchAgentDetails = async (agentId) => {
    try {
      const res = await fetch(`http://localhost:8000/noctis/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgentDetails(data);
      }
    } catch (e) {
      console.error("Error fetching agent details", e);
    }
  };

  const handleRecommendAction = async (findingId) => {
    try {
      const res = await fetch(`http://localhost:8000/noctis/findings/${findingId}/review`, {
        method: 'POST'
      });
      if (res.ok) {
        // Refresh findings and active agent details
        fetchData();
        if (selectedAgentId) {
          fetchAgentDetails(selectedAgentId);
        }
      }
    } catch (e) {
      console.error("Error recommending action", e);
    }
  };

  const getRiskClass = (level) => {
    if (level === "High") return "badge-high";
    if (level === "Medium") return "badge-medium";
    return "badge-low";
  };

  // --- RENDER LOGIN VIEW ---
  if (!isLoggedIn) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'calc(100vh - 64px)',
        background: 'radial-gradient(circle at center, #121824 0%, #07090e 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background cybersecurity design elements */}
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)', filter: 'blur(40px)' }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)', filter: 'blur(40px)' }}></div>
        
        <div className="card" style={{
          width: '420px',
          padding: '30px',
          background: 'rgba(18, 22, 32, 0.65)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          zIndex: 5
        }}>
          {isAuthenticating ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', gap: '20px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '3px solid rgba(6, 182, 212, 0.1)',
                borderTop: '3px solid var(--accent-cyan)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {authStep}
              </span>
            </div>
          ) : (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '10px', marginBottom: '12px', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <h1 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '0.5px' }}>Identity Gateway</h1>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Noctis Security Control Center Access Portal</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Security Email</label>
                <input 
                  type="email" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required
                  style={{ padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '13px' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required
                  style={{ padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '13px' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Assigned Security Role</label>
                <select 
                  value={selectedRole} 
                  onChange={(e) => setSelectedRole(e.target.value)} 
                  style={{ padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '13px', cursor: 'pointer' }}
                >
                  <option value="Lead Security Operations Analyst">Lead Security Operations Analyst</option>
                  <option value="CISO / Chief Security Officer">CISO / Chief Security Officer</option>
                  <option value="Security Compliance Auditor">Security Compliance Auditor</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '10px' }}>
                Authenticate & Access Gate
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER SECURE DASHBOARD VIEW ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      
      {/* Session Banner */}
      <div style={{
        background: 'rgba(18, 22, 32, 0.5)',
        borderBottom: '1px solid var(--border-color)',
        padding: '8px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }}></span>
            <span>Logged in as: <strong style={{ color: 'white' }}>{username}</strong> ({selectedRole})</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
            <span style={{ color: 'var(--text-muted)' }}>DB Connection:</span>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>{dbStatus}</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Graph Engine:</span>
            <span style={{ color: 'var(--accent-purple)', fontWeight: '600' }}>{graphStatus}</span>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--risk-high)',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          Sign Out
        </button>
      </div>

      <div className="grid-3" style={{ flex: 1, height: 'auto', padding: '15px' }}>
        {/* COLUMN 1: Agent List */}
        <div className="panel-col">
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>Discovered Agents</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              AI agents identified interacting with corporate assets.
            </p>
            
            <div className="panel-body">
              {agents.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px', fontSize: '14px' }}>
                  No agents discovered yet.
                </div>
              ) : (
                agents.map((agent) => (
                  <div 
                    key={agent.agent_id}
                    className="card"
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      background: selectedAgentId === agent.agent_id ? 'rgba(139, 92, 246, 0.08)' : 'rgba(18,22,32,0.4)',
                      borderColor: selectedAgentId === agent.agent_id ? 'var(--accent-purple)' : 'var(--border-color)'
                    }}
                    onClick={() => setSelectedAgentId(agent.agent_id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
                        {agent.agent_id}
                      </span>
                      <span className={`badge ${getRiskClass(agent.risk_level)}`}>
                        {agent.risk_level}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {agent.role}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>
                      Active: {new Date(agent.last_active).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: Agent Detail / Capability Graph Visualization */}
        <div className="panel-col">
          {agentDetails ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', overflow: 'hidden' }}>
              
              {/* Capability Graph Store Vis */}
              <div className="card" style={{ flex: 1.2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '2px' }}>
                  Graph Profile: {agentDetails.profile.agent_id}
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                  Live capability graph built dynamically from agent logs. Shows active permissions.
                </p>
                
                {/* Graphical Relationship Nodes Visualizer - Fixed Grid Flow */}
                <div style={{ 
                  flex: 1, 
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 110px 1.4fr',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px', 
                  background: '#070a0f', 
                  border: '1px solid var(--border-color)',
                  alignItems: 'center',
                  overflow: 'hidden',
                  minHeight: '200px'
                }}>
                  {/* Left Column: Data Accessed */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', justifyContent: 'center', overflow: 'hidden' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACCESSES DATA</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
                      {agentDetails.profile.ACCESSES.length === 0 ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No database accesses</span>
                      ) : (
                        agentDetails.profile.ACCESSES.map((d, idx) => (
                          <span key={idx} style={{ padding: '5px 8px', background: 'rgba(6, 182, 212, 0.06)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '5px', fontSize: '11px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            💾 {d}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Center Column: The Agent Node */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'linear-gradient(90deg, rgba(6,182,212,0.2) 0%, rgba(139,92,246,0.2) 100%)', zIndex: 1 }}></div>
                    
                    <div style={{
                      background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
                      border: '2px solid rgba(255,255,255,0.8)',
                      borderRadius: '50%',
                      width: '76px',
                      height: '76px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)',
                      zIndex: 2,
                      textAlign: 'center',
                      padding: '6px'
                    }}>
                      <span style={{ fontSize: '8px', fontWeight: '700', color: 'white', letterSpacing: '0.5px' }}>AGENT</span>
                      <span style={{ fontSize: '9px', color: 'white', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '64px', fontFamily: 'var(--font-mono)' }}>
                        {agentDetails.profile.agent_id}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Uses, Calls, Connects */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', justifyContent: 'center', overflowY: 'auto', paddingRight: '2px' }}>
                    {/* Tools */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>USES TOOL</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {agentDetails.profile.USES.length === 0 ? (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                        ) : (
                          agentDetails.profile.USES.map((t, idx) => (
                            <span key={idx} style={{ padding: '3px 6px', background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '4px', fontSize: '10px', fontWeight: '500' }}>
                              🛠️ {t}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* APIs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CALLS API</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {agentDetails.profile.CALLS.length === 0 ? (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                        ) : (
                          agentDetails.profile.CALLS.map((a, idx) => (
                            <span key={idx} style={{ padding: '3px 6px', background: 'rgba(236, 72, 153, 0.06)', border: '1px solid rgba(236, 72, 153, 0.2)', borderRadius: '4px', fontSize: '10px', fontWeight: '500' }}>
                              🔌 {a}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Systems */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CONNECTS TO SYSTEM</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {agentDetails.profile.CONNECTS_TO.length === 0 ? (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                        ) : (
                          agentDetails.profile.CONNECTS_TO.map((s, idx) => (
                            <span key={idx} style={{ padding: '3px 6px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '4px', fontSize: '10px', fontWeight: '500' }}>
                              🖥️ {s}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
  
              {/* Agent Timeline */}
              <div className="card" style={{ flex: 0.8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Agent Activity Timeline</h3>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {agentDetails.timeline.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No recorded operations.</span>
                  ) : (
                    agentDetails.timeline.map((evt) => (
                      <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {evt.event_type.toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {JSON.stringify(evt.payload)}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
            </div>
          ) : (
            <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select an agent to view capability profiles.
            </div>
          )}
        </div>

        {/* COLUMN 3: Active Findings and Remediation */}
        <div className="panel-col">
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>Active Risk Findings</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Permission scope violations and agent manipulations flagged by the pipeline.
            </p>
  
            <div className="panel-body">
              {allFindings.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px', fontSize: '14px' }}>
                  All systems quiet. No active findings.
                </div>
              ) : (
                allFindings.map((finding) => {
                  const isNew = newlyAddedFindingIds.has(finding.id);
                  const isExpanded = expandedFindingId === finding.id;
                  
                  return (
                    <div 
                      key={finding.id}
                      className={`card ${isNew ? 'flash-highlight' : ''}`}
                      onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        cursor: 'pointer',
                        borderColor: isExpanded ? 'var(--accent-purple)' : 'var(--border-color)',
                        transition: 'all 0.2s ease',
                        background: isExpanded ? 'rgba(139, 92, 246, 0.03)' : 'rgba(18, 22, 32, 0.4)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700', fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'white' }}>
                            {finding.agent_id}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {new Date(finding.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`badge ${getRiskClass(finding.risk_level)}`}>
                            {finding.risk_level}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                        <strong>Risk Details:</strong> {finding.explanation}
                      </div>

                      {/* Expandable Security Inspection Suite */}
                      {isExpanded && (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '10px', 
                          paddingTop: '8px', 
                          marginTop: '4px',
                          borderTop: '1px dashed var(--border-color)' 
                        }}>
                          {/* 1. Risk Score Gauge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '90px' }}>Risk Score:</span>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${finding.risk_score || 25}%`,
                                height: '100%',
                                background: finding.risk_level === 'High' ? 'var(--risk-high)' : finding.risk_level === 'Medium' ? 'var(--risk-medium)' : 'var(--risk-low)',
                                boxShadow: '0 0 6px currentColor'
                              }}></div>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: finding.risk_level === 'High' ? 'var(--risk-high)' : finding.risk_level === 'Medium' ? 'var(--risk-medium)' : 'var(--risk-low)', width: '45px', textAlign: 'right' }}>
                              {finding.risk_score || 25}/100
                            </span>
                          </div>

                          {/* 2. Execution Authority */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--text-secondary)', width: '90px' }}>Execution Type:</span>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '600',
                              background: finding.execution_type?.includes('Hijack') ? 'rgba(236, 72, 153, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                              color: finding.execution_type?.includes('Hijack') ? 'var(--accent-pink)' : 'var(--accent-purple)',
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                              {finding.execution_type || 'Autonomous AI Agent'}
                            </span>
                          </div>

                          {/* 3. Compromised Corporate Asset Scope */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Affected Corporate Scope:</span>
                            <span style={{
                              padding: '6px 10px',
                              background: 'rgba(6, 182, 212, 0.04)',
                              border: '1px solid rgba(6, 182, 212, 0.15)',
                              borderRadius: '5px',
                              fontSize: '11px',
                              color: 'var(--accent-cyan)',
                              fontFamily: 'var(--font-mono)',
                              wordBreak: 'break-all'
                            }}>
                              💾 {finding.affected_data || 'General corporate logs'}
                            </span>
                          </div>

                          {/* Associated Transaction History */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Associated Transaction History:</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {agentDetails?.timeline?.filter(evt => finding.events_involved.includes(evt.id)).map((evt, idx) => (
                                <div key={idx} style={{
                                  padding: '6px 8px',
                                  background: 'rgba(255,255,255,0.01)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '5px',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '10px'
                                }}>
                                  <span style={{ color: 'var(--accent-cyan)' }}>[{new Date(evt.timestamp).toLocaleTimeString()}] {evt.event_type.toUpperCase()}</span>
                                  <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                    {JSON.stringify(evt.payload)}
                                  </div>
                                </div>
                              ))}
                              {(!agentDetails?.timeline || agentDetails.timeline.filter(evt => finding.events_involved.includes(evt.id)).length === 0) && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Timeline traces archived or loading...</span>
                              )}
                            </div>
                          </div>

                          {/* 4. Action / Mitigation Log */}
                          {finding.status !== "Active" && finding.audit_log && (() => {
                            try {
                              const audit = typeof finding.audit_log === 'string' ? JSON.parse(finding.audit_log) : finding.audit_log;
                              return (
                                <div style={{
                                  padding: '8px',
                                  background: 'rgba(16, 185, 129, 0.03)',
                                  border: '1px solid rgba(16, 185, 129, 0.2)',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  color: 'var(--risk-low)'
                                }}>
                                  <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                    🛡️ Remediation Efficacy Verified
                                  </div>
                                  <div><strong>Audited By:</strong> {audit.reviewer}</div>
                                  <div><strong>Role:</strong> {audit.role}</div>
                                  <div><strong>Enforced at:</strong> {new Date(audit.timestamp).toLocaleString()}</div>
                                  <div style={{ marginTop: '5px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px', fontStyle: 'italic' }}>
                                    "{audit.remediation_status}"
                                  </div>
                                </div>
                              );
                            } catch(err) {
                              return null;
                            }
                          })()}
                        </div>
                      )}
  
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', borderLeft: '2px solid var(--accent-cyan)' }}>
                        <strong>Recommendation:</strong> {finding.recommendation}
                      </div>
  
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Status: <span className={finding.status === "Active" ? "badge-status-active" : "badge-status-reviewed"} style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: '700' }}>{finding.status}</span>
                        </span>
                        
                        {finding.status === "Active" && (
                          <button 
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px' }}
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent card collapse/expand on button click
                              handleRecommendAction(finding.id);
                              setExpandedFindingId(finding.id); // Auto-expand showing audited log details
                            }}
                          >
                            Recommend Action
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
