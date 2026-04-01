const User = require('../Models/User.js');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { classifyRisk, combineRisk } = require('../Utils/riskEngine.js');
const { generateAlert, getCooldownStats, clearCooldowns } = require('../Utils/alertEngine.js');
const { detectAnomaly, getUserBaseline, getAllBaselines, resetUserBaseline, resetAllBaselines } = require('../Utils/anomalyEngine.js');
const { generateSummaryPDF, generateEventsCSV, generateAlertsCSV, generateUserRiskCSV } = require('../Utils/reportGenerator.js');
const { storeEvent, storeAlert, getRecentEvents, getRecentAlerts, getHighRiskEvents } = require('../Utils/eventStore.js');
const { handleEvent, parseJsonEvent, parseAuditdEvent } = require('../Utils/eventHandler.js');
const LogWatcher = require('../Utils/logWatcher.js');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const Report = require('../Models/Report.js');

// Global log watcher instance
let logWatcher = null;

router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt - Request body:', req.body);
        const { username, password } = req.body;

        if (!username || !password) {
            console.log('Missing credentials - username:', username, 'password:', password);
            return res.status(400).json({ message: "Please enter all fields" });
        }

        const userfind = await User.findOne({ username });
        if (!userfind) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, userfind.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid password" });
        }

        const token = jwt.sign(
            { id: userfind._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: userfind._id,
                username: userfind.username,
                role: userfind.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});



