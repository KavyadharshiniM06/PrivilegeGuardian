import react from 'react';
import './Simulation.css'
import {useNavigate} from 'react-router-dom';
export default function Simulation()
{
    const Navigate=useNavigate();
   return (
    <>
    <div className='container'>
        <div class='admin'>
            <h2>Privelge Gaurdian</h2>
      <ul>
        <li>Dashboard</li>
        <li>User Management</li>
        <li>Simulation</li>
        <li>AI Insights</li>
        <li>Settings</li>
      </ul>
      </div>
      <div className='container2'>
        <h2>Attack Simulation</h2>
        <div className='card'>
            <h3>Attack simulation </h3>
            <ul>
                <li>Privelge Esclation Attemp</li>
                <li>Brute Force Attack</li>
                <li>Unauthorised Data Acess</li>
                <li>Role Abuse Simulation</li>
                <li>Lateral Movement Attempt</li>
            </ul>
        </div>
        <div className='card'>
            <h2>Configuration Panel</h2>
            <ul>
                <input type="text" placeholder="Target User">
                </input>
                <input type="text" placeholder="Target Resource">
                </input>
                <input type="text" placeholder="Attack Intensity">
                </input>
                <input type="date" placeholder="Duration">
                </input>
                <button>start</button>
            </ul>
        </div>
        <div className='card'>
            <h2>Simulation Activity</h2>
            <p>Event Generated:124</p>
            <p>Failed Attempts 24 </p>
            <p>Alert Triggered:3</p>
            <p>Policy Voilation:High</p>
        </div>
        <div className='card'>
            <h2>Analysis</h2>
            <p>Detection Time:4s</p>
            <p>Control Triggered:MFA control</p>
            <p>Compliance Report</p>
            <button onClick={()=>Navigate('/generate')}>Generate Report</button>
        </div>
      </div>
    </div>
    </>
   ) 
}