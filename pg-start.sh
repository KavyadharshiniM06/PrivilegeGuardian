#!/usr/bin/env bash
# ============================================================
# PrivilegeGuardian — Integrated SIEM Startup Script
# Handles: auditd setup → JWT auth → real-time collection
# Usage:  sudo bash pg-start.sh [--no-seed] [--keep-db]
#
# By default, clears the MongoDB DB on every run so your
# demo always starts fresh with ≤500 clean events.
# Pass --keep-db to skip the wipe.
# ============================================================
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*"; exit 1; }
info() { echo -e "${CYAN}→${NC}  $*"; }
step() { echo -e "\n${BLUE}${BOLD}[$((++STEP))]${NC} $*"; }

STEP=0

# ── Config (override via env) ────────────────────────────────
PG_DIR="${PG_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
PG_API="${PG_API:-http://localhost:4000}"
PG_USER="${PG_USER:-admin}"
PG_PASS="${PG_PASS:-admin123}"
PG_NODE="${PG_NODE:-$(command -v node 2>/dev/null || echo '/usr/bin/node')}"
TOKEN_FILE="/tmp/.pg_token"
COLLECTOR_PID_FILE="/tmp/.pg_collector.pid"
COLLECTOR_LOG="/var/log/pg-collector.log"
NO_SEED=false
KEEP_DB=false
MAX_INGEST=500          # cap for historical event ingestion

for arg in "$@"; do
  [[ "$arg" == "--no-seed" ]] && NO_SEED=true
  [[ "$arg" == "--keep-db" ]] && KEEP_DB=true
done

# ── Banner ───────────────────────────────────────────────────
echo -e "
${CYAN}╔══════════════════════════════════════════════════════════╗
║         PrivilegeGuardian  SIEM  Integrated Startup       ║
╚══════════════════════════════════════════════════════════╝${NC}
  Dir:  $PG_DIR
  API:  $PG_API
  Node: $PG_NODE
  Max events ingested: $MAX_INGEST  |  Keep DB: $KEEP_DB
"

[[ $EUID -ne 0 ]] && err "Run as root: sudo bash pg-start.sh"

# ════════════════════════════════════════════════════════════
# STEP 1 — Install dependencies
# ════════════════════════════════════════════════════════════
step "Checking system dependencies"

command -v curl  >/dev/null 2>&1 || { info "Installing curl..."; apt-get install -y curl &>/dev/null; }
command -v jq    >/dev/null 2>&1 || { info "Installing jq...";   apt-get install -y jq   &>/dev/null || true; }
[[ -x "$PG_NODE" ]] || err "Node.js not found at $PG_NODE. Install with: apt-get install -y nodejs"

if ! command -v auditd >/dev/null 2>&1; then
  info "Installing auditd..."
  if   command -v apt-get &>/dev/null; then apt-get install -y auditd audispd-plugins &>/dev/null
  elif command -v yum     &>/dev/null; then yum     install -y audit audit-libs       &>/dev/null
  elif command -v dnf     &>/dev/null; then dnf     install -y audit audit-libs       &>/dev/null
  else warn "Cannot install auditd automatically — install it manually"; fi
fi
ok "Dependencies satisfied"

# ════════════════════════════════════════════════════════════
# STEP 2 — Configure & start auditd
# ════════════════════════════════════════════════════════════
step "Configuring auditd"

RULES_FILE="/etc/audit/rules.d/privilegeguardian.rules"
mkdir -p /etc/audit/rules.d

cat > "$RULES_FILE" << 'RULES'
-D
-b 8192
-f 1

# Identity files
-w /etc/passwd   -p wa -k identity
-w /etc/shadow   -p wa -k identity
-w /etc/group    -p wa -k identity
-w /etc/sudoers  -p wa -k identity
-w /etc/sudoers.d/ -p wa -k identity

# SSH config
-w /etc/ssh/sshd_config -p wa -k sshd

# Privilege escalation binaries
-w /bin/su            -p x -k priv_esc
-w /usr/bin/sudo      -p x -k priv_esc
-w /usr/bin/newgrp    -p x -k priv_esc

