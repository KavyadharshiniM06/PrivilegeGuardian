import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
export default function Dashboard() {
      const Navigate=useNavigate();
    return (
        <div className="admin-container">
     
            <div className="admin">
                <h2>Privilege Guardian</h2>
                <ul>
                    <li>Dashboard</li>
                    <li onClick={()=>Navigate('/compliancereport')}>Audit Logs</li>
                    <li>Policy Reports</li>
                    <li>Settings</li>
                </ul>
            </div>

         
            <div className="content">

                <div className="card">
                   
                    <div className="risk-score">85%</div>
                    <h3>3 Policies Violated</h3>
                    <h3>Last Audit: 12 Feb 2026</h3>
                </div>

                <div className="card">
               
                    <ul>
                        <li>Unauthorized Access</li>
                        <li>Data Exposure</li>
                        <li>Privilege Escalation</li>
                    </ul>
                </div>

                <div className="card">
                 
                    <ul>
                        <li>6 Role Changes</li>
                        <li>4 Permission Changes</li>
                        <li>2 User Access Changes</li>
                    </ul>
                </div>

                <div className="card">
                    
                    <ul>
                        <li>MFA: Enabled</li>
                        <li>Least Privilege: Partial</li>
                        <li>Monitoring: Active</li>
                        <li>Automated Response: Active</li>
                        <li>Regular Audits: Scheduled</li>
                    </ul>
                </div>

            </div>
        </div>
    );
}