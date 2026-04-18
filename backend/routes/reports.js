const router   = require('express').Router();
const Report   = require('../models/Report');
const AuditLog = require('../models/Auditlog');
const Alert    = require('../models/Alert');
const { auth } = require('../middleware/auth');

// GET /api/reports
router.get('/', auth, async (req, res) => {
  try {
    const reports = await Report.find().sort({ date: -1 });
    res.json(reports);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/reports
router.post('/', auth, async (req, res) => {
  try {
    const { name, generatedBy, format, status } = req.body;
    if (!name || !generatedBy || !format) return res.status(400).json({ error: 'Fields required' });
    const report = await Report.create({ name, generatedBy, format, status: status || 'completed' });
    res.status(201).json({ message: 'Report created', report });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/reports/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/reports (all)
router.delete('/', auth, async (req, res) => {
  try {
    const result = await Report.deleteMany({});
    res.json({ message: 'All reports deleted', count: result.deletedCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reports/export/events.csv
router.get('/export/events.csv', auth, async (req, res) => {
  try {
    const days  = +(req.query.days || 30);
    const since = new Date(Date.now() - days * 86400000);
    const events = await AuditLog.find({ timestamp: { $gte: since } }).sort({ timestamp: -1 }).lean();

    const header = 'username,action,status,file,ruleRisk,anomalyScore,finalRisk,timestamp\n';
    const rows   = events.map(e =>
      `${e.username},${e.action},${e.status},"${e.file}",${e.ruleRisk},${e.anomalyScore},${e.finalRisk},${e.timestamp.toISOString()}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="events_${Date.now()}.csv"`);
    res.send(header + rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reports/export/alerts.csv
router.get('/export/alerts.csv', auth, async (req, res) => {
  try {
    const days  = +(req.query.days || 30);
    const since = new Date(Date.now() - days * 86400000);
    const alerts = await Alert.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).lean();

    const header = 'username,severity,riskScore,action,file,status,message,createdAt\n';
    const rows   = alerts.map(a =>
      `${a.username},${a.severity},${a.riskScore},${a.action},"${a.file}",${a.status},"${a.message}",${a.createdAt.toISOString()}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="alerts_${Date.now()}.csv"`);
    res.send(header + rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
