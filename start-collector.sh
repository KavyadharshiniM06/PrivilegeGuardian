#!/usr/bin/env bash
# PrivilegeGuardian — start-collector.sh
# Automatically authenticates, fetches a JWT, and starts the live collector.
# Run as root: sudo bash start-collector.sh
#
# Environment overrides (optional):
#   PG_USER=admin            SIEM admin username       (default: admin)
#   PG_PASS=admin123         SIEM admin password       (default: admin123)
#   PG_API=http://...        API base URL              (default: http://localhost:4000)
#   PG_COLLECTOR=./collector.js   Path to collector.js
#   PG_NODE=$(which node)    Path to node binary

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
info() { echo -e "${CYAN}[→]${NC} $*"; }

# ── Config (override via env vars) ───────────────────────────────────────────
PG_USER="${PG_USER:-admin}"
PG_PASS="${PG_PASS:-admin123}"
PG_API="${PG_API:-http://localhost:4000}"
PG_NODE="${PG_NODE:-$(command -v node 2>/dev/null || echo '/usr/bin/node')}"

# Locate collector.js relative to this script, or fall back to common paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${PG_COLLECTOR:-}" ]]; then
  COLLECTOR="$PG_COLLECTOR"
elif [[ -f "$SCRIPT_DIR/collector.js" ]]; then
  COLLECTOR="$SCRIPT_DIR/collector.js"
elif [[ -f "/opt/privilegeguardian/collector.js" ]]; then
  COLLECTOR="/opt/privilegeguardian/collector.js"
else
  err "Cannot find collector.js. Set PG_COLLECTOR=/path/to/collector.js"
fi

TOKEN_FILE="/tmp/.pg_collector_token"

# ── Pre-flight checks ────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Run as root so the collector can read /var/log/audit/audit.log"

command -v curl  >/dev/null 2>&1 || err "curl is required. Install with: apt-get install -y curl"
[[ -x "$PG_NODE" ]]             || err "node not found at $PG_NODE. Install Node.js first."
[[ -f "$COLLECTOR" ]]           || err "collector.js not found at $COLLECTOR"

# ── Check auditd ─────────────────────────────────────────────────────────────
log "Checking auditd..."
if ! systemctl is-active --quiet auditd 2>/dev/null; then
  warn "auditd is not running — attempting to start..."
  systemctl enable auditd 2>/dev/null || true
  systemctl start auditd
  sleep 2
  if ! systemctl is-active --quiet auditd; then
    err "auditd failed to start. Run: sudo bash setup.sh"
  fi
fi
log "auditd is active."

# ── Check audit rules ─────────────────────────────────────────────────────────
RULE_COUNT=$(auditctl -l 2>/dev/null | grep -c '\-' || true)
if [[ "$RULE_COUNT" -lt 3 ]]; then
  warn "Fewer than 3 audit rules detected ($RULE_COUNT). Running setup to load rules..."
  SCRIPT_DIR_SETUP="$SCRIPT_DIR"
  if [[ -f "$SCRIPT_DIR_SETUP/setup.sh" ]]; then
    bash "$SCRIPT_DIR_SETUP/setup.sh"
  else
    warn "setup.sh not found. Load rules manually: sudo auditctl -R /etc/audit/rules.d/privilegeguardian.rules"
  fi
else
  log "Audit rules loaded: $RULE_COUNT rules active."
fi

# ── Check audit log exists and is readable ───────────────────────────────────
if [[ ! -f "/var/log/audit/audit.log" ]]; then
  warn "/var/log/audit/audit.log not found — creating it..."
  mkdir -p /var/log/audit
  touch /var/log/audit/audit.log
  # Restart auditd so it starts writing there
  systemctl restart auditd
  sleep 2
fi
log "Audit log present: $(wc -l < /var/log/audit/audit.log) lines so far."

