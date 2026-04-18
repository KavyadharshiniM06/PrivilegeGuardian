require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const readline = require('readline');

const User     = require('./models/User');
const AuditLog = require('./models/Auditlog');
const Alert    = require('./models/Alert');
const { classifyRisk, combineRisk, detectAnomaly, generateAlert, resetAnomaly } = require('./utils/engine');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/siem';

// ── Demo event templates ──────────────────────────────────────────────────────
const DEMO_EVENTS = [
  { username: 'root',      action: 'delete', file: '/etc/shadow',          status: 'denied'  },
  { username: 'root',      action: 'write',  file: '/etc/passwd',          status: 'allowed' },
  { username: 'admin',     action: 'read',   file: '/etc/sudoers',         status: 'allowed' },
  { username: 'admin',     action: 'delete', file: '/secure/backup.tar',   status: 'denied'  },
  { username: 'alice',     action: 'write',  file: '/var/www/index.html',  status: 'allowed' },
  { username: 'alice',     action: 'read',   file: '/etc/hosts',           status: 'allowed' },
  { username: 'bob',       action: 'execute',file: '/tmp/payload.sh',      status: 'denied'  },
  { username: 'bob',       action: 'write',  file: '/critical/config.yml', status: 'denied'  },
  { username: 'auditor',   action: 'read',   file: '/var/log/syslog',      status: 'allowed' },
  { username: 'auditor',   action: 'open',   file: '/var/log/auth.log',    status: 'allowed' },
  { username: 'deploy',    action: 'write',  file: '/opt/app/server.js',   status: 'allowed' },
  { username: 'deploy',    action: 'execute',file: '/opt/app/start.sh',    status: 'allowed' },
  { username: 'root',      action: 'unlink', file: '/tmp/secrets.txt',     status: 'allowed' },
  { username: 'mallory',   action: 'read',   file: '/etc/shadow',          status: 'denied'  },
  { username: 'mallory',   action: 'write',  file: '/etc/crontab',         status: 'denied'  },
  { username: 'ci_runner', action: 'execute',file: '/usr/bin/docker',      status: 'allowed' },
  { username: 'ci_runner', action: 'read',   file: '/home/alice/.ssh/id_rsa', status: 'denied' },
];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate N events spread over the past `days` days
function generateDemoEvents(count = 200, days = 30) {
  const now  = Date.now();
  const span = days * 24 * 60 * 60 * 1000;
  const events = [];

  for (let i = 0; i < count; i++) {
    const template = DEMO_EVENTS[i % DEMO_EVENTS.length];
    events.push({
      ...template,
      time: new Date(now - randomBetween(0, span)).toISOString(),
    });
  }

  // Sort oldest-first so anomaly engine sees natural order
  return events.sort((a, b) => new Date(a.time) - new Date(b.time));
}

// ── Core seeding logic ────────────────────────────────────────────────────────
async function seedUsers() {
  const defaults = [
    { username: 'admin',   password: 'admin123',   role: 'admin'   },
    { username: 'auditor', password: 'auditor123', role: 'auditor' },
  ];

  for (const u of defaults) {
    if (await User.findOne({ username: u.username })) {
      console.log(`[Seed] User exists: ${u.username}`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 12);
    await User.create({ username: u.username, password: hash, role: u.role });
    console.log(`[Seed] Created user: ${u.username} / ${u.password} (${u.role})`);
  }
}

async function processEvent(data) {
  const rule      = classifyRisk(data.username, data.action, data.status, data.file);
  const anomaly   = detectAnomaly(data.username, data.action);
  const finalRisk = combineRisk(rule.score, anomaly);

  const log = await AuditLog.create({
    username:     data.username,
    action:       data.action,
    status:       data.status || 'allowed',
    file:         data.file   || 'unknown',
    ruleRisk:     rule.score,
    anomalyScore: anomaly,
    finalRisk,
    timestamp:    data.time ? new Date(data.time) : new Date(),
  });

  const alertData = generateAlert({
    username: data.username, action: data.action,
    status:   data.status,  file:   data.file, finalRisk,
  });
  if (alertData) await Alert.create({ ...alertData, auditLogId: log._id });

  return log;
}

async function replayFile(logPath) {
  console.log(`\n[Seed] Replaying ${logPath}...`);
  const rl = readline.createInterface({
    input: fs.createReadStream(logPath),
    crlfDelay: Infinity,
  });

  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    let data;
    try { data = JSON.parse(line); } catch { continue; }
    if (!data.username || !data.action) continue;
    await processEvent(data);
    count++;
    if (count % 100 === 0) console.log(`  Processed ${count} events...`);
  }
  return count;
}

async function seedDemoEvents() {
  console.log('\n[Seed] Generating synthetic demo events...');
  resetAnomaly(); // fresh anomaly baseline for demo data
  const events = generateDemoEvents(200, 30);
  let count = 0;
  for (const event of events) {
    await processEvent(event);
    count++;
  }
  return count;
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('[Seed] Connected to MongoDB');

  await seedUsers();

  const logPath = process.argv[2] || 'audit.log';

  if (fs.existsSync(logPath)) {
    const count = await replayFile(logPath);
    console.log(`\n[Seed] Done — ${count} events from ${logPath}`);
  } else {
    console.log(`[Seed] No audit.log found at "${logPath}" — seeding synthetic demo data instead`);
    const count = await seedDemoEvents();
    console.log(`\n[Seed] Done — ${count} synthetic events seeded`);
  }

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
