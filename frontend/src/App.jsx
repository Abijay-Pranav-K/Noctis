import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Simulation from './simulation/Simulation';
import Dashboard from './dashboard/Dashboard';

function Header() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-icon">N</div>
        <div className="brand-name">NOCTIS <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: '500' }}>// Agent Risk Platform</span></div>
      </div>
      <nav className="nav-links">
        <Link 
          to="/simulation" 
          className={`nav-link ${currentPath === '/simulation' ? 'active' : ''}`}
        >
          Corporate Simulation
        </Link>
        <Link 
          to="/dashboard" 
          className={`nav-link ${currentPath === '/dashboard' ? 'active' : ''}`}
        >
          Noctis Dashboard
        </Link>
      </nav>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>STATUS:</span>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>SECURE PIPELINE</span>
      </div>
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="app-container">
        <Header />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
