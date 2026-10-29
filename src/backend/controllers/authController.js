import db from '../config/database.js';
import { getTokenExpiryMs } from '../config/timezone.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ==========================================
// HELPER: Fungsi untuk mencatat Log ke database
// ==========================================
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

// HELPER: Ekstrak IP dan User-Agent dari Request
const getClientInfo = (req) => {
    // Menangkap IP asli meskipun dibalik Proxy/Load Balancer
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
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

// ==========================================
// 1. LOGIN (WEB)
// ==========================================
export const login = async (req, res) => {
    const { username, password } = req.body;
    const clientInfo = getClientInfo(req);

    try {
        // 1. Cari user di database
        const [rows] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
        if (rows.length === 0) {
            await addSystemLog('WARNING', 'AUTENTIFIKASI', `Percobaan login gagal: Username '${username}' tidak ditemukan. ${clientInfo}`);
            return res.status(401).json({ success: false, message: 'Username tidak ditemukan.' });
        }

        const user = rows[0];

        // 2. Cek status aktif
        if (!user.is_active) {
            await addSystemLog('WARNING', 'AUTENTIFIKASI', `Percobaan login ditolak: Akun '${username}' sedang dinonaktifkan. ${clientInfo}`);
            return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan.' });
        }

        // 3. Validasi Role (Hanya Admin)
        if (user.role !== 'Admin') {
            await addSystemLog('WARNING', 'AUTENTIFIKASI', `Percobaan login ditolak: Pengguna '${username}' bukan Admin. ${clientInfo}`);
            return res.status(403).json({ success: false, message: 'Akses ditolak! Hanya role Admin yang diizinkan masuk.' });
        }

        // 4. Validasi Password (Bcrypt)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await addSystemLog('WARNING', 'AUTENTIFIKASI', `Percobaan login gagal: Password salah untuk pengguna '${username}'. ${clientInfo}`);
            return res.status(401).json({ success: false, message: 'Password salah.' });
        }

        // 5. Generate JWT Token
        const payload = { id: user.id, username: user.username, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

        // 6. Set token ke HTTP-Only Cookie (aman untuk HTTP staging maupun HTTPS production)
        res.cookie('mox_token', token, {
            httpOnly: true,
            secure: isHttpsRequest(req),
            sameSite: 'lax',
            maxAge: 12 * 60 * 60 * 1000 // 12 Jam
        });

        // CATAT LOG LOGIN BERHASIL
        await addSystemLog('INFO', 'AUTENTIFIKASI', `Login berhasil: Pengguna '${username}' masuk ke sistem. ${clientInfo}`);

        return res.status(200).json({
            success: true,
            message: 'Login berhasil',
            user: { name: user.name, username: user.username, role: user.role }
        });

    } catch (error) {
        console.error('Login Error:', error);
        await addSystemLog('ERROR', 'AUTENTIFIKASI', `Terjadi kesalahan sistem saat percobaan login '${username}'. ${clientInfo}`);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
};

// ==========================================
// 2. LOGOUT (WEB)
// ==========================================
export const logout = async (req, res) => {
    const clientInfo = getClientInfo(req);
    try {
        const username = req.user ? req.user.username : 'Seorang pengguna';
        res.clearCookie('mox_token', {
            httpOnly: true,
            secure: isHttpsRequest(req),
            sameSite: 'lax'
        });
        await addSystemLog('INFO', 'AUTENTIFIKASI', `Logout berhasil: ${username} telah keluar dari sistem. ${clientInfo}`);
        return res.status(200).json({ success: true, message: 'Logout berhasil.' });
    } catch (error) {
        console.error('Logout Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal melakukan logout.' });
    }
};

// ==========================================
// 3. LOGIN KHUSUS MOBILE APP (3-Factor)
// ==========================================
export const mobileLogin = async (req, res) => {
    // Menangkap 4 parameter dari body request Flutter (fcm_token ditambahkan)
    const { username, password, token, fcm_token } = req.body;
    const clientInfo = getClientInfo(req); // Ambil info IP dan Device Flutter

    if (!username || !password || !token) {
        await addSystemLog('WARNING', 'MOBILE AUTH', `Percobaan login ditolak: Parameter tidak lengkap. ${clientInfo}`);
        return res.status(400).json({
            success: false,
            message: 'Akses ditolak: Username, password, dan token otorisasi wajib diisi lengkap.'
        });
    }

    try {
        // 1. Cari User berdasarkan Username dan Token
        const [users] = await db.query(
            'SELECT * FROM users WHERE username = ? AND api_token = ?',
            [username, token]
        );

        if (users.length === 0) {
            await addSystemLog('WARNING', 'MOBILE_AUTH', `Percobaan login gagal: Username '${username}' atau Token tidak valid. ${clientInfo}`);
            return res.status(401).json({
                success: false,
                message: 'Kredensial tidak valid: Username atau Token otorisasi tidak ditemukan.'
            });
        }

        const user = users[0];

        // 2. Cek status aktif (Toggled Off)
        if (user.is_active === 0) {
            await addSystemLog('WARNING', 'MOBILE_AUTH', `Percobaan login ditolak: Akun '${username}' sedang dinonaktifkan. ${clientInfo}`);
            return res.status(403).json({
                success: false,
                message: 'Akun Anda sedang dinonaktifkan oleh Administrator.'
            });
        }

        // 3. Verifikasi Password menggunakan Bcrypt
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            await addSystemLog('WARNING', 'MOBILE_AUTH', `Percobaan login gagal: Password salah untuk pengguna '${username}'. ${clientInfo}`);
            return res.status(401).json({
                success: false,
                message: 'Password yang Anda masukkan salah.'
            });
        }

        // 4. Cek masa berlaku token (Kadaluarsa)
        if (user.token_expires_at) {
            // Token berlaku sampai akhir hari kedaluwarsa menurut WIB
            const expiresAtMs = getTokenExpiryMs(user.token_expires_at);

            if (expiresAtMs !== null && Date.now() >= expiresAtMs) {
                await addSystemLog('WARNING', 'MOBILE_AUTH', `Percobaan login ditolak: Token untuk '${username}' sudah kadaluarsa. ${clientInfo}`);
                return res.status(401).json({
                    success: false,
                    message: 'Token otorisasi Anda sudah kadaluarsa. Silakan generate ulang di Dashboard Web.'
                });
            }
        }

        // 5. UPDATE FCM TOKEN (Fitur Push Notification CallKit)
        if (fcm_token) {
            await db.query('UPDATE users SET fcm_token = ? WHERE id = ?', [fcm_token, user.id]);
        }

        // CATAT LOG LOGIN BERHASIL
        await addSystemLog('INFO', 'MOBILE_AUTH', `Login Mobile berhasil: Pengguna '${username}' masuk ke sistem. ${clientInfo}`);

        // 6. Kembalikan Response Sukses ke Flutter
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
        await addSystemLog('ERROR', 'MOBILE_AUTH', `Terjadi kesalahan sistem saat percobaan login Mobile '${username}'. ${clientInfo}`);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login.' });
    }
};