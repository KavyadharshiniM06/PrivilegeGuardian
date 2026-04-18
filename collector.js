#!/usr/bin/env node
/**
 * PrivilegeGuardian — Real-time auditd Collector  (FAANG-grade v3)
 *
 * Tails /var/log/audit/audit.log AND /var/log/auth.log,
 * assembles multi-record audit events, resolves UIDs,
 * and ships enriched events to the SIEM API with back-pressure control.
 *
 * Usage: sudo node collector.js <JWT_TOKEN> [API_URL]
 */

'use strict';

const { execSync, spawn } = require('child_process');
const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const os     = require('os');

const TOKEN   = process.argv[2];
const API_URL = (process.argv[3] || 'http://localhost:4000').replace(/\/$/, '');

if (!TOKEN) {
  console.error('Usage: sudo node collector.js <JWT_TOKEN> [API_URL]');
  process.exit(1);
}

// ── Constants ──────────────────────────────────────────────────────────────────
const HOSTNAME = os.hostname();

// Complete Linux syscall → action mapping (x86_64)
const SYSCALL_MAP = {
  '0':'read','1':'write','2':'open','3':'close','4':'stat','5':'fstat',
  '6':'lstat','7':'poll','8':'lseek','9':'mmap','10':'mprotect',
  '11':'munmap','12':'brk','13':'rt_sigaction','14':'rt_sigprocmask',
  '17':'pread64','18':'pwrite64','19':'readv','20':'writev',
  '21':'access','22':'pipe','23':'select','24':'sched_yield',
  '28':'madvise','32':'dup','33':'dup2','39':'getpid','41':'socket',
  '42':'connect','43':'accept','44':'sendto','45':'recvfrom',
  '46':'sendmsg','47':'recvmsg','48':'shutdown','49':'bind',
  '50':'listen','54':'setsockopt','55':'getsockopt','56':'clone',
  '57':'fork','58':'vfork','59':'execve','60':'exit','61':'wait4',
  '62':'kill','63':'uname','64':'semget','65':'semop','66':'semctl',
  '72':'fcntl','73':'flock','74':'fsync','75':'fdatasync',
  '76':'truncate','77':'ftruncate','78':'getdents','79':'getcwd',
  '80':'chdir','81':'fchdir','82':'rename','83':'mkdir','84':'rmdir',
  '85':'creat','86':'link','87':'unlink','88':'symlink','89':'readlink',
  '90':'chmod','91':'chown','92':'lchown','93':'umask','94':'gettimeofday',
  '96':'getrlimit','97':'getrusage','99':'sysinfo','100':'times',
  '105':'setuid','106':'setgid','107':'geteuid','108':'getegid',
  '109':'setpgid','110':'getppid','112':'setsid','113':'setreuid',
  '114':'setregid','117':'setresuid','118':'getresuid','119':'setresgid',
  '120':'getresgid','121':'getpgrp','122':'sethostname','123':'setdomainname',
  '126':'create_module','128':'init_module','129':'delete_module',
  '131':'quotactl','132':'getpmsg','133':'putpmsg','134':'afs_syscall',
  '135':'tuxcall','136':'security','137':'gettid','138':'readahead',
  '157':'prctl','160':'arch_prctl','161':'adjtimex','162':'setrlimit',
  '163':'chroot','164':'sync','165':'acct','166':'settimeofday',
  '167':'mount','168':'umount2','169':'swapon','170':'swapoff',
  '171':'reboot','172':'sethostname','173':'setdomainname',
  '175':'init_module','176':'delete_module','180':'ioperm',
  '186':'gettid','188':'setxattr','189':'lsetxattr','190':'fsetxattr',
  '191':'getxattr','192':'lgetxattr','193':'fgetxattr','194':'listxattr',
  '195':'llistxattr','196':'flistxattr','197':'removexattr',
  '198':'lremovexattr','199':'fremovexattr','200':'tkill',
  '202':'futex','206':'io_setup','207':'io_destroy','208':'io_getevents',
  '209':'io_submit','210':'io_cancel','213':'epoll_create','214':'epoll_ctl_old',
  '215':'epoll_wait_old','216':'remap_file_pages','217':'getdents64',
  '218':'set_tid_address','219':'restart_syscall','220':'semtimedop',
  '221':'fadvise64','222':'timer_create','223':'timer_settime',
  '224':'timer_gettime','225':'timer_getoverrun','226':'timer_delete',
  '227':'clock_settime','228':'clock_gettime','229':'clock_getres',
  '230':'clock_nanosleep','231':'exit_group','232':'epoll_wait',
  '233':'epoll_ctl','234':'tgkill','235':'utimes','237':'mbind',
  '238':'set_mempolicy','239':'get_mempolicy','240':'mq_open',
  '241':'mq_unlink','242':'mq_timedsend','243':'mq_timedreceive',
  '244':'mq_notify','245':'mq_getsetattr','246':'kexec_load',
  '247':'waitid','248':'add_key','249':'request_key','250':'keyctl',
  '251':'ioprio_set','252':'ioprio_get','253':'inotify_init',
  '254':'inotify_add_watch','255':'inotify_rm_watch','256':'migrate_pages',
  '257':'openat','258':'mkdirat','259':'mknodat','260':'fchownat',
  '261':'futimesat','262':'newfstatat','263':'unlinkat','264':'renameat',
  '265':'linkat','266':'symlinkat','267':'readlinkat','268':'fchmodat',
  '269':'faccessat','270':'pselect6','271':'ppoll','272':'unshare',
  '273':'set_robust_list','274':'get_robust_list','275':'splice',
  '276':'tee','277':'sync_file_range','278':'vmsplice','279':'move_pages',
  '280':'utimensat','281':'epoll_pwait','282':'signalfd','283':'timerfd_create',
  '284':'eventfd','285':'fallocate','286':'timerfd_settime',
  '287':'timerfd_gettime','288':'accept4','289':'signalfd4',
  '290':'eventfd2','291':'epoll_create1','292':'dup3','293':'pipe2',
  '294':'inotify_init1','295':'preadv','296':'pwritev','297':'rt_tgsigqueueinfo',
  '298':'perf_event_open','299':'recvmmsg','300':'fanotify_init',
  '301':'fanotify_mark','302':'prlimit64','303':'name_to_handle_at',
  '304':'open_by_handle_at','305':'clock_adjtime','306':'syncfs',
  '307':'sendmmsg','308':'setns','309':'getcpu','310':'process_vm_readv',
  '311':'process_vm_writev','312':'kcmp','313':'finit_module',
  '314':'sched_setattr','315':'sched_getattr','316':'renameat2',
  '317':'seccomp','318':'getrandom','319':'memfd_create','320':'kexec_file_load',
  '321':'bpf','322':'execveat','323':'userfaultfd','324':'membarrier',
  '325':'mlock2','326':'copy_file_range','327':'preadv2','328':'pwritev2',
  '329':'pkey_mprotect','330':'pkey_alloc','331':'pkey_free',
  '332':'statx','333':'io_pgetevents','334':'rseq',
};

