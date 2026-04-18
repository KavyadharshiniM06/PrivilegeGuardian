const router   = require('express').Router();
const AuditLog = require('../models/Auditlog');
const Alert    = require('../models/Alert');
const { auth } = require('../middleware/auth');

// GET /api/stats
router.get('/', auth, async (req, res) => {
  try {
    const days  = +(req.query.days || 30);
    const since = new Date(Date.now() - days * 86400000);

    const [evAgg, alAgg, topUsers, riskDist, actionBreakdown, hourlyActivity] = await Promise.all([
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: {
            _id: null,
            total:   { $sum: 1 },
            denied:  { $sum: { $cond: [{ $eq: ['$status','denied'] }, 1, 0] } },
            avgRisk: { $avg: '$finalRisk' },
            maxRisk: { $max: '$finalRisk' },
            users:   { $addToSet: '$username' }
        }}
      ]),
      Alert.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: {
            _id: '$username',
            total:   { $sum: 1 },
            avgRisk: { $avg: '$finalRisk' },
            maxRisk: { $max: '$finalRisk' },
            denied:  { $sum: { $cond: [{ $eq: ['$status','denied'] }, 1, 0] } }
        }},
        { $sort: { avgRisk: -1 } }, { $limit: 10 }
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $bucket: {
            groupBy: '$finalRisk',
            boundaries: [0, 25, 50, 75, 85, 101],
            default: 'other',
            output: { count: { $sum: 1 } }
        }}
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: {
            _id: '$action',
            total:   { $sum: 1 },
            allowed: { $sum: { $cond: [{ $eq: ['$status','allowed'] }, 1, 0] } },
            denied:  { $sum: { $cond: [{ $eq: ['$status','denied'] }, 1, 0] } }
        }},
        { $sort: { total: -1 } }
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: {
            _id: { $hour: '$timestamp' },
            count: { $sum: 1 },
            denied: { $sum: { $cond: [{ $eq: ['$status','denied'] }, 1, 0] } }
        }},
        { $sort: { _id: 1 } }
      ])
    ]);

    const ev    = evAgg[0] || {};
    const alMap = Object.fromEntries(alAgg.map(a => [a._id, a.count]));

    res.json({
      totalEvents:   ev.total   || 0,
      deniedEvents:  ev.denied  || 0,
      avgRisk:       +(ev.avgRisk || 0).toFixed(1),
      maxRisk:       ev.maxRisk || 0,
      uniqueUsers:   (ev.users  || []).length,
      totalAlerts:   alAgg.reduce((s, a) => s + a.count, 0),
      critical:      alMap.CRITICAL || 0,
      high:          alMap.HIGH     || 0,
      medium:        alMap.MEDIUM   || 0,
      low:           alMap.LOW      || 0,
      topUsers, riskDist, actionBreakdown, hourlyActivity, days
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/stats/risk-over-time
router.get('/risk-over-time', auth, async (req, res) => {
  try {
    const since = new Date(Date.now() - (+(req.query.days) || 7) * 86400000);
    const data  = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%dT%H:00', date: '$timestamp' } },
          avgRisk: { $avg: '$finalRisk' },
          maxRisk: { $max: '$finalRisk' },
          count:   { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
