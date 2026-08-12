import React, { useState } from 'react';
import Simulation from './simulation/Simulation.jsx';
import Dashboard from './dashboard/Dashboard.jsx';

export default function App() {
  // Default view to the Security Dashboard
  const [view, setView] = useState('noctis'); 

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Shell Navigation Header */}
      <header className="topbar" style={{ flexShrink: 0 }}>
        <div className="brand">
          <div className="logo-mark" style={{ background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' }}>N</div>
          <div>
            <strong>NOCTIS SECURITY</strong>
            <small>Shadow AI Discover & Compliance Auditor</small>
          </div>
        </div>
        <nav className="view-switch" aria-label="Demo surfaces">
          <button 
            className={view === 'noctis' ? 'active' : ''} 
            onClick={() => setView('noctis')}
          >
            🛡️ Security Dashboard
          </button>
          <button 
            className={view === 'enterprise' ? 'active' : ''} 
            onClick={() => setView('enterprise')}
          >
            💻 Enterprise Simulation
          </button>
        </nav>
      </header>

      {/* Surface Viewport Container */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'noctis' ? <Dashboard /> : <Simulation />}
      </div>
    </div>
  );
}
