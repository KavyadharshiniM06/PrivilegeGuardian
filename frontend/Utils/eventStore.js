/**
 * Event Store
 * 
 * Writes parsed + scored events and generated alerts to MongoDB.
 * Provides race-safe operations for user creation and event storage.
 */

const User = require('../Models/User.js');
const Event = require('../Models/Event.js');
const Alert = require('../Models/Alert.js');


/**
 * Parse timestamp string to Date object
 * Supports formats: "YYYY-MM-DD HH:MM:SS" or ISO string
 * @param {string} tsStr - Timestamp string
 * @returns {Date} Parsed date
 */
function parseTimestamp(tsStr) {
    // Try ISO format first
    if (tsStr.includes('T')) {
        return new Date(tsStr);
    }
    
    // Try "YYYY-MM-DD HH:MM:SS" format
    const parsed = new Date(tsStr);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }
    
    // Fallback to current time
    console.warn(`Could not parse timestamp: ${tsStr}, using current time`);
    return new Date();
}


/**
 * Get or create a user (race-safe using MongoDB findOrCreate pattern)
 * @param {string} username - Username
 * @param {string} role - User role (optional)
 * @returns {Promise<ObjectId>} User ID
 */
async function getOrCreateUser(username, role = 'unknown') {
    try {
        // Try to find existing user
        let user = await User.findOne({ username });
        
        if (user) {
            return user._id;
        }

        // If not found, attempt to create
        // Use findOneAndUpdate with upsert for race-safety
        user = await User.findOneAndUpdate(
            { username },
            { 
                username,
                role,
                created_at: new Date()
            },
            { 
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log(`User created/found: ${username} (${user._id})`);
        return user._id;

    } catch (err) {
        console.error(`Error in getOrCreateUser: ${err.message}`);
        throw err;
    }
}


/**
 * Store a security event
 * @param {Object} event - Event object with username, action, file, status, timestamps, risk scores
 * @returns {Promise<ObjectId>} Event ID
 */
async function storeEvent(event) {
    try {
        // Validate required fields
        if (!event.username || !event.action) {
            throw new Error('Event must have username and action');
        }

        // Get or create user
        const userId = await getOrCreateUser(event.username, event.role);

        // Prepare event data
        const eventData = {
            user_id: userId,
            file: event.file || 'unknown',
            action: event.action,
            status: event.status || 'allowed',
            rule_risk: parseInt(event.rule_risk) || 0,
            anomaly_score: parseFloat(event.anomaly_score) || 0,
            final_risk: parseFloat(event.final_risk) || 0,
            timestamp: parseTimestamp(event.time || event.timestamp)
        };

        // Create and save event
        const newEvent = new Event(eventData);
        const savedEvent = await newEvent.save();

        console.log(`Event stored: ${savedEvent._id}`);
        return savedEvent._id;

    } catch (err) {
        console.error(`Error storing event: ${err.message}`);
        throw err;
    }
}


/**
 * Store an alert linked to an event
 * @param {ObjectId} eventId - Event ID
 * @param {Object} alert - Alert object with severity, message, timestamp
 * @returns {Promise<ObjectId>} Alert ID
 */
async function storeAlert(eventId, alert) {
    try {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        if (!alert.severity || !alert.message) {
            throw new Error('Alert must have severity and message');
        }

        // Get event to extract user_id
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error(`Event not found: ${eventId}`);
        }

        // Prepare alert data
        const alertData = {
            event_id: eventId,
            user_id: event.user_id,
            alert_type: alert.alert_type || 'suspicious_activity',
            severity: alert.severity,
            message: alert.message,
            risk_score: alert.risk_score || event.final_risk,
            action: alert.action || event.action,
            file: alert.file || event.file,
            status: alert.status || event.status,
            created_at: parseTimestamp(alert.timestamp || alert.created_at)
        };

        // Create and save alert
        const newAlert = new Alert(alertData);
        const savedAlert = await newAlert.save();

        console.log(`Alert stored: ${savedAlert._id}`);
        return savedAlert._id;

    } catch (err) {
        console.error(`Error storing alert: ${err.message}`);
        throw err;
    }
}


/**
 * Batch store events
 * @param {Array} events - Array of event objects
 * @returns {Promise<Array>} Array of event IDs
 */
async function storeEvents(events) {
    try {
        const eventIds = [];
        
        for (const event of events) {
            try {
                const id = await storeEvent(event);
                eventIds.push(id);
            } catch (err) {
                console.error(`Failed to store individual event: ${err.message}`);
                // Continue with next event
            }
        }

        console.log(`Batch stored ${eventIds.length} events`);
        return eventIds;

    } catch (err) {
        console.error(`Error in batch store: ${err.message}`);
        throw err;
    }
}


/**
 * Batch store alerts
 * @param {Array} alerts - Array of {eventId, alert} objects
 * @returns {Promise<Array>} Array of alert IDs
 */
async function storeAlerts(alerts) {
    try {
        const alertIds = [];
        
        for (const item of alerts) {
            try {
                const id = await storeAlert(item.eventId, item.alert);
                alertIds.push(id);
            } catch (err) {
                console.error(`Failed to store individual alert: ${err.message}`);
                // Continue with next alert
            }
        }

        console.log(`Batch stored ${alertIds.length} alerts`);
        return alertIds;

    } catch (err) {
        console.error(`Error in batch alert store: ${err.message}`);
        throw err;
    }
}


/**
 * Get recent events
 * @param {number} limit - Number of recent events to retrieve
 * @returns {Promise<Array>} Array of events
 */
async function getRecentEvents(limit = 100) {
    try {
        const events = await Event.find()
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate('user_id', 'username role');
        
        return events;
    } catch (err) {
        console.error(`Error fetching recent events: ${err.message}`);
        throw err;
    }
}


/**
 * Get recent alerts
 * @param {number} limit - Number of recent alerts to retrieve
 * @returns {Promise<Array>} Array of alerts
 */
async function getRecentAlerts(limit = 100) {
    try {
        const alerts = await Alert.find()
            .sort({ created_at: -1 })
            .limit(limit)
            .populate('user_id', 'username')
            .populate('event_id');
        
        return alerts;
    } catch (err) {
        console.error(`Error fetching recent alerts: ${err.message}`);
        throw err;
    }
}


/**
 * Get high-risk events
 * @param {number} riskThreshold - Minimum risk score (default 70)
 * @param {number} limit - Number of events to retrieve
 * @returns {Promise<Array>} Array of high-risk events
 */
async function getHighRiskEvents(riskThreshold = 70, limit = 50) {
    try {
        const events = await Event.find({ final_risk: { $gte: riskThreshold } })
            .sort({ final_risk: -1, timestamp: -1 })
            .limit(limit)
            .populate('user_id', 'username role');
        
        return events;
    } catch (err) {
        console.error(`Error fetching high-risk events: ${err.message}`);
        throw err;
    }
}


module.exports = {
    storeEvent,
    storeAlert,
    storeEvents,
    storeAlerts,
    getRecentEvents,
    getRecentAlerts,
    getHighRiskEvents,
    getOrCreateUser,
    parseTimestamp,
};