// Sensitive syscalls that always generate events regardless of filter
const HIGH_INTEREST_SYSCALLS = new Set([
  '59','57','56','87','263','88','90','91','86','265','82','264','316',
  '105','106','113','114','117','119','163','167','168','129',
  '186','200','234','62',
]);

// auditd types we care about
const RELEVANT_TYPES = new Set([
  'SYSCALL','EXECVE','PATH','USER_LOGIN','USER_LOGOUT',
  'USER_AUTH','USER_ACCT','USER_CMD','USER_CHAUTHTOK',
  'ADD_USER','DEL_USER','ADD_GROUP','DEL_GROUP',
  'PRIV_USE','CRED_ACQ','CRED_DISP','CRED_REFR',
  'USER_START','USER_END','USER_ERR',
  'ANOM_PROMISCUOUS','ANOM_ABEND','ANOM_LINK',
  'AVC','MAC_POLICY_LOAD','MAC_STATUS',
  'NETFILTER_PKT','NETFILTER_CFG',
  'CONFIG_CHANGE','SYSTEM_BOOT','SYSTEM_SHUTDOWN','SYSTEM_RUNLEVEL',
  'SERVICE_START','SERVICE_STOP',
  'KERN_MODULE','MODULE_RUN_FAIL','DEV_ALLOC','DEV_DEALLOC',
  'SECCOMP','CAPSET','CAPGET',
  'CRYPTO_SESSION','CRYPTO_KEY_USER','CRYPTO_LOGIN',
  'INTEGRITY_DATA','INTEGRITY_METADATA','INTEGRITY_STATUS',
  'LABEL_LEVEL_CHANGE','LABEL_OVERRIDE',
  'DAEMON_START','DAEMON_END','DAEMON_ABORT','DAEMON_CONFIG',
]);

