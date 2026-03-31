import './Login.css';
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {

    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    async function handleclick(e) {
        e.preventDefault();

        try {
            const res = await fetch("http://localhost:4000/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok) {
                const userRole = data.user.role?.toLowerCase();

if (userRole === "admin") {
    navigate("/admin");
} else if (userRole === "auditor") {
    navigate("/auditor");
}
else{
    navigate("/dashboard");
}
               
            } 
            else {
                alert(data.error || "Login failed");
            }

        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    }

    return (
        <>
            <h1>Privilege<span>Guardian</span> </h1>
            <form onSubmit={handleclick}>
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

                <button type="submit">Login</button>

                <button 
                    type="button"
                    onClick={() => navigate("/register")}
                >
                    Not registered?
                </button>
            </form>
        </>
    );
}
