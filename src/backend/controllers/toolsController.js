import { spawn, exec } from 'child_process';
import { logSystemEvent } from './systemLogController.js';

// ------------------------------------------------------------------
// CATATAN SERVER SETUP:
// Fitur Network Tools membutuhkan `ping`, `traceroute`, dan `nmap` di server backend:
// - Alpine Linux (Dockerfile `node:22-alpine`):
//     RUN apk add --no-cache iputils traceroute nmap
// - Debian / Ubuntu (Bare-metal / VM):
//     sudo apt update && sudo apt install iputils-ping traceroute nmap -y
// ------------------------------------------------------------------

const LOG_SOURCE = 'NETWORK TOOLS';

const TARGET_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/;
const MAX_TARGET_LENGTH = 253;
const TOOL_TIMEOUT_MS = 120 * 1000;
const IPSCAN_TIMEOUT_MS = 5 * 60 * 1000; // scan subnet besar (mis. /16) butuh waktu lebih lama
const isWin = process.platform === 'win32';

// Format IPv4 dengan prefix CIDR opsional, mis. "192.168.1.0/24" atau "192.168.1.10"
const IPSCAN_REGEX = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$/;
const IPSCAN_MIN_PREFIX = 16; // batasi ukuran scan agar tidak memindai ratusan ribu host

// ==================================================================
// HELPER AUDIT LOGGING KE TABEL `system_logs`
// ==================================================================
const sanitizeLogInput = (raw) => {
    if (raw === undefined || raw === null || raw === '') return '<kosong>';
    return String(raw).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80);
};

const buildActorContext = (req, channel = 'Web') => {
    const username = req?.user?.username || req?.user?.name || 'Anonim';
    const role = req?.user?.role ? ` (${req.user.role})` : '';
    const forwarded = req?.headers?.['x-forwarded-for'];
    const rawIp = typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : (req?.socket?.remoteAddress || 'Unknown IP');
    const cleanIp = rawIp.replace(/^::ffff:/, '');
    return `[Oleh: ${username}${role} | Via: ${channel} | IP: ${cleanIp}]`;
};

const formatDurationSec = (startMs) => ((Date.now() - startMs) / 1000).toFixed(1);

// Ekstrak ringkasan 1 baris dari output terminal untuk dicatat di system_logs
const summarizeToolOutput = (toolKey, rawOutput = '') => {
    if (!rawOutput) return '';

    if (toolKey === 'ping') {
        const linuxMatch = rawOutput.match(/\d+\s+packets transmitted,\s+\d+\s+(?:packets\s+)?received,[^\r\n]*/i);
        if (linuxMatch) return linuxMatch[0].trim();

        const winMatch = rawOutput.match(/Packets:\s*Sent\s*=\s*\d+,\s*Received\s*=\s*\d+,\s*Lost\s*=\s*\d+\s*\([^)]+\)/i);
        if (winMatch) return winMatch[0].trim();
    }

    if (toolKey === 'ipscan') {
        const nmapMatch = rawOutput.match(/Nmap done:\s*[^\r\n]+/i);
        if (nmapMatch) return nmapMatch[0].trim();
    }

    if (toolKey === 'traceroute') {
        const hopLines = rawOutput.match(/^\s*\d+\s+/gm);
        if (hopLines && hopLines.length > 0) {
            return `${hopLines.length} hop terlacak`;
        }
    }

    return '';
};

const recordToolLog = (level, message) => {
    // Non-blocking agar tidak menahan proses streaming maupun respons API
    void logSystemEvent(level, LOG_SOURCE, message);
};

// ==================================================================
// HELPER VALIDASI INPUT TARGET
// ==================================================================
// Validasi target host/IP/domain untuk Ping & Traceroute
const getValidHostTarget = (req) => {
    const target = typeof req.body?.target === 'string' ? req.body.target.trim() : '';
    if (!target || target.length > MAX_TARGET_LENGTH || !TARGET_REGEX.test(target)) return null;
    return target;
};

