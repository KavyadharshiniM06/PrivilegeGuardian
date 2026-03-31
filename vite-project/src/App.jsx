import { Routes, Route } from "react-router-dom"; 
import Admin from './Admin.jsx';
import Attacker from './Attacker.jsx';
import Login from "./Login.jsx";
import Register from "./Register.jsx";
import Auditor from './Auditor.jsx'
import Dashboard from './Dashboard.jsx';
import Adduser from './Adduser.jsx';
import Audit from './AuditLogs.jsx'
import Generate from './Generate.jsx';
import ComplianceReport from "./ComplianceReport.jsx";
import Attack from './Simulation.jsx';
import ManageLogs from './ManageLogs.jsx';
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login/>} />
      <Route path="/register" element={<Register />} />
      <Route path="/auditor" element={<Auditor />} />
      <Route path='/admin' element={<Admin/>}/>
      <Route path='/Attacker' element={<Attacker/>}/>
      <Route path='/dashboard' element={<Dashboard/>}/>
      <Route path='/audit' element={<Audit/>}/>
      <Route path='/adduser' element={<Adduser/>}/>
      <Route path='/generate' element={<Generate/>}/>
      <Route path='/compliancereport' element={<ComplianceReport/>}/>
      <Route path='/attack' element={<Attack/>}/>
      <Route path='/manage-logs' element={<ManageLogs/>}/>
    </Routes>
  );
}