# ── Wait for the API to be ready ─────────────────────────────────────────────
log "Waiting for SIEM API at $PG_API ..."
MAX_WAIT=60
WAITED=0
until curl -sf "$PG_API/api/auth/login" -o /dev/null --max-time 3 \
        -X POST -H 'Content-Type: application/json' \
        -d '{"username":"__ping__","password":"__ping__"}' \
        2>/dev/null || [[ "$WAITED" -ge "$MAX_WAIT" ]]; do
  # A 401 response also means the API is up
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 3 -X POST \
    -H 'Content-Type: application/json' \
    -d '{"username":"__ping__","password":"__ping__"}' \
    "$PG_API/api/auth/login" 2>/dev/null || echo "000")
  if [[ "$HTTP" == "401" || "$HTTP" == "409" || "$HTTP" == "200" ]]; then
    break
  fi
  info "API not ready (HTTP $HTTP) — waiting... ($WAITED/$MAX_WAIT s)"
  sleep 3
  WAITED=$((WAITED + 3))
done

if [[ "$WAITED" -ge "$MAX_WAIT" ]]; then
  err "SIEM API did not respond within ${MAX_WAIT}s. Start the backend first: cd backend && npm run dev"
fi
log "SIEM API is reachable."

# ── Authenticate and get JWT ─────────────────────────────────────────────────
log "Authenticating as '$PG_USER'..."
AUTH_RESPONSE=$(curl -sf --max-time 10 \
  -X POST "$PG_API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$PG_USER\",\"password\":\"$PG_PASS\"}" 2>&1) || \
  err "Login request failed. Check API is running and credentials are correct."

# Extract token (works without jq)
TOKEN=$(echo "$AUTH_RESPONSE" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])" 2>/dev/null || \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d.token)" \
    <<< "$AUTH_RESPONSE" 2>/dev/null || true)

if [[ -z "$TOKEN" ]]; then
  err "Failed to extract JWT from response: $AUTH_RESPONSE
       Check username/password: PG_USER=$PG_USER  PG_PASS=<hidden>"
fi

echo "$TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
log "JWT token obtained and cached at $TOKEN_FILE"

# ── Kill any existing collector ───────────────────────────────────────────────
if pgrep -f "collector.js" >/dev/null 2>&1; then
  warn "Existing collector.js process found — stopping it..."
  pkill -f "collector.js" 2>/dev/null || true
  sleep 1
fi

# ── Start collector ───────────────────────────────────────────────────────────
LOG_FILE="/var/log/pg-collector.log"
touch "$LOG_FILE"

log "Starting collector: $PG_NODE $COLLECTOR <token> $PG_API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"
echo "[$(date)] Collector started by start-collector.sh"              >> "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"

# Run in background, log to file, and print PID
"$PG_NODE" "$COLLECTOR" "$TOKEN" "$PG_API" >> "$LOG_FILE" 2>&1 &
COLLECTOR_PID=$!

sleep 2
if kill -0 "$COLLECTOR_PID" 2>/dev/null; then
  log "Collector running (PID $COLLECTOR_PID)"
else
  err "Collector exited immediately. Check $LOG_FILE for errors."
fi

echo "$COLLECTOR_PID" > /tmp/.pg_collector.pid

# ── Tail output for 10 seconds so the user can see it's working ──────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  PrivilegeGuardian Collector Started                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  PID:        $COLLECTOR_PID"
echo "  Log file:   $LOG_FILE"
echo "  Audit log:  /var/log/audit/audit.log"
echo ""
echo "  Live output (Ctrl-C to detach — collector keeps running):"
echo "  ─────────────────────────────────────────────────────────"
tail -f "$LOG_FILE" &
TAIL_PID=$!
sleep 12
kill "$TAIL_PID" 2>/dev/null || true

echo ""
echo "  ─────────────────────────────────────────────────────────"
echo "  Collector is running in the background."
echo ""
echo "  Useful commands:"
echo "    tail -f $LOG_FILE            # watch live output"
echo "    kill \$(cat /tmp/.pg_collector.pid)   # stop collector"
echo "    sudo auditctl -l                      # list active rules"
echo "    sudo tail -f /var/log/audit/audit.log # raw audit stream"
echo ""
