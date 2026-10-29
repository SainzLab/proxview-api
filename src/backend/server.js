import './config/timezone.js';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { initializeApp, cert } from 'firebase-admin/app';

try {
    const serviceAccountPath = new URL('./serviceAccountKey.json', import.meta.url);
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    initializeApp({
        credential: cert(serviceAccount)
    });
    console.log('[INFO] Firebase Admin SDK berhasil diinisialisasi.');
} catch (error) {
    console.error('[CRITICAL ERROR] Gagal menginisialisasi Firebase Admin.', error.message);
}
// =============================================

import { login, logout, mobileLogin } from './controllers/authController.js';
import { getUsers, createUser, updateUser, deleteUser, getToken, resetToken, toggleUserStatus } from './controllers/userController.js';
import { getTargets, createTarget, updateTarget, deleteTarget, toggleTargetStatus, getTargetHistory, getSystemStatus } from './controllers/targetController.js';
import { startMonitoringDaemon } from './services/monitoringDaemon.js';
import { getProxmoxNodes, createProxmoxNode, updateProxmoxNode, deleteProxmoxNode, testProxmoxConnection, getProxmoxResources, getProxmoxNodeStatus } from './controllers/proxmoxController.js';
import { getSystemLogs } from './controllers/systemLogController.js';
import { getNetworkThresholds, saveNetworkThresholds, getProxmoxThresholds, saveProxmoxThresholds, getNetworkCatalog, getProxmoxCatalog } from './controllers/thresholdController.js';
import { getActiveAlerts, getAlertHistory } from './controllers/mobileAlertController.js';
import { getTasksLog, getClusterLog, getTaskDetailLog } from './controllers/proxmoxLogController.js';
import { verifyApiToken, verifyWebAuth, requireAdmin, attachWebUserIfPresent, attachMobileUserIfPresent } from './middlewares/authMiddleware.js';
import { getIncidents, getIncidentStats, joinIncident, resolveIncident, getAnalytics } from './controllers/incidentController.js';
import { getCleanupSettings, saveCleanupSettings, runManualCleanup } from './controllers/cleanupController.js';
import { getDashboardSummary } from './controllers/dashboardController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Helper pembaca manifest hasil build Vite untuk mode Production / Staging
const resolveViteManifestAssets = () => {
    try {
        const manifestPath = path.join(process.cwd(), 'public', 'dist', '.vite', 'manifest.json');
        if (!fs.existsSync(manifestPath)) return null;
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const entry = manifest['src/frontend/main.js'];
        if (!entry) return null;
        return { js: entry.file || null, css: Array.isArray(entry.css) ? entry.css : [] };
    } catch (err) {
        console.error('[MANIFEST ERROR] Gagal membaca manifest Vite:', err.message);
        return null;
    }
};

// Middleware CORS, Parsing & Cookie
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Konfigurasi EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/assets', express.static(path.join(process.cwd(), 'public', 'dist', 'assets')));

// Route Auth (Web)
app.post('/api/auth/login', login);
app.post('/api/auth/logout', attachWebUserIfPresent, logout);
app.get('/api/auth/me', verifyWebAuth, (req, res) => {
    res.json({ success: true, data: req.user });
});

// Route Users (Khusus Admin)
app.get('/api/users', verifyWebAuth, requireAdmin, getUsers);
app.post('/api/users', verifyWebAuth, requireAdmin, createUser);
app.put('/api/users/:id', verifyWebAuth, requireAdmin, updateUser);
app.delete('/api/users/:id', verifyWebAuth, requireAdmin, deleteUser);
app.get('/api/users/:id/token', verifyWebAuth, requireAdmin, getToken);
app.post('/api/users/:id/token/reset', verifyWebAuth, requireAdmin, resetToken);
app.put('/api/users/:id/toggle-status', verifyWebAuth, requireAdmin, toggleUserStatus);

// Route Target Monitoring
app.get('/api/targets', verifyWebAuth, getTargets);
app.post('/api/targets', verifyWebAuth, requireAdmin, createTarget);
app.put('/api/targets/:id', verifyWebAuth, requireAdmin, updateTarget);
app.delete('/api/targets/:id', verifyWebAuth, requireAdmin, deleteTarget);
app.put('/api/targets/:id/toggle', verifyWebAuth, requireAdmin, toggleTargetStatus);
app.get('/api/targets/:id/history', verifyWebAuth, getTargetHistory);

// Route Status Konektivitas Node & Ringkasan Dashboard
app.get('/api/system/status', verifyWebAuth, getSystemStatus);
app.get('/api/dashboard/summary', verifyWebAuth, getDashboardSummary);

// Route API Proxmox Logs
app.get('/api/proxmox/logs/tasks', verifyWebAuth, getTasksLog);
app.get('/api/proxmox/logs/cluster', verifyWebAuth, getClusterLog);
app.get('/api/proxmox/logs/task-detail', verifyWebAuth, getTaskDetailLog);

