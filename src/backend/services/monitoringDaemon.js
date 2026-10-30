import db from '../config/database.js';
import ping from 'ping';
import net from 'net';
import axios from 'axios';
import https from 'https';
// HAPUS import admin from 'firebase-admin' karena bentrok dengan ES Modules
import { getWibYear, WIB_OFFSET_MS } from '../config/timezone.js';
import { executeScheduledCleanupIfDue, ensureCleanupSettingsTable } from '../controllers/cleanupController.js';
import { getMessaging } from 'firebase-admin/messaging'; // Gunakan import ini untuk FCM

// Tracker berurutan untuk kegagalan ping/TCP (RTO Tolerance)
const failureCounts = new Map();

// Tracker in-memory khusus untuk Sistem Notifikasi & Tiket Otomatis
const alertStateTracker = {};

// Urutan tingkat keparahan untuk menentukan eskalasi vs penurunan status
const SEVERITY_RANK = {
    RECOVERED: 0,
    WARNING: 1,
    CRITICAL: 2,
    DOWN: 3
};

// ==========================================
// FUNGSI HELPER & LOG TERMINAL INTERVAL CEK
// ==========================================
const getWibTimeStr = () => {
    const wib = new Date(Date.now() + WIB_OFFSET_MS);
    const hh = String(wib.getUTCHours()).padStart(2, '0');
    const mm = String(wib.getUTCMinutes()).padStart(2, '0');
    const ss = String(wib.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss} WIB`;
};

const logIntervalCheck = (moduleLabel, detailMsg) => {
    console.log(`[${getWibTimeStr()}] [CHECK ${moduleLabel}] ${detailMsg}`);
};

const addDaemonLog = async (level, message) => {
    try {
        await db.query('INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)', [level, 'DAEMON', message]);
    } catch (err) {
        console.error('[DAEMON ERROR] Gagal menulis log ke database:', err);
    }
};

export const resetTargetAlertState = (moduleType, targetId = null) => {
    if (targetId !== null) {
        delete alertStateTracker[`${moduleType}_${targetId}`];
        if (moduleType === 'NETWORK') failureCounts.delete(Number(targetId));
        return;
    }
    for (const key of Object.keys(alertStateTracker)) {
        if (key.startsWith(`${moduleType}_`)) delete alertStateTracker[key];
    }
};

const checkIcmp = async (ip) => {
    try {
        const res = await ping.promise.probe(ip, { timeout: 2 });
        const numericTime = parseFloat(res.time);
        return {
            isUp: Boolean(res.alive),
            latency: res.alive && !Number.isNaN(numericTime) ? Math.round(numericTime) : null
        };
    } catch (err) {
        return { isUp: false, latency: null };
    }
};

const checkTcp = (ip, port) => {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(2000);

        socket.on('connect', () => {
            const latency = Date.now() - start;
            socket.destroy();
            resolve({ isUp: true, latency: Math.round(latency) });
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve({ isUp: false, latency: null });
        });
        socket.on('error', () => {
            socket.destroy();
            resolve({ isUp: false, latency: null });
        });

        socket.connect(Number(port), ip);
    });
};

// ==========================================
// MESIN NOTIFIKASI & TIKET OTOMATIS (STATE ENGINE)
// ==========================================
const triggerAlert = async (target, moduleType, severity, actionType = 'Pesan', maxCount = 1, message = '') => {
    const stateKey = `${moduleType}_${target.id}`;
    if (!alertStateTracker[stateKey]) {
        alertStateTracker[stateKey] = { failCount: 0, isAlerting: false, currentSeverity: null };
    }
    const state = alertStateTracker[stateKey];
    const safeAction = actionType === 'Call' ? 'Call' : 'Pesan';
    const thresholdCount = Math.max(1, Number(maxCount) || 1);
    const targetDisplayName = target.name || target.node || `ID-${target.id}`;

    // Akumulasi hitungan berurutan
    state.failCount += 1;
    state.currentSeverity = severity;

    if (state.failCount >= thresholdCount) {
        let currentAlertId = null;

        try {
            const [existing] = await db.query(
                'SELECT id, severity, original_severity, action_type, message FROM active_alerts WHERE target_id = ? AND target_type = ? AND is_resolved = 0',
                [target.id, moduleType]
            );

            const logLevel = severity === 'WARNING' ? 'WARNING' : 'ERROR';

            if (existing.length === 0) {
                // Buat tiket baru
                const [result] = await db.query(
                    `INSERT INTO active_alerts (target_id, target_type, target_name, severity, original_severity, action_type, message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [target.id, moduleType, targetDisplayName, severity, severity, safeAction, message]
                );

                currentAlertId = result.insertId;
                const ticketId = `#INC-${getWibYear()}-${String(currentAlertId).padStart(4, '0')}`;
                const logMsg = `Tiket ${ticketId} otomatis dibuat: [${moduleType}] ${targetDisplayName} berstatus ${severity} (${message})`;
                console.log(`[ALERT TRIGGERED] ${logMsg}`);

                await addDaemonLog(logLevel, logMsg);
            } else {
                const currentAlert = existing[0];
                currentAlertId = currentAlert.id;
                const prevRank = SEVERITY_RANK[currentAlert.severity] ?? 0;
                const newRank = SEVERITY_RANK[severity] ?? 1;
                const origRank = SEVERITY_RANK[currentAlert.original_severity] ?? prevRank;
                const highestOriginal = newRank > origRank ? severity : (currentAlert.original_severity || severity);

                if (currentAlert.severity !== severity) {
                    await db.query(
                        `UPDATE active_alerts SET target_name = ?, severity = ?, original_severity = ?, action_type = ?, message = ? WHERE id = ?`,
                        [targetDisplayName, severity, highestOriginal, safeAction, message, currentAlertId]
                    );

                    const ticketId = `#INC-${getWibYear()}-${String(currentAlertId).padStart(4, '0')}`;
                    let logMsg;
                    if (currentAlert.severity === 'RECOVERED') {
                        logMsg = `Gangguan Berulang pada Tiket ${ticketId}: [${moduleType}] ${targetDisplayName} kembali berstatus ${severity} (${message})`;
                    } else if (newRank > prevRank) {
                        logMsg = `Eskalasi Tiket ${ticketId}: [${moduleType}] ${targetDisplayName} naik menjadi ${severity} (${message})`;
                    } else {
                        logMsg = `Perubahan Status Tiket ${ticketId}: [${moduleType}] ${targetDisplayName} menjadi ${severity} (${message})`;
                    }
                    console.log(`[ALERT UPDATED] ${logMsg}`);
                    await addDaemonLog(logLevel, logMsg);
                } else if (currentAlert.message !== message || currentAlert.action_type !== safeAction) {
                    await db.query(
                        `UPDATE active_alerts SET target_name = ?, action_type = ?, message = ? WHERE id = ?`,
                        [targetDisplayName, safeAction, message, currentAlertId]
                    );
                }
            }
            state.isAlerting = true;
        } catch (error) {
            console.error('[ALERT ERROR] Gagal menyimpan alert ke DB:', error);
            return; // Hentikan eksekusi FCM jika insert DB gagal
        }

        // HANYA TEMBAKKAN FCM SAAT PERTAMA KALI MELEWATI THRESHOLD
        if (state.failCount === thresholdCount) {
            try {
                // Ambil token teknisi yang aktif (kecuali Kepala Bidang)
                const [techs] = await db.query("SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL AND role != 'Kepala Bidang' AND is_active = 1");
                const tokens = techs.map(t => t.fcm_token);

                if (tokens.length > 0) {
                    const fcmPayload = {
                        tokens: tokens,
                        data: {
                            alert_id: String(currentAlertId),
                            target_name: targetDisplayName,
                            severity: severity,
                            action_type: safeAction, 
                            message: message,
                            click_action: "FLUTTER_NOTIFICATION_CLICK"
                        },
                        android: { 
                            priority: 'high' // Wajib 'high' untuk menembus Doze Mode Android
                        }
                    };
                    
                    // Ganti sendMulticast menjadi sendEachForMulticast
                    getMessaging().sendEachForMulticast(fcmPayload)
                        .then(res => console.log(`[FCM] Push terkirim ke ${res.successCount} perangkat untuk alert #${currentAlertId}.`))
                        .catch(err => console.error(`[FCM ERROR] Gagal mengirim pesan multicast:`, err));
                }
            } catch (fcmDbErr) {
                console.error('[FCM DB ERROR] Gagal mengambil token teknisi dari DB:', fcmDbErr);
            }
        }
    }
};

