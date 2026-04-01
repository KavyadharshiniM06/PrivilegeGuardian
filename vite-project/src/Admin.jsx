import './Admin.css';
import {useNavigate} from 'react-router-dom';
export default function Admin() {
    const navigate = useNavigate();
    return (
        <div className="admin-container">
 
          
            <div className="admin">
                <h2>Privilege Guardian</h2>
                <ul>
                    <li>Dashboard</li>
                    <li onClick={()=>navigate('/audit')}>User Management</li>
                    <li onClick={()=>navigate('/compliancereport')}>Audit Logs</li>
                    <li onClick={()=>navigate('/manage-logs')} style={{color: '#ff6b6b', fontWeight: 'bold'}}>Manage Logs</li>
                    <li onClick={()=>navigate('/alerts')} style={{color: '#ff0000', fontWeight: 'bold'}}>Security Alerts</li>
                    <li onClick={()=>navigate('/reports')} style={{color: '#2196F3', fontWeight: 'bold'}}>Download Reports</li>
                    <li onClick={()=>navigate('/attack')}>Simulation</li>
                    <li>AI Insights</li>
                    <li>Settings</li>
                </ul>
            </div>

          
            <div className="content">

                <div className="card">

                    <div className="risk-score">72</div>
                    <h3>High Risk Detected</h3>
                    <h3>Immediate Action Required</h3>
                </div>

                <div className="card">
                    
                    <ul>
                        <li>Suspicious Login Attempt</li>
                        <li>Privilege Escalation Detected</li>
                        <li>Unusual Activity in User Management</li>
                    </ul>
                </div>

                <div className="card">
                  
                    <ul>
                        <li>User1: Admin → User</li>
                        <li>User2: User → Admin</li>
                        <li>User3: User → User</li>
                    </ul>
                </div>

                <div className="card">
                    <ul>
                        <li>Multi-factor Authentication</li>
                        <li>Least Privilege Enforcement</li>
                        <li>Real-time Monitoring</li>
                        <li>Automated Response</li>
                        <li>Regular Audits</li>
                    </ul>
                </div>

            </div>
        </div>
    );
}