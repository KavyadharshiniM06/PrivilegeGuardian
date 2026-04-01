import { useState } from "react";
import { useNavigate } from "react-router-dom";
import './AuditLogs.css';

export default function ReportDownload() {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(null);

  const downloadReport = async (reportType) => {
    setDownloading(reportType);
    try {
      const endpoint = `http://localhost:4000/api/report/${reportType}`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to download report: ${response.statusText}`);
      }

      // Determine file extension based on report type
      let filename = `report_${new Date().toISOString().split('T')[0]}`;
      let fileType = 'application/octet-stream';

      if (reportType === 'summary-pdf') {
        filename += '.pdf';
        fileType = 'application/pdf';
      } else if (reportType === 'events-csv' || reportType === 'alerts-csv' || reportType === 'user-risk-csv') {
        filename += '.csv';
        fileType = 'text/csv';
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: fileType }));
      const downloadUrl = document.createElement('a');
      downloadUrl.href = url;
      downloadUrl.download = filename;
      document.body.appendChild(downloadUrl);
      downloadUrl.click();
      downloadUrl.remove();
      window.URL.revokeObjectURL(url);

      alert(`${reportType} downloaded successfully!`);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Error downloading report: ${error.message}`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="admin-container">
      <div className="sidebar">
        <h2>Privilege Guardian</h2>
        <ul>
          <li onClick={() => navigate('/admin')}>Dashboard</li>
          <li onClick={() => navigate('/audit')}>User Management</li>
          <li onClick={() => navigate('/compliancereport')}>Compliance</li>
          <li onClick={() => navigate('/manage-logs')}>Manage Logs</li>
          <li>Reports</li>
        </ul>
      </div>

      <div className="main-content">
        <div className="top-bar">
          <h1>Download Security Reports</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', margin: '30px 0' }}>
          
          {/* PDF Report */}
          <div className='card' style={{ padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3>📄 Summary PDF Report</h3>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Executive summary with key metrics, top users, and recent critical alerts
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button
                onClick={() => downloadReport('summary-pdf')}
                disabled={downloading !== null}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  opacity: downloading ? 0.6 : 1
                }}
              >
                {downloading === 'summary-pdf' ? '⏳ Generating...' : '⬇️ Download PDF'}
              </button>
            </div>
          </div>

          {/* Events CSV */}
          <div className='card' style={{ padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3>📊 Events CSV Report</h3>
            <p style={{ fontSize: '14px', color: '#666' }}>
              All security events in CSV format for analysis
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button
                onClick={() => downloadReport('events-csv')}
                disabled={downloading !== null}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  opacity: downloading ? 0.6 : 1
                }}
              >
                {downloading === 'events-csv' ? '⏳ Generating...' : '⬇️ Download CSV'}
              </button>
            </div>
          </div>

          {/* Alerts CSV */}
          <div className='card' style={{ padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3>🚨 Alerts CSV Report</h3>
            <p style={{ fontSize: '14px', color: '#666' }}>
              All security alerts with severity levels and details
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button
                onClick={() => downloadReport('alerts-csv')}
                disabled={downloading !== null}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  opacity: downloading ? 0.6 : 1
                }}
              >
                {downloading === 'alerts-csv' ? '⏳ Generating...' : '⬇️ Download CSV'}
              </button>
            </div>
          </div>

          {/* User Risk CSV */}
          <div className='card' style={{ padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3>👥 User Risk CSV Report</h3>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Per-user risk breakdown with event counts and alert metrics
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button
                onClick={() => downloadReport('user-risk-csv')}
                disabled={downloading !== null}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#9C27B0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  opacity: downloading ? 0.6 : 1
                }}
              >
                {downloading === 'user-risk-csv' ? '⏳ Generating...' : '⬇️ Download CSV'}
              </button>
            </div>
          </div>

        </div>

        <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <h3>📋 Report Types</h3>
          <ul style={{ lineHeight: '2' }}>
            <li><strong>Summary PDF:</strong> Executive-level report with key metrics and analysis</li>
            <li><strong>Events CSV:</strong> Detailed log of all security events for spreadsheet analysis</li>
            <li><strong>Alerts CSV:</strong> All generated security alerts with severity and context</li>
            <li><strong>User Risk CSV:</strong> Risk profile for each user including event counts and alert frequency</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
