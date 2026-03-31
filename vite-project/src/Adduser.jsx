import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Adduser() {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("");

    const navigate = useNavigate();   // ✅ Correct place

    async function handleclick(e) {
        e.preventDefault();

        try {
            const res = await fetch("http://localhost:4000/api/adduser", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password, role })
            });

            const data = await res.json();

            if (res.ok) {
                alert("User added successfully");
                navigate("/audit");   // ✅ Works properly now
            } else {
                alert(data.message || "Failed to add user");
            }

        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    }

    return (
        <form onSubmit={handleclick}>
            <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
            />

            <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />

            <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
            >
                <option value="">Select Role</option>
                <option value="admin">Admin</option>
                <option value="auditor">Auditor</option>
            </select>

            <button type="submit">Add User</button>
        </form>
    );
}