import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { getTokenExpiryMs } from '../config/timezone.js';

// ==========================================
// 1. MIDDLEWARE OTENTIKASI WEB (JWT COOKIE)
// ==========================================
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

// ==========================================
// 2. MIDDLEWARE OTORISASI ROLE ADMIN (RBAC)
// ==========================================
export const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak! Hanya role Admin yang diizinkan mengakses endpoint ini.'
        });
    }
    next();
};

// Helper opsional untuk melampirkan user dari cookie JWT jika ada (misal pada endpoint logout)
export const attachWebUserIfPresent = async (req, res, next) => {
    const token = req.cookies?.proxview_token || req.cookies?.mox_token;
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    } catch {
        // Abaikan jika token sudah kadaluarsa saat proses logout
    }
    next();
};

// ==========================================
// 3. MIDDLEWARE OTENTIKASI MOBILE (BEARER TOKEN)
// ==========================================
export const verifyApiToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    // Cek apakah header Authorization ada dan formatnya benar
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            message: 'Akses ditolak. Token otorisasi tidak ditemukan.' 
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Ambil data lengkap user (termasuk name), status aktif, dan batas waktu token
        const [users] = await db.query(
            'SELECT id, name, username, role, is_active, token_expires_at FROM users WHERE api_token = ?', 
            [token]
        );
        
        // 1. Cek apakah token ada di database
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token tidak valid atau tidak terdaftar.' 
            });
        }

        const user = users[0];

        // 2. Cek apakah akun sedang dinonaktifkan (Toggled Off)
        if (user.is_active === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'Akses ditolak. Akun Anda telah dinonaktifkan oleh Admin.' 
            });
        }

        // 3. Cek apakah masa berlaku token sudah habis (Kadaluarsa)
        if (user.token_expires_at) {
            // Token berlaku sampai akhir hari kedaluwarsa menurut WIB
            const expiresAtMs = getTokenExpiryMs(user.token_expires_at);

            if (expiresAtMs !== null && Date.now() >= expiresAtMs) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Sesi token Anda telah kadaluarsa. Silakan login kembali dari aplikasi.' 
                });
            }
        }

        // Jika semua lolos, simpan data user ke request
        req.user = user; 
        next(); 
    } catch (error) {
        console.error("Error verifyApiToken:", error);
        res.status(500).json({ success: false, message: 'Server error saat memverifikasi token.' });
    }
};

// Middleware Hybrid: Jika request menyertakan Bearer Token (misal dari aplikasi Mobile ke endpoint umum),
// validasi token tersebut via verifyApiToken. Jika tidak ada header Bearer, wajibkan otentikasi sesi Web (verifyWebAuth).
export const attachMobileUserIfPresent = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return verifyApiToken(req, res, next);
    }
    return verifyWebAuth(req, res, next);
};
