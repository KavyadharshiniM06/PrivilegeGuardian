import { useNavigate } from "react-router-dom";
import './AuditLogs.css';
import { useState,useEffect } from "react";
export default function AuditLogs() {
  const navigate = useNavigate();
const [users, setUsers] = useState([]);

useEffect(() => {
   fetch("http://localhost:4000/api/users")
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.log(err));
}, []);
  return (
    <div className="admin-container">


      <div className="sidebar">
        <h2>Privilege Guardian</h2>
        <ul>
          <li>Dashboard</li>
          <li>Audit Logs</li>
          <li>Policy Reports</li>
          <li>Settings</li>
        </ul>
      </div>

      <div className="main-content">

        <div className="top-bar">
          <h1>User Management</h1>
          <button onClick={() => navigate("/adduser")}>
            Add Users
          </button>
        </div>

        <div className="stats-cards">
          <div className="card-box">
            <h3>Total Events</h3>
            <p>1500</p>
          </div>
          <div className="card-box">
            <h3>Critical Events</h3>
            <p>200</p>
          </div>
          <div className="card-box">
            <h3>Failed Logins</h3>
            <p>50</p>
          </div>
          <div className="card-box">
            <h3>Privilege Changes</h3>
            <p>30</p>
          </div>
        </div>

        <div className="filters">
          <input type="text" placeholder="Search logs..." />

          <select>
            <option>All roles</option>
            <option>Admin</option>
            <option>User</option>
          </select>

          <select>
            <option>All departments</option>
            <option>IT</option>
            <option>HR</option>
          </select>

          <select>
            <option>All statuses</option>
            <option>Success</option>
            <option>Failure</option>
          </select>
        </div>

        <div className="table-section">
          <h2>User Logs</h2>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.username}</td>
                  <td>{user.role}</td>
                  <td>{user.department || "IT"}</td>
                  <td>Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}