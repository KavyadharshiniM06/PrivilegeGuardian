const router = require('express').Router();
const Alert  = require('../models/Alert');
const { auth } = require('../middleware/auth');

// GET /api/alerts
router.get('/', auth, async (req, res) => {
  try {
    const { days = 30, limit = 200, severity } = req.query;
    const since  = new Date(Date.now() - days * 86400000);
    const filter = { createdAt: { $gte: since } };
    if (severity) filter.severity = severity;
    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(+limit).lean();
    res.json(alerts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/alerts/:id/acknowledge
router.patch('/:id/acknowledge', auth, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/alerts/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ message: 'Alert deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
