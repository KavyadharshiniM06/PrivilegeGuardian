/**
 * PrivilegeGuardian - Real-time auditd Shipper
 * Run with: sudo node shipper.js <YOUR_ADMIN_JWT_TOKEN>
 */
const fs = require('fs');
const axios = require('axios'); // Install with: npm install axios
const { exec } = require('child_process');

const API_URL = 'http://localhost:4000/api/events/ingest';
const LOG_FILE = '/var/log/audit/audit.log';
const TOKEN = process.argv[2];

if (!TOKEN) {
    console.error("❌ Error: Please provide your Admin JWT token.");
    console.log("Usage: sudo node shipper.js YOUR_TOKEN_HERE");
    process.exit(1);
}

console.log(`🚀 Shipper started. Monitoring ${LOG_FILE}...`);

// Function to parse raw auditd lines into JSON
function parseAuditLine(line) {
    // Extracting basic fields using Regex
    const typeMatch = line.match(/type=([A-Z_]+)/);
    const commMatch = line.match(/comm="([^"]+)"/);
    const exeMatch  = line.match(/exe="([^"]+)"/);
    const resMatch  = line.match(/res=([a-z]+)/);
    const auidMatch = line.match(/auid=([0-9]+)/);

    if (!typeMatch) return null;

    // Map auditd terminology to your SIEM terminology
    return {
        username: auidMatch && auidMatch[1] === '0' ? 'root' : `user_${auidMatch ? auidMatch[1] : 'unknown'}`,
        action: typeMatch[1].toLowerCase(),
        file: exeMatch ? exeMatch[1] : (commMatch ? commMatch[1] : 'system_process'),
        status: resMatch && resMatch[1] === 'success' ? 'allowed' : 'denied',
        time: new Date().toISOString()
    };
}

// Tail the file live using the 'tail' command
const tail = exec(`tail -F ${LOG_FILE}`);

tail.stdout.on('data', async (data) => {
    const lines = data.split('\n');
    
    for (const line of lines) {
        if (!line.trim()) continue;

        const formattedEvent = parseAuditLine(line);
        if (formattedEvent) {
            try {
                await axios.post(API_URL, formattedEvent, {
                    headers: { 'Authorization': `Bearer ${TOKEN}` }
                });
                console.log(`✅ Ingested: ${formattedEvent.action} by ${formattedEvent.username}`);
            } catch (err) {
                console.error(`❌ Ingest failed: ${err.response?.data?.error || err.message}`);
            }
        }
    }
});

tail.stderr.on('data', (data) => {
    console.error(`Tail error: ${data}`);
});
