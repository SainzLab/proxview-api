import db from '../config/database.js';

const MAX_BUCKET_ENTRIES = 10000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeClientIp = (req) => {
    const rawIp = req.ip || req.socket?.remoteAddress || 'unknown';
    return String(rawIp).replace(/^::ffff:/i, '').trim() || 'unknown';
};

const writeRateLimitLog = async (source, message) => {
    try {
        await db.query(
            'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
            ['WARNING', source, message]
        );
    } catch (error) {
        console.error('[RATE LIMIT LOG ERROR]', error.message);
    }
};

const pruneExpiredMap = (store, getExpiry) => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (now >= getExpiry(entry)) {
            store.delete(key);
        }
    }

    if (store.size >= MAX_BUCKET_ENTRIES) {
        const overflow = store.size - MAX_BUCKET_ENTRIES + 1;
        let removed = 0;
        for (const key of store.keys()) {
            store.delete(key);
            removed++;
            if (removed >= overflow) break;
        }
    }
};

export const createRateLimiter = ({
    keyPrefix = 'rl',
    windowMs = 15 * 60 * 1000,
    max = 10,
    logSource = 'RATE_LIMIT',
    skipSuccessfulRequests = false,
    messageBuilder
} = {}) => {
    const buckets = new Map();

    const timer = setInterval(() => {
        pruneExpiredMap(buckets, (entry) => entry.resetAt);
    }, CLEANUP_INTERVAL_MS);

    if (typeof timer.unref === 'function') {
        timer.unref();
    }

    return (req, res, next) => {
        const now = Date.now();
        const clientIp = normalizeClientIp(req);
        const bucketKey = `${keyPrefix}:${clientIp}`;

        let bucket = buckets.get(bucketKey);
        if (!bucket || now >= bucket.resetAt) {
            if (buckets.size >= MAX_BUCKET_ENTRIES) {
                pruneExpiredMap(buckets, (entry) => entry.resetAt);
            }
            bucket = {
                count: 0,
                resetAt: now + windowMs,
                loggedBlocked: false
            };
            buckets.set(bucketKey, bucket);
        }

        bucket.count += 1;

        const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        const remaining = Math.max(0, max - bucket.count);

        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(retryAfterSec));
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(retryAfterSec));

        if (bucket.count > max) {
            res.setHeader('Retry-After', String(retryAfterSec));

            if (!bucket.loggedBlocked) {
                bucket.loggedBlocked = true;
                const agent = req.headers['user-agent'] || 'Unknown Device';
                writeRateLimitLog(
                    logSource,
                    `Batas frekuensi request terlampaui pada ${req.method} ${req.originalUrl}. [IP: ${clientIp} | OS/Browser: ${agent}]`
                );
            }

            const waitText = retryAfterSec >= 60
                ? `${Math.ceil(retryAfterSec / 60)} menit`
                : `${retryAfterSec} detik`;

            const message = typeof messageBuilder === 'function'
                ? messageBuilder(waitText, retryAfterSec)
                : `Terlalu banyak permintaan. Silakan coba kembali dalam ${waitText}.`;

            return res.status(429).json({
                success: false,
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: retryAfterSec,
                message
            });
        }

        if (skipSuccessfulRequests) {
            res.on('finish', () => {
                if (res.statusCode < 400 && bucket.count > 0) {
                    bucket.count -= 1;
                }
            });
        }

        next();
    };
};

export const loginRateLimiter = createRateLimiter({
    keyPrefix: 'auth_login',
    windowMs: parsePositiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: parsePositiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 10),
    logSource: 'AUTENTIFIKASI',
    messageBuilder: (waitText) => `Terlalu banyak percobaan login dari alamat IP Anda. Silakan tunggu ${waitText} sebelum mencoba kembali.`
});

export const captchaRateLimiter = createRateLimiter({
    keyPrefix: 'auth_captcha',
    windowMs: parsePositiveInt(process.env.AUTH_CAPTCHA_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000),
    max: parsePositiveInt(process.env.AUTH_CAPTCHA_RATE_LIMIT_MAX, 30),
    logSource: 'AUTENTIFIKASI',
    messageBuilder: (waitText) => `Terlalu banyak permintaan muat ulang CAPTCHA. Silakan tunggu ${waitText}.`
});

