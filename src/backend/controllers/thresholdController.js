import db from '../config/database.js';
import { resetTargetAlertState } from '../services/monitoringDaemon.js';

const addSystemLog = async (level, source, message) => {
    try {
        await db.query('INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)', [level, source, message]);
    } catch (err) {
        console.error('Gagal menulis log konfigurasi:', err);
    }
};

export const getNetworkThresholds = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM monitoring_targets WHERE is_alert_enabled = 1 ORDER BY id ASC');

        const formattedData = rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.protocol.includes('ICMP') ? 'ICMP' : 'TCP',
            host: row.ip_address,
            port: row.port,
            rtoTolerance: Number(row.max_retries ?? 3),
            latency: {
                warning: Number(row.latency_warning ?? 50),
                critical: Number(row.latency_critical ?? 150)
            },
            alertSettings: {
                checkInterval: Number(row.check_interval ?? 5),
                warning: { maxCount: Number(row.notify_warning_max ?? 1), type: row.notify_warning_type || 'Pesan' },
                critical: { maxCount: Number(row.notify_critical_max ?? 3), type: row.notify_critical_type || 'Pesan' },
                down: { maxCount: Number(row.notify_down_max ?? 5), type: row.notify_down_type || 'Call' }
            }
        }));
        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error("Error getNetworkThresholds:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data threshold network' });
    }
};

export const getNetworkCatalog = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name, protocol, ip_address, port FROM monitoring_targets WHERE is_alert_enabled = 0 ORDER BY name ASC');
        const catalog = rows.map(row => ({
            id: row.id, name: row.name, type: row.protocol.includes('ICMP') ? 'ICMP' : 'TCP', host: row.ip_address, port: row.port
        }));
        res.json({ success: true, data: catalog });
    } catch (error) {
        console.error("Error getNetworkCatalog:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil katalog target' });
    }
};

export const saveNetworkThresholds = async (req, res) => {
    const { targets } = req.body;
    try {
        const [oldActive] = await db.query('SELECT id, name FROM monitoring_targets WHERE is_alert_enabled = 1');
        const oldIds = oldActive.map(t => t.id);
        const newIds = targets ? targets.map(t => t.id) : [];

        await db.query('UPDATE monitoring_targets SET is_alert_enabled = 0');

        if (targets && targets.length > 0) {
            for (const target of targets) {
                await db.query(`
                    UPDATE monitoring_targets 
                    SET is_alert_enabled = 1, max_retries = ?, latency_warning = ?, latency_critical = ?, check_interval = ?, 
                        notify_warning_max = ?, notify_warning_type = ?, notify_critical_max = ?, notify_critical_type = ?, 
                        notify_down_max = ?, notify_down_type = ?, last_check = NULL
                    WHERE id = ?
                `, [
                    Number(target.rtoTolerance ?? 3),
                    Number(target.latency?.warning ?? 50),
                    Number(target.latency?.critical ?? 150),
                    Number(target.alertSettings?.checkInterval ?? 5),
                    Number(target.alertSettings?.warning?.maxCount ?? 1),
                    target.alertSettings?.warning?.type || 'Pesan',
                    Number(target.alertSettings?.critical?.maxCount ?? 3),
                    target.alertSettings?.critical?.type || 'Pesan',
                    Number(target.alertSettings?.down?.maxCount ?? 5),
                    target.alertSettings?.down?.type || 'Call',
                    target.id
                ]);

                if (oldIds.includes(target.id)) {
                    await addSystemLog('INFO', 'THRESHOLD NETWORK', `Konfigurasi diperbarui: ${target.name}`);
                } else {
                    await addSystemLog('INFO', 'THRESHOLD NETWORK', `Target ditambahkan ke Notifikasi: ${target.name}`);
                }
            }
        }

        const removedTargets = oldActive.filter(t => !newIds.includes(t.id));
        for (const target of removedTargets) {
            await addSystemLog('WARNING', 'THRESHOLD NETWORK', `Target dihapus dari Notifikasi: ${target.name}`);
            await db.query(
                `UPDATE active_alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE target_id = ? AND target_type = 'NETWORK' AND is_resolved = 0`,
                [target.id]
            );
        }

        resetTargetAlertState('NETWORK');

        res.json({ success: true, message: 'Konfigurasi Network berhasil disimpan' });
    } catch (error) {
        console.error("Error saveNetworkThresholds:", error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan konfigurasi' });
    }
};

export const getProxmoxCatalog = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, vmid, name, type, node FROM proxmox_targets WHERE is_alert_enabled = 0 ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error getProxmoxCatalog:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil katalog proxmox' });
    }
};