router.post('/register', async (req, res) => {
    try {
        const { username, password,role } = req.body;

        if (!username || !password||!role) {
            return res.status(400).json({ message: "Please enter all fields" });
        }

        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashpassword = await bcrypt.hash(password, 10);

        const newuser = new User({
            username,
            password: hashpassword,
            role:role
        });

        await newuser.save();

        res.status(201).json({ message: "User registered successfully" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/adduser', async (req, res) => {
    try {
        const { username, password,role } = req.body;
            if (!username || !password||!role) {
                return res.status(400).json({ message: "Please enter all fields" });
            }   
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }       
        const hashpassword = await bcrypt.hash(password, 10);

        const newuser = new User({  
            username,
            password: hashpassword,
            role:role
        });     
        await newuser.save();

        res.status(201).json({ message: "User added successfully" });
    }
        catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    }
    catch(err)
    {
        res.status(500).json({ error: err.message });   
    }
});
router.post('/generate', async (req, res) => {
    try {
        const { reportName, generatedBy, date, reportType, status } = req.body;
        console.log('Request body:', req.body);

        if (!reportName || !generatedBy || !date || !reportType || !status) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const newReport = new Report({
            report: reportName,
            generatedBy,
            date: new Date(date),  
            format: reportType,
            status
        });

        console.log('Report to save:', newReport);
        await newReport.save();

        res.status(201).json({ message: "Report generated successfully" });

    } catch (err) {
        console.error('Error in /generate:', err);  
        res.status(500).json({ error: err.message });
    }
});
router.get('/reports', async (req, res) => {
    try {
        const reports = await Report.find();
        console.log('Reports found:', reports);
        res.json(reports);
    } catch (err) {
        console.error('Error fetching reports:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedReport = await Report.findByIdAndDelete(id);
        
        if (!deletedReport) {
            return res.status(404).json({ message: "Report not found" });
        }
        
        console.log('Report deleted:', id);
        res.status(200).json({ message: "Report deleted successfully" });
    } catch (err) {
        console.error('Error deleting report:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/reports/delete/all', async (req, res) => {
    try {
        const result = await Report.deleteMany({});
        console.log('All reports deleted. Deleted count:', result.deletedCount);
        res.status(200).json({ message: "All reports deleted successfully", deletedCount: result.deletedCount });
    } catch (err) {
        console.error('Error deleting all reports:', err);
        res.status(500).json({ error: err.message });
    }
});

// Risk Engine Endpoints
router.post('/risk/classify', (req, res) => {
    try {
        const { username, action, status, filePath } = req.body;

        if (!username || !action) {
            return res.status(400).json({ message: "username and action are required" });
        }

        const riskResult = classifyRisk(username, action, status || "allowed", filePath || "");
        res.status(200).json(riskResult);

    } catch (err) {
        console.error('Error classifying risk:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/risk/combine', (req, res) => {
    try {
        const { ruleRisk, anomalyScore } = req.body;

        if (ruleRisk === undefined || anomalyScore === undefined) {
            return res.status(400).json({ message: "ruleRisk and anomalyScore are required" });
        }

        const combinedRisk = combineRisk(ruleRisk, anomalyScore);
        res.status(200).json({ 
            combinedRisk,
            ruleRisk,
            anomalyScore
        });

    } catch (err) {
        console.error('Error combining risk:', err);
        res.status(500).json({ error: err.message });
    }
});

// Anomaly Detection Endpoints
router.post('/anomaly/detect', (req, res) => {
    try {
        const event = req.body;

        if (!event.username || !event.action) {
            return res.status(400).json({ message: "username and action are required" });
        }

        const anomalyScore = detectAnomaly(event);
        res.status(200).json({ 
            anomaly_score: anomalyScore,
            username: event.username,
            action: event.action
        });

    } catch (err) {
        console.error('Error detecting anomaly:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/anomaly/baselines/:username', (req, res) => {
    try {
        const { username } = req.params;
        const baseline = getUserBaseline(username);
        res.status(200).json(baseline);

    } catch (err) {
        console.error('Error fetching baseline:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/anomaly/all-baselines', (req, res) => {
    try {
        const baselines = getAllBaselines();
        res.status(200).json(baselines);

    } catch (err) {
        console.error('Error fetching all baselines:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/anomaly/reset/:username', (req, res) => {
    try {
        const { username } = req.params;
        resetUserBaseline(username);
        res.status(200).json({ message: `Baseline reset for user: ${username}` });

    } catch (err) {
        console.error('Error resetting baseline:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/anomaly/reset-all', (req, res) => {
    try {
        resetAllBaselines();
        res.status(200).json({ message: "All baselines reset" });

    } catch (err) {
        console.error('Error resetting all baselines:', err);
        res.status(500).json({ error: err.message });
    }
});

// Alert Engine Endpoints
router.post('/alert/generate', (req, res) => {
    try {
        const event = req.body;

        if (!event.username || event.final_risk === undefined) {
            return res.status(400).json({ message: "username and final_risk are required" });
        }

        const alert = generateAlert(event);

        if (!alert) {
            return res.status(200).json({ alert: null, reason: "Below threshold or in cooldown" });
        }

        res.status(200).json({ alert, generated: true });

    } catch (err) {
        console.error('Error generating alert:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/alert/cooldowns', (req, res) => {
    try {
        const cooldowns = getCooldownStats();
        res.status(200).json(cooldowns);
    } catch (err) {
        console.error('Error fetching cooldowns:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/alert/clear-cooldowns', (req, res) => {
    try {
        clearCooldowns();
        res.status(200).json({ message: "All cooldowns cleared" });
    } catch (err) {
        console.error('Error clearing cooldowns:', err);
        res.status(500).json({ error: err.message });
    }
});

// Report Generation Endpoints
router.get('/report/summary-pdf', async (req, res) => {
    try {
        // Prepare sample data (in production, fetch from database)
        const reports = await Report.find();
        const data = {
            stats: {
                total_events: 1500,
                total_alerts: 45,
                critical_alerts: 12,
                high_alerts: 18,
                denied_events: 156,
                unique_users: 8,
                period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
            },
            top_users: [
                { username: 'admin_user', total_events: 320, avg_risk: 42.5, max_risk: 85, alert_count: 8 },
                { username: 'root', total_events: 280, avg_risk: 38.2, max_risk: 78, alert_count: 6 },
                { username: 'test_user', total_events: 150, avg_risk: 35.1, max_risk: 65, alert_count: 3 }
            ],
            recent_alerts: reports.slice(0, 15).map((r, idx) => ({
                created_at: r.date || new Date().toISOString(),
                username: r.generatedBy || 'unknown',
                severity: idx % 3 === 0 ? 'CRITICAL' : idx % 3 === 1 ? 'HIGH' : 'MEDIUM',
                action: 'delete',
                file: r.report || '/sensitive/file'
            }))
        };

        const pdfPath = path.join(__dirname, '../reports', `report_${Date.now()}.pdf`);
        
        // Create reports directory if it doesn't exist
        const reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        await generateSummaryPDF(data, pdfPath);

        res.download(pdfPath, `PrivilegeGuardian_Report_${new Date().toISOString().split('T')[0]}.pdf`, (err) => {
            if (err) console.error('Download error:', err);
            // Clean up file after download
            setTimeout(() => {
                if (fs.existsSync(pdfPath)) {
                    fs.unlinkSync(pdfPath);
                }
            }, 5000);
        });

    } catch (err) {
        console.error('Error generating PDF report:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/report/events-csv', async (req, res) => {
    try {
        // Sample data (in production, fetch from database)
        const sampleEvents = [
            { event_id: '1', username: 'admin', action: 'write', file: '/etc/config', status: 'allowed', timestamp: new Date() },
            { event_id: '2', username: 'user1', action: 'read', file: '/home/user', status: 'allowed', timestamp: new Date() },
            { event_id: '3', username: 'root', action: 'delete', file: '/sensitive/data', status: 'denied', timestamp: new Date() }
        ];

        const csv = generateEventsCSV(sampleEvents);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="events_${Date.now()}.csv"`);
        res.send(csv);

    } catch (err) {
        console.error('Error generating events CSV:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/report/alerts-csv', async (req, res) => {
    try {
        const reports = await Report.find();
        
        // Convert reports to alerts format
        const alerts = reports.map((r, idx) => ({
            event_id: r._id,
            username: r.generatedBy,
            severity: idx % 3 === 0 ? 'CRITICAL' : idx % 3 === 1 ? 'HIGH' : 'MEDIUM',
            risk_score: Math.floor(Math.random() * 100),
            action: 'audit_action',
            file: r.report,
            status: r.status,
            timestamp: r.date
        }));

        const csv = generateAlertsCSV(alerts);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="alerts_${Date.now()}.csv"`);
        res.send(csv);

    } catch (err) {
        console.error('Error generating alerts CSV:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/report/user-risk-csv', async (req, res) => {
    try {
        // Sample user risk data
        const users = await User.find({}, '-password');
        
        const userRiskData = users.map((u, idx) => ({
            username: u.username,
            role: u.role,
            total_events: Math.floor(Math.random() * 500) + 50,
            avg_risk: (Math.random() * 80).toFixed(1),
            max_risk: (Math.random() * 100).toFixed(1),
            alert_count: Math.floor(Math.random() * 20),
            last_activity: new Date()
        }));

        const csv = generateUserRiskCSV(userRiskData);
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="user_risk_${Date.now()}.csv"`);
        res.send(csv);

    } catch (err) {
        console.error('Error generating user risk CSV:', err);
        res.status(500).json({ error: err.message });
    }
});

// Event Store Endpoints
router.post('/events/store', async (req, res) => {
    try {
        const event = req.body;

        if (!event.username || !event.action) {
            return res.status(400).json({ message: "username and action are required" });
        }

        const eventId = await storeEvent(event);
        res.status(201).json({ 
            message: "Event stored successfully",
            event_id: eventId 
        });

    } catch (err) {
        console.error('Error storing event:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/alerts/store', async (req, res) => {
    try {
        const { event_id, alert } = req.body;

        if (!event_id || !alert) {
            return res.status(400).json({ message: "event_id and alert object are required" });
        }

        const alertId = await storeAlert(event_id, alert);
        res.status(201).json({ 
            message: "Alert stored successfully",
            alert_id: alertId 
        });

    } catch (err) {
        console.error('Error storing alert:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/events/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const events = await getRecentEvents(limit);
        
        res.status(200).json({
            count: events.length,
            events
        });

    } catch (err) {
        console.error('Error fetching recent events:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/alerts/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const alerts = await getRecentAlerts(limit);
        
        res.status(200).json({
            count: alerts.length,
            alerts
        });

    } catch (err) {
        console.error('Error fetching recent alerts:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/events/high-risk', async (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold) || 70;
        const limit = parseInt(req.query.limit) || 50;
        
        const events = await getHighRiskEvents(threshold, limit);
        
        res.status(200).json({
            threshold,
            count: events.length,
            events
        });

    } catch (err) {
        console.error('Error fetching high-risk events:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/events/batch-store', async (req, res) => {
    try {
        const { events } = req.body;

        if (!Array.isArray(events)) {
            return res.status(400).json({ message: "events must be an array" });
        }

        const eventIds = [];
        for (const event of events) {
            try {
                const id = await storeEvent(event);
                eventIds.push(id);
            } catch (err) {
                console.error(`Failed to store event: ${err.message}`);
            }
        }

        res.status(201).json({ 
            message: `Stored ${eventIds.length} out of ${events.length} events`,
            stored_count: eventIds.length,
            event_ids: eventIds
        });

    } catch (err) {
        console.error('Error batch storing events:', err);
        res.status(500).json({ error: err.message });
    }
});

// Log Watcher Endpoints
router.post('/watcher/start', async (req, res) => {
    try {
        if (logWatcher && logWatcher.watching) {
            return res.status(400).json({ message: "Watcher already running" });
        }

        const logPath = req.body.log_path || process.env.AUDIT_LOG || 'audit.log';
        
        logWatcher = new LogWatcher(logPath);
        
        // Start watching (fire and forget)
        logWatcher.watch(handleEvent).catch(err => {
            console.error('Watcher error:', err);
        });

        res.status(200).json({ 
            message: "Log watcher started",
            log_path: logPath
        });

    } catch (err) {
        console.error('Error starting watcher:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/watcher/stop', (req, res) => {
    try {
        if (!logWatcher || !logWatcher.watching) {
            return res.status(400).json({ message: "Watcher is not running" });
        }

        logWatcher.stop();
        logWatcher = null;

        res.status(200).json({ message: "Log watcher stopped" });

    } catch (err) {
        console.error('Error stopping watcher:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/watcher/status', (req, res) => {
    try {
        const status = {
            running: logWatcher && logWatcher.watching,
            log_path: logWatcher ? logWatcher.logPath : null
        };

        res.status(200).json(status);

    } catch (err) {
        console.error('Error getting watcher status:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/events/process', async (req, res) => {
    try {
        const { raw_event } = req.body;

        if (!raw_event) {
            return res.status(400).json({ message: "raw_event is required" });
        }

        await handleEvent(raw_event);

        res.status(200).json({ message: "Event processed" });

    } catch (err) {
        console.error('Error processing event:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