# Cron
-w /etc/crontab       -p wa -k cron
-w /etc/cron.d/       -p wa -k cron
-w /var/spool/cron/crontabs -p wa -k cron

# Network
-w /etc/hosts         -p wa -k network
-w /etc/resolv.conf   -p wa -k network

# Syscalls: deletions, exec, chmod, chown
-a always,exit -F arch=b64 -S unlinkat -S rmdir    -k delete
-a always,exit -F arch=b32 -S unlinkat -S rmdir    -k delete
-a always,exit -F arch=b64 -S execve               -k exec
-a always,exit -F arch=b32 -S execve               -k exec
-a always,exit -F arch=b64 -S chmod -S fchmod -S fchmodat -k chmod
-a always,exit -F arch=b64 -S chown -S fchown -S fchownat -k chown
-a always,exit -F arch=b64 -S connect              -k net_connect
-a always,exit -F arch=b32 -S connect              -k net_connect
RULES

ok "Audit rules written to $RULES_FILE"

if systemctl is-active --quiet auditd 2>/dev/null; then
  systemctl restart auditd
  ok "auditd restarted"
else
  systemctl enable auditd &>/dev/null || true
  systemctl start  auditd
  ok "auditd started"
fi

sleep 2
augenrules --load 2>/dev/null || auditctl -R "$RULES_FILE" 2>/dev/null || true
RULE_COUNT=$(auditctl -l 2>/dev/null | grep -c '\-' || echo 0)
ok "auditd active — $RULE_COUNT rules loaded"

# Ensure log exists and is readable
mkdir -p /var/log/audit
touch /var/log/audit/audit.log
chmod 640 /var/log/audit/audit.log
touch /var/log/auth.log 2>/dev/null || true
ok "Log files ready"

# ════════════════════════════════════════════════════════════
# STEP 3 — Backend: npm install
# ════════════════════════════════════════════════════════════
step "Setting up backend"

BACKEND_DIR="$PG_DIR/backend"
[[ -d "$BACKEND_DIR" ]] || err "backend/ not found in $PG_DIR"

cd "$BACKEND_DIR"

if [[ ! -f node_modules/.package-lock.json && ! -d node_modules/express ]]; then
  info "Running npm install..."
  npm install --silent
  ok "npm packages installed"
else
  ok "node_modules present"
fi

# Create .env if missing
if [[ ! -f .env ]]; then
  info "Creating .env with defaults..."
  cat > .env << 'ENV'
MONGO_URI=mongodb://localhost:27017/siem
JWT_SECRET=privilegeguardian_secret_change_me
PORT=4000
AUDIT_LOG=/var/log/audit/audit.log
ENV
  ok ".env created"
fi

# ════════════════════════════════════════════════════════════
# STEP 4 — Start MongoDB if not running
# ════════════════════════════════════════════════════════════
step "Checking MongoDB"

if ! mongosh --eval "db.runCommand({ ping: 1 })" --quiet &>/dev/null 2>&1 && \
   ! mongo   --eval "db.runCommand({ ping: 1 })" --quiet &>/dev/null 2>&1; then
  if systemctl list-units --type=service | grep -q mongod; then
    info "Starting mongod..."
    systemctl start mongod 2>/dev/null || true
    sleep 3
    ok "mongod started"
  else
    warn "MongoDB not found as a service. Start it manually if needed."
    warn "Install: apt-get install -y mongodb  OR  use MongoDB Atlas"
  fi
else
  ok "MongoDB is reachable"
fi

