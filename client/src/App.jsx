// =============================================
// Family Guardian - React App Entry Point
// =============================================
// This is the root component of our React app.
// For now, it's a simple placeholder that proves
// the frontend is running and can talk to the API.
// =============================================

import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [apiStatus, setApiStatus] = useState('checking...');

  // useEffect runs once when the component mounts (loads).
  // We use it to ping our backend health endpoint.
  useEffect(() => {
    fetch('http://localhost:5000/api/health')
      .then(res => res.json())
      .then(data => setApiStatus(data.status))
      .catch(() => setApiStatus('offline'));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🛡️ Family Guardian</h1>
        <p>AI-assisted payment protection for elderly users</p>
        <div className="status-badge">
          API Status: <span className={apiStatus === 'ok' ? 'status-ok' : 'status-err'}>
            {apiStatus}
          </span>
        </div>
      </header>
    </div>
  );
}

export default App;