// ── UID → Username cache ───────────────────────────────────────────────────────
const uidCache = new Map([
  ['0', 'root'],
  ['4294967295', null],  // unset auid
  ['-1', null],
  ['(null)', null],
]);

function buildUidCache() {
  try {
    const lines = fs.readFileSync('/etc/passwd', 'utf8').split('\n');
    for (const line of lines) {
      const p = line.split(':');
      if (p.length >= 3 && p[0] && p[2]) {
        uidCache.set(p[2], p[0]);
      }
    }
    console.log(`[Collector] UID cache built: ${uidCache.size} entries`);
  } catch (e) {
    console.warn('[Collector] /etc/passwd unreadable:', e.message);
  }
}

function resolveUid(uid) {
  if (!uid) return null;
  const s = String(uid);
  if (uidCache.has(s)) return uidCache.get(s);
  try {
    const name = execSync(`getent passwd ${s} 2>/dev/null | cut -d: -f1`, { timeout: 300 })
      .toString().trim();
    const result = name || `uid_${s}`;
    uidCache.set(s, result);
    return result;
  } catch (_) {
    const fallback = `uid_${s}`;
    uidCache.set(s, fallback);
    return fallback;
  }
}

// ── auditd multi-record event assembler ───────────────────────────────────────
// Real auditd logs emit multiple records sharing the same serial (event ID).
// We buffer them and emit a single enriched event per serial.
const EVENT_TIMEOUT_MS = 250;   // flush incomplete events after 250ms
const pendingEvents    = new Map(); // serial → { records, timer }

function getSerial(line) {
  const m = line.match(/msg=audit\([\d.]+:(\d+)\)/);
  return m ? m[1] : null;
}

function scheduleFlush(serial) {
  const entry = pendingEvents.get(serial);
  if (!entry) return;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    const e = pendingEvents.get(serial);
    if (e) { pendingEvents.delete(serial); emitEvent(e.records); }
  }, EVENT_TIMEOUT_MS);
}

function ingestAuditLine(line) {
  if (!line.trim()) return;

  // Quick type check before expensive parsing
  const typeM = line.match(/\btype=([A-Z_]+)\b/);
  if (!typeM || !RELEVANT_TYPES.has(typeM[1])) return;

  const serial = getSerial(line);
  if (!serial) { emitEvent([line]); return; }

  if (!pendingEvents.has(serial)) {
    pendingEvents.set(serial, { records: [], timer: null });
  }
  pendingEvents.get(serial).records.push(line);
  scheduleFlush(serial);

  // Flush immediately on EOE marker (auditd 3.x)
  if (typeM[1] === 'EOE') {
    const entry = pendingEvents.get(serial);
    if (entry) { clearTimeout(entry.timer); pendingEvents.delete(serial); emitEvent(entry.records); }
  }
}

// ── Field extractor ────────────────────────────────────────────────────────────
function get(line, key) {
  const m = line.match(new RegExp(`\\b${key}=(?:"([^"]*)"|(\\S+))`));
  return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
}