const resolveAlert = async (target, moduleType) => {
    const stateKey = `${moduleType}_${target.id}`;
    const targetDisplayName = target.name || target.node || `ID-${target.id}`;
    try {
        const [existing] = await db.query(
            'SELECT id, severity FROM active_alerts WHERE target_id = ? AND target_type = ? AND is_resolved = 0',
            [target.id, moduleType]
        );

        if (existing.length > 0) {
            const alertId = existing[0].id;

            if (existing[0].severity === 'RECOVERED') {
                alertStateTracker[stateKey] = { failCount: 0, isAlerting: false, currentSeverity: null };
                return;
            }

            const [handlers] = await db.query('SELECT COUNT(id) as count FROM alert_handlers WHERE alert_id = ?', [alertId]);

            if (handlers[0].count > 0) {
                await db.query(`UPDATE active_alerts SET severity = 'RECOVERED' WHERE id = ?`, [alertId]);
                console.log(`[ALERT RECOVERED] [${moduleType}] ${targetDisplayName} pulih. Menunggu validasi Teknisi.`);
                await addDaemonLog('INFO', `Menunggu Validasi: [${moduleType}] ${targetDisplayName} telah pulih.`);
            } else {
                await db.query(`UPDATE active_alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`, [alertId]);
                console.log(`[ALERT RESOLVED] [${moduleType}] ${targetDisplayName} kembali normal (Otomatis).`);
                await addDaemonLog('INFO', `Insiden Selesai Otomatis: [${moduleType}] ${targetDisplayName} kembali normal.`);
            }
        }
    } catch (error) {
        console.error('[ALERT ERROR] Gagal resolve alert:', error);
    }

    alertStateTracker[stateKey] = { failCount: 0, isAlerting: false, currentSeverity: null };
};

