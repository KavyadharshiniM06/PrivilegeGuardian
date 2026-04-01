/**
 * Risk Engine
 * 
 * 1. classifyRisk  – rule-based score (0-100) with breakdown
 * 2. combineRisk   – weighted merge of rule + anomaly scores
 */

const BASE_RISK = {
    read:    10,
    open:    10,
    write:   40,
    unlink:  70,
    delete:  70,
    unknown: 20,
};

const PRIVILEGED_USERS       = new Set(["root", "admin_user", "admin"]);
const SENSITIVE_KEYWORDS     = ["secure", "critical", "etc", "shadow", "passwd"];

const RULE_WEIGHT    = 0.7;
const ANOMALY_WEIGHT = 0.3;


/**
 * Classify risk based on username, action, status, and file path
 * @param {string} username - User performing the action
 * @param {string} action - Type of action (read, write, delete, etc)
 * @param {string} status - Status of action (allowed, denied, etc)
 * @param {string} filePath - Path to the file being accessed
 * @returns {Object} Risk assessment with score and breakdown
 */
function classifyRisk(username, action, status, filePath) {
    // Get base risk for the action
    const baseActionRisk = BASE_RISK[action] || BASE_RISK.unknown;

    // Check if user is privileged
    const privilegedRisk = PRIVILEGED_USERS.has(username) ? 20 : 0;

    // Check if access was denied
    const deniedRisk = status === "denied" ? 30 : 0;

    // Check for sensitive file paths
    let sensitiveRisk = 0;
    if (filePath) {
        for (const kw of SENSITIVE_KEYWORDS) {
            if (filePath.toLowerCase().includes(kw)) {
                sensitiveRisk = 30;
                break;
            }
        }
    }

    const total = Math.min(baseActionRisk + privilegedRisk + deniedRisk + sensitiveRisk, 100);

    return {
        score: total,
        breakdown: {
            base_action:     baseActionRisk,
            privileged_user: privilegedRisk,
            denied_access:   deniedRisk,
            sensitive_file:  sensitiveRisk,
        },
    };
}


/**
 * Combine rule-based risk with anomaly score
 * @param {number} ruleRisk - Rule-based risk score (0-100)
 * @param {number} anomalyScore - Anomaly score (0-1)
 * @returns {number} Combined risk score (0-100)
 */
function combineRisk(ruleRisk, anomalyScore) {
    return Math.round(Math.min(RULE_WEIGHT * ruleRisk + ANOMALY_WEIGHT * anomalyScore * 100, 100));
}


module.exports = {
    classifyRisk,
    combineRisk,
    BASE_RISK,
    PRIVILEGED_USERS,
    SENSITIVE_KEYWORDS,
};