# ════════════════════════════════════════════════════════════
# STEP 4b — Wipe the database for a clean demo (default)
# ════════════════════════════════════════════════════════════
if [[ "$KEEP_DB" == false ]]; then
  step "Wiping existing database for clean demo"

  MONGO_URI_VAL=$(grep -E '^MONGO_URI=' "$BACKEND_DIR/.env" | cut -d= -f2- | tr -d '"' || echo "mongodb://localhost:27017/siem")
  DB_NAME=$(echo "$MONGO_URI_VAL" | sed 's|.*/||' | cut -d'?' -f1)
  DB_NAME="${DB_NAME:-siem}"

  # Try mongosh first, fall back to mongo
  if command -v mongosh &>/dev/null; then
    mongosh "$MONGO_URI_VAL" --quiet --eval "
      db.auditlogs.deleteMany({});
      db.alerts.deleteMany({});
      db.reports.deleteMany({});
      print('Collections wiped: auditlogs, alerts, reports');
    " 2>/dev/null && ok "Database wiped via mongosh" || warn "mongosh wipe failed — will continue"
  elif command -v mongo &>/dev/null; then
    mongo "$MONGO_URI_VAL" --quiet --eval "
      db.auditlogs.deleteMany({});
      db.alerts.deleteMany({});
      db.reports.deleteMany({});
      print('Collections wiped');
    " 2>/dev/null && ok "Database wiped via mongo" || warn "mongo wipe failed — will continue"
  else
    warn "No mongo client found — skipping DB wipe (install mongosh to enable auto-wipe)"
  fi
else
  info "Skipping DB wipe (--keep-db passed)"
fi

# ════════════════════════════════════════════════════════════
# STEP 5 — Start backend API
# ════════════════════════════════════════════════════════════
step "Starting SIEM backend API"

cd "$BACKEND_DIR"

# Kill any existing backend
pkill -f "node.*server.js" 2>/dev/null || true
sleep 1

BACKEND_LOG="/var/log/pg-backend.log"
touch "$BACKEND_LOG"

if [[ "$NO_SEED" == false ]]; then
  info "Running seed (creates admin/auditor users + ~200 demo events)..."
  "$PG_NODE" seed.js >> "$BACKEND_LOG" 2>&1 || warn "Seed had errors — check $BACKEND_LOG"
  ok "Seed complete"
fi

info "Starting backend on port 4000..."
"$PG_NODE" server.js >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > /tmp/.pg_backend.pid

# Wait up to 20s for API to respond
MAX_WAIT=20; WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 \
    -X POST -H 'Content-Type: application/json' \
    -d '{"username":"__ping__","password":"__ping__"}' \
    "$PG_API/api/auth/login" 2>/dev/null || echo "000")
  [[ "$HTTP" == "401" || "$HTTP" == "200" ]] && break
  sleep 2; WAITED=$((WAITED+2))
  echo -n "."
done
echo ""

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  err "Backend exited. Check $BACKEND_LOG"
fi
ok "Backend running (PID $BACKEND_PID) — $PG_API"

# ════════════════════════════════════════════════════════════
# STEP 6 — Authenticate and get JWT
# ════════════════════════════════════════════════════════════
step "Authenticating with SIEM API"

AUTH_RESP=$(curl -sf --max-time 10 \
  -X POST "$PG_API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$PG_USER\",\"password\":\"$PG_PASS\"}" 2>&1) || \
  err "Login failed. Backend may still be starting — retry in a moment."

# Extract token (python3 or node fallback)
TOKEN=$( echo "$AUTH_RESP" | python3 -c \
  "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || \
  "$PG_NODE" -e \
  "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d.token);" \
  <<< "$AUTH_RESP" 2>/dev/null || true)

[[ -z "$TOKEN" ]] && err "Could not extract JWT. Response: $AUTH_RESP"
echo "$TOKEN" > "$TOKEN_FILE"; chmod 600 "$TOKEN_FILE"
ok "JWT obtained (expires in 12h)"

# ════════════════════════════════════════════════════════════
# STEP 7 — Ingest historical auditd log (capped at MAX_INGEST)
# ════════════════════════════════════════════════════════════
step "Ingesting historical audit events (cap: $MAX_INGEST)"

HIST_LOG="/var/log/audit/audit.log"
CONVERTED="/tmp/pg_audit_converted.jsonl"
INGESTED=0