// ==========================================
// PENGAMBILAN METRIK PROXMOX LANGSUNG KE PVE API
// ==========================================
const pveHttpsAgent = new https.Agent({ rejectUnauthorized: false });
const pxCache = {
    clusterResources: new Map(), // key: pve.id -> { data, expires }
    nodeStatus: new Map()        // key: `${pve.id}_${nodeName}` -> { data, expires }
};
const CACHE_TTL_MS = 3000;

const createPveClient = (pve) => {
    return axios.create({
        baseURL: pve.host_url,
        timeout: 5000,
        headers: {
            Authorization: `PVEAPIToken=${pve.token_id}=${pve.token_secret}`
        },
        httpsAgent: pveHttpsAgent
    });
};

const getClusterResourcesCached = async (pve) => {
    const now = Date.now();
    const cached = pxCache.clusterResources.get(pve.id);
    if (cached && now < cached.expires) return cached.data;

    const api = createPveClient(pve);
    const res = await api.get('/api2/json/cluster/resources');
    const data = Array.isArray(res.data?.data) ? res.data.data : [];
    pxCache.clusterResources.set(pve.id, { data, expires: now + CACHE_TTL_MS });

    if (pve.status !== 'TERHUBUNG') {
        db.query('UPDATE proxmox_nodes SET status = "TERHUBUNG" WHERE id = ?', [pve.id]).catch(() => {});
    }
    return data;
};

