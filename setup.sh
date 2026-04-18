#!/usr/bin/env bash
# PrivilegeGuardian - System Setup Script
# Run as root: sudo bash setup.sh
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
info() { echo -e "${CYAN}[→]${NC} $*"; }

[[ $EUID -ne 0 ]] && err "Run as root: sudo bash setup.sh"

# ── 1. Install auditd ────────────────────────────────────────────────────────
log "Installing auditd..."
if command -v apt-get &>/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y auditd audispd-plugins
elif command -v yum &>/dev/null; then
  yum install -y audit audit-libs
elif command -v dnf &>/dev/null; then
  dnf install -y audit audit-libs
else
  warn "Package manager not found — skipping install (auditd must already be present)"
fi

# Verify auditd binary exists
command -v auditctl >/dev/null 2>&1 || err "auditctl not found after install — aborting"

# ── 2. Configure auditd.conf ─────────────────────────────────────────────────
log "Writing /etc/audit/auditd.conf..."
mkdir -p /etc/audit
cat > /etc/audit/auditd.conf << 'EOF'
log_file = /var/log/audit/audit.log
log_format = RAW
log_group = root
priority_boost = 4
flush = INCREMENTAL_ASYNC
freq = 50
num_logs = 5
max_log_file = 50
max_log_file_action = ROTATE
space_left = 75
space_left_action = SYSLOG
admin_space_left = 50
admin_space_left_action = SUSPEND
disk_full_action = SUSPEND
disk_error_action = SUSPEND
EOF

# ── 3. Write audit rules ─────────────────────────────────────────────────────
log "Writing audit rules to /etc/audit/rules.d/privilegeguardian.rules..."
mkdir -p /etc/audit/rules.d

cat > /etc/audit/rules.d/privilegeguardian.rules << 'RULES'
## PrivilegeGuardian audit rules
## Loaded by augenrules / auditctl

# Remove all existing rules first
-D

# Increase kernel buffer
-b 8192

# Failure mode: 1=silent log, 2=panic (use 1 for production)
-f 1

# ── Identity & Credentials ───────────────────────────────────────────
-w /etc/passwd    -p wa -k identity
-w /etc/shadow    -p wa -k identity
-w /etc/group     -p wa -k identity
-w /etc/gshadow   -p wa -k identity
-w /etc/sudoers   -p wa -k identity
-w /etc/sudoers.d -p wa -k identity

# ── Login / Session files ─────────────────────────────────────────────
-w /var/log/lastlog  -p wa -k logins
-w /var/run/faillock -p wa -k logins
-w /var/log/tallylog -p wa -k logins

# ── SSH ───────────────────────────────────────────────────────────────
-w /etc/ssh/sshd_config -p wa -k sshd

# ── Privilege Escalation binaries ─────────────────────────────────────
-w /bin/su            -p x -k priv_esc
-w /usr/bin/sudo      -p x -k priv_esc
-w /usr/bin/newgrp    -p x -k priv_esc
-w /usr/bin/chsh      -p x -k priv_esc
-w /usr/bin/chfn      -p x -k priv_esc
-w /usr/sbin/usermod  -p x -k priv_esc
-w /usr/sbin/useradd  -p x -k priv_esc
-w /usr/sbin/userdel  -p x -k priv_esc

# ── Cron ──────────────────────────────────────────────────────────────
-w /etc/cron.allow         -p wa -k cron
-w /etc/cron.deny          -p wa -k cron
-w /etc/cron.d             -p wa -k cron
-w /etc/crontab            -p wa -k cron
-w /var/spool/cron/crontabs -p wa -k cron

# ── Network config ────────────────────────────────────────────────────
-w /etc/hosts       -p wa -k network
-w /etc/resolv.conf -p wa -k network

# ── Kernel modules ────────────────────────────────────────────────────
-w /sbin/insmod   -p x -k modules
-w /sbin/rmmod    -p x -k modules
-w /sbin/modprobe -p x -k modules

# ── Syscall rules (64-bit) ────────────────────────────────────────────

# File deletion
-a always,exit -F arch=b64 -S unlinkat -S rmdir -k delete
-a always,exit -F arch=b32 -S unlinkat -S rmdir -k delete

# Permission changes
-a always,exit -F arch=b64 -S chmod -S fchmod -S fchmodat -k chmod
-a always,exit -F arch=b32 -S chmod -S fchmod -S fchmodat -k chmod