// Validasi format + rentang nilai untuk IP Scan (octet 0-255, prefix /16 s.d. /32)
const getValidScanTarget = (req) => {
    const target = typeof req.body?.target === 'string' ? req.body.target.trim() : '';
    if (!target || !IPSCAN_REGEX.test(target)) return null;

    const [ip, prefix] = target.split('/');
    if (ip.split('.').some((octet) => Number(octet) > 255)) return null;

    if (prefix !== undefined) {
        const p = Number(prefix);
        if (p > 32 || p < IPSCAN_MIN_PREFIX) return null;
    }
    return target;
};

const rejectInvalidHost = (req, res, toolLabel, channel) => {
    const rawPreview = sanitizeLogInput(req.body?.target);
    const actorCtx = buildActorContext(req, channel);
    recordToolLog(
        'WARNING',
        `Eksekusi ${toolLabel} ditolak: format target tidak valid ('${rawPreview}'). ${actorCtx}`
    );

    return res.status(400).json({
        success: false,
        output: '',
        message: 'Target tidak valid. Hanya huruf, angka, titik, dan strip yang diperbolehkan.'
    });
};

const rejectInvalidScan = (req, res, channel) => {
    const rawPreview = sanitizeLogInput(req.body?.target);
    const actorCtx = buildActorContext(req, channel);
    recordToolLog(
        'WARNING',
        `Eksekusi IP Scan ditolak: format IP/subnet di luar batas aman ('${rawPreview}'). ${actorCtx}`
    );

    return res.status(400).json({
        success: false,
        output: '',
        message: `Target tidak valid. Gunakan format IP atau IP/prefix (contoh: 192.168.1.0/24, prefix /${IPSCAN_MIN_PREFIX} sampai /32).`
    });
};

// ==================================================================
// 1. HELPER & CONTROLLER WEB (REAL-TIME CHUNKED STREAMING VIA SPAWN)
// ==================================================================
const streamCommand = (req, res, {
    toolKey,
    toolLabel,
    target,
    command,
    args,
    timeoutMs = TOOL_TIMEOUT_MS,
    missingMessage = null
}) => {
    const startMs = Date.now();
    const actorCtx = buildActorContext(req, 'Web');
    const cmdString = `${command} ${args.join(' ')}`;

    let outputTail = '';
    let isProcessDone = false;
    let timedOut = false;
    let abortedByClient = false;
    let hasLoggedEnd = false;

    // Rekam log mulai eksekusi
    recordToolLog('INFO', `Memulai eksekusi ${toolLabel} ke target '${target}' (${cmdString}). ${actorCtx}`);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // matikan buffering jika di belakang nginx
    res.flushHeaders();

    const child = spawn(command, args);

    const timer = setTimeout(() => {
        timedOut = true;
        res.write(`\n[${toolLabel} dihentikan karena melebihi batas waktu.]\n`);
        child.kill();
    }, timeoutMs);

    const appendChunk = (data) => {
        const text = data.toString();
        outputTail = (outputTail + text).slice(-1500);
        res.write(text);
    };

    child.stdout.on('data', appendChunk);
    child.stderr.on('data', appendChunk);

    // Mis. perintah tidak terpasang di OS (ENOENT)
    child.on('error', (err) => {
        isProcessDone = true;
        clearTimeout(timer);

        if (!hasLoggedEnd) {
            hasLoggedEnd = true;
            recordToolLog(
                'ERROR',
                `Gagal menjalankan ${toolLabel} ke target '${target}': binary '${command}' gagal dieksekusi (${err.code || err.message}). ${actorCtx}`
            );
        }

        if (err.code === 'ENOENT' && missingMessage) {
            res.write(`\n${missingMessage}\n`);
        } else {
            res.write(`\n[Gagal menjalankan ${toolLabel}: ${err.message}]\n`);
        }
        res.end();
    });

    child.on('close', (code) => {
        isProcessDone = true;
        clearTimeout(timer);

        if (!hasLoggedEnd) {
            hasLoggedEnd = true;
            const duration = formatDurationSec(startMs);
            const summary = summarizeToolOutput(toolKey, outputTail);
            const summarySuffix = summary ? ` — ${summary}` : '';

            if (timedOut) {
                recordToolLog(
                    'WARNING',
                    `Eksekusi ${toolLabel} ke target '${target}' dihentikan otomatis karena melebihi batas waktu (${duration}d). ${actorCtx}`
                );
            } else if (abortedByClient) {
                recordToolLog(
                    'WARNING',
                    `Eksekusi ${toolLabel} ke target '${target}' dihentikan oleh pengguna setelah ${duration}d. ${actorCtx}`
                );
            } else if (code === 0) {
                recordToolLog(
                    'INFO',
                    `Eksekusi ${toolLabel} ke target '${target}' selesai (${duration}d)${summarySuffix}. ${actorCtx}`
                );
            } else {
                recordToolLog(
                    'WARNING',
                    `Eksekusi ${toolLabel} ke target '${target}' selesai dengan peringatan/kode ${code ?? '-'} (${duration}d)${summarySuffix}. ${actorCtx}`
                );
            }
        }

        if (!res.writableEnded) {
            res.end();
        }
    });

    // Hentikan proses jika pengguna menekan tombol Stop atau menutup tab sebelum proses selesai
    res.on('close', () => {
        if (!isProcessDone && !timedOut) {
            abortedByClient = true;
            clearTimeout(timer);
            if (child.exitCode === null) child.kill();

            if (!hasLoggedEnd) {
                hasLoggedEnd = true;
                const duration = formatDurationSec(startMs);
                recordToolLog(
                    'WARNING',
                    `Eksekusi ${toolLabel} ke target '${target}' dihentikan oleh pengguna setelah ${duration}d. ${actorCtx}`
                );
            }
        }
    });
};

