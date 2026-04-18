#!/usr/bin/env bash
# PrivilegeGuardian - SIEM Admin CLI
# Usage: bash siem-admin.sh <command> [args]
# Commands: add-user, del-user, list-users, lock-user, unlock-user,
#           add-sudo, del-sudo, show-logins, show-failed, replay-log,
#           get-token, purge-events, check-status

set -euo pipefail
API_URL="${PG_API:-http://localhost:4000}"
TOKEN_FILE="/tmp/.pg_token"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*"; exit 1; }
info() { echo -e "${CYAN}→${NC}  $*"; }

# ── Auth helpers ──────────────────────────────────────────────────────────────
api_login() {
  local user=$1 pass=$2
  local resp
  resp=$(curl -sf -X POST "$API_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}" 2>&1) || err "API unreachable at $API_URL"
  local tok
  tok=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null) || err "Login failed: $resp"
  echo "$tok" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  ok "Authenticated as $user"
}

token() {
  if [[ -f "$TOKEN_FILE" ]]; then cat "$TOKEN_FILE"
  else err "Not authenticated. Run: bash siem-admin.sh get-token <user> <pass>"; fi
}

api() {
  local method=$1 path=$2
  shift 2
  curl -sf -X "$method" "$API_URL$path" \
    -H "Authorization: Bearer $(token)" \
    -H 'Content-Type: application/json' "$@"
}

# ── Commands ──────────────────────────────────────────────────────────────────
CMD="${1:-help}"
shift 2>/dev/null || true

case "$CMD" in

