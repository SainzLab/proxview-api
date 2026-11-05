import { spawn, exec } from 'child_process';
import { isIPv6 } from 'net';
import { logSystemEvent } from './systemLogController.js';

const LOG_SOURCE = 'NETWORK TOOLS';

const TARGET_REGEX = /^[a-zA-Z0-9.:-]+(?:\/[0-9]{1,3})?$/;
const MAX_TARGET_LENGTH = 253;
const TOOL_TIMEOUT_MS = 120 * 1000;
const IPSCAN_TIMEOUT_MS = 5 * 60 * 1000;
const isWin = process.platform === 'win32';

const IPSCAN_REGEX = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$/;
const IPSCAN_MIN_PREFIX = 16;

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
    void logSystemEvent(level, LOG_SOURCE, message);
};

const getValidHostTarget = (req) => {
    const target = typeof req.body?.target === 'string' ? req.body.target.trim() : '';
    if (!target || target.length > MAX_TARGET_LENGTH || !TARGET_REGEX.test(target)) return null;

    const baseHost = target.split('/')[0];
    if (isIPv6(baseHost)) {
        return target;
    }

    if (target.includes(':')) return null;

    if (/^[.-]|[.-]$/.test(baseHost)) return null;

    return target;
};

const getValidScanTarget = (req) => {
    const target = typeof req.body?.target === 'string' ? req.body.target.trim() : '';
    if (!target || target.length > MAX_TARGET_LENGTH || !TARGET_REGEX.test(target)) return null;

    const [ip, prefix] = target.split('/');

    if (isIPv6(ip)) {
        if (prefix !== undefined) {
            const p = Number(prefix);
            if (isNaN(p) || p < 1 || p > 128) return null;
        }
        return target;
    }

    if (IPSCAN_REGEX.test(target)) {
        if (ip.split('.').some((octet) => Number(octet) > 255)) return null;

        if (prefix !== undefined) {
            const p = Number(prefix);
            if (p > 32 || p < IPSCAN_MIN_PREFIX) return null;
        }
        return target;
    }

    return null;
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
        message: 'Target tidak valid. Hanya format IPv4, IPv6, atau domain yang diperbolehkan.'
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
        message: `Target tidak valid. Gunakan format IP atau IP/prefix (contoh: 192.168.1.0/24, 2001:db8::/64).`
    });
};

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

    recordToolLog('INFO', `Memulai eksekusi ${toolLabel} ke target '${target}' (${cmdString}). ${actorCtx}`);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
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

export const runPing = (req, res) => {
    const target = getValidHostTarget(req);
    if (!target) return rejectInvalidHost(req, res, 'Ping', 'Web');

    const isV6 = isIPv6(target.split('/')[0]);
    const args = isV6
        ? (isWin ? ['-6', '-n', '4', target] : ['-6', '-c', '4', target])
        : [isWin ? '-n' : '-c', '10', target];

    streamCommand(req, res, {
        toolKey: 'ping',
        toolLabel: 'Ping',
        target,
        command: 'ping',
        args
    });
};

export const runTraceroute = (req, res) => {
    const target = getValidHostTarget(req);
    if (!target) return rejectInvalidHost(req, res, 'Traceroute', 'Web');

    const isV6 = isIPv6(target.split('/')[0]);
    const args = isV6 ? ['-6', target] : [target];

    streamCommand(req, res, {
        toolKey: 'traceroute',
        toolLabel: 'Traceroute',
        target,
        command: isWin ? 'tracert' : 'traceroute',
        args
    });
};

export const runIpScan = (req, res) => {
    const target = getValidScanTarget(req);
    if (!target) return rejectInvalidScan(req, res, 'Web');

    const isV6 = isIPv6(target.split('/')[0]);
    const args = isV6 ? ['-6', '-sn', target] : ['-sn', target];

    streamCommand(req, res, {
        toolKey: 'ipscan',
        toolLabel: 'IP Scan',
        target,
        command: 'nmap',
        args,
        timeoutMs: IPSCAN_TIMEOUT_MS,
        missingMessage: "[Error] Aplikasi 'nmap' belum terinstal di server backend. Silakan jalankan 'apt install nmap' terlebih dahulu."
    });
};

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

export const runMobilePing = (req, res) => {
    const target = getValidHostTarget(req);
    if (!target) return rejectInvalidHost(req, res, 'Ping', 'Mobile');

    const isV6 = isIPv6(target.split('/')[0]);
    const cmd = isV6
        ? (isWin ? `ping -6 -n 4 ${target}` : `ping -6 -c 4 ${target}`)
        : (isWin ? `ping -n 10 ${target}` : `ping -c 10 ${target}`);

    execCommandJson(req, res, {
        toolKey: 'ping',
        toolLabel: 'Ping',
        target,
        command: cmd,
        missingBinary: 'iputils-ping'
    });
};

export const runMobileTraceroute = (req, res) => {
    const target = getValidHostTarget(req);
    if (!target) return rejectInvalidHost(req, res, 'Traceroute', 'Mobile');

    const isV6 = isIPv6(target.split('/')[0]);
    const cmd = isWin
        ? (isV6 ? `tracert -6 ${target}` : `tracert ${target}`)
        : (isV6 ? `traceroute -6 ${target}` : `traceroute ${target}`);

    execCommandJson(req, res, {
        toolKey: 'traceroute',
        toolLabel: 'Traceroute',
        target,
        command: cmd,
        missingBinary: 'traceroute'
    });
};

export const runMobileIpScan = (req, res) => {
    const target = getValidScanTarget(req);
    if (!target) return rejectInvalidScan(req, res, 'Mobile');

    const isV6 = isIPv6(target.split('/')[0]);
    const cmd = isV6 ? `nmap -6 -sn ${target}` : `nmap -sn ${target}`;

    execCommandJson(req, res, {
        toolKey: 'ipscan',
        toolLabel: 'IP Scan',
        target,
        command: cmd,
        timeoutMs: IPSCAN_TIMEOUT_MS,
        missingBinary: 'nmap'
    });
};