// POST /api/tools/ping (Web Streaming)
export const runPing = (req, res) => {
    const target = getValidHostTarget(req);
    if (!target) return rejectInvalidHost(req, res, 'Ping', 'Web');

    streamCommand(req, res, {
        toolKey: 'ping',
        toolLabel: 'Ping',
        target,
        command: 'ping',
        args: [isWin ? '-n' : '-c', '10', target]
    });
};

// POST /api/tools/traceroute (Web Streaming)
export const runTraceroute = (req, res) => {
    const target = getValidHostTarget(req);
    if (!target) return rejectInvalidHost(req, res, 'Traceroute', 'Web');

    streamCommand(req, res, {
        toolKey: 'traceroute',
        toolLabel: 'Traceroute',
        target,
        command: isWin ? 'tracert' : 'traceroute',
        args: [target]
    });
};

// POST /api/tools/ipscan (Web Streaming)
export const runIpScan = (req, res) => {
    const target = getValidScanTarget(req);
    if (!target) return rejectInvalidScan(req, res, 'Web');

    streamCommand(req, res, {
        toolKey: 'ipscan',
        toolLabel: 'IP Scan',
        target,
        command: 'nmap',
        args: ['-sn', target],
        timeoutMs: IPSCAN_TIMEOUT_MS,
        missingMessage: "[Error] Aplikasi 'nmap' belum terinstal di server backend. Silakan jalankan 'apt install nmap' terlebih dahulu."
    });
};