export const authEndpointRateLimiter = createRateLimiter({
    keyPrefix: 'auth_endpoint',
    windowMs: parsePositiveInt(process.env.AUTH_SESSION_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: parsePositiveInt(process.env.AUTH_SESSION_RATE_LIMIT_MAX, 60),
    logSource: 'AUTENTIFIKASI',
    messageBuilder: (waitText) => `Terlalu banyak permintaan ke layanan otentikasi. Silakan coba lagi dalam ${waitText}.`
});

const LOCKOUT_MAX_ATTEMPTS = parsePositiveInt(process.env.AUTH_LOCKOUT_MAX_ATTEMPTS, 5);
const LOCKOUT_WINDOW_MS = parsePositiveInt(process.env.AUTH_LOCKOUT_WINDOW_MS, 15 * 60 * 1000);
const LOCKOUT_DURATION_MS = parsePositiveInt(process.env.AUTH_LOCKOUT_DURATION_MS, 15 * 60 * 1000);

const accountLockoutStore = new Map();

const lockoutCleanupTimer = setInterval(() => {
    pruneExpiredMap(accountLockoutStore, (entry) => Math.max(entry.windowExpiresAt, entry.lockedUntil || 0));
}, CLEANUP_INTERVAL_MS);

if (typeof lockoutCleanupTimer.unref === 'function') {
    lockoutCleanupTimer.unref();
}

const normalizeUsernameKey = (username) => {
    if (typeof username !== 'string') return '';
    return username.trim().toLowerCase().slice(0, 128);
};

export const checkAccountLockout = (username) => {
    const key = normalizeUsernameKey(username);
    if (!key) return { locked: false, retryAfterSec: 0, shouldLog: false };

    const entry = accountLockoutStore.get(key);
    if (!entry) return { locked: false, retryAfterSec: 0, shouldLog: false };

    const now = Date.now();
    if (entry.lockedUntil && now < entry.lockedUntil) {
        const retryAfterSec = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
        const shouldLog = !entry.loggedLockout;
        entry.loggedLockout = true;
        return { locked: true, retryAfterSec, shouldLog };
    }

    if (now >= entry.windowExpiresAt && (!entry.lockedUntil || now >= entry.lockedUntil)) {
        accountLockoutStore.delete(key);
    }

    return { locked: false, retryAfterSec: 0, shouldLog: false };
};

export const recordFailedLoginAttempt = (username) => {
    const key = normalizeUsernameKey(username);
    if (!key) return { locked: false, attempts: 0, retryAfterSec: 0 };

    const now = Date.now();
    let entry = accountLockoutStore.get(key);

    if (!entry || (now >= entry.windowExpiresAt && (!entry.lockedUntil || now >= entry.lockedUntil))) {
        if (accountLockoutStore.size >= MAX_BUCKET_ENTRIES) {
            pruneExpiredMap(accountLockoutStore, (item) => Math.max(item.windowExpiresAt, item.lockedUntil || 0));
        }
        entry = {
            attempts: 0,
            windowExpiresAt: now + LOCKOUT_WINDOW_MS,
            lockedUntil: 0,
            loggedLockout: false
        };
        accountLockoutStore.set(key, entry);
    }

    entry.attempts += 1;

    if (entry.attempts >= LOCKOUT_MAX_ATTEMPTS) {
        entry.lockedUntil = now + LOCKOUT_DURATION_MS;
        entry.loggedLockout = false;
        const retryAfterSec = Math.max(1, Math.ceil(LOCKOUT_DURATION_MS / 1000));
        return { locked: true, attempts: entry.attempts, retryAfterSec };
    }

    return { locked: false, attempts: entry.attempts, retryAfterSec: 0 };
};

export const resetLoginAttempts = (username) => {
    const key = normalizeUsernameKey(username);
    if (key) {
        accountLockoutStore.delete(key);
    }
};
