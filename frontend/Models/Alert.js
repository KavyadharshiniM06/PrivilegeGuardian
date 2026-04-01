const mongoose = require('mongoose');

// Alert Schema
const alertSchema = new mongoose.Schema({
    event_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    alert_type: {
        type: String,
        default: 'suspicious_activity',
        enum: ['suspicious_activity', 'policy_violation', 'anomaly', 'threshold_exceeded']
    },
    severity: {
        type: String,
        required: true,
        enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    },
    message: {
        type: String,
        required: true
    },
    risk_score: {
        type: Number,
        min: 0,
        max: 100
    },
    action: String,
    file: String,
    status: String,
    created_at: {
        type: Date,
        default: Date.now
    },
    acknowledged: {
        type: Boolean,
        default: false
    },
    acknowledged_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    acknowledged_at: Date
});

// Create index on created_at and severity for faster queries
alertSchema.index({ created_at: -1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ user_id: 1 });
alertSchema.index({ event_id: 1 });

module.exports = mongoose.model('Alert', alertSchema);