function getTimestamp(line) {
  const m = line.match(/msg=audit\((\d+)\.(\d+):\d+\)/);
  if (!m) return new Date().toISOString();
  return new Date(parseInt(m[1], 10) * 1000 + Math.floor(parseInt(m[2], 10) / 1000)).toISOString();
}

// ── Core event builder ─────────────────────────────────────────────────────────
function emitEvent(records) {
  // Find primary SYSCALL record first
  const syscallRec = records.find(r => r.includes('type=SYSCALL'));
  const execveRec  = records.find(r => r.includes('type=EXECVE'));
  const pathRec    = records.find(r => r.includes('type=PATH'));
  const userRec    = records.find(r => /type=USER_|type=ADD_|type=DEL_|type=CRED_|type=PRIV_|type=ANOM_|type=AVC|type=DAEMON_|type=CONFIG_|type=SYSTEM_|type=SERVICE_|type=SECCOMP|type=CAPSET/.test(r));

  const primary = syscallRec || userRec || records[0];
  if (!primary) return;

  const typeM = primary.match(/\btype=([A-Z_]+)\b/);
  const type  = typeM ? typeM[1] : 'UNKNOWN';

  const auid = get(primary, 'auid');
  const uid  = get(primary, 'uid');
  const euid = get(primary, 'euid');

  // Prefer auid (audit UID = original login user) over euid/uid
  const rawUid = (auid && auid !== '4294967295' && auid !== '-1' && auid !== '(null)') ? auid
               : (euid && euid !== '4294967295') ? euid
               : uid;
  const username = resolveUid(rawUid) || 'unknown';

  // Determine action
  const syscall = get(primary, 'syscall');
  const res     = get(primary, 'res') || get(primary, 'success');
  let action    = 'unknown';

  switch (type) {
    case 'EXECVE':                                    action = 'execute';        break;
    case 'USER_LOGIN':  case 'USER_AUTH':             action = 'login';          break;
    case 'USER_LOGOUT': case 'CRED_DISP':             action = 'logout';         break;
    case 'USER_CHAUTHTOK':                            action = 'passwd_change';  break;
    case 'ADD_USER':                                  action = 'add_user';       break;
    case 'DEL_USER':                                  action = 'del_user';       break;
    case 'ADD_GROUP':                                 action = 'add_group';      break;
    case 'DEL_GROUP':                                 action = 'del_group';      break;
    case 'PRIV_USE': case 'USER_CMD':                 action = 'sudo';           break;
    case 'AVC':                                       action = 'selinux_denial'; break;
    case 'CONFIG_CHANGE':                             action = 'config_change';  break;
    case 'SYSTEM_BOOT':                               action = 'system_boot';    break;
    case 'SYSTEM_SHUTDOWN':                           action = 'system_shutdown';break;
    case 'SERVICE_START':                             action = 'service_start';  break;
    case 'SERVICE_STOP':                              action = 'service_stop';   break;
    case 'ANOM_PROMISCUOUS':                          action = 'promisc_mode';   break;
    case 'ANOM_ABEND':                                action = 'abnormal_exit';  break;
    case 'SECCOMP':                                   action = 'seccomp_kill';   break;
    case 'CAPSET':                                    action = 'capability_set'; break;
    case 'DAEMON_START': case 'DAEMON_END':           action = 'daemon_event';   break;
    default:
      if (syscallRec) {
        action = SYSCALL_MAP[syscall] || `syscall_${syscall}`;
        // Normalize grouped actions
        if (['unlink','unlinkat','rmdir'].includes(action)) action = 'delete';
        else if (['creat','open','openat','openat2'].includes(action)) action = 'open';
        else if (['rename','renameat','renameat2'].includes(action)) action = 'rename';
        else if (['clone','fork','vfork'].includes(action)) action = 'fork';
        else if (['execve','execveat'].includes(action)) action = 'execute';
        else if (['connect','bind','socket'].includes(action)) action = 'network';
        else if (['chmod','fchmod','fchmodat'].includes(action)) action = 'chmod';
        else if (['chown','fchown','fchownat','lchown'].includes(action)) action = 'chown';
        else if (['mount','umount2'].includes(action)) action = 'mount';
        else if (['write','pwrite64','writev','pwritev','pwritev2'].includes(action)) action = 'write';
        else if (['read','pread64','readv','preadv','preadv2'].includes(action)) action = 'read';
      }
  }

  // Determine file path - prefer PATH record's 'name', then exe, then comm
  let file = 'unknown';
  if (pathRec) {
    const pathName = get(pathRec, 'name');
    if (pathName && pathName !== '(null)' && pathName !== 'unknown') {
      file = pathName;
    }
  }
  if (file === 'unknown' && execveRec) {
    // EXECVE a0 = program path
    const a0 = get(execveRec, 'a0');
    if (a0 && !a0.startsWith('0x')) file = a0;
  }
  if (file === 'unknown') {
    const exe  = get(primary, 'exe');
    const comm = get(primary, 'comm');
    const name = get(primary, 'name');
    file = (name && name !== '(null)') ? name
         : (exe  && exe  !== '(null)') ? exe
         : (comm && comm !== '(null)') ? comm
         : 'unknown';
  }
  file = file.replace(/\0/g, '').slice(0, 500);

  // Status: success/failure
  const success = (res === 'success' || res === 'yes' || res === '1' || res === '0');
  const status  = success ? 'allowed' : 'denied';

  // Source IP
  const addr     = get(primary, 'addr') || get(primary, 'laddr');
  const sourceIp = (addr && addr !== '?' && addr !== '0.0.0.0' && addr !== '::1' && addr !== '127.0.0.1') ? addr : null;

  const time = getTimestamp(primary);

  // Build enriched argv for execute events
  let argv = null;
  if (execveRec) {
    const argc = parseInt(get(execveRec, 'argc') || '0', 10);
    const args = [];
    for (let i = 0; i < Math.min(argc, 16); i++) {
      const a = get(execveRec, `a${i}`);
      if (a && !a.startsWith('0x')) args.push(a);
    }
    if (args.length > 0) argv = args.join(' ').slice(0, 500);
  }

  const event = {
    username,
    action,
    file,
    status,
    time,
    raw_type: type,
    source_ip: sourceIp,
    hostname: HOSTNAME,
    argv,
  };

  console.log(`[auditd] ${username} → ${action} → ${file} (${status})`);
  ship(event);
}

