/**
 * Alert Engine
 * 
 * Generates alerts from processed events.
 * Cooldown is tracked in-memory (per process).
 * Threshold and severity bands are configurable.
 */

const ALERT_THRESHOLD  = 50;    // minimum final_risk to generate an alert
const CRITICAL_BAND    = 85;
const HIGH_BAND        = 75;
const MEDIUM_BAND      = 60;
const COOLDOWN_SECS    = 30;    // suppress repeat alerts for same user within N seconds

const _lastAlertTs = {};        // username → epoch timestamp


/**
 * Generate an alert from an event if it meets threshold criteria
 * @param {Object} event - Event object with username, final_risk, action, file, status, time, event_id
 * @returns {Object|null} Alert object or null if no alert should be generated
 */
function generateAlert(event) {
    const username   = event.username;
    const finalRisk  = event.final_risk || 0;

    // Check if risk exceeds threshold
    if (finalRisk < ALERT_THRESHOLD) {
        return null;
    }

    // Check cooldown to prevent alert spam
    const now = Date.now() / 1000;  // Convert to seconds
    if (username in _lastAlertTs) {
        if (now - _lastAlertTs[username] < COOLDOWN_SECS) {
            return null;
        }
    }

    _lastAlertTs[username] = now;

    const severity = _getSeverity(finalRisk);

    return {
        event_id:  event.event_id || `event_${Date.now()}`,
        username:  username,
        severity:  severity,
        risk_score: finalRisk,
        action:    event.action,
        file:      event.file,
        status:    event.status,
        timestamp: event.time || new Date().toISOString(),
        message:   _buildMessage(username, severity, finalRisk, event),
        alert_generated_at: new Date().toISOString()
    };
}


/**
 * Determine severity level based on risk score
 * @param {number} score - Risk score (0-100)
 * @returns {string} Severity level
 */
function _getSeverity(score) {
    if (score >= CRITICAL_BAND) {
        return "CRITICAL";
    }
    if (score >= HIGH_BAND) {
        return "HIGH";
    }
    if (score >= MEDIUM_BAND) {
        return "MEDIUM";
    }
    return "LOW";
}


/**
 * Build a descriptive alert message
 * @param {string} username - Username
 * @param {string} severity - Severity level
 * @param {number} risk - Risk score
 * @param {Object} event - Event object
 * @returns {string} Alert message
 */
function _buildMessage(username, severity, risk, event) {
    return (
        `[${severity}] Suspicious activity detected | ` +
        `user=${username} | ` +
        `action=${event.action || 'unknown'} | ` +
        `file=${event.file || 'unknown'} | ` +
        `status=${event.status || 'unknown'} | ` +
        `risk_score=${risk}`
    );
}


/**
 * Get all active cooldowns (for monitoring/debugging)
 * @returns {Object} Current cooldown states
 */
function getCooldownStats() {
    const now = Date.now() / 1000;
    const stats = {};
    
    for (const [username, timestamp] of Object.entries(_lastAlertTs)) {
        const secondsRemaining = Math.max(0, COOLDOWN_SECS - (now - timestamp));
        stats[username] = {
            lastAlertAt: new Date(timestamp * 1000).toISOString(),
            secondsRemainingInCooldown: Math.round(secondsRemaining)
        };
    }
    
    return stats;
}


/**
 * Clear all cooldowns (for testing/reset)
 */
function clearCooldowns() {
    for (const key in _lastAlertTs) {
        delete _lastAlertTs[key];
    }
}


module.exports = {
    generateAlert,
    getCooldownStats,
    clearCooldowns,
    ALERT_THRESHOLD,
    CRITICAL_BAND,
    HIGH_BAND,
    MEDIUM_BAND,
    COOLDOWN_SECS,
};
