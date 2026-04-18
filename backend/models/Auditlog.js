const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  username:     { type: String, required: true, index: true },
  action:       { type: String, required: true, index: true },
  status:       { type: String, enum: ['allowed', 'denied'], required: true, index: true },
  file:         { type: String, default: 'unknown' },
  argv:         { type: String, default: null },   // full command line for execve events
  ruleRisk:     { type: Number, default: 0 },
  anomalyScore: { type: Number, default: 0 },
  finalRisk:    { type: Number, default: 0, index: true },
  rawType:      { type: String, default: null, index: true },  // auditd event type e.g. SYSCALL
  sourceIp:     { type: String, default: null },               // SSH source IP / remote addr
  hostname:     { type: String, default: null, index: true },  // origin host
  timestamp:    { type: Date, default: Date.now, index: true },
});

// Compound indexes for common query patterns
auditLogSchema.index({ timestamp: -1, finalRisk: -1 });
auditLogSchema.index({ username: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ rawType: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
