const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  auditLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditLog' },
  username:   { type: String, required: true },
  severity:   { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
  riskScore:  { type: Number, required: true },
  action:     { type: String },
  file:       { type: String },
  status:     { type: String },
  message:    { type: String },
  acknowledged: { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now }
});

alertSchema.index({ createdAt: -1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ username: 1 });

module.exports = mongoose.model('Alert', alertSchema);
