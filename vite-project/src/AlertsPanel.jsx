import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import './AuditLogs.css';

export default function AlertsPanel() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAlerts();
    // Fetch alerts every 5 seconds for real-time updates
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      // In a real app, you'd fetch alerts from a database
      // For now, this is a placeholder for the alerts
      console.log("Checking for new alerts...");
    } catch (err) {
      console.error("Error fetching alerts:", err);
    }
  };

  const testAlert = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/alert/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: `event_${Date.now()}`,
          username: "test_user",
          action: "delete",
          file: "/etc/passwd",
          status: "denied",
          final_risk: 85,
          time: new Date().toISOString()
        })
      });

      const data = await res.json();

      if (data.generated) {
        setAlerts([data.alert, ...alerts]);
        alert("Alert generated!");
      } else {
        alert("No alert generated: " + data.reason);
      }
    } catch (err) {
      console.error(err);
      alert("Error generating test alert");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case "CRITICAL": return "#ff0000";
      case "HIGH": return "#ff6600";
      case "MEDIUM": return "#ffaa00";
      case "LOW": return "#00aa00";
      default: return "#999999";
    }
  };

  return (
    <div className="admin-container">
      <div className="sidebar">
        <h2>Privilege Guardian</h2>
        <ul>
          <li onClick={() => navigate('/admin')}>Dashboard</li>
          <li onClick={() => navigate('/audit')}>User Management</li>
          <li onClick={() => navigate('/manage-logs')}>Manage Logs</li>
          <li>Alerts</li>
        </ul>
      </div>

      <div className="main-content">
        <div className="top-bar">
          <h1>Security Alerts</h1>
          <button onClick={testAlert} disabled={loading}>
            {loading ? "Testing..." : "Test Alert"}
          </button>
        </div>

        <div className="stats-cards">
          <div className="card-box">
            <h3>Critical Alerts</h3>
            <p style={{color: "#ff0000"}}>
              {alerts.filter(a => a.severity === "CRITICAL").length}
            </p>
          </div>
          <div className="card-box">
            <h3>High Alerts</h3>
            <p style={{color: "#ff6600"}}>
              {alerts.filter(a => a.severity === "HIGH").length}
            </p>
          </div>
          <div className="card-box">
            <h3>Medium Alerts</h3>
            <p style={{color: "#ffaa00"}}>
              {alerts.filter(a => a.severity === "MEDIUM").length}
            </p>
          </div>
          <div className="card-box">
            <h3>Total Alerts</h3>
            <p>{alerts.length}</p>
          </div>
        </div>

        <div className="table-section">
          <h2>Alert History</h2>
          {alerts.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Username</th>
                  <th>Action</th>
                  <th>Risk Score</th>
                  <th>Timestamp</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert, idx) => (
                  <tr key={idx} style={{borderLeft: `5px solid ${getSeverityColor(alert.severity)}`}}>
                    <td>
                      <span style={{
                        padding: "5px 10px",
                        backgroundColor: getSeverityColor(alert.severity),
                        color: "white",
                        borderRadius: "3px",
                        fontWeight: "bold"
                      }}>
                        {alert.severity}
                      </span>
                    </td>
                    <td>{alert.username}</td>
                    <td>{alert.action}</td>
                    <td style={{fontWeight: "bold", color: getSeverityColor(alert.severity)}}>
                      {alert.risk_score}/100
                    </td>
                    <td>{new Date(alert.timestamp).toLocaleString()}</td>
                    <td>{alert.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ textAlign: "center", marginTop: "20px" }}>No alerts yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
