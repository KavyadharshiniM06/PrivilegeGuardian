const router   = require('express').Router();
const fs       = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');
const AuditLog = require('../models/Auditlog');
const Alert    = require('../models/Alert');
const { classifyRisk, combineRisk, detectAnomaly, generateAlert } = require('../utils/engine');
const { auth, adminOnly } = require('../middleware/auth');

// ── SSE client registry ────────────────────────────────────────────────────────
// Maps client ID → response object for Server-Sent Events (live refresh)
const sseClients = new Map();
let   clientSeq  = 0;

function broadcastEvent(event) {
  const payload = JSON.stringify(event);
  for (const [id, res] of sseClients) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (_) {
      sseClients.delete(id);
    }
  }
}

// ── Core event processor ───────────────────────────────────────────────────────
async function processEvent(data) {
  if (!data.username || !data.action) return null;

  const rule      = classifyRisk(data.username, data.action, data.status, data.file);
  const anomaly   = detectAnomaly(data.username, data.action);
  const finalRisk = combineRisk(rule.score, anomaly);

  const log = await AuditLog.create({
    username:     data.username,
    action:       data.action,
    status:       data.status   || 'allowed',
    file:         data.file     || 'unknown',
    ruleRisk:     rule.score,
    anomalyScore: anomaly,
    finalRisk,
    rawType:      data.raw_type || null,
    sourceIp:     data.source_ip || null,
    hostname:     data.hostname  || null,
    argv:         data.argv      || null,
    timestamp:    data.time ? new Date(data.time) : new Date(),
  });

  const alertData = generateAlert({
    username: data.username, action: data.action,
    status:   data.status,   file:   data.file, finalRisk,
  });
  let alert = null;
  if (alertData) {
    alert = await Alert.create({ ...alertData, auditLogId: log._id });
  }

  // Push to SSE clients for real-time UI refresh
  broadcastEvent({
    type:  'event',
    event: log,
    alert: alert || null,
  });

  return log;
}

// ── GET /api/events ─────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const {
      page    = 1,
      limit   = 50,
      user,
      status,
      minRisk = 0,
      maxRisk = 100,
      days    = 30,
      action,
      rawType,
      hostname,
      sortBy  = 'timestamp',
      sortDir = 'desc',
    } = req.query;

    const since  = new Date(Date.now() - days * 86400000);
    const filter = {
      timestamp: { $gte: since },
      finalRisk: { $gte: +minRisk, $lte: +maxRisk },
    };
    if (user)     filter.username = new RegExp(user, 'i');
    if (status)   filter.status   = status;
    if (action)   filter.action   = new RegExp(action, 'i');
    if (rawType)  filter.rawType  = new RegExp(rawType, 'i');
    if (hostname) filter.hostname = new RegExp(hostname, 'i');

    const sortField = ['timestamp', 'finalRisk', 'username', 'action'].includes(sortBy)
      ? sortBy : 'timestamp';
    const sortOrder = sortDir === 'asc' ? 1 : -1;

    const [events, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip((+page - 1) * +limit)
        .limit(Math.min(+limit, 200))
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ events, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/events/stream  (Server-Sent Events live feed) ─────────────────────
// Frontend connects here to receive real-time event pushes without polling.
router.get('/stream', auth, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send a heartbeat comment every 15s to keep the connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 15_000);

  // Send "connected" confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);

  const id = ++clientSeq;
  sseClients.set(id, res);
  console.log(`[SSE] Client ${id} connected (total: ${sseClients.size})`);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(id);
    console.log(`[SSE] Client ${id} disconnected (total: ${sseClients.size})`);
  });
});

// ── GET /api/events/latest  ─────────────────────────────────────────────────────
// Returns events newer than a given timestamp (for polling fallback).
router.get('/latest', auth, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 60_000);
    const limit = Math.min(+(req.query.limit || 100), 500);

    const events = await AuditLog.find({ timestamp: { $gt: since } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const alerts = await Alert.find({ createdAt: { $gt: since } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      events,
      alerts,
      serverTime: new Date().toISOString(),
      count: events.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/events/ingest  (called by collector) ─────────────────────────────
router.post('/ingest', auth, async (req, res) => {
  try {
    const result = await processEvent(req.body);
    if (!result) return res.status(400).json({ error: 'Invalid event' });
    res.json({ message: 'ok', id: result._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/events/ingest/batch  (bulk ingest for high-throughput) ───────────
router.post('/ingest/batch', auth, async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array required' });
    }
    const results = await Promise.allSettled(events.slice(0, 100).map(processEvent));
    const ok      = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed  = results.length - ok;
    res.json({ message: `Ingested ${ok} events`, ok, failed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/events/replay  (replay a newline-JSON audit log) ─────────────────
router.post('/replay', adminOnly, async (req, res) => {
  const logPath = req.body.path || process.env.AUDIT_LOG || 'audit.log';
  if (!fs.existsSync(logPath)) return res.status(404).json({ error: 'File not found' });

  res.json({ message: 'Replay started', path: logPath });

  let count = 0, skipped = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(logPath), crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      const result = await processEvent(data);
      if (result) count++;
      else skipped++;
    } catch (_) { skipped++; }
  }

  console.log(`[Replay] Done — ${count} ingested, ${skipped} skipped`);
  broadcastEvent({ type: 'replay_complete', count, skipped });
});

// ── GET /api/events/system-users  ─────────────────────────────────────────────
router.get('/system-users', adminOnly, async (req, res) => {
  try {
    const passwd = fs.readFileSync('/etc/passwd', 'utf8');
    const users  = passwd.split('\n')
      .map(l => l.split(':'))
      .filter(p => p.length >= 7 && +p[2] >= 0 &&
        ['/bin/bash', '/bin/sh', '/bin/zsh', '/usr/bin/bash', '/usr/bin/zsh'].some(s => p[6]?.includes(s)))
      .map(p => ({
        username: p[0],
        uid:      +p[2],
        gid:      +p[3],
        home:     p[5],
        shell:    p[6]?.trim(),
        groups:   [],
      }));

    for (const u of users) {
      try {
        const g = execSync(`groups ${u.username} 2>/dev/null | cut -d: -f2`, { timeout: 500 })
          .toString().trim().split(/\s+/);
        u.groups = g.filter(Boolean);
      } catch (_) {}
    }

    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/events  (admin-only bulk delete) ───────────────────────────────
router.delete('/', adminOnly, async (req, res) => {
  try {
    const days  = +(req.query.days || 90);
    const before = new Date(Date.now() - days * 86400000);
    const result = await AuditLog.deleteMany({ timestamp: { $lt: before } });
    res.json({ message: `Deleted ${result.deletedCount} events older than ${days} days` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