// Route API Proxmox (Node Config & Metrik)
app.get('/api/proxmox', verifyWebAuth, getProxmoxNodes);
app.post('/api/proxmox', verifyWebAuth, requireAdmin, createProxmoxNode);
app.put('/api/proxmox/:id', verifyWebAuth, requireAdmin, updateProxmoxNode);
app.delete('/api/proxmox/:id', verifyWebAuth, requireAdmin, deleteProxmoxNode);
app.post('/api/proxmox/:id/test', verifyWebAuth, requireAdmin, testProxmoxConnection);
app.get('/api/proxmox/:id/resources', verifyWebAuth, getProxmoxResources);
app.get('/api/proxmox/:id/status', verifyWebAuth, getProxmoxNodeStatus);

// Route API System Log (Internal)
app.get('/api/logs/system', verifyWebAuth, getSystemLogs);

// Route Notifikasi Gangguan Aktif & Riwayat (Dashboard Web)
app.get('/api/alerts/active', verifyWebAuth, getActiveAlerts);
app.get('/api/alerts/history', verifyWebAuth, getAlertHistory);

// Route Pengaturan Cronjob Pembersihan Otomatis (Log & Riwayat Gangguan) - Dikunci khusus Admin
app.get('/api/settings/cleanup', verifyWebAuth, requireAdmin, getCleanupSettings);
app.put('/api/settings/cleanup', verifyWebAuth, requireAdmin, saveCleanupSettings);
app.post('/api/settings/cleanup/run', verifyWebAuth, requireAdmin, runManualCleanup);

// Route Threshold Network & Proxmox
app.get('/api/thresholds/network/catalog', verifyWebAuth, getNetworkCatalog);
app.get('/api/thresholds/network', verifyWebAuth, getNetworkThresholds);
app.put('/api/thresholds/network', verifyWebAuth, requireAdmin, saveNetworkThresholds);
app.get('/api/thresholds/proxmox/catalog', verifyWebAuth, getProxmoxCatalog);
app.get('/api/thresholds/proxmox', verifyWebAuth, getProxmoxThresholds);
app.put('/api/thresholds/proxmox', verifyWebAuth, requireAdmin, saveProxmoxThresholds);

// Route Insiden & Analitik SLA (Mendukung Web Cookie maupun Bearer Token Mobile)
app.get('/api/incidents', attachMobileUserIfPresent, getIncidents);
app.get('/api/incidents/stats', attachMobileUserIfPresent, getIncidentStats);
app.get('/api/analytics', attachMobileUserIfPresent, getAnalytics);
app.post('/api/incidents/join', attachMobileUserIfPresent, joinIncident);
app.post('/api/incidents/resolve', attachMobileUserIfPresent, resolveIncident);

// ==========================================
// ROUTE API MOBILE V1 (Wajib Bearer Token)
// ==========================================
app.post('/api/mobile/v1/auth/login', mobileLogin);
app.get('/api/mobile/v1/auth/me', verifyApiToken, (req, res) => {
    res.json({ success: true, data: req.user });
});
app.get('/api/mobile/v1/system/status', verifyApiToken, getSystemStatus);
app.get('/api/mobile/v1/dashboard', verifyApiToken, getDashboardSummary);
app.get('/api/mobile/v1/alerts/active', verifyApiToken, getActiveAlerts);
app.get('/api/mobile/v1/alerts/history', verifyApiToken, getAlertHistory);
app.post('/api/mobile/v1/alerts/join', verifyApiToken, joinIncident);
app.post('/api/mobile/v1/alerts/resolve', verifyApiToken, resolveIncident);
app.get('/api/mobile/v1/incidents', verifyApiToken, getIncidents);
app.get('/api/mobile/v1/incidents/stats', verifyApiToken, getIncidentStats);
app.post('/api/mobile/v1/incidents/join', verifyApiToken, joinIncident);
app.post('/api/mobile/v1/incidents/resolve', verifyApiToken, resolveIncident);
app.get('/api/mobile/v1/analytics', verifyApiToken, getAnalytics);
app.get('/api/mobile/v1/targets', verifyApiToken, getTargets);
app.get('/api/mobile/v1/targets/:id/history', verifyApiToken, getTargetHistory);
app.get('/api/mobile/v1/proxmox', verifyApiToken, getProxmoxNodes);
app.get('/api/mobile/v1/proxmox/:id/status', verifyApiToken, getProxmoxNodeStatus);
app.get('/api/mobile/v1/proxmox/:id/resources', verifyApiToken, getProxmoxResources);
app.get('/api/mobile/v1/proxmox/logs/tasks', verifyApiToken, getTasksLog);
app.get('/api/mobile/v1/proxmox/logs/cluster', verifyApiToken, getClusterLog);
app.get('/api/mobile/v1/proxmox/logs/task-detail', verifyApiToken, getTaskDetailLog);
app.get('/api/mobile/v1/logs/system', verifyApiToken, getSystemLogs);

// Route Utama SPA
app.get(/^(?!\/api).*/, (req, res) => {
    const viteAssets = isProd ? resolveViteManifestAssets() : null;
    res.render('index', { isProd, viteAssets });
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    startMonitoringDaemon();
});