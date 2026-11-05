import db from '../config/database.js';
import { getTokenExpiryMs } from '../config/timezone.js';
import { getMessaging } from 'firebase-admin/messaging';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { CAPTCHA_TTL_MS, createCaptchaChallenge, invalidateCaptcha, verifyAndConsumeCaptcha } from '../services/captchaService.js';
import { checkAccountLockout, recordFailedLoginAttempt, resetLoginAttempts } from '../middlewares/rateLimitMiddleware.js';

const addSystemLog = async (level, source, message) => {
    try {
        await db.query(
            'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
            [level, source, message]
        );
    } catch (error) {
        console.error('Gagal menulis log:', error);
    }
};

const getClientInfo = (req) => {
    const rawIp = req.ip || req.socket?.remoteAddress || 'Unknown IP';
    const ip = String(rawIp).replace(/^::ffff:/i, '');
    const agent = req.headers['user-agent'] || 'Unknown Device';
    return `[IP: ${ip} | OS/Browser: ${agent}]`;
};

const isHttpsRequest = (req) => {
    return Boolean(
        req.secure ||
        req.headers['x-forwarded-proto'] === 'https' ||
        process.env.COOKIE_SECURE === 'true'
    );
};

const formatWaitDuration = (seconds) => {
    return seconds >= 60 ? `${Math.ceil(seconds / 60)} menit` : `${seconds} detik`;
};

export const getCaptcha = (req, res) => {
    try {
        const prevCookieId = req.cookies?.proxview_captcha_id;
        const prevQueryId = typeof req.query?.prevId === 'string' ? req.query.prevId : '';

        if (prevCookieId) invalidateCaptcha(prevCookieId);
        if (prevQueryId && prevQueryId !== prevCookieId) invalidateCaptcha(prevQueryId);

        const challenge = createCaptchaChallenge();

        res.cookie('proxview_captcha_id', challenge.captchaId, {
            httpOnly: true,
            secure: isHttpsRequest(req),
            sameSite: 'lax',
            maxAge: CAPTCHA_TTL_MS,
            path: '/api/auth'
        });

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.status(200).json({
            success: true,
            captchaId: challenge.captchaId,
            image: challenge.image,
            imageDark: challenge.imageDark,
            expiresIn: challenge.expiresIn
        });
    } catch (error) {
        console.error('Captcha Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal membuat kode verifikasi keamanan.'
        });
    }
};

