/**
 * Real-time Log Watcher
 * 
 * Tails a log file and feeds every new line/event block to a callback.
 * 
 * Supports two log formats automatically:
 *   - JSON lines: {"username":...,"action":...} (event_generator output)
 *   - Raw auditd: type=SYSCALL ... type=PATH ... (Linux kernel audit records)
 * 
 * The callback is always invoked with the raw string, and the full pipeline
 * (parse → score → alert → store) runs from there.
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const readline = require('readline');


class LogWatcher extends EventEmitter {
    constructor(logPath = process.env.AUDIT_LOG || 'audit.log', pollInterval = 300) {
        super();
        
        this.logPath = logPath;
        this.pollInterval = pollInterval;  // milliseconds
        this.fileHandle = null;
        this.rl = null;
        this.watching = false;
        
        // For auditd multi-line accumulation
        this.pendingSerial = null;
        this.pendingLines = [];
        
        // Track file size to detect rotation
        this.lastFileSize = 0;
        this.lastInode = null;
    }

    /**
     * Extract audit serial from auditd line
     * Format: audit(1234567890.123:456)
     * @param {string} line - Auditd line
     * @returns {string|null} Audit serial number
     */
    extractAuditSerial(line) {
        const match = line.match(/audit\(\d+\.\d+:(\d+)\)/);
        return match ? match[1] : null;
    }

    /**
     * Check if line is JSON format
     * @param {string} line - Line to check
     * @returns {boolean}
     */
    isJsonLine(line) {
        return line.trim().startsWith('{');
    }

    /**
     * Flush any pending auditd block
     */
    flushPending() {
        if (this.pendingLines.length > 0) {
            const event = this.pendingLines.join('');
            this.emit('event', event);
            this.pendingLines = [];
            this.pendingSerial = null;
        }
    }

    /**
     * Process a single line
     * @param {string} line - Log line
     */
    processLine(line) {
        if (!line) return;

        // ── JSON line ────────────────────────────────────
        if (this.isJsonLine(line)) {
            this.flushPending();  // Flush any pending auditd block
            this.emit('event', line);
            return;
        }

        // ── Auditd line ──────────────────────────────────
        const serial = this.extractAuditSerial(line);
        if (!serial) {
            return;  // Unrecognized line, skip
        }

        if (this.pendingSerial === null) {
            this.pendingSerial = serial;
            this.pendingLines = [line + '\n'];
            return;
        }

        if (serial !== this.pendingSerial) {
            // New serial → flush completed block, start fresh
            this.flushPending();
            this.pendingSerial = serial;
            this.pendingLines = [line + '\n'];
        } else {
            // Same serial → accumulate
            this.pendingLines.push(line + '\n');
        }
    }

    /**
     * Watch log file for changes
     * @param {Function} callback - Function called with each event
     */
    async watch(callback) {
        if (this.watching) {
            console.warn('[Watcher] Already watching');
            return;
        }

        this.watching = true;

        // Wrap callback in event listener
        this.on('event', (event) => {
            try {
                callback(event);
            } catch (err) {
                console.error('[Watcher] Callback error:', err.message);
                this.emit('error', err);
            }
        });

        console.log(`[Watcher] Watching: ${this.logPath}`);
        console.log(`[Watcher] Press Ctrl-C to stop.\n`);

        if (!fs.existsSync(this.logPath)) {
            console.error(`[Watcher] File not found: ${this.logPath}`);
            this.watching = false;
            return;
        }

        try {
            // Get initial file stats
            const stats = fs.statSync(this.logPath);
            this.lastFileSize = stats.size;
            this.lastInode = stats.ino;

            // Start watching from end of file
            await this.tailFile();

        } catch (err) {
            console.error('[Watcher] Error:', err.message);
            this.watching = false;
            this.emit('error', err);
        }
    }

    /**
     * Tail the log file
     */
    async tailFile() {
        return new Promise((resolve, reject) => {
            try {
                const stream = fs.createReadStream(this.logPath, {
                    encoding: 'utf8',
                    start: this.lastFileSize
                });

                const rl = readline.createInterface({
                    input: stream,
                    crlfDelay: Infinity
                });

                rl.on('line', (line) => {
                    this.processLine(line);
                });

                rl.on('close', () => {
                    // Check for file rotation or new data
                    setTimeout(() => {
                        if (fs.existsSync(this.logPath)) {
                            const stats = fs.statSync(this.logPath);
                            
                            // File was rotated (inode changed or size decreased)
                            if (stats.ino !== this.lastInode || stats.size < this.lastFileSize) {
                                console.log('[Watcher] Log file rotated, restarting watch');
                                this.lastFileSize = 0;
                                this.lastInode = stats.ino;
                                this.pendingSerial = null;
                                this.pendingLines = [];
                                this.tailFile().catch(reject);
                            } else if (stats.size > this.lastFileSize) {
                                // New data available
                                this.lastFileSize = stats.size;
                                this.tailFile().catch(reject);
                            } else {
                                // No new data, wait and check again
                                setTimeout(() => {
                                    if (this.watching) {
                                        this.tailFile().catch(reject);
                                    }
                                }, this.pollInterval);
                            }
                        }
                    }, this.pollInterval);
                });

                rl.on('error', (err) => {
                    console.error('[Watcher] Read error:', err.message);
                    reject(err);
                });

            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Stop watching
     */
    stop() {
        this.watching = false;
        this.flushPending();
        this.removeAllListeners();
        console.log('[Watcher] Stopped');
    }
}


module.exports = LogWatcher;