# ── Auth ──────────────────────────────────────────────────────────────────────
get-token)
  [[ $# -lt 2 ]] && err "Usage: get-token <username> <password>"
  api_login "$1" "$2"
  ;;

# ── Linux User Management ─────────────────────────────────────────────────────
add-user)
  [[ $# -lt 1 ]] && err "Usage: add-user <username> [password] [--sudo]"
  [[ $EUID -ne 0 ]] && err "Run as root"
  USERNAME="$1"
  PASSWORD="${2:-$(openssl rand -base64 12)}"
  SUDO_FLAG="${3:-}"

  useradd -m -s /bin/bash "$USERNAME" 2>/dev/null || warn "User may already exist"
  echo "$USERNAME:$PASSWORD" | chpasswd
  ok "Linux user '$USERNAME' created (password: $PASSWORD)"

  if [[ "$SUDO_FLAG" == "--sudo" ]]; then
    usermod -aG sudo "$USERNAME"
    ok "Added $USERNAME to sudo group"
  fi

  # Also add to SIEM DB
  info "Registering in SIEM..."
  api POST /api/users -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\",\"role\":\"auditor\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'SIEM user created: {d[\"user\"][\"username\"]} ({d[\"user\"][\"role\"]})')" 2>/dev/null || warn "SIEM registration failed (API may not be running)"
  ;;

del-user)
  [[ $# -lt 1 ]] && err "Usage: del-user <username> [--keep-home]"
  [[ $EUID -ne 0 ]] && err "Run as root"
  USERNAME="$1"
  KEEP="${2:-}"

  if [[ "$KEEP" == "--keep-home" ]]; then
    userdel "$USERNAME"
  else
    userdel -r "$USERNAME" 2>/dev/null || userdel "$USERNAME"
  fi
  ok "Linux user '$USERNAME' deleted"
  ;;

lock-user)
  [[ $# -lt 1 ]] && err "Usage: lock-user <username>"
  [[ $EUID -ne 0 ]] && err "Run as root"
  passwd -l "$1"
  ok "User '$1' locked"
  ;;

unlock-user)
  [[ $# -lt 1 ]] && err "Usage: unlock-user <username>"
  [[ $EUID -ne 0 ]] && err "Run as root"
  passwd -u "$1"
  ok "User '$1' unlocked"
  ;;

add-sudo)
  [[ $# -lt 1 ]] && err "Usage: add-sudo <username>"
  [[ $EUID -ne 0 ]] && err "Run as root"
  usermod -aG sudo "$1"
  ok "User '$1' added to sudo group"
  ;;

del-sudo)
  [[ $# -lt 1 ]] && err "Usage: del-sudo <username>"
  [[ $EUID -ne 0 ]] && err "Run as root"
  gpasswd -d "$1" sudo
  ok "User '$1' removed from sudo group"
  ;;

list-users)
  echo -e "\n${CYAN}═══ System Users (login shells) ═══${NC}"
  getent passwd | awk -F: '$7 ~ /bash|sh|zsh/ && $3 >= 1000 {printf "  %-20s UID:%-6s HOME:%s\n", $1, $3, $6}'
  echo ""
  echo -e "${CYAN}═══ SIEM Users ═══${NC}"
  api GET /api/users | python3 -c "
import sys, json
users = json.load(sys.stdin)
for u in users:
    print(f'  {u[\"username\"]:<20} {u[\"role\"]:<10} {u[\"createdAt\"][:10]}')
" 2>/dev/null || warn "SIEM API not reachable"
  ;;

# ── Log / Forensics ───────────────────────────────────────────────────────────
show-logins)
  echo -e "\n${CYAN}═══ Recent Logins ═══${NC}"
  last -n 20 | head -25
  echo -e "\n${CYAN}═══ Currently Logged In ═══${NC}"
  who
  ;;

show-failed)
  echo -e "\n${CYAN}═══ Failed Login Attempts ═══${NC}"
  faillog -a 2>/dev/null || lastb -n 20 2>/dev/null || grep "Failed\|failure\|FAILED" /var/log/auth.log 2>/dev/null | tail -20 || warn "No failed login data available"
  ;;

show-sudo)
  echo -e "\n${CYAN}═══ Recent Sudo Usage ═══${NC}"
  grep -i sudo /var/log/auth.log 2>/dev/null | tail -20 || journalctl -t sudo -n 20 2>/dev/null || warn "No sudo log available"
  ;;

show-audit)
  echo -e "\n${CYAN}═══ Recent Audit Events ═══${NC}"
  ausearch -i --start recent 2>/dev/null | tail -40 || \
    tail -40 /var/log/audit/audit.log 2>/dev/null || \
    warn "No audit log available (run setup.sh first)"
  ;;

replay-log)
  [[ $# -lt 1 ]] && err "Usage: replay-log <path/to/audit.log>"
  info "Replaying $1 into SIEM..."
  api POST /api/events/replay -d "{\"path\":\"$1\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','done'))"
  ;;

# ── SIEM API Ops ──────────────────────────────────────────────────────────────
purge-events)
  warn "This will delete all SIEM reports. Events are kept."
  read -p "Confirm? [y/N] " -n 1 -r; echo
  [[ $REPLY =~ ^[Yy]$ ]] || exit 0
  api DELETE /api/reports | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Deleted {d[\"count\"]} reports')"
  ;;

check-status)
  echo -e "\n${CYAN}═══ System Status ═══${NC}"
  echo -n "  auditd:      "; systemctl is-active auditd 2>/dev/null || echo "not running"
  echo -n "  SIEM API:    "; curl -sf "$API_URL/api/auth/me" -H "Authorization: Bearer $(token)" &>/dev/null && echo "running" || echo "unreachable"
  echo -n "  Audit rules: "; auditctl -l 2>/dev/null | wc -l | xargs echo "rules loaded"
  echo -n "  Audit log:   "; ls -lh /var/log/audit/audit.log 2>/dev/null || echo "not found"
  echo -n "  Auth log:    "; ls -lh /var/log/auth.log 2>/dev/null || echo "not found"
  echo ""
  ;;

# ── Auditd shortcuts ──────────────────────────────────────────────────────────
watch-file)
  [[ $# -lt 1 ]] && err "Usage: watch-file <path>"
  [[ $EUID -ne 0 ]] && err "Run as root"
  auditctl -w "$1" -p warx -k "pg_watch_$(basename $1)"
  ok "Watching $1 for read/write/exec/attr changes"
  ;;

unwatch-file)
  [[ $# -lt 1 ]] && err "Usage: unwatch-file <path>"
  [[ $EUID -ne 0 ]] && err "Run as root"
  auditctl -W "$1" -p warx -k "pg_watch_$(basename $1)"
  ok "Removed watch on $1"
  ;;

list-rules)
  [[ $EUID -ne 0 ]] && err "Run as root"
  auditctl -l
  ;;

# ── Help ──────────────────────────────────────────────────────────────────────
help|*)
  echo -e "
${CYAN}PrivilegeGuardian - SIEM Admin CLI${NC}

${GREEN}Auth:${NC}
  get-token <user> <pass>      Authenticate & store token

${GREEN}Linux User Management (root required):${NC}
  add-user <user> [pass] [--sudo]  Create Linux + SIEM user
  del-user <user> [--keep-home]    Delete Linux user
  lock-user <user>                 Lock account
  unlock-user <user>               Unlock account
  add-sudo <user>                  Grant sudo
  del-sudo <user>                  Revoke sudo
  list-users                       List system + SIEM users

${GREEN}Forensics:${NC}
  show-logins                  Recent logins (last/who)
  show-failed                  Failed login attempts
  show-sudo                    Recent sudo usage
  show-audit                   Recent auditd events
  replay-log <path>            Replay a .log file into SIEM

${GREEN}SIEM Ops:${NC}
  purge-events                 Delete all reports
  check-status                 System health check

${GREEN}Audit Rules (root required):${NC}
  watch-file <path>            Add audit watch
  unwatch-file <path>          Remove audit watch
  list-rules                   Show active rules

${GREEN}Env:${NC}
  PG_API=http://...            Override API URL (default: http://localhost:4000)
"
  ;;
esac
