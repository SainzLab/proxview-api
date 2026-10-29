import db from '../config/database.js';
import { WIB_OFFSET_MS } from '../config/timezone.js';

let isTableReady = false;

const getWibTimeStr = () => {
    const wib = new Date(Date.now() + WIB_OFFSET_MS);
    const hh = String(wib.getUTCHours()).padStart(2, '0');
    const mm = String(wib.getUTCMinutes()).padStart(2, '0');
    const ss = String(wib.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss} WIB`;
};

const unitToSeconds = (val, unit) => {
    const num = Math.max(1, parseInt(val, 10) || 1);
    switch (String(unit || 'DAYS').toUpperCase()) {
        case 'MINUTES':
            return num * 60;
        case 'HOURS':
            return num * 3600;
        case 'DAYS':
        default:
            return num * 86400;
    }
};

export const ensureCleanupSettingsTable = async () => {
    if (isTableReady) return;
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS cleanup_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                is_enabled TINYINT(1) NOT NULL DEFAULT 1,
                interval_value INT NOT NULL DEFAULT 7,
                interval_unit ENUM('MINUTES', 'HOURS', 'DAYS') NOT NULL DEFAULT 'DAYS',
                retention_mode ENUM('OLDER_THAN', 'ALL') NOT NULL DEFAULT 'OLDER_THAN',
                last_run TIMESTAMP NULL DEFAULT NULL,
                last_deleted_count INT NOT NULL DEFAULT 0,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Seed pengaturan awal terpisah untuk system_logs dan incident_history
        await db.query(`
            INSERT IGNORE INTO cleanup_settings (setting_key, is_enabled, interval_value, interval_unit, retention_mode, last_run)
            VALUES 
                ('system_logs', 1, 7, 'DAYS', 'OLDER_THAN', NOW()),
                ('incident_history', 1, 30, 'DAYS', 'OLDER_THAN', NOW())
        `);

        isTableReady = true;
    } catch (error) {
        console.error('[CRON CLEANUP ERROR] Gagal menginisialisasi tabel cleanup_settings:', error.message);
    }
};

// Eksekusi penghapusan data untuk satu kategori ('system_logs' atau 'incident_history')
export const performCleanupByKey = async (settingKey, retentionMode, intervalSec, sourceLabel = 'AUTO') => {
    let deletedCount = 0;

    if (settingKey === 'system_logs') {
        if (retentionMode === 'ALL') {
            const [res] = await db.query('DELETE FROM system_logs');
            deletedCount = res.affectedRows || 0;
        } else {
            const [res] = await db.query(
                'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? SECOND)',
                [intervalSec]
            );
            deletedCount = res.affectedRows || 0;
        }

        await db.query(
            'UPDATE cleanup_settings SET last_run = NOW(), last_deleted_count = ? WHERE setting_key = ?',
            [deletedCount, 'system_logs']
        );

        console.log(
            `[${getWibTimeStr()}] [CRON CLEANUP LOG] (${sourceLabel}) Pembersihan system_logs selesai: ${deletedCount} baris dihapus (mode=${retentionMode}).`
        );
    } else if (settingKey === 'incident_history') {
        // MENGGUNAKAN TRANSAKSI ACID UNTUK MULTI-TABLE DELETE
        const conn = await db.getConnection();
        await conn.beginTransaction(); 
        
        try {
            if (retentionMode === 'ALL') {
                // Hapus handler untuk tiket yang sudah selesai
                await conn.query(`
                    DELETE ah FROM alert_handlers ah
                    INNER JOIN active_alerts aa ON ah.alert_id = aa.id
                    WHERE aa.is_resolved = 1
                `);
                const [resAlerts] = await conn.query('DELETE FROM active_alerts WHERE is_resolved = 1');
                await conn.query('DELETE FROM down_history');
                deletedCount = resAlerts.affectedRows || 0;
            } else {
                await conn.query(
                    `DELETE ah FROM alert_handlers ah
                     INNER JOIN active_alerts aa ON ah.alert_id = aa.id
                     WHERE aa.is_resolved = 1
                       AND IFNULL(aa.resolved_at, aa.created_at) < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
                    [intervalSec]
                );
                const [resAlerts] = await conn.query(
                    `DELETE FROM active_alerts
                     WHERE is_resolved = 1
                       AND IFNULL(resolved_at, created_at) < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
                    [intervalSec]
                );
                await conn.query(
                    'DELETE FROM down_history WHERE down_at < DATE_SUB(NOW(), INTERVAL ? SECOND)',
                    [intervalSec]
                );
                deletedCount = resAlerts.affectedRows || 0;
            }

            // Bersihkan baris handler yatim jika ada
            await conn.query(`
                DELETE ah FROM alert_handlers ah
                LEFT JOIN active_alerts aa ON ah.alert_id = aa.id
                WHERE aa.id IS NULL
            `);

            await conn.commit(); // Eksekusi permanen penghapusan jika tidak ada error
        } catch (err) {
            await conn.rollback(); // Batalkan semua penghapusan jika ada satu kueri yang gagal
            console.error('[CRON CLEANUP ERROR] Transaksi pembersihan riwayat dibatalkan:', err.message);
            throw err;
        } finally {
            conn.release(); // Kembalikan koneksi ke pool
        }

        await db.query(
            'UPDATE cleanup_settings SET last_run = NOW(), last_deleted_count = ? WHERE setting_key = ?',
            [deletedCount, 'incident_history']
        );

        console.log(
            `[${getWibTimeStr()}] [CRON CLEANUP RIWAYAT] (${sourceLabel}) Pembersihan riwayat gangguan selesai: ${deletedCount} tiket selesai dihapus (mode=${retentionMode}).`
        );
    }

    return deletedCount;
};

// Dipanggil secara berkala oleh Monitoring Daemon untuk mengecek apakah jadwal cron sudah waktunya jalan
export const executeScheduledCleanupIfDue = async () => {
    try {
        await ensureCleanupSettingsTable();
        const [rows] = await db.query(`
            SELECT 
                setting_key, is_enabled, interval_value, interval_unit, retention_mode, last_run,
                TIMESTAMPDIFF(SECOND, IFNULL(last_run, NOW()), NOW()) AS elapsed_seconds
            FROM cleanup_settings
        `);

        for (const row of rows) {
            if (row.is_enabled !== 1) continue;

            if (!row.last_run) {
                await db.query('UPDATE cleanup_settings SET last_run = NOW() WHERE setting_key = ?', [row.setting_key]);
                continue;
            }

            const intervalSec = unitToSeconds(row.interval_value, row.interval_unit);
            if (row.elapsed_seconds >= intervalSec) {
                await performCleanupByKey(row.setting_key, row.retention_mode, intervalSec, 'CRON');
            }
        }
    } catch (error) {
        console.error('[CRON CLEANUP ERROR] Gagal menjalankan pengecekan jadwal cleanup:', error.message);
    }
};

// GET /api/settings/cleanup
export const getCleanupSettings = async (req, res) => {
    if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak! Hanya role Admin yang diizinkan mengakses pengaturan pembersihan.'
        });
    }

    try {
        await ensureCleanupSettingsTable();
        const [rows] = await db.query('SELECT * FROM cleanup_settings');
        const [[logStat]] = await db.query('SELECT COUNT(*) AS total FROM system_logs');
        const [[histStat]] = await db.query('SELECT COUNT(*) AS total FROM active_alerts WHERE is_resolved = 1');

        const result = {
            system_logs: {
                is_enabled: true,
                interval_value: 7,
                interval_unit: 'DAYS',
                retention_mode: 'OLDER_THAN',
                last_run: null,
                next_run: null,
                last_deleted_count: 0,
                current_count: logStat?.total || 0
            },
            incident_history: {
                is_enabled: true,
                interval_value: 30,
                interval_unit: 'DAYS',
                retention_mode: 'OLDER_THAN',
                last_run: null,
                next_run: null,
                last_deleted_count: 0,
                current_count: histStat?.total || 0
            }
        };

        for (const row of rows) {
            if (!result[row.setting_key]) continue;
            const intervalSec = unitToSeconds(row.interval_value, row.interval_unit);
            const lastRunDate = row.last_run ? new Date(row.last_run) : null;
            const nextRunDate = row.is_enabled === 1 && lastRunDate
                ? new Date(lastRunDate.getTime() + intervalSec * 1000)
                : null;

            result[row.setting_key] = {
                ...result[row.setting_key],
                is_enabled: row.is_enabled === 1,
                interval_value: Number(row.interval_value) || 1,
                interval_unit: row.interval_unit || 'DAYS',
                retention_mode: row.retention_mode || 'OLDER_THAN',
                last_run: lastRunDate ? lastRunDate.toISOString() : null,
                next_run: nextRunDate ? nextRunDate.toISOString() : null,
                last_deleted_count: Number(row.last_deleted_count) || 0
            };
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error getCleanupSettings:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat pengaturan cronjob pembersihan' });
    }
};

// PUT /api/settings/cleanup
export const saveCleanupSettings = async (req, res) => {
    if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak! Hanya role Admin yang diizinkan mengubah pengaturan pembersihan.'
        });
    }

    try {
        await ensureCleanupSettingsTable();
        const { system_logs, incident_history } = req.body || {};

        const validUnits = ['MINUTES', 'HOURS', 'DAYS'];
        const validModes = ['OLDER_THAN', 'ALL'];

        if (system_logs) {
            const enabled = system_logs.is_enabled ? 1 : 0;
            const val = Math.max(1, parseInt(system_logs.interval_value, 10) || 7);
            const unit = validUnits.includes(system_logs.interval_unit) ? system_logs.interval_unit : 'DAYS';
            const mode = validModes.includes(system_logs.retention_mode) ? system_logs.retention_mode : 'OLDER_THAN';

            await db.query(
                `UPDATE cleanup_settings
                 SET is_enabled = ?, interval_value = ?, interval_unit = ?, retention_mode = ?, last_run = NOW()
                 WHERE setting_key = 'system_logs'`,
                [enabled, val, unit, mode]
            );
        }

        if (incident_history) {
            const enabled = incident_history.is_enabled ? 1 : 0;
            const val = Math.max(1, parseInt(incident_history.interval_value, 10) || 30);
            const unit = validUnits.includes(incident_history.interval_unit) ? incident_history.interval_unit : 'DAYS';
            const mode = validModes.includes(incident_history.retention_mode) ? incident_history.retention_mode : 'OLDER_THAN';

            await db.query(
                `UPDATE cleanup_settings
                 SET is_enabled = ?, interval_value = ?, interval_unit = ?, retention_mode = ?, last_run = NOW()
                 WHERE setting_key = 'incident_history'`,
                [enabled, val, unit, mode]
            );
        }

        await db.query(
            'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
            ['INFO', 'CRON CONFIG', `Pengaturan jadwal cronjob pembersihan otomatis (Log & Riwayat Gangguan) diperbarui oleh Admin '${req.user.username}'.`]
        );

        res.json({ success: true, message: 'Pengaturan cronjob pembersihan berhasil disimpan' });
    } catch (error) {
        console.error('Error saveCleanupSettings:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan cronjob' });
    }
};

// POST /api/settings/cleanup/run
export const runManualCleanup = async (req, res) => {
    if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak! Hanya role Admin yang diizinkan menjalankan pembersihan log.'
        });
    }

    try {
        await ensureCleanupSettingsTable();
        const { target, mode } = req.body || {};

        if (!['system_logs', 'incident_history'].includes(target)) {
            return res.status(400).json({ success: false, message: 'Target pembersihan tidak valid' });
        }

        const [[row]] = await db.query('SELECT * FROM cleanup_settings WHERE setting_key = ?', [target]);
        const intervalSec = unitToSeconds(row?.interval_value || 1, row?.interval_unit || 'DAYS');
        const effectiveMode = mode === 'ALL' || mode === 'OLDER_THAN' ? mode : (row?.retention_mode || 'ALL');

        const deletedCount = await performCleanupByKey(target, effectiveMode, intervalSec, 'MANUAL');

        if (target === 'system_logs') {
            await db.query(
                'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
                ['WARNING', 'CRON CLEANUP', `Pembersihan manual Log Sistem dijalankan oleh Admin '${req.user.username}' (${deletedCount} baris dihapus, mode=${effectiveMode}).`]
            );
        } else if (target === 'incident_history') {
            await db.query(
                'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
                ['WARNING', 'CRON CLEANUP', `Pembersihan manual riwayat gangguan dijalankan oleh Admin '${req.user.username}' (${deletedCount} tiket selesai dihapus, mode=${effectiveMode}).`]
            );
        }

        res.json({
            success: true,
            deleted_count: deletedCount,
            message: target === 'system_logs'
                ? `Berhasil membersihkan ${deletedCount} baris Log Sistem.`
                : `Berhasil membersihkan ${deletedCount} riwayat gangguan selesai.`
        });
    } catch (error) {
        console.error('Error runManualCleanup:', error);
        res.status(500).json({ success: false, message: 'Gagal menjalankan pembersihan manual' });
    }
};