export const getProxmoxThresholds = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM proxmox_targets WHERE is_alert_enabled = 1 ORDER BY id ASC');
        const formattedData = rows.map(row => ({
            id: row.id,
            vmid: row.vmid,
            name: row.name,
            type: row.type,
            node: row.node,
            cpu: { warning: Number(row.cpu_warning ?? 75), critical: Number(row.cpu_critical ?? 90) },
            ram: { warning: Number(row.ram_warning ?? 80), critical: Number(row.ram_critical ?? 95) },
            ioDelay: { warning: Number(row.io_warning ?? 5), critical: Number(row.io_critical ?? 15) },
            alertSettings: {
                checkInterval: Number(row.check_interval ?? 10),
                warning: { maxCount: Number(row.notify_warning_max ?? 1), type: row.notify_warning_type || 'Pesan' },
                critical: { maxCount: Number(row.notify_critical_max ?? 3), type: row.notify_critical_type || 'Call' },
                down: { maxCount: Number(row.notify_down_max ?? 5), type: row.notify_down_type || 'Call' }
            }
        }));
        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error("Error getProxmoxThresholds:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data threshold proxmox' });
    }
};

export const saveProxmoxThresholds = async (req, res) => {
    const { targets } = req.body;
    try {
        await db.query('UPDATE proxmox_targets SET is_alert_enabled = 0');

        if (targets && targets.length > 0) {
            for (const target of targets) {
                const vmidVal = target.vmid !== undefined && target.vmid !== '' ? target.vmid : null;
                const [existing] = await db.query(
                    'SELECT id FROM proxmox_targets WHERE type = ? AND node = ? AND (vmid <=> ? OR name = ?)',
                    [target.type, target.node, vmidVal, target.name]
                );

                const cpuWarn = Number(target.cpu?.warning ?? 75);
                const cpuCrit = Number(target.cpu?.critical ?? 90);
                const ramWarn = Number(target.ram?.warning ?? 80);
                const ramCrit = Number(target.ram?.critical ?? 95);
                const ioWarn  = Number(target.ioDelay?.warning ?? 10);
                const ioCrit  = Number(target.ioDelay?.critical ?? 20);
                const checkInt = Number(target.alertSettings?.checkInterval ?? 10);
                const warnMax = Number(target.alertSettings?.warning?.maxCount ?? 1);
                const warnType = target.alertSettings?.warning?.type || 'Pesan';
                const critMax = Number(target.alertSettings?.critical?.maxCount ?? 3);
                const critType = target.alertSettings?.critical?.type || 'Call';
                const downMax = Number(target.alertSettings?.down?.maxCount ?? 5);
                const downType = target.alertSettings?.down?.type || 'Call';

                if (existing.length > 0) {
                    await db.query(`
                        UPDATE proxmox_targets 
                        SET name = ?, vmid = ?, is_alert_enabled = 1, cpu_warning = ?, cpu_critical = ?, ram_warning = ?, ram_critical = ?, 
                            io_warning = ?, io_critical = ?, check_interval = ?, notify_warning_max = ?, notify_warning_type = ?, 
                            notify_critical_max = ?, notify_critical_type = ?, notify_down_max = ?, notify_down_type = ?,
                            last_check = NULL
                        WHERE id = ?
                    `, [
                        target.name, vmidVal, cpuWarn, cpuCrit, ramWarn, ramCrit,
                        ioWarn, ioCrit, checkInt, warnMax, warnType,
                        critMax, critType, downMax, downType, existing[0].id
                    ]);
                    await addSystemLog('INFO', 'THRESHOLD PROXMOX', `Konfigurasi diperbarui: ${target.name} (${target.type})`);
                } else {
                    await db.query(`
                        INSERT INTO proxmox_targets 
                        (vmid, name, type, node, is_alert_enabled, cpu_warning, cpu_critical, ram_warning, ram_critical, 
                        io_warning, io_critical, check_interval, notify_warning_max, notify_warning_type, notify_critical_max, 
                        notify_critical_type, notify_down_max, notify_down_type, last_check) 
                        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                    `, [
                        vmidVal, target.name, target.type, target.node, cpuWarn, cpuCrit,
                        ramWarn, ramCrit, ioWarn, ioCrit,
                        checkInt, warnMax, warnType,
                        critMax, critType, downMax, downType
                    ]);
                    await addSystemLog('INFO', 'THRESHOLD PROXMOX', `Target ditambahkan ke Notifikasi: ${target.name} (${target.type})`);
                }
            }
        }

        const [deletedTargets] = await db.query('SELECT id, name, type FROM proxmox_targets WHERE is_alert_enabled = 0');
        for (const del of deletedTargets) {
            await addSystemLog('WARNING', 'THRESHOLD PROXMOX', `Target dihapus dari Notifikasi: ${del.name} (${del.type})`);
            await db.query(
                `UPDATE active_alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE target_id = ? AND target_type = 'PROXMOX' AND is_resolved = 0`,
                [del.id]
            );
        }

        await db.query('DELETE FROM proxmox_targets WHERE is_alert_enabled = 0');

        resetTargetAlertState('PROXMOX');

        res.json({ success: true, message: 'Konfigurasi Proxmox berhasil disimpan' });
    } catch (error) {
        console.error("Error saveProxmoxThresholds:", error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan konfigurasi proxmox' });
    }
};
