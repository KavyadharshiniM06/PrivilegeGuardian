import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Generate() {

    const [reportName, setReportName] = useState('');
    const [generatedBy, setGeneratedBy] = useState('');
    const [reportType, setReportType] = useState('');
    const [status, setStatus] = useState('');
    const [date, setDate] = useState('');

    const navigate = useNavigate();

    async function handleclick(e) {
        e.preventDefault();

        try {
            if (!reportName || !generatedBy || !date || !reportType || !status) {
    alert("All fields are required");
    return;
}
            const res = await fetch('http://localhost:4000/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportName,
                    generatedBy,
                    date,
                    reportType,
                    status
                })
            });

            if (res.ok) {
                alert('Report generated successfully');
                navigate('/compliancereport');
            } else {
                alert('Failed to generate report');
            }

        } catch (err) {
            alert('Error generating report: ' + err.message);
        }
    }

    return (
        <div>
            <form onSubmit={handleclick}>

                <input
                    type="text"
                    placeholder="enter report name"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                />

                <select value={generatedBy} onChange={(e) => setGeneratedBy(e.target.value)}>
                    <option value="">who generated</option>
                    <option value="auditor">auditor</option>
                    <option value="admin">admin</option>
                </select>

               
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                />

                <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                    <option value="">report type</option>
                    <option value="access-review">access review</option>
                    <option value="policy-violation">policy violation</option>
                </select>

                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">status</option>
                    <option value="pending">pending</option>
                    <option value="completed">completed</option>
                </select>

                <button type="submit">generate</button>
            </form>
        </div>
    );
}