// ── /var/log/auth.log parser ───────────────────────────────────────────────────
function parseAuthLine(line) {
  // sudo command execution
  const sudoM = line.match(/sudo:\s+(\S+)\s+:.*?COMMAND=(.*)/);
  if (sudoM) return {
    username: sudoM[1], action: 'sudo',
    file: sudoM[2].trim().slice(0, 300), status: 'allowed',
    time: new Date().toISOString(), raw_type: 'USER_CMD', hostname: HOSTNAME,
  };

  // SSH successful login
  const sshOkM = line.match(/sshd.*Accepted\s+\S+\s+for\s+(\S+)\s+from\s+(\S+)/);
  if (sshOkM) return {
    username: sshOkM[1], action: 'ssh_login',
    file: `ssh_from_${sshOkM[2]}`, status: 'allowed',
    time: new Date().toISOString(), raw_type: 'USER_LOGIN',
    source_ip: sshOkM[2], hostname: HOSTNAME,
  };

  // SSH failed login
  const sshFailM = line.match(/sshd.*(?:Failed|Invalid user)\s+(?:password for\s+)?(?:invalid user\s+)?(\S+)\s+from\s+(\S+)/);
  if (sshFailM) return {
    username: sshFailM[1], action: 'ssh_login',
    file: `ssh_from_${sshFailM[2]}`, status: 'denied',
    time: new Date().toISOString(), raw_type: 'USER_AUTH',
    source_ip: sshFailM[2], hostname: HOSTNAME,
  };

  // su switch
  const suM = line.match(/\bsu[:\s].*\(to\s+(\S+)\)\s+(\S+)/);
  if (suM) return {
    username: suM[2], action: 'su',
    file: `su_to_${suM[1]}`, status: 'allowed',
    time: new Date().toISOString(), raw_type: 'PRIV_USE', hostname: HOSTNAME,
  };

  // PAM session open/close
  const pamM = line.match(/pam_unix.*:\s+session\s+(opened|closed)\s+for\s+user\s+(\S+)/);
  if (pamM) return {
    username: pamM[2], action: pamM[1] === 'opened' ? 'session_open' : 'session_close',
    file: 'pam_session', status: 'allowed',
    time: new Date().toISOString(), raw_type: 'USER_START', hostname: HOSTNAME,
  };

  // useradd / userdel
  const useraddM = line.match(/useradd.*new\s+user.*name=(\S+)/i);
  if (useraddM) return {
    username: 'root', action: 'add_user',
    file: useraddM[1], status: 'allowed',
    time: new Date().toISOString(), raw_type: 'ADD_USER', hostname: HOSTNAME,
  };

  // passwd change
  const passwdM = line.match(/passwd.*password changed for\s+(\S+)/i);
  if (passwdM) return {
    username: passwdM[1], action: 'passwd_change',
    file: '/etc/shadow', status: 'allowed',
    time: new Date().toISOString(), raw_type: 'USER_CHAUTHTOK', hostname: HOSTNAME,
  };

  return null;
}

