import db from '../config/database.js';
import { resetTargetAlertState } from '../services/monitoringDaemon.js';

const addSystemLog = async (level, source, message) => {
  try {
    await db.query('INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)', [level, source, message]);
  } catch (error) {
    console.error('Gagal menulis log:', error);
  }
};

export const getTargets = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM monitoring_targets ORDER BY created_at DESC');
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get Targets Error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data monitoring.' });
  }
};

export const createTarget = async (req, res) => {
  const { name, description, protocol, ip_address, port, check_interval, max_retries } = req.body;
  try {
    const targetPort = protocol === 'TCP SOCKET' ? port : null;

    await db.query(
      `INSERT INTO monitoring_targets (name, description, protocol, ip_address, port, check_interval, max_retries, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, protocol, ip_address, targetPort, check_interval || 60, max_retries || 3, true]
    );

    await addSystemLog('INFO', 'TARGET MONITORING', `Target baru ditambahkan: ${name} (${ip_address})`);

    res.status(201).json({ success: true, message: 'Target monitoring berhasil ditambahkan.' });
  } catch (error) {
    console.error('Create Target Error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan target monitoring.' });
  }
};

export const updateTarget = async (req, res) => {
  const { id } = req.params;
  const { name, description, protocol, ip_address, port, check_interval, max_retries } = req.body;
  try {
    const targetPort = protocol === 'TCP SOCKET' ? port : null;

    await db.query(
      `UPDATE monitoring_targets SET name=?, description=?, protocol=?, ip_address=?, port=?, check_interval=?, max_retries=?, last_check=NULL WHERE id=?`,
      [name, description, protocol, ip_address, targetPort, check_interval, max_retries, id]
    );

    resetTargetAlertState('NETWORK', id);

    await addSystemLog('INFO', 'TARGET MONITORING', `Konfigurasi target diperbarui: ${name} (${ip_address})`);

    res.status(200).json({ success: true, message: 'Data target berhasil diperbarui.' });
  } catch (error) {
    console.error('Update Target Error:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui target.' });
  }
};

export const deleteTarget = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT name, ip_address FROM monitoring_targets WHERE id = ?', [id]);
    const targetName = rows.length > 0 ? rows[0].name : `ID ${id}`;
    const targetIp = rows.length > 0 ? rows[0].ip_address : '';

    await db.query(
      `UPDATE active_alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE target_id = ? AND target_type = 'NETWORK' AND is_resolved = 0`,
      [id]
    );
    resetTargetAlertState('NETWORK', id);

    await db.query('DELETE FROM monitoring_targets WHERE id = ?', [id]);

    await addSystemLog('WARNING', 'TARGET MONITORING', `Target dihapus dari sistem: ${targetName} ${targetIp ? `(${targetIp})` : ''}`);

    res.status(200).json({ success: true, message: 'Target berhasil dihapus.' });
  } catch (error) {
    console.error('Delete Target Error:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus target.' });
  }
};

export const toggleTargetStatus = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    const [rows] = await db.query('SELECT name FROM monitoring_targets WHERE id = ?', [id]);
    const targetName = rows.length > 0 ? rows[0].name : `ID ${id}`;

    await db.query('UPDATE monitoring_targets SET is_active = ?, last_check = NULL WHERE id = ?', [is_active, id]);
    resetTargetAlertState('NETWORK', id);

    const actionName = is_active ? 'Mulai (Start)' : 'Jeda (Pause)';
    await addSystemLog('INFO', 'TARGET MONITORING', `Monitoring ${actionName} untuk target: ${targetName}`);

    res.status(200).json({ success: true, message: is_active ? 'Monitoring Dilanjutkan' : 'Monitoring Dijeda' });
  } catch (error) {
    console.error('Toggle Target Error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengubah status.' });
  }
};

export const getTargetHistory = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT latency_ms, status, DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") as time 
       FROM (
         SELECT id, latency_ms, status, created_at 
         FROM target_history 
         WHERE target_id = ? 
         ORDER BY id DESC 
         LIMIT 20
       ) AS latest 
       ORDER BY id ASC`,
      [id]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get History Error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil riwayat grafik.' });
  }
};

export const getSystemStatus = async (req, res) => {
  try {
    const [targets] = await db.query('SELECT protocol, status, is_active FROM monitoring_targets');

    const icmpTargets = targets.filter(t => t.protocol === 'ICMP PING' && t.is_active === 1);
    const icmpStatus = icmpTargets.length > 0 && icmpTargets.some(t => t.status === 'UP') ? 'ACTIVE' : 'DOWN';

    const tcpTargets = targets.filter(t => t.protocol === 'TCP SOCKET' && t.is_active === 1);
    const tcpStatus = tcpTargets.length > 0 && tcpTargets.some(t => t.status === 'UP') ? 'ACTIVE' : 'DOWN';

    const [proxmoxNodes] = await db.query('SELECT status FROM proxmox_nodes');
    const proxmoxStatus = proxmoxNodes.length > 0 && proxmoxNodes.some(n => n.status === 'TERHUBUNG') ? 'ACTIVE' : 'DOWN';

    res.status(200).json({
      success: true,
      data: {
        proxmox: proxmoxStatus,
        icmp: icmpStatus,
        tcp: tcpStatus
      }
    });
  } catch (error) {
    console.error('Get System Status Error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil status sistem' });
  }
};