const getNodeStatusCached = async (pve, nodeName) => {
    const cacheKey = `${pve.id}_${nodeName}`;
    const now = Date.now();
    const cached = pxCache.nodeStatus.get(cacheKey);
    if (cached && now < cached.expires) return cached.data;

    const api = createPveClient(pve);
    const res = await api.get(`/api2/json/nodes/${encodeURIComponent(nodeName)}/status`);
    const data = res.data?.data || null;
    pxCache.nodeStatus.set(cacheKey, { data, expires: now + CACHE_TTL_MS });
    return data;
};

const fetchLiveProxmoxMetrics = async (pt) => {
    let pveNodes = [];
    try {
        const [rows] = await db.query('SELECT * FROM proxmox_nodes');
        pveNodes = rows;
    } catch (err) {
        return { isUp: false, reason: 'Gagal membaca konfigurasi server Proxmox' };
    }

    if (!pveNodes || pveNodes.length === 0) {
        return { isUp: false, reason: 'Tidak ada server Proxmox yang terdaftar' };
    }

    let anyClusterReachable = false;

    for (const pve of pveNodes) {
        let resources;
        try {
            resources = await getClusterResourcesCached(pve);
            anyClusterReachable = true;
        } catch (err) {
            db.query('UPDATE proxmox_nodes SET status = "GAGAL", latency = "-" WHERE id = ?', [pve.id]).catch(() => {});
            continue;
        }

        if (pt.type === 'NODE') {
            const nodeResource = resources.find(
                r => r.type === 'node' && (r.node === pt.node || r.node === pt.name)
            );
            if (!nodeResource) continue;

            const nodeStatusStr = String(nodeResource.status || '').toLowerCase();
            if (nodeStatusStr === 'offline' || nodeStatusStr === 'stopped' || nodeStatusStr === 'down') {
                return {
                    isUp: false,
                    reason: `Node Fisik ${pt.node} berstatus OFFLINE`
                };
            }

            let cpuPct = Number(((nodeResource.cpu || 0) * 100).toFixed(1));
            let ramPct = Number((nodeResource.maxmem ? (nodeResource.mem / nodeResource.maxmem) * 100 : 0).toFixed(1));
            let ioDelayPct = 0;

            try {
                const detail = await getNodeStatusCached(pve, nodeResource.node);
                if (detail) {
                    if (typeof detail.cpu === 'number') {
                        cpuPct = Number((detail.cpu * 100).toFixed(1));
                    }
                    if (detail.memory && detail.memory.total > 0) {
                        ramPct = Number(((detail.memory.used / detail.memory.total) * 100).toFixed(1));
                    }
                    if (typeof detail.wait === 'number') {
                        ioDelayPct = Number((detail.wait * 100).toFixed(1));
                    }
                }
            } catch (nodeErr) {
                return {
                    isUp: false,
                    reason: `Node Fisik ${pt.node} tidak merespon (${nodeErr.message})`
                };
            }

            return { isUp: true, cpu: cpuPct, ram: ramPct, ioDelay: ioDelayPct };
        } else {
            const expectedType = pt.type === 'VM' ? 'qemu' : 'lxc';
            const machine = resources.find(
                r => r.type === expectedType && 
                     ((pt.vmid != null && String(r.vmid) === String(pt.vmid)) || (pt.vmid == null && r.name === pt.name)) &&
                     (!pt.node || r.node === pt.node)
            );

            if (!machine) continue;

            const parentNode = resources.find(r => r.type === 'node' && r.node === machine.node);
            if (parentNode && String(parentNode.status || '').toLowerCase() === 'offline') {
                return { isUp: false, reason: `Node induk (${machine.node}) sedang OFFLINE` };
            }

            const statusLower = String(machine.status || '').toLowerCase();
            const isRunning = ['running', 'online', 'up'].includes(statusLower);

            if (!isRunning) {
                return { isUp: false, reason: `Mesin ${pt.type} ${pt.name} (${pt.vmid || '-'}) berstatus ${(machine.status || 'STOPPED').toUpperCase()}` };
            }

            const cpuPct = Number(((machine.cpu || 0) * 100).toFixed(1));
            const ramPct = Number((machine.maxmem ? (machine.mem / machine.maxmem) * 100 : 0).toFixed(1));

            return { isUp: true, cpu: cpuPct, ram: ramPct, ioDelay: null };
        }
    }

    if (!anyClusterReachable) {
        return { isUp: false, reason: 'Server Proxmox Cluster tidak dapat dihubungi / Offline' };
    }

    return { isUp: false, reason: `Target ${pt.type} ${pt.name} tidak ditemukan atau tidak merespon` };
};