// ── HTTP shipping queue (with back-pressure) ───────────────────────────────────
const ENDPOINT  = `${API_URL}/api/events/ingest`;
const queue     = [];
const MAX_QUEUE = 2000;
let   shipping  = false;
let   shipCount = 0;
let   errCount  = 0;
let   dropCount = 0;

function ship(event) {
  if (queue.length >= MAX_QUEUE) {
    dropCount++;
    if (dropCount % 100 === 0) console.warn(`[Collector] ⚠ Dropped ${dropCount} events (queue full)`);
    return;
  }
  queue.push(event);
  if (!shipping) drainQueue();
}

async function drainQueue() {
  if (shipping) return;
  shipping = true;
  while (queue.length > 0) {
    const batch = queue.splice(0, Math.min(queue.length, 10)); // batch 10 at a time
    const results = await Promise.allSettled(batch.map(postEvent));
    let ok = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        ok++; shipCount++;
      } else {
        errCount++;
        queue.unshift(batch[i]); // re-queue failed
      }
    }
    if (ok > 0 && (shipCount <= 10 || shipCount % 50 === 0)) {
      console.log(`[Collector] ✓ ${shipCount} shipped  queue=${queue.length}  errors=${errCount}`);
    }
    if (results.some(r => r.status === 'rejected') && queue.length > 0) {
      await sleep(2000); // back-off on errors
    }
  }
  shipping = false;
}

function postEvent(event) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(event);
    const url  = new URL(ENDPOINT);
    const lib  = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
        'X-Collector':    'privilegeguardian/3.0',
      },
      timeout: 10000,
    }, (res) => {
      let buf = '';
      res.on('data', d => { buf += d; });
      res.on('end', () => {
        if (res.statusCode === 401) {
          console.error('[Collector] ✗ 401 Unauthorized — JWT expired. Restart collector.');
          process.exit(1);
        }
        res.statusCode < 400 ? resolve() : reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 120)}`));
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── File tailer with rotation detection ────────────────────────────────────────
function tailFile(filePath, parser, label) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[${label}] Not found: ${filePath} — retry in 30s`);
    setTimeout(() => tailFile(filePath, parser, label), 30_000);
    return;
  }

  console.log(`[${label}] Tailing ${filePath}`);
  // -n 0 = don't re-send history, only new lines
  const tail = spawn('tail', ['-F', '-n', '0', filePath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buffer = '';

  tail.stdout.on('data', chunk => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();  // keep incomplete line
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const result = parser(line);
        if (result) {
          if (Array.isArray(result)) result.forEach(ship);
          else ship(result);
        }
      } catch (e) {
        console.error(`[${label}] Parse error: ${e.message}`);
      }
    }
  });

  tail.stderr.on('data', d => {
    const m = d.toString().trim();
    if (m && !m.includes('file truncated')) console.warn(`[${label}] ${m}`);
  });

  tail.on('close', code => {
    console.warn(`[${label}] tail exited (${code}) — restarting in 5s`);
    setTimeout(() => tailFile(filePath, parser, label), 5_000);
  });
}

