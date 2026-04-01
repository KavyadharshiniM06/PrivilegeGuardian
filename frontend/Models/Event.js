const mongoose = require('mongoose');

// Event Schema
const eventSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    file: {
        type: String,
        default: 'unknown'
    },
    action: {
        type: String,
        required: true,
        enum: ['read', 'write', 'delete', 'execute', 'open', 'unlink', 'unknown']
    },
    status: {
        type: String,
        required: true,
        enum: ['allowed', 'denied', 'pending']
    },
    rule_risk: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    anomaly_score: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
    },
    final_risk: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Create index on timestamp for faster queries
eventSchema.index({ timestamp: -1 });
eventSchema.index({ user_id: 1 });
eventSchema.index({ final_risk: -1 });

module.exports = mongoose.model('Event', eventSchema);