# Ownership changes
-a always,exit -F arch=b64 -S chown -S fchown -S fchownat -k chown
-a always,exit -F arch=b32 -S chown -S fchown -S fchownat -k chown

# Process execution (high volume — comment out if too noisy)
-a always,exit -F arch=b64 -S execve -k exec
-a always,exit -F arch=b32 -S execve -k exec

# Network connections
-a always,exit -F arch=b64 -S connect -k net_connect
-a always,exit -F arch=b32 -S connect -k net_connect

# Mount / unmount
-a always,exit -F arch=b64 -S mount -S umount2 -k mount
-a always,exit -F arch=b32 -S mount  -k mount

# Open files (read access) — uncomment for full file-open tracking (very noisy)
# -a always,exit -F arch=b64 -S open -S openat -k open
RULES

log "Rules file written."

# ── 4. Ensure log directory exists ───────────────────────────────────────────
mkdir -p /var/log/audit
touch /var/log/audit/audit.log
chmod 640 /var/log/audit/audit.log

# ── 5. Start / restart auditd ────────────────────────────────────────────────
log "Enabling and starting auditd..."
systemctl enable auditd 2>/dev/null || true
systemctl stop auditd 2>/dev/null || true
sleep 1
systemctl start auditd
sleep 2   # give auditd time to bind before we push rules

if ! systemctl is-active --quiet auditd; then
  err "auditd failed to start. Check: journalctl -xe -u auditd"
fi
log "auditd is running."

# ── 6. Load rules ─────────────────────────────────────────────────────────────
log "Loading audit rules..."

# Prefer augenrules (reads /etc/audit/rules.d/*.rules)
if command -v augenrules &>/dev/null; then
  augenrules --load
  LOAD_METHOD="augenrules"
else
  # Fallback: load directly with auditctl
  auditctl -D                                        # clear first
  auditctl -R /etc/audit/rules.d/privilegeguardian.rules
  LOAD_METHOD="auditctl -R"
fi
log "Rules loaded via $LOAD_METHOD."

# ── 7. Verify ────────────────────────────────────────────────────────────────
log "Verifying rules..."
SYSCALL_COUNT=$(auditctl -l 2>/dev/null | grep -c 'SYSCALL' || true)
WATCH_COUNT=$(auditctl -l 2>/dev/null | grep -c '\-w ' || true)

if [[ "$SYSCALL_COUNT" -gt 0 ]] || [[ "$WATCH_COUNT" -gt 0 ]]; then
  log "Rules active: ${SYSCALL_COUNT} syscall rules, ${WATCH_COUNT} file-watch rules"
else
  warn "No rules detected after load — check: sudo auditctl -l"
  warn "If auditd is inside a container, syscall rules may be blocked by the host kernel."
fi

# Print current rules for confirmation
info "Current active rules:"
auditctl -l 2>/dev/null | head -30 || true

# ── 8. Fix auth.log ──────────────────────────────────────────────────────────
touch /var/log/auth.log 2>/dev/null || true
chmod 640 /var/log/auth.log 2>/dev/null || true

# ── 9. Create siem system user ───────────────────────────────────────────────
log "Creating siem system user..."
if ! id siem &>/dev/null; then
  useradd -r -s /sbin/nologin -d /opt/privilegeguardian siem
  log "siem user created."
else
  log "siem user already exists."
fi
usermod -aG adm siem 2>/dev/null || true

# Give siem read access to audit log
setfacl -m u:siem:r /var/log/audit/audit.log 2>/dev/null || \
  chmod o+r /var/log/audit/audit.log 2>/dev/null || true

# ── 10. Quick sanity: write a test event ────────────────────────────────────
log "Writing test audit event..."
auditctl -m "PrivilegeGuardian setup complete — test event" 2>/dev/null || true
sleep 1
if grep -q "PrivilegeGuardian" /var/log/audit/audit.log 2>/dev/null; then
  log "Test event confirmed in audit log ✔"
else
  warn "Test event not found in log yet — may take a moment."
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  PrivilegeGuardian setup complete                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Next steps:"
echo "  1. Start backend:   cd backend && npm run dev"
echo "  2. Get JWT token:   bash siem-admin.sh get-token admin admin123"
echo "  3. Start collector: sudo bash start-collector.sh"
echo ""
echo "  Useful commands:"
echo "    sudo auditctl -l              # list active rules"
echo "    sudo auditctl -s              # show auditd status"
echo "    sudo tail -f /var/log/audit/audit.log"
echo "    journalctl -u auditd -f       # auditd logs"