// ==========================================
// CRONJOB PEMBERSIHAN RIWAYAT GRAFIK
// ==========================================
const HISTORY_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const MAX_HISTORY_ROWS_PER_TARGET = 20;

export const cleanupTargetHistory = async () => {
    try {
        let totalDeleted = 0;
        const [orphanRes] = await db.query(`
            DELETE th FROM target_history th
            LEFT JOIN monitoring_targets mt ON th.target_id = mt.id
            WHERE mt.id IS NULL
        `);
        totalDeleted += orphanRes.affectedRows || 0;

        const [targets] = await db.query('SELECT id FROM monitoring_targets');
        for (const t of targets) {
            const [delRes] = await db.query(
                `DELETE FROM target_history
                 WHERE target_id = ?
                   AND id <= IFNULL((
                       SELECT id FROM (
                           SELECT id FROM target_history
                           WHERE target_id = ?
                           ORDER BY id DESC
                           LIMIT 1 OFFSET ${MAX_HISTORY_ROWS_PER_TARGET}
                       ) AS cutoff
                   ), 0)`,
                [t.id, t.id]
            );
            totalDeleted += delRes.affectedRows || 0;
        }

        console.log(`[${getWibTimeStr()}] [CRON CLEANUP] Pembersihan target_history selesai (${totalDeleted} baris dihapus).`);
    } catch (err) {
        console.error('[CRON CLEANUP ERROR] Gagal membersihkan target_history:', err.message);
    }
};

// Helper Pemecah Array menjadi Batch
const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

// ==========================================
// FUNGSI UTAMA DAEMON
// ==========================================
let isDaemonRunning = false;

