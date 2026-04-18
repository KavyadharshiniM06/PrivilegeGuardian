const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  generatedBy: { type: String, required: true },
  format:      { type: String, required: true },
  status:      { type: String, enum: ['pending', 'completed'], default: 'pending' },
  date:        { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
