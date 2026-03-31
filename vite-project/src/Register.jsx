import './Login.css';
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Register() {

    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const[role,setRole]=useState("");
    async function handleRegister(e) {
        e.preventDefault();

       

        try {
            const res = await fetch("http://localhost:4000/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password,role })
            });

            const data = await res.json();

            if (res.ok) {
                alert("Registration successful!");
                navigate("/");
            } else {
                alert(data.message || "Registration failed");
            }

        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    }

    return (
        <>
            <h1>Privilege<span>Guardian</span></h1>

            <form onSubmit={handleRegister}>

                <input 
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input 
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />


                <select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="">Select Role</option>
                    <option value="admin">Admin</option>
                    <option value="attacker">Attacker</option>
                    <option value="user">Auditor</option>
                </select>

                <button type="submit">Register</button>

            </form>
        </>
    );
}
