/**
 * Event Handler
 * 
 * Bridges the log watcher with the full event processing pipeline:
 * log → parse → classify risk → detect anomaly → combine risk → generate alert → store
 */

const { classifyRisk, combineRisk } = require('./riskEngine.js');
const { generateAlert } = require('./alertEngine.js');
const { detectAnomaly } = require('./anomalyEngine.js');
const { storeEvent, storeAlert } = require('./eventStore.js');


/**
 * Parse JSON event line
 * @param {string} line - JSON string
 * @returns {Object} Parsed event
 */
function parseJsonEvent(line) {
    try {
        return JSON.parse(line);
    } catch (err) {
        console.error('Failed to parse JSON event:', err.message);
        return null;
    }
}


/**
 * Parse auditd event block
 * @param {string} block - Auditd block (multi-line string)
 * @returns {Object} Parsed event
 */
function parseAuditdEvent(block) {
    try {
        const event = {
            format: 'auditd',
            raw: block,
            lines: block.split('\n').filter(l => l.trim())
        };

        // Extract fields from first SYSCALL line
        const syscallLine = event.lines.find(l => l.includes('type=SYSCALL'));
        if (!syscallLine) {
            return event;
        }

        // Parse key-value pairs from auditd format
        const pairs = {};
        const regex = /(\w+)=([^\s]+)/g;
        let match;
        while ((match = regex.exec(syscallLine)) !== null) {
            pairs[match[1]] = match[2].replace(/"/g, '');
        }

        event.username = pairs.uid === '0' ? 'root' : `uid_${pairs.uid}`;
        event.action = pairs.syscall || 'unknown';
        event.status = syscallLine.includes('exit=0') ? 'allowed' : 'denied';
        event.file = pairs.name || 'unknown';
        event.timestamp = new Date().toISOString();

        return event;

    } catch (err) {
        console.error('Failed to parse auditd event:', err.message);
        return null;
    }
}


/**
 * Process a raw event (JSON or auditd format)
 * Runs the full pipeline: parse → risk → alert → store
 * @param {string|Object} rawEvent - Raw event line or object
 */
async function handleEvent(rawEvent) {
    try {
        let event;

        // Parse the event
        if (typeof rawEvent === 'string') {
            if (rawEvent.trim().startsWith('{')) {
                event = parseJsonEvent(rawEvent);
            } else {
                event = parseAuditdEvent(rawEvent);
            }
        } else {
            event = rawEvent;
        }

        if (!event || !event.username) {
            console.warn('[Handler] Skipping invalid event');
            return;
        }

        console.log(`[Handler] Processing event: ${event.username} → ${event.action}`);

        // Step 1: Classify risk based on rules
        const riskResult = classifyRisk(
            event.username,
            event.action,
            event.status || 'allowed',
            event.file || ''
        );

        event.rule_risk = riskResult.score;
        event.rule_breakdown = riskResult.breakdown;

        // Step 2: Detect anomalies
        const anomalyScore = detectAnomaly(event);
        event.anomaly_score = anomalyScore;

        // Step 3: Combine rule-based and anomaly scores
        event.final_risk = combineRisk(riskResult.score, anomalyScore);

        console.log(`[Handler] Risk scores - Rule: ${riskResult.score}, Anomaly: ${anomalyScore}, Final: ${event.final_risk}`);

        // Step 4: Store event
        let eventId;
        try {
            eventId = await storeEvent(event);
            console.log(`[Handler] Event stored: ${eventId}`);
        } catch (err) {
            console.error('[Handler] Failed to store event:', err.message);
            return;
        }

        // Step 5: Check for alerts
        const alert = generateAlert({
            event_id: eventId,
            username: event.username,
            final_risk: event.final_risk,
            action: event.action,
            file: event.file,
            status: event.status,
            time: event.timestamp
        });

        if (alert) {
            console.log(`[Handler] Alert generated: ${alert.severity} (risk: ${alert.risk_score})`);
            
            try {
                const alertId = await storeAlert(eventId, {
                    severity: alert.severity,
                    message: alert.message,
                    risk_score: alert.risk_score,
                    action: alert.action,
                    file: alert.file,
                    status: alert.status,
                    timestamp: alert.timestamp
                });
                console.log(`[Handler] Alert stored: ${alertId}`);
            } catch (err) {
                console.error('[Handler] Failed to store alert:', err.message);
            }
        }

    } catch (err) {
        console.error('[Handler] Error processing event:', err.message);
    }
}


module.exports = {
    handleEvent,
    parseJsonEvent,
    parseAuditdEvent,
};
