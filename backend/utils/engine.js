// ── Risk Engine ────────────────────────────────────────────────────────────────
// Scores are calibrated for real auditd event types, not just dummy data.

const BASE_RISK = {
  // File operations
  read:           10,
  open:           10,
  write:          40,
  delete:         70,
  unlink:         70,
  rename:         35,
  chmod:          50,
  chown:          55,
  mount:          60,
  // Process operations
  execute:        45,
  fork:           20,
  network:        30,
  seccomp_kill:   80,
  capability_set: 60,
  // Auth / privilege
  login:          15,
  logout:          5,
  ssh_login:      20,
  sudo:           55,
  su:             55,
  add_user:       75,
  del_user:       75,
  add_group:      65,
  del_group:      65,
  passwd_change:  50,
  // System
  system_boot:    30,
  system_shutdown:30,
  service_start:  25,
  service_stop:   25,
  config_change:  60,
  selinux_denial: 70,
  promisc_mode:   80,
  abnormal_exit:  40,
  file_modified:  65,  // FIM trigger
  daemon_event:   15,
  session_open:    5,
  session_close:   5,
  unknown:        20,
};

const PRIVILEGED = new Set(['root', 'admin_user', 'admin', '0']);

const SENSITIVE_KW = [
  'secure', 'critical', 'etc', 'shadow', 'passwd', 'sudoers',
  'authorized_keys', 'id_rsa', 'id_ed25519', '.ssh', 'crontab',
  'ld.so.preload', 'profile', 'bashrc', 'bash_history', '.aws',
  'credentials', 'private', 'secret', 'token', 'key', 'cert',
  'ssl', 'tls', '/proc/mem', '/dev/mem', '/dev/kmem',
];

// Actions that are inherently high-risk regardless of other factors
const CRITICAL_ACTIONS = new Set([
  'selinux_denial', 'promisc_mode', 'seccomp_kill', 'file_modified',
  'add_user', 'del_user',
]);

function classifyRisk(username, action, status, filePath) {
  const base      = BASE_RISK[action] !== undefined ? BASE_RISK[action] : BASE_RISK.unknown;
  const priv      = PRIVILEGED.has(username) ? 20 : 0;
  const denied    = status === 'denied' ? 30 : 0;
  const critical  = CRITICAL_ACTIONS.has(action) ? 15 : 0;

  let sensitive = 0;
  if (filePath) {
    const fp = filePath.toLowerCase();
    for (const kw of SENSITIVE_KW) {
      if (fp.includes(kw)) { sensitive = 30; break; }
    }
  }

  const score = Math.min(base + priv + denied + sensitive + critical, 100);
  return {
    score,
    breakdown: { base, priv, denied, sensitive, critical },
  };
}

function combineRisk(ruleRisk, anomalyScore) {
  return Math.round(Math.min(0.7 * ruleRisk + 0.3 * anomalyScore * 100, 100));
}

// ── Anomaly Engine ─────────────────────────────────────────────────────────────
// In-memory baseline tracking per user:
//   - frequency of each action relative to total events
//   - burst detection (events < 2s apart)
//   - new-user detection (no history)

const _actionCount  = {};
const _totalEvents  = {};
const _lastEventTs  = {};
const _windowEvents = {}; // sliding 60s window for burst detection

function resetAnomaly() {
  for (const k of Object.keys(_actionCount))  delete _actionCount[k];
  for (const k of Object.keys(_totalEvents))  delete _totalEvents[k];
  for (const k of Object.keys(_lastEventTs))  delete _lastEventTs[k];
  for (const k of Object.keys(_windowEvents)) delete _windowEvents[k];
}

function detectAnomaly(username, action) {
  if (!_totalEvents[username]) {
    _totalEvents[username]  = 0;
    _actionCount[username]  = {};
    _lastEventTs[username]  = null;
    _windowEvents[username] = [];
  }

  let score = 0;
  const now = Date.now();

  // New user with no history
  if (_totalEvents[username] === 0) score += 0.5;

  // Rare action for this user (< 10% of their events, min 5 events seen)
  if (_totalEvents[username] >= 5) {
    const freq = (_actionCount[username][action] || 0) / _totalEvents[username];
    if (freq < 0.05) score += 0.4;
    else if (freq < 0.10) score += 0.2;
  }

  // Rapid burst (> 10 events in last 60s)
  _windowEvents[username] = _windowEvents[username].filter(t => now - t < 60_000);
  _windowEvents[username].push(now);
  if (_windowEvents[username].length > 15) score += 0.4;
  else if (_windowEvents[username].length > 8) score += 0.2;

  // Very tight burst (< 500ms since last event)
  if (_lastEventTs[username] && (now - _lastEventTs[username]) < 500) score += 0.3;

  // Update state
  _totalEvents[username]++;
  _actionCount[username][action] = (_actionCount[username][action] || 0) + 1;
  _lastEventTs[username] = now;

  return Math.round(Math.min(score, 1.0) * 100) / 100;
}

// ── Alert Engine ───────────────────────────────────────────────────────────────
const THRESHOLD   = 50;
const COOLDOWN_MS = 30_000;
const _lastAlert  = {};

function getSeverity(score) {
  if (score >= 85) return 'CRITICAL';
  if (score >= 75) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  return 'LOW';
}

function generateAlert(event) {
  if (event.finalRisk < THRESHOLD) return null;

  const now = Date.now();
  const key = `${event.username}:${event.action}`;  // more granular cooldown key

  if (_lastAlert[key] && now - _lastAlert[key] < COOLDOWN_MS) return null;
  _lastAlert[key] = now;

  const severity = getSeverity(event.finalRisk);
  return {
    username:  event.username,
    severity,
    riskScore: event.finalRisk,
    action:    event.action,
    file:      event.file,
    status:    event.status,
    message:   `[${severity}] user=${event.username} action=${event.action} file=${event.file} risk=${event.finalRisk}`,
  };
}

module.exports = { classifyRisk, combineRisk, detectAnomaly, generateAlert, resetAnomaly };