// ── File Integrity Monitor (FIM) ───────────────────────────────────────────────
const FIM_PATHS = [
  '/etc/passwd', '/etc/shadow', '/etc/sudoers', '/etc/sudoers.d',
  '/etc/hosts', '/etc/crontab', '/etc/cron.d', '/etc/ssh/sshd_config',
  '/etc/ld.so.preload', '/etc/profile', '/etc/bashrc',
  '/root/.bashrc', '/root/.ssh/authorized_keys',
];
const fimHashes = {};
const fimMtimes = {};

function checkFIM() {
  for (const f of FIM_PATHS) {
    try {
      const stat = fs.statSync(f);
      const mtime = stat.mtimeMs;
      if (fimMtimes[f] === undefined) { fimMtimes[f] = mtime; continue; }
      if (fimMtimes[f] !== mtime) {
        fimMtimes[f] = mtime;
        // Verify with hash
        const h = execSync(`md5sum "${f}" 2>/dev/null | awk '{print $1}'`, { timeout: 1000 }).toString().trim();
        if (fimHashes[f] && fimHashes[f] !== h) {
          console.log(`[FIM] ⚠ Modified: ${f}`);
          ship({
            username: 'system', action: 'file_modified', file: f,
            status: 'denied', time: new Date().toISOString(),
            raw_type: 'FIM', hostname: HOSTNAME,
          });
        }
        fimHashes[f] = h;
      }
    } catch (_) {}
  }
}

// Initial FIM hash baseline
function buildFIMBaseline() {
  for (const f of FIM_PATHS) {
    try {
      const h = execSync(`md5sum "${f}" 2>/dev/null | awk '{print $1}'`, { timeout: 1000 }).toString().trim();
      if (h) fimHashes[f] = h;
      fimMtimes[f] = fs.statSync(f).mtimeMs;
    } catch (_) {}
  }
  console.log(`[FIM] Baseline built for ${Object.keys(fimHashes).length} files`);
}

// ── Startup banner ─────────────────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  PrivilegeGuardian Collector v3.0  —  FAANG-grade            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`  Host:  ${HOSTNAME}`);
console.log(`  API:   ${API_URL}`);
console.log(`  Token: ${TOKEN.slice(0, 24)}...`);
console.log('');

buildUidCache();
buildFIMBaseline();

// Start tailing both log files
tailFile('/var/log/audit/audit.log', ingestAuditLine, 'auditd');
tailFile('/var/log/auth.log',        parseAuthLine,   'auth');

// FIM polling every 60s
setInterval(checkFIM, 60_000);

// Heartbeat stats
setInterval(() => {
  console.log(`[Collector] ── shipped=${shipCount} errors=${errCount} dropped=${dropCount} queue=${queue.length} pending=${pendingEvents.size} uptime=${Math.round(process.uptime())}s`);
}, 60_000);

// Graceful shutdown
const shutdown = (sig) => {
  console.log(`\n[Collector] ${sig} — flushing ${queue.length} queued events...`);
  // Flush pending assembler events
  for (const [serial, entry] of pendingEvents) {
    clearTimeout(entry.timer);
    emitEvent(entry.records);
  }
  // Give 5s for queue to drain
  setTimeout(() => {
    console.log(`[Collector] Stopped. shipped=${shipCount}`);
    process.exit(0);
  }, 5_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  e => console.error('[Collector] Uncaught:', e.message));
process.on('unhandledRejection', r => console.error('[Collector] Rejection:', r));