// ==================================================================
// 2. HELPER & CONTROLLER MOBILE (FINAL JSON RESPONSE VIA EXEC)
// ==================================================================
const execCommandJson = (req, res, {
    toolKey,
    toolLabel,
    target,
    command,
    timeoutMs = TOOL_TIMEOUT_MS,
    missingBinary = null
}) => {
    const startMs = Date.now();
    const actorCtx = buildActorContext(req, 'Mobile');

    // Rekam log mulai eksekusi dari aplikasi Mobile
    recordToolLog('INFO', `Memulai eksekusi ${toolLabel} ke target '${target}' (${command}). ${actorCtx}`);

    exec(command, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        const combinedOutput = [stdout, stderr].filter(Boolean).join('\n').trim();
        const duration = formatDurationSec(startMs);
        const summary = summarizeToolOutput(toolKey, combinedOutput);
        const summarySuffix = summary ? ` — ${summary}` : '';

        if (error) {
            if (error.killed) {
                recordToolLog(
                    'WARNING',
                    `Eksekusi ${toolLabel} ke target '${target}' dihentikan otomatis karena melebihi batas waktu (${duration}d). ${actorCtx}`
                );
                return res.json({
                    success: false,
                    output: combinedOutput,
                    message: `${toolLabel} dihentikan karena melebihi batas waktu.`
                });
            }

            const errDetail = `${combinedOutput} ${error.message}`;
            if (missingBinary && (error.code === 127 || /ENOENT|not found|is not recognized/i.test(errDetail))) {
                recordToolLog(
                    'ERROR',
                    `Gagal menjalankan ${toolLabel} ke target '${target}': aplikasi '${missingBinary}' belum terinstal di server backend. ${actorCtx}`
                );
                return res.json({
                    success: false,
                    output: `[Error] Aplikasi '${missingBinary}' belum terinstal di server backend. Silakan jalankan 'apt install ${missingBinary}' terlebih dahulu.`,
                    message: `Aplikasi '${missingBinary}' belum terinstal di server backend.`
                });
            }

            recordToolLog(
                'WARNING',
                `Eksekusi ${toolLabel} ke target '${target}' selesai dengan peringatan/kode ${error.code ?? '-'} (${duration}d)${summarySuffix}. ${actorCtx}`
            );
            return res.json({
                success: false,
                output: combinedOutput || error.message,
                message: `${toolLabel} selesai dengan peringatan atau target tidak merespons.`
            });
        }

        recordToolLog(
            'INFO',
            `Eksekusi ${toolLabel} ke target '${target}' selesai (${duration}d)${summarySuffix}. ${actorCtx}`
        );
        return res.json({
            success: true,
            output: combinedOutput || `Tidak ada output dari ${toolLabel}.`,
            message: `${toolLabel} berhasil dijalankan.`
        });
    });
};

// POST /api/mobile/tools/ping & /api/mobile/v1/tools/ping
export const runMobilePing = (req, res) => {
    const target = getValidHostTarget(req);
    if (!target) return rejectInvalidHost(req, res, 'Ping', 'Mobile');

    const cmd = isWin ? `ping -n 10 ${target}` : `ping -c 10 ${target}`;
    execCommandJson(req, res, {
        toolKey: 'ping',
        toolLabel: 'Ping',
        target,
        command: cmd,
        missingBinary: 'iputils-ping'
    });
};

// POST /api/mobile/tools/traceroute & /api/mobile/v1/tools/traceroute
export const runMobileTraceroute = (req, res) => {
    const target = getValidHostTarget(req);
    if (!target) return rejectInvalidHost(req, res, 'Traceroute', 'Mobile');

    const cmd = isWin ? `tracert ${target}` : `traceroute ${target}`;
    execCommandJson(req, res, {
        toolKey: 'traceroute',
        toolLabel: 'Traceroute',
        target,
        command: cmd,
        missingBinary: 'traceroute'
    });
};

// POST /api/mobile/tools/ipscan & /api/mobile/v1/tools/ipscan
export const runMobileIpScan = (req, res) => {
    const target = getValidScanTarget(req);
    if (!target) return rejectInvalidScan(req, res, 'Mobile');

    const cmd = `nmap -sn ${target}`;
    execCommandJson(req, res, {
        toolKey: 'ipscan',
        toolLabel: 'IP Scan',
        target,
        command: cmd,
        timeoutMs: IPSCAN_TIMEOUT_MS,
        missingBinary: 'nmap'
    });
};