export const login = async (req, res) => {
    const { username, password, captchaId, captchaInput } = req.body || {};
    const clientInfo = getClientInfo(req);

    const cookieCaptchaId = req.cookies?.proxview_captcha_id;
    const resolvedCaptchaId = captchaId || cookieCaptchaId;

    if (cookieCaptchaId && cookieCaptchaId !== resolvedCaptchaId) {
        invalidateCaptcha(cookieCaptchaId);
    }

    res.clearCookie('proxview_captcha_id', {
        httpOnly: true,
        secure: isHttpsRequest(req),
        sameSite: 'lax',
        path: '/api/auth'
    });

    const captchaResult = verifyAndConsumeCaptcha(resolvedCaptchaId, captchaInput);
    if (!captchaResult.valid) {
        await addSystemLog(
            'WARNING',
            'AUTENTIFIKASI',
            `Percobaan login ditolak: ${captchaResult.message} (Username: '${username || '-'}'). ${clientInfo}`
        );
        return res.status(400).json({
            success: false,
            code: captchaResult.code,
            message: captchaResult.message
        });
    }

    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username dan password wajib diisi.'
        });
    }

    const trimmedUsername = username.trim();

    const lockout = checkAccountLockout(trimmedUsername);
    if (lockout.locked) {
        res.setHeader('Retry-After', String(lockout.retryAfterSec));
        if (lockout.shouldLog) {
            await addSystemLog(
                'WARNING',
                'AUTENTIFIKASI',
                `Percobaan login diblokir sementara: Akun '${trimmedUsername}' terkunci akibat percobaan gagal berulang. ${clientInfo}`
            );
        }
        return res.status(429).json({
            success: false,
            code: 'ACCOUNT_LOCKED',
            retryAfter: lockout.retryAfterSec,
            message: `Akun dikunci sementara karena terlalu banyak percobaan gagal. Silakan coba lagi dalam ${formatWaitDuration(lockout.retryAfterSec)}.`
        });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [trimmedUsername]);
        if (rows.length === 0) {
            const failState = recordFailedLoginAttempt(trimmedUsername);
            await addSystemLog('WARNING', 'AUTENTIFIKASI', `Percobaan login gagal: Username '${trimmedUsername}' tidak ditemukan. ${clientInfo}`);
            if (failState.locked) {
                await addSystemLog('WARNING', 'AUTENTIFIKASI', `Proteksi Brute-Force: Target username '${trimmedUsername}' dikunci sementara selama ${formatWaitDuration(failState.retryAfterSec)}. ${clientInfo}`);
            }
            return res.status(401).json({ success: false, message: 'Username tidak ditemukan.' });
        }

        const user = rows[0];

        if (!user.is_active) {
            await addSystemLog('WARNING', 'AUTENTIFIKASI', `Percobaan login ditolak: Akun '${trimmedUsername}' sedang dinonaktifkan. ${clientInfo}`);
            return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan.' });
        }

        if (user.role !== 'Admin') {
            await addSystemLog('WARNING', 'AUTENTIFIKASI', `Percobaan login ditolak: Pengguna '${trimmedUsername}' bukan Admin. ${clientInfo}`);
            return res.status(403).json({ success: false, message: 'Akses ditolak! Hanya role Admin yang diizinkan masuk.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const failState = recordFailedLoginAttempt(trimmedUsername);
            await addSystemLog('WARNING', 'AUTENTIFIKASI', `Percobaan login gagal: Password salah untuk pengguna '${trimmedUsername}'. ${clientInfo}`);
            if (failState.locked) {
                await addSystemLog('WARNING', 'AUTENTIFIKASI', `Proteksi Brute-Force: Akun '${trimmedUsername}' dikunci sementara selama ${formatWaitDuration(failState.retryAfterSec)}. ${clientInfo}`);
            }
            return res.status(401).json({ success: false, message: 'Password salah.' });
        }

        resetLoginAttempts(trimmedUsername);

        const payload = { id: user.id, username: user.username, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

        res.cookie('proxview_token', token, {
            httpOnly: true,
            secure: isHttpsRequest(req),
            sameSite: 'lax',
            maxAge: 12 * 60 * 60 * 1000
        });

        await addSystemLog('INFO', 'AUTENTIFIKASI', `Login berhasil: Pengguna '${trimmedUsername}' masuk ke sistem. ${clientInfo}`);

        return res.status(200).json({
            success: true,
            message: 'Login berhasil',
            user: { name: user.name, username: user.username, role: user.role }
        });

    } catch (error) {
        console.error('Login Error:', error);
        await addSystemLog('ERROR', 'AUTENTIFIKASI', `Terjadi kesalahan sistem saat percobaan login '${trimmedUsername}'. ${clientInfo}`);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
};

export const logout = async (req, res) => {
    const clientInfo = getClientInfo(req);
    try {
        const username = req.user ? req.user.username : 'Seorang pengguna';
        res.clearCookie('proxview_token', {
            httpOnly: true,
            secure: isHttpsRequest(req),
            sameSite: 'lax'
        });
        res.clearCookie('mox_token', {
            httpOnly: true,
            secure: isHttpsRequest(req),
            sameSite: 'lax'
        });
        res.clearCookie('proxview_captcha_id', {
            httpOnly: true,
            secure: isHttpsRequest(req),
            sameSite: 'lax',
            path: '/api/auth'
        });
        await addSystemLog('INFO', 'AUTENTIFIKASI', `Logout berhasil: ${username} telah keluar dari sistem. ${clientInfo}`);
        return res.status(200).json({ success: true, message: 'Logout berhasil.' });
    } catch (error) {
        console.error('Logout Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal melakukan logout.' });
    }
};

export const mobileLogin = async (req, res) => {
    const { username, password, token, fcm_token } = req.body || {};
    const clientInfo = getClientInfo(req);

    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password || typeof token !== 'string' || !token.trim()) {
        await addSystemLog('WARNING', 'MOBILE_AUTH', `Percobaan login ditolak: Parameter tidak lengkap. ${clientInfo}`);
        return res.status(400).json({
            success: false,
            message: 'Akses ditolak: Username, password, dan token otorisasi wajib diisi lengkap.'
        });
    }

    const trimmedUsername = username.trim();

    const lockout = checkAccountLockout(trimmedUsername);
    if (lockout.locked) {
        res.setHeader('Retry-After', String(lockout.retryAfterSec));
        if (lockout.shouldLog) {
            await addSystemLog(
                'WARNING',
                'MOBILE_AUTH',
                `Percobaan login Mobile diblokir sementara: Akun '${trimmedUsername}' terkunci akibat percobaan gagal berulang. ${clientInfo}`
            );
        }
        return res.status(429).json({
            success: false,
            code: 'ACCOUNT_LOCKED',
            retryAfter: lockout.retryAfterSec,
            message: `Akun dikunci sementara karena terlalu banyak percobaan gagal. Silakan coba lagi dalam ${formatWaitDuration(lockout.retryAfterSec)}.`
        });
    }

    try {
        const [users] = await db.query(
            'SELECT * FROM users WHERE username = ? AND api_token = ?',
            [trimmedUsername, token.trim()]
        );

        if (users.length === 0) {
            const failState = recordFailedLoginAttempt(trimmedUsername);
            await addSystemLog('WARNING', 'MOBILE_AUTH', `Percobaan login gagal: Username '${trimmedUsername}' atau Token tidak valid. ${clientInfo}`);
            if (failState.locked) {
                await addSystemLog('WARNING', 'MOBILE_AUTH', `Proteksi Brute-Force: Target username '${trimmedUsername}' dikunci sementara selama ${formatWaitDuration(failState.retryAfterSec)}. ${clientInfo}`);
            }
            return res.status(401).json({
                success: false,
                message: 'Kredensial tidak valid: Username atau Token otorisasi tidak ditemukan.'
            });
        }

        const user = users[0];

        if (user.is_active === 0) {
            await addSystemLog('WARNING', 'MOBILE_AUTH', `Percobaan login ditolak: Akun '${trimmedUsername}' sedang dinonaktifkan. ${clientInfo}`);
            return res.status(403).json({
                success: false,
                message: 'Akun Anda sedang dinonaktifkan oleh Administrator.'
            });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            const failState = recordFailedLoginAttempt(trimmedUsername);
            await addSystemLog('WARNING', 'MOBILE_AUTH', `Percobaan login gagal: Password salah untuk pengguna '${trimmedUsername}'. ${clientInfo}`);
            if (failState.locked) {
                await addSystemLog('WARNING', 'MOBILE_AUTH', `Proteksi Brute-Force: Akun '${trimmedUsername}' dikunci sementara selama ${formatWaitDuration(failState.retryAfterSec)}. ${clientInfo}`);
            }
            return res.status(401).json({
                success: false,
                message: 'Password yang Anda masukkan salah.'
            });
        }

        if (user.token_expires_at) {
            const expiresAtMs = getTokenExpiryMs(user.token_expires_at);

            if (expiresAtMs !== null && Date.now() >= expiresAtMs) {
                await addSystemLog('WARNING', 'MOBILE_AUTH', `Percobaan login ditolak: Token untuk '${trimmedUsername}' sudah kadaluarsa. ${clientInfo}`);
                return res.status(401).json({
                    success: false,
                    message: 'Token otorisasi Anda sudah kadaluarsa. Silakan generate ulang di Dashboard Web.'
                });
            }
        }

        resetLoginAttempts(trimmedUsername);

        if (fcm_token) {
            await db.query('UPDATE users SET fcm_token = ? WHERE id = ?', [fcm_token, user.id]);
        }

        await addSystemLog('INFO', 'MOBILE_AUTH', `Login Mobile berhasil: Pengguna '${trimmedUsername}' masuk ke sistem. ${clientInfo}`);

        res.json({
            success: true,
            message: 'Otentikasi berhasil. Perangkat terhubung.',
            data: {
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
                api_token: user.api_token
            }
        });

    } catch (error) {
        console.error("Error mobileLogin:", error);
        await addSystemLog('ERROR', 'MOBILE_AUTH', `Terjadi kesalahan sistem saat percobaan login Mobile '${trimmedUsername}'. ${clientInfo}`);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login.' });
    }
};

export const simulateFCM = async (req, res) => {
    const { action_type } = req.body;

    try {
        const [techs] = await db.query("SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL AND is_active = 1");
        const cleanTokens = [...new Set(techs.map(t => t.fcm_token?.trim()).filter(Boolean))];

        if (cleanTokens.length === 0) {
            return res.status(404).json({ success: false, message: 'Tidak ada token teknisi.' });
        }

        const fcmPayload = {
            tokens: cleanTokens,
            data: {
                alert_id: "TEST-000",
                target_name: "SERVER UJI COBA (SIMULASI)",
                severity: action_type === 'Call' ? 'DOWN' : 'WARNING',
                action_type: action_type, 
                message: `[SIMULASI] Uji coba sistem untuk aksi: ${action_type}.`,
                click_action: "FLUTTER_NOTIFICATION_CLICK"
            },
            android: { priority: 'high' }
        };

        const response = await getMessaging().sendEachForMulticast(fcmPayload);
        res.json({ success: true, message: `Simulasi ${action_type} terkirim ke ${response.successCount} perangkat.` });
    } catch (error) {
        console.error('[SIMULASI ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