if [[ -f "$HIST_LOG" && -s "$HIST_LOG" ]]; then
  LINE_COUNT=$(wc -l < "$HIST_LOG")
  info "Converting $LINE_COUNT raw auditd lines → NDJSON..."

  # Inline awk converter: raw auditd → newline-delimited JSON
  awk '
  function get(line, key,    pat, m) {
    pat = key "=\"([^\"]+)\""
    if (match(line, pat)) { return substr(line, RSTART+length(key)+2, RLENGTH-length(key)-3) }
    pat = key "=([^ ]+)"
    if (match(line, pat)) { return substr(line, RSTART+length(key)+1, RLENGTH-length(key)-1) }
    return ""
  }
  {
    if ($0 !~ /type=/) next
    type = get($0, "type")
    if (type !~ /SYSCALL|EXECVE|USER_LOGIN|USER_LOGOUT|USER_AUTH|USER_CMD|ADD_USER|DEL_USER|AVC|CONFIG_CHANGE/) next

    auid    = get($0, "auid");  uid  = get($0, "uid")
    syscall = get($0, "syscall"); comm = get($0, "comm"); exe = get($0, "exe")
    name    = get($0, "name");   res  = get($0, "res")

    # Username fallback
    username = (auid != "" && auid != "4294967295" && auid != "-1") ? "uid_" auid : \
               (uid  != "" && uid  != "4294967295" && uid  != "-1") ? "uid_" uid : "unknown"
    # Common root
    if (auid == "0" || uid == "0") username = "root"

    # Action mapping
    action = "unknown"
    if (type == "EXECVE")                              action = "execute"
    else if (type == "USER_LOGIN" || type == "USER_AUTH") action = "login"
    else if (type == "USER_LOGOUT")                    action = "logout"
    else if (type == "ADD_USER")                       action = "add_user"
    else if (type == "DEL_USER")                       action = "del_user"
    else if (type == "USER_CMD")                       action = "sudo"
    else if (type == "AVC")                            action = "selinux_denial"
    else if (type == "CONFIG_CHANGE")                  action = "config_change"
    else if (syscall == "87" || syscall == "263")      action = "unlink"
    else if (syscall == "59")                          action = "execute"
    else if (syscall == "2" || syscall == "257")       action = "open"
    else if (syscall == "1")                           action = "write"
    else if (syscall == "0")                           action = "read"
    else                                               action = (comm != "") ? comm : "unknown"

    # File
    file = (name != "") ? name : (exe != "") ? exe : (comm != "") ? comm : "unknown"
    gsub(/\\000/, "", file)

    # Status
    status = (res == "success" || res == "yes" || res == "0") ? "allowed" : "denied"

    # Emit JSON (escape quotes in file path)
    gsub(/"/, "\\\"", file)
    printf "{\"username\":\"%s\",\"action\":\"%s\",\"file\":\"%s\",\"status\":\"%s\",\"raw_type\":\"%s\"}\n", \
           username, action, file, status, type
  }
  ' "$HIST_LOG" > "$CONVERTED" 2>/dev/null || true

  if [[ -s "$CONVERTED" ]]; then
    TOTAL_CONVERTED=$(wc -l < "$CONVERTED")

    # ── Cap to MAX_INGEST lines (take the most recent ones) ──────────────────
    if [[ "$TOTAL_CONVERTED" -gt "$MAX_INGEST" ]]; then
      warn "Found $TOTAL_CONVERTED convertible events — capping to $MAX_INGEST most recent"
      tail -n "$MAX_INGEST" "$CONVERTED" > "${CONVERTED}.capped"
      mv "${CONVERTED}.capped" "$CONVERTED"
      TOTAL_CONVERTED=$MAX_INGEST
    fi

    info "Ingesting $TOTAL_CONVERTED events via API (throttled to 20 req/s)..."

    BATCH=0
    while IFS= read -r line; do
      curl -sf -X POST "$PG_API/api/events/ingest" \
        -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' \
        -d "$line" &>/dev/null || true
      BATCH=$((BATCH+1)); INGESTED=$((INGESTED+1))
      # Throttle: 20 requests/s
      [[ $((BATCH % 20)) -eq 0 ]] && sleep 1
      [[ $((INGESTED % 100)) -eq 0 ]] && echo -n "  $INGESTED/$TOTAL_CONVERTED ingested..."$'\r'
    done < "$CONVERTED"
    echo ""
    ok "Ingested $INGESTED historical events (+ ~200 synthetic demo events from seed)"
  else
    warn "No relevant auditd events found in $HIST_LOG — only synthetic demo data from seed"
  fi