export const startMonitoringDaemon = async () => {
    const startupMsg = 'Layanan Monitoring (Daemon) berhasil diaktifkan.';
    console.log(`[INFO] ${startupMsg}`);
    await addDaemonLog('INFO', startupMsg);

    try {
        await db.query('UPDATE monitoring_targets SET last_check = NULL WHERE last_check > NOW()');
        await db.query('UPDATE proxmox_targets SET last_check = NULL WHERE last_check > NOW()');
    } catch (e) {
        console.error('[DAEMON INIT] Gagal menormalkan last_check:', e.message);
    }

    await cleanupTargetHistory();
    setInterval(cleanupTargetHistory, HISTORY_CLEANUP_INTERVAL_MS);

    await ensureCleanupSettingsTable();
    setInterval(executeScheduledCleanupIfDue, 10000);

    setInterval(async () => {
        if (isDaemonRunning) return;
        isDaemonRunning = true;

        try {
            // BERSIHKAN CACHE PROXMOX EXPIRED
            const nowMs = Date.now();
            for (const [key, val] of pxCache.nodeStatus.entries()) {
                if (nowMs > val.expires) pxCache.nodeStatus.delete(key);
            }
            for (const [key, val] of pxCache.clusterResources.entries()) {
                if (nowMs > val.expires) pxCache.clusterResources.delete(key);
            }

            // =======================================
            // BAGIAN 1: NETWORK (BATCHING)
            // =======================================
            const [targets] = await db.query(
                `SELECT *, TIMESTAMPDIFF(SECOND, IFNULL(last_check, '1970-01-01 00:00:00'), NOW()) AS elapsed_seconds 
                 FROM monitoring_targets 
                 WHERE is_active = 1`
            );

            const networkBatches = chunkArray(targets, 20); // Eksekusi 20 target sekaligus

            for (const batch of networkBatches) {
                await Promise.allSettled(batch.map(async (target) => {
                    const interval = Math.max(1, Number(target.check_interval) || 10);

                    if (target.last_check == null || target.elapsed_seconds >= interval || target.elapsed_seconds < 0) {
                        let result = { isUp: false, latency: null };
                        if (target.protocol === 'ICMP PING') {
                            result = await checkIcmp(target.ip_address);
                        } else if (target.protocol === 'TCP SOCKET') {
                            result = await checkTcp(target.ip_address, target.port);
                        }

                        let currentFails = failureCounts.get(target.id) || 0;
                        let newStatus = target.status;
                        const limitRTO = Math.max(1, Number(target.max_retries) || 3);

                        if (result.isUp) {
                            if (target.status === 'DOWN') {
                                const recMsg = `Koneksi Pulih: ${target.name} kembali ONLINE.`;
                                console.log(`[INFO] ${recMsg}`);
                                await addDaemonLog('INFO', recMsg);
                            }
                            currentFails = 0;
                            newStatus = 'UP';

                            if (target.is_alert_enabled === 1) {
                                const latCrit = Number(target.latency_critical);
                                const latWarn = Number(target.latency_warning);
                                const warnMax = Math.max(1, Number(target.notify_warning_max) || 1);
                                const critMax = Math.max(1, Number(target.notify_critical_max) || 1);

                                if (latCrit > 0 && result.latency !== null && result.latency >= latCrit) {
                                    await triggerAlert(
                                        target, 'NETWORK', 'CRITICAL', target.notify_critical_type || 'Pesan',
                                        critMax, `Latency Kritis: ${result.latency}ms (Batas: ${latCrit}ms)`
                                    );
                                } else if (latWarn > 0 && result.latency !== null && result.latency >= latWarn) {
                                    await triggerAlert(
                                        target, 'NETWORK', 'WARNING', target.notify_warning_type || 'Pesan',
                                        warnMax, `Latency Tinggi: ${result.latency}ms (Batas: ${latWarn}ms)`
                                    );
                                } else {
                                    await resolveAlert(target, 'NETWORK');
                                }
                            }
                        } else {
                            currentFails += 1;
                            if (currentFails >= limitRTO) {
                                newStatus = 'DOWN';
                                if (target.status !== 'DOWN') {
                                    const errMsg = `Koneksi Terputus: ${target.name} OFFLINE.`;
                                    console.log(`[ERROR] ${errMsg}`);
                                    await addDaemonLog('ERROR', errMsg);
                                }

                                if (target.is_alert_enabled === 1) {
                                    await triggerAlert(
                                        target, 'NETWORK', 'DOWN', target.notify_down_type || 'Call',
                                        1, `Koneksi Timeout / Terputus (${currentFails}x RTO berturut-turut)`
                                    );
                                }
                            }
                        }

                        failureCounts.set(target.id, currentFails);

                        const protoTag = target.protocol === 'ICMP PING' ? 'ICMP' : 'TCP';
                        const addrStr = target.protocol === 'TCP SOCKET' ? `${target.ip_address}:${target.port}` : target.ip_address;
                        const resultStr = result.isUp ? `status=${newStatus} | latency=${result.latency}ms` : `status=${newStatus} | latency=TIMEOUT (fail=${currentFails}/${limitRTO})`;
                        logIntervalCheck(protoTag, `${target.name} (${addrStr}) | interval=${interval}s | ${resultStr} | alert=${target.is_alert_enabled === 1 ? 'ON' : 'OFF'}`);

                        try {
                            await db.query('INSERT INTO target_history (target_id, latency_ms, status) VALUES (?, ?, ?)', [target.id, result.latency, result.isUp ? 'UP' : 'DOWN']);
                        } catch (histErr) {}

                        if (target.status !== newStatus) {
                            if (newStatus === 'DOWN' && target.status !== 'DOWN' && target.is_alert_enabled === 1) {
                                const upSince = target.last_status_change ? new Date(target.last_status_change) : new Date();
                                const downAt = new Date();
                                const uptimeSeconds = Math.max(0, Math.floor((downAt - upSince) / 1000));
                                const reason = result.latency !== null ? `Terputus (Last Ping: ${result.latency}ms)` : 'Koneksi Timeout / Terputus';

                                await db.query(
                                    `INSERT INTO down_history (target_id, target_type, target_name, up_since, down_at, uptime_duration_sec, down_reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    [target.id, 'NETWORK', target.name, upSince, downAt, uptimeSeconds, reason]
                                ).catch(err => console.error('[HISTORY ERROR]', err));
                            }

                            await db.query(
                                'UPDATE monitoring_targets SET status = ?, last_latency = ?, last_check = NOW(), last_status_change = NOW() WHERE id = ?',
                                [newStatus, result.latency !== null ? `${result.latency} ms` : 'TIMEOUT', target.id]
                            );
                        } else {
                            await db.query(
                                'UPDATE monitoring_targets SET status = ?, last_latency = ?, last_check = NOW() WHERE id = ?',
                                [newStatus, result.latency !== null ? `${result.latency} ms` : 'TIMEOUT', target.id]
                            );
                        }
                    }
                }));
            }

            // =======================================
            // BAGIAN 2: PROXMOX THRESHOLDS (BATCHING)
            // =======================================
            const [pxTargets] = await db.query(
                `SELECT *, TIMESTAMPDIFF(SECOND, IFNULL(last_check, '1970-01-01 00:00:00'), NOW()) AS elapsed_seconds 
                 FROM proxmox_targets 
                 WHERE is_alert_enabled = 1`
            );

            const pxBatches = chunkArray(pxTargets, 10); // Eksekusi 10 Proxmox target sekaligus

            for (const batch of pxBatches) {
                await Promise.allSettled(batch.map(async (pt) => {
                    const interval = Math.max(1, Number(pt.check_interval) || 10);

                    if (pt.last_check == null || pt.elapsed_seconds >= interval || pt.elapsed_seconds < 0) {
                        await db.query('UPDATE proxmox_targets SET last_check = NOW() WHERE id = ?', [pt.id]);

                        const metrics = await fetchLiveProxmoxMetrics(pt);
                        const newStatus = metrics.isUp ? 'UP' : 'DOWN';

                        const pxTargetLabel = pt.type === 'NODE' ? `${pt.name} (node=${pt.node})` : `${pt.name} (node=${pt.node}, vmid=${pt.vmid})`;
                        const pxMetricStr = metrics.isUp ? `status=UP | cpu=${metrics.cpu}% | ram=${metrics.ram}%${pt.type === 'NODE' && metrics.ioDelay !== null ? ` | io=${metrics.ioDelay}%` : ''}` : `status=DOWN | reason=${metrics.reason || 'Offline'}`;
                        logIntervalCheck(`PROXMOX:${pt.type}`, `${pxTargetLabel} | interval=${interval}s | ${pxMetricStr}`);

                        if (!metrics.isUp) {
                            await triggerAlert(pt, 'PROXMOX', 'DOWN', pt.notify_down_type || 'Call', 1, metrics.reason || 'Mesin Offline atau tidak merespon');
                        } else {
                            let highestSeverity = null;
                            let actionType = 'Pesan';
                            let msgs = [];

                            const cpuWarn = Number(pt.cpu_warning ?? 75);
                            const cpuCrit = Number(pt.cpu_critical ?? 90);
                            const ramWarn = Number(pt.ram_warning ?? 80);
                            const ramCrit = Number(pt.ram_critical ?? 95);
                            const ioWarn  = Number(pt.io_warning ?? 10);
                            const ioCrit  = Number(pt.io_critical ?? 20);

                            if (metrics.cpu >= cpuCrit) {
                                highestSeverity = 'CRITICAL';
                                actionType = pt.notify_critical_type || 'Call';
                                msgs.push(`CPU Kritis (${metrics.cpu}% >= ${cpuCrit}%)`);
                            } else if (metrics.cpu >= cpuWarn) {
                                highestSeverity = 'WARNING';
                                actionType = pt.notify_warning_type || 'Pesan';
                                msgs.push(`CPU Tinggi (${metrics.cpu}% >= ${cpuWarn}%)`);
                            }

                            if (metrics.ram >= ramCrit) {
                                if (highestSeverity !== 'CRITICAL') {
                                    highestSeverity = 'CRITICAL';
                                    actionType = pt.notify_critical_type || 'Call';
                                }
                                msgs.push(`RAM Kritis (${metrics.ram}% >= ${ramCrit}%)`);
                            } else if (metrics.ram >= ramWarn) {
                                if (!highestSeverity) {
                                    highestSeverity = 'WARNING';
                                    actionType = pt.notify_warning_type || 'Pesan';
                                }
                                msgs.push(`RAM Tinggi (${metrics.ram}% >= ${ramWarn}%)`);
                            }

                            if (pt.type === 'NODE' && metrics.ioDelay !== null) {
                                if (metrics.ioDelay >= ioCrit) {
                                    if (highestSeverity !== 'CRITICAL') {
                                        highestSeverity = 'CRITICAL';
                                        actionType = pt.notify_critical_type || 'Call';
                                    }
                                    msgs.push(`IO Kritis (${metrics.ioDelay}% >= ${ioCrit}%)`);
                                } else if (metrics.ioDelay >= ioWarn) {
                                    if (!highestSeverity) {
                                        highestSeverity = 'WARNING';
                                        actionType = pt.notify_warning_type || 'Pesan';
                                    }
                                    msgs.push(`IO Tinggi (${metrics.ioDelay}% >= ${ioWarn}%)`);
                                }
                            }

                            if (highestSeverity) {
                                await triggerAlert(pt, 'PROXMOX', highestSeverity, actionType, 1, msgs.join(' | '));
                            } else {
                                await resolveAlert(pt, 'PROXMOX');
                            }
                        }

                        if (pt.status !== newStatus) {
                            if (newStatus === 'DOWN' && pt.status !== 'DOWN') {
                                const upSince = pt.last_status_change ? new Date(pt.last_status_change) : new Date();
                                const downAt = new Date();
                                const uptimeSeconds = Math.max(0, Math.floor((downAt - upSince) / 1000));
                                const targetName = `${pt.name || pt.node}${pt.vmid ? ` (VMID: ${pt.vmid})` : ' (Node Utama)'}`;

                                await db.query(
                                    `INSERT INTO down_history (target_id, target_type, target_name, up_since, down_at, uptime_duration_sec, down_reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    [pt.id, 'PROXMOX', targetName, upSince, downAt, uptimeSeconds, metrics.reason || 'Mesin Proxmox Offline / Tidak merespon API']
                                ).catch(err => console.error('[HISTORY ERROR]', err));
                            } else if (pt.status === 'DOWN' && newStatus === 'UP') {
                                const recMsg = `Mesin Pulih: [PROXMOX] ${pt.name || pt.node} kembali ONLINE.`;
                                console.log(`[INFO] ${recMsg}`);
                                await addDaemonLog('INFO', recMsg);
                            }

                            await db.query('UPDATE proxmox_targets SET status = ?, last_status_change = NOW() WHERE id = ?', [newStatus, pt.id]);
                        }
                    }
                }));
            }

        } catch (error) {
            console.error(`[ERROR] Daemon Master Loop Error: ${error.message}`);
        } finally {
            isDaemonRunning = false;
        }
    }, 1000);
};