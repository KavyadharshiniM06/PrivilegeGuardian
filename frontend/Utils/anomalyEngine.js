/**
 * Anomaly Detection Engine
 * 
 * Three signals:
 *   1. New user - never seen before this process run
 *   2. Rare action - action frequency below threshold for this user
 *   3. Burst - events arriving too fast
 * 
 * Returns anomaly_score float in [0.0, 1.0].
 * 
 * NOTE: Baselines are in-memory. They survive for the lifetime of the process.
 * For production, persist user_action_count / user_total_events to Redis or MongoDB.
 */

// -------------------------------------------------------
// IN-MEMORY BASELINE STATE
// -------------------------------------------------------

const _actionCount = {};      // user → { action → count }
const _totalEvents = {};      // user → total events
const _lastEventTs = {};      // user → last event time (unix ms)

// -------------------------------------------------------
// THRESHOLDS
// -------------------------------------------------------

const BURST_WINDOW_SECS = 2;         // two events within 2s → burst
const RARE_ACTION_THRESHOLD = 0.10;  // action < 10% of user's events → rare
const NEW_USER_SCORE = 0.60;         // suspicion for first-ever event
const RARE_ACTION_SCORE = 0.40;      // suspicion for rare action
const BURST_SCORE = 0.30;            // suspicion for burst activity
const MIN_EVENTS_FOR_RARE = 5;       // need at least 5 events before "rare" kicks in

/**
 * Detect anomalies in an event
 * @param {Object} event - Event object with username and action
 * @returns {number} Anomaly score in [0.0, 1.0]
 */
function detectAnomaly(event) {
    const username = event.username;
    const action = event.action;

    if (!username || !action) {
        return 0.0;
    }

    let score = 0.0;
    const now = Date.now();

    // Initialize user baseline if not exists
    if (!_totalEvents[username]) {
        _totalEvents[username] = 0;
        _actionCount[username] = {};
        _lastEventTs[username] = null;
    }

    // 1. New user detection
    if (_totalEvents[username] === 0) {
        score += NEW_USER_SCORE;
    }

    // 2. Rare action detection (only after baseline is established)
    const total = _totalEvents[username];
    if (total >= MIN_EVENTS_FOR_RARE) {
        const actionCount = _actionCount[username][action] || 0;
        const freq = actionCount / total;
        if (freq < RARE_ACTION_THRESHOLD) {
            score += RARE_ACTION_SCORE;
        }
    }

    // 3. Burst detection
    const last = _lastEventTs[username];
    if (last !== null && (now - last) < BURST_WINDOW_SECS * 1000) {
        score += BURST_SCORE;
    }

    // Update baseline AFTER scoring (don't let this event influence itself)
    _totalEvents[username] += 1;
    if (!_actionCount[username][action]) {
        _actionCount[username][action] = 0;
    }
    _actionCount[username][action] += 1;
    _lastEventTs[username] = now;

    return Math.round(Math.min(score, 1.0) * 100) / 100;
}

/**
 * Get user baseline statistics
 * @param {string} username - Username to query
 * @returns {Object} User baseline data
 */
function getUserBaseline(username) {
    return {
        username,
        total_events: _totalEvents[username] || 0,
        actions: _actionCount[username] || {},
        last_event_ts: _lastEventTs[username] || null
    };
}

/**
 * Get all user baselines
 * @returns {Object} All user baseline data
 */
function getAllBaselines() {
    const baselines = {};
    for (const username of Object.keys(_totalEvents)) {
        baselines[username] = {
            total_events: _totalEvents[username],
            actions: _actionCount[username],
            last_event_ts: _lastEventTs[username]
        };
    }
    return baselines;
}

/**
 * Reset baseline for a specific user
 * @param {string} username - Username to reset
 */
function resetUserBaseline(username) {
    delete _totalEvents[username];
    delete _actionCount[username];
    delete _lastEventTs[username];
}

/**
 * Reset all baselines (testing utility)
 */
function resetAllBaselines() {
    Object.keys(_totalEvents).forEach(key => delete _totalEvents[key]);
    Object.keys(_actionCount).forEach(key => delete _actionCount[key]);
    Object.keys(_lastEventTs).forEach(key => delete _lastEventTs[key]);
}

/**
 * Configure thresholds (advanced)
 * @param {Object} config - Configuration object with optional keys:
 *   - burst_window_secs
 *   - rare_action_threshold
 *   - new_user_score
 *   - rare_action_score
 *   - burst_score
 *   - min_events_for_rare
 */
function configureThresholds(config) {
    if (config.burst_window_secs !== undefined) {
        BURST_WINDOW_SECS = config.burst_window_secs;
    }
    if (config.rare_action_threshold !== undefined) {
        RARE_ACTION_THRESHOLD = config.rare_action_threshold;
    }
    if (config.new_user_score !== undefined) {
        NEW_USER_SCORE = config.new_user_score;
    }
    if (config.rare_action_score !== undefined) {
        RARE_ACTION_SCORE = config.rare_action_score;
    }
    if (config.burst_score !== undefined) {
        BURST_SCORE = config.burst_score;
    }
    if (config.min_events_for_rare !== undefined) {
        MIN_EVENTS_FOR_RARE = config.min_events_for_rare;
    }
}

module.exports = {
    detectAnomaly,
    getUserBaseline,
    getAllBaselines,
    resetUserBaseline,
    resetAllBaselines,
    configureThresholds,
    // Export constants for reference
    BURST_WINDOW_SECS,
    RARE_ACTION_THRESHOLD,
    NEW_USER_SCORE,
    RARE_ACTION_SCORE,
    BURST_SCORE,
    MIN_EVENTS_FOR_RARE
};