else
  warn "$HIST_LOG empty or missing — only synthetic demo data from seed will be used"
fi

# ════════════════════════════════════════════════════════════
# STEP 8 — Start real-time collector
# ════════════════════════════════════════════════════════════
step "Starting real-time collector"

COLLECTOR_JS="$PG_DIR/collector.js"
[[ -f "$COLLECTOR_JS" ]] || err "collector.js not found at $COLLECTOR_JS"

# Stop any existing collector
if [[ -f "$COLLECTOR_PID_FILE" ]]; then
  OLD_PID=$(cat "$COLLECTOR_PID_FILE")
  kill "$OLD_PID" 2>/dev/null || true
  sleep 1
fi
pkill -f "collector.js" 2>/dev/null || true
sleep 1

touch "$COLLECTOR_LOG"
"$PG_NODE" "$COLLECTOR_JS" "$TOKEN" "$PG_API" >> "$COLLECTOR_LOG" 2>&1 &
COLL_PID=$!
echo "$COLL_PID" > "$COLLECTOR_PID_FILE"

sleep 3
if ! kill -0 "$COLL_PID" 2>/dev/null; then
  err "Collector exited immediately. Check $COLLECTOR_LOG"
fi
ok "Collector running (PID $COLL_PID) — tailing auditd + auth.log"

# ════════════════════════════════════════════════════════════
# STEP 9 — Frontend hint
# ════════════════════════════════════════════════════════════
step "Frontend"

FRONTEND_DIR="$PG_DIR/frontend"
if [[ -d "$FRONTEND_DIR" ]]; then
  cd "$FRONTEND_DIR"
  if [[ ! -d node_modules ]]; then
    info "Installing frontend deps..."
    npm install --silent &
    FRONT_NPM_PID=$!
    ok "Frontend npm install running in background (PID $FRONT_NPM_PID)"
  fi
  info "To start frontend: cd frontend && npm run dev"
fi

# ════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════
echo -e "
${GREEN}╔══════════════════════════════════════════════════════════╗
║           PrivilegeGuardian — ALL SYSTEMS GO 🟢           ║
╚══════════════════════════════════════════════════════════╝${NC}

  ${BOLD}Backend API:${NC}  $PG_API           (PID $(cat /tmp/.pg_backend.pid 2>/dev/null || echo '?'))
  ${BOLD}Collector:${NC}    live auditd stream  (PID $COLL_PID)
  ${BOLD}Historical:${NC}   $INGESTED events ingested (cap: $MAX_INGEST)
  ${BOLD}Audit rules:${NC}  $RULE_COUNT active rules

  ${CYAN}Credentials:${NC}
    Admin:   admin   / admin123
    Auditor: auditor / auditor123

  ${CYAN}Useful commands:${NC}
    tail -f $COLLECTOR_LOG           # live collector output
    tail -f /var/log/pg-backend.log  # backend logs
    tail -f /var/log/audit/audit.log # raw auditd stream
    sudo auditctl -l                 # list active rules
    kill \$(cat $COLLECTOR_PID_FILE)    # stop collector
    kill \$(cat /tmp/.pg_backend.pid)   # stop backend

  ${CYAN}API (with saved token):${NC}
    TOKEN=\$(cat $TOKEN_FILE)
    curl -H \"Authorization: Bearer \$TOKEN\" $PG_API/api/stats

  ${CYAN}Re-run options:${NC}
    sudo bash pg-start.sh              # fresh wipe + seed every time (default)
    sudo bash pg-start.sh --keep-db   # keep existing DB, no wipe
    sudo bash pg-start.sh --no-seed   # skip demo seed (historical only)
"
