import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { getTokenExpiryMs } from '../config/timezone.js';

export const verifyWebAuth = async (req, res, next) => {
    const token = req.cookies?.proxview_token || req.cookies?.mox_token;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Akses ditolak. Sesi otentikasi tidak ditemukan, silakan login kembali.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [users] = await db.query(
            'SELECT id, name, username, role, is_active FROM users WHERE id = ? LIMIT 1',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Sesi tidak valid. Pengguna tidak ditemukan.'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Akses ditolak. Akun Anda telah dinonaktifkan oleh Admin.'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Sesi Anda telah berakhir atau token tidak valid. Silakan login kembali.'
        });
    }
};

export const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak! Hanya role Admin yang diizinkan mengakses endpoint ini.'
        });
    }
    next();
};

export const attachWebUserIfPresent = async (req, res, next) => {
    const token = req.cookies?.proxview_token || req.cookies?.mox_token;
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    } catch {
    }
    next();
};

export const verifyApiToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            message: 'Akses ditolak. Token otorisasi tidak ditemukan.' 
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const [users] = await db.query(
            'SELECT id, name, username, role, is_active, token_expires_at FROM users WHERE api_token = ?', 
            [token]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token tidak valid atau tidak terdaftar.' 
            });
        }

        const user = users[0];

        if (user.is_active === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'Akses ditolak. Akun Anda telah dinonaktifkan oleh Admin.' 
            });
        }

        if (user.token_expires_at) {
            const expiresAtMs = getTokenExpiryMs(user.token_expires_at);

            if (expiresAtMs !== null && Date.now() >= expiresAtMs) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Sesi token Anda telah kadaluarsa. Silakan login kembali dari aplikasi.' 
                });
            }
        }

        req.user = user; 
        next(); 
    } catch (error) {
        console.error("Error verifyApiToken:", error);
        res.status(500).json({ success: false, message: 'Server error saat memverifikasi token.' });
    }
};

export const attachMobileUserIfPresent = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return verifyApiToken(req, res, next);
    }
    return verifyWebAuth(req, res, next);
};
