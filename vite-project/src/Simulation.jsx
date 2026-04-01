import react, { useState } from 'react';
import './Simulation.css'
import {useNavigate} from 'react-router-dom';

export default function Simulation()
{
    const Navigate = useNavigate();
    const [targetUser, setTargetUser] = useState("");
    const [targetResource, setTargetResource] = useState("");
    const [attackIntensity, setAttackIntensity] = useState("");
    const [duration, setDuration] = useState("");
    
    const [simulationRunning, setSimulationRunning] = useState(false);
    const [riskScore, setRiskScore] = useState(null);
    const [riskBreakdown, setRiskBreakdown] = useState(null);
    const [activity, setActivity] = useState({
        eventsGenerated: 0,
        failedAttempts: 0,
        alertsTriggered: 0,
        policyViolation: "Low"
    });

    async function handleStartSimulation(e) {
        e.preventDefault();

        if (!targetUser || !targetResource || !attackIntensity) {
            alert("Please fill in all fields");
            return;
        }

        setSimulationRunning(true);

        try {
            // Simulate attack based on intensity
            const actionType = attackIntensity === "low" ? "read" : attackIntensity === "medium" ? "write" : "delete";

            const res = await fetch("http://localhost:4000/api/risk/classify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: targetUser,
                    action: actionType,
                    status: "denied",
                    filePath: targetResource
                })
            });

            const data = await res.json();

            if (res.ok) {
                setRiskScore(data.score);
                setRiskBreakdown(data.breakdown);

                // Update activity based on risk score
                setActivity({
                    eventsGenerated: Math.floor(Math.random() * 200) + 50,
                    failedAttempts: Math.floor(Math.random() * 50) + 10,
                    alertsTriggered: data.score > 70 ? Math.floor(Math.random() * 10) + 5 : Math.floor(Math.random() * 3) + 1,
                    policyViolation: data.score > 70 ? "High" : data.score > 40 ? "Medium" : "Low"
                });

                alert(`Simulation Complete!\nRisk Score: ${data.score}/100`);
            } else {
                alert("Simulation failed: " + data.message);
            }

        } catch (err) {
            console.error(err);
            alert("Error running simulation");
        } finally {
            setSimulationRunning(false);
        }
    }

    function getRiskColor(score) {
        if (score > 70) return "#ff4444";
        if (score > 40) return "#ffaa00";
        return "#44aa44";
    }

    return (
        <>
        <div className='container'>
            <div className='admin'>
                <h2>Privilege Guardian</h2>
                <ul>
                    <li onClick={() => Navigate('/admin')}>Dashboard</li>
                    <li onClick={() => Navigate('/audit')}>User Management</li>
                    <li>Simulation</li>
                    <li>AI Insights</li>
                    <li>Settings</li>
                </ul>
            </div>
            <div className='container2'>
                <h2>Attack Simulation</h2>
                <div className='card'>
                    <h3>Attack Types</h3>
                    <ul>
                        <li>Privilege Escalation Attempt</li>
                        <li>Brute Force Attack</li>
                        <li>Unauthorised Data Access</li>
                        <li>Role Abuse Simulation</li>
                        <li>Lateral Movement Attempt</li>
                    </ul>
                </div>
                
                <div className='card'>
                    <h2>Configuration Panel</h2>
                    <form onSubmit={handleStartSimulation}>
                        <input 
                            type="text" 
                            placeholder="Target User"
                            value={targetUser}
                            onChange={(e) => setTargetUser(e.target.value)}
                        />
                        <input 
                            type="text" 
                            placeholder="Target Resource"
                            value={targetResource}
                            onChange={(e) => setTargetResource(e.target.value)}
                        />
                        <select 
                            value={attackIntensity}
                            onChange={(e) => setAttackIntensity(e.target.value)}
                        >
                            <option value="">Select Attack Intensity</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                        <input 
                            type="date"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                        />
                        <button type="submit" disabled={simulationRunning}>
                            {simulationRunning ? "Running..." : "Start Simulation"}
                        </button>
                    </form>
                </div>

                <div className='card'>
                    <h2>Simulation Activity</h2>
                    <p>Events Generated: {activity.eventsGenerated}</p>
                    <p>Failed Attempts: {activity.failedAttempts}</p>
                    <p>Alerts Triggered: {activity.alertsTriggered}</p>
                    <p>Policy Violation: <span style={{color: getRiskColor(riskScore || 0)}}>{activity.policyViolation}</span></p>
                </div>

                {riskScore !== null && (
                    <div className='card'>
                        <h2>Risk Analysis</h2>
                        <p style={{fontSize: "24px", fontWeight: "bold", color: getRiskColor(riskScore)}}>
                            Overall Risk Score: {riskScore}/100
                        </p>
                        {riskBreakdown && (
                            <div style={{fontSize: "14px", marginTop: "10px"}}>
                                <p>Base Action Risk: {riskBreakdown.base_action}</p>
                                <p>Privileged User Risk: {riskBreakdown.privileged_user}</p>
                                <p>Denied Access Risk: {riskBreakdown.denied_access}</p>
                                <p>Sensitive File Risk: {riskBreakdown.sensitive_file}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className='card'>
                    <h2>Generate Report</h2>
                    <p>Detection Time: {simulationRunning ? "Running..." : riskScore ? "0.4s" : "N/A"}</p>
                    <p>Control Triggered: MFA control</p>
                    <button onClick={()=>Navigate('/generate')}>Generate Report</button>
                </div>
            </div>
        </div>
        </>
    ) 
}