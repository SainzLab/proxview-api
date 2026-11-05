import db from '../config/database.js';
import { WIB_OFFSET_MS, getWibYear } from '../config/timezone.js';

const formatSec = (totalSeconds) => {
    if (totalSeconds == null) return '-';
    if (totalSeconds <= 0) return '0d';

    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    let result = [];
    if (d > 0) result.push(`${d} hari`);
    if (h > 0) result.push(`${h}j`);
    if (m > 0 || h > 0) result.push(`${m}m`);
    result.push(`${s}d`);

    return result.join(' ');
};

export const fetchIncidentsData = async () => {
    const [rows] = await db.query(`
        SELECT 
            a.id, a.target_type, a.target_name, a.severity, a.original_severity, a.message, 
            a.created_at, a.resolved_at, a.is_resolved,
            GROUP_CONCAT(h.user_name SEPARATOR ', ') AS technicians,
            MIN(h.joined_at) AS handled_at,
            COUNT(h.id) AS handler_count,
            TIMESTAMPDIFF(SECOND, a.created_at, IFNULL(a.resolved_at, CURRENT_TIMESTAMP)) AS downtime_sec,
            TIMESTAMPDIFF(SECOND, MIN(h.joined_at), IFNULL(a.resolved_at, CURRENT_TIMESTAMP)) AS handling_sec
        FROM active_alerts a
        LEFT JOIN alert_handlers h ON a.id = h.alert_id
        GROUP BY a.id
        ORDER BY a.is_resolved ASC, a.created_at DESC
    `);

    return rows.map(row => {
        let status = 'Gangguan Aktif';
        if (row.is_resolved === 1) status = 'Selesai';
        else if (row.handler_count > 0) status = 'Dalam Penanganan';

        const year = getWibYear(row.created_at);
        const ticketId = `#INC-${year}-${String(row.id).padStart(4, '0')}`;

        return {
            id: ticketId,
            db_id: row.id,
            time: row.created_at,
            resolved_at: row.resolved_at,
            title: row.message,
            target: `${row.target_type} - ${row.target_name}`,
            status: status,
            severity: row.severity,
            original_severity: row.original_severity || row.severity,
            technicians: row.technicians || null,
            is_resolved: row.is_resolved,
            downtime_duration: formatSec(row.downtime_sec),
            handling_duration: row.handled_at ? formatSec(row.handling_sec) : '-'
        };
    });
};

export const getIncidents = async (req, res) => {
    try {
        const formattedTickets = await fetchIncidentsData();
        res.json({ success: true, data: formattedTickets });
    } catch (error) {
        console.error("Error getIncidents:", error);
        res.status(500).json({ success: false, message: 'Gagal memuat rekap tiket' });
    }
};

export const getIncidentStats = async (req, res) => {
    try {
        const [[stats]] = await db.query(`
            SELECT 
                COUNT(CASE WHEN a.is_resolved = 0 AND a.severity = 'DOWN' THEN 1 END) AS \`down\`,
                COUNT(CASE WHEN a.is_resolved = 0 AND a.severity = 'CRITICAL' THEN 1 END) AS \`critical\`,
                COUNT(CASE WHEN a.is_resolved = 0 AND a.severity = 'WARNING' THEN 1 END) AS \`warning\`,
                COUNT(CASE WHEN a.is_resolved = 0 AND h.handler_count > 0 THEN 1 END) AS \`progress\`,
                COUNT(CASE WHEN a.is_resolved = 1 THEN 1 END) AS \`resolved\`,
                COUNT(CASE WHEN a.is_resolved = 0 THEN 1 END) AS \`total_active\`,
                COUNT(a.id) AS \`total_tickets\`
            FROM active_alerts a
            LEFT JOIN (
                SELECT alert_id, COUNT(id) AS handler_count 
                FROM alert_handlers 
                GROUP BY alert_id
            ) h ON a.id = h.alert_id
        `);

        res.json({
            success: true,
            data: {
                down: Number(stats?.down) || 0,
                critical: Number(stats?.critical) || 0,
                warning: Number(stats?.warning) || 0,
                progress: Number(stats?.progress) || 0,
                resolved: Number(stats?.resolved) || 0,
                total_active: Number(stats?.total_active) || 0,
                total_tickets: Number(stats?.total_tickets) || 0
            }
        });
    } catch (error) {
        console.error("Error getIncidentStats:", error);
        res.status(500).json({ success: false, message: 'Gagal memuat statistik gangguan' });
    }
};

export const joinIncident = async (req, res) => {
    const alert_id = req.body.alert_id || req.body.id;
    const user_id = req.user?.id;
    const user_name = req.user?.name || req.user?.username;

    if (!alert_id || !user_id || !user_name) {
        return res.status(400).json({ success: false, message: 'Parameter alert_id atau identitas sesi teknisi (Bearer Token) tidak valid.' });
    }

    try {
        const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [user_id]);
        if (userRows.length > 0 && userRows[0].role === 'Kepala Bidang') {
            return res.status(403).json({ 
                success: false, 
                message: 'Akses Ditolak: Kepala Bidang tidak memiliki wewenang operasional untuk menangani tiket lapangan.' 
            });
        }

        const [alertRows] = await db.query('SELECT id, is_resolved FROM active_alerts WHERE id = ?', [alert_id]);
        if (alertRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Tiket gangguan tidak ditemukan.' });
        }
        if (alertRows[0].is_resolved === 1) {
            return res.status(400).json({ success: false, message: 'Tiket gangguan ini sudah diselesaikan.' });
        }

        await db.query(
            'INSERT IGNORE INTO alert_handlers (alert_id, user_id, user_name) VALUES (?, ?, ?)', 
            [alert_id, user_id, user_name]
        );

        await db.query(
            'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)', 
            ['INFO', 'TICKET SYSTEM', `Teknisi ${user_name} mengkonfirmasi penanganan tiket #${alert_id}`]
        );

        res.json({ success: true, message: 'Berhasil bergabung dalam penanganan tiket' });
    } catch (error) {
        console.error("Error joinIncident:", error);
        res.status(500).json({ success: false, message: 'Gagal mengkonfirmasi tiket' });
    }
};

export const resolveIncident = async (req, res) => {
    const alert_id = req.body.alert_id || req.body.id;
    const user_id = req.user?.id; 
    const user_name = req.user?.name || req.user?.username || 'Teknisi';

    if (!alert_id || !user_id) {
        return res.status(400).json({ success: false, message: 'Parameter alert_id atau identitas sesi tidak valid.' });
    }

    try {
        const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [user_id]);
        if (userRows.length > 0 && userRows[0].role === 'Kepala Bidang') {
            return res.status(403).json({ 
                success: false, 
                message: 'Akses Ditolak: Kepala Bidang tidak memiliki wewenang untuk menutup tiket perbaikan.' 
            });
        }

        const [alertData] = await db.query('SELECT severity, is_resolved FROM active_alerts WHERE id = ?', [alert_id]);

        if (alertData.length === 0) {
            return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
        }
        if (alertData[0].is_resolved === 1) {
            return res.json({ success: true, message: 'Tiket sudah berstatus selesai.' });
        }
        if (alertData[0].severity !== 'RECOVERED') {
            return res.status(400).json({ success: false, message: 'Gagal! Sistem masih mendeteksi adanya gangguan. Pastikan indikator sistem kembali normal sebelum menutup tiket.' });
        }

        await db.query('UPDATE active_alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = ?', [alert_id]);
        await db.query('INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)', ['INFO', 'TICKET SYSTEM', `Tiket #${alert_id} ditutup secara manual oleh teknisi ${user_name}`]);

        res.json({ success: true, message: 'Tiket berhasil ditandai selesai' });
    } catch (error) {
        console.error("Error resolveIncident:", error);
        res.status(500).json({ success: false, message: 'Gagal menyelesaikan tiket' });
    }
};

const PERIODS = {
    '24h': { ms: 24 * 3600 * 1000, bucket: 'hour' },
    '7d':  { ms: 7 * 24 * 3600 * 1000, bucket: 'day' },
    '30d': { ms: 30 * 24 * 3600 * 1000, bucket: 'day' }
};

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const formatPreciseDuration = (totalSeconds) => {
    if (!totalSeconds || totalSeconds <= 0) return '0d';
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d} hari`);
    if (h > 0) parts.push(`${h}j`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}d`);
    return parts.join(' ');
};

const hitungMetrikITIL = (incidents, winStart, winEnd) => {
    const overlapped = incidents
        .map(i => ({ sec: Math.max(0, (Math.min(i.end, winEnd) - Math.max(i.start, winStart)) / 1000) }))
        .filter(i => i.sec > 0);

    const totalPeriodSec = Math.max(1, Math.round((winEnd - winStart) / 1000));
    const totalDowntimeSec = Math.min(totalPeriodSec, Math.round(overlapped.reduce((sum, i) => sum + i.sec, 0)));
    const totalUptimeSec = totalPeriodSec - totalDowntimeSec;
    const incidentCount = overlapped.length;
    const mttrSec = incidentCount > 0 ? Math.round(totalDowntimeSec / incidentCount) : 0;
    const mtbfSec = incidentCount > 0 ? Math.round(totalUptimeSec / incidentCount) : totalUptimeSec;
    const availability = Math.min(100, Math.max(0, (totalUptimeSec / totalPeriodSec) * 100)).toFixed(2);

    return {
        total_period_sec: totalPeriodSec,
        total_uptime_sec: totalUptimeSec,
        uptime_duration: formatPreciseDuration(totalUptimeSec),
        total_downtime_sec: totalDowntimeSec,
        downtime_duration: formatPreciseDuration(totalDowntimeSec),
        incident_count: incidentCount,
        mttr_sec: mttrSec,
        mttr_duration: formatPreciseDuration(mttrSec),
        mtbf_sec: mtbfSec,
        mtbf_duration: formatPreciseDuration(mtbfSec),
        availability
    };
};

const VALID_SEVERITIES = ['ALL', 'DOWN', 'CRITICAL', 'WARNING'];

export const fetchAnalyticsData = async ({
    period: reqPeriod = '24h',
    severity: reqSeverity = 'ALL',
    targetId: reqTargetId = null,
    targetType: reqTargetType = null
} = {}) => {
    const periodKey = PERIODS[reqPeriod] ? reqPeriod : '24h';
    const period = PERIODS[periodKey];
    const rawSev = String(reqSeverity || 'ALL').toUpperCase();
    const severityFilter = VALID_SEVERITIES.includes(rawSev) ? rawSev : 'ALL';

    const winEnd = Date.now();
    const winStart = winEnd - period.ms;

    const targetId = Number(reqTargetId);
    const targetType = String(reqTargetType || '').toUpperCase();
    let masterCreatedMs = null;

    if (Number.isInteger(targetId) && targetId > 0 && targetType) {
        const table = targetType === 'NETWORK' ? 'monitoring_targets'
            : (['PROXMOX', 'NODE', 'VM', 'LXC'].includes(targetType) ? 'proxmox_targets' : null);
        if (table) {
            const [[tRow]] = await db.query(`SELECT created_at FROM ${table} WHERE id = ?`, [targetId]);
            if (tRow && tRow.created_at) masterCreatedMs = new Date(tRow.created_at).getTime();
        }
    } else {
        const [[nRow]] = await db.query('SELECT MIN(created_at) AS first_at FROM monitoring_targets');
        const [[pRow]] = await db.query('SELECT MIN(created_at) AS first_at FROM proxmox_targets');
        const times = [nRow?.first_at, pRow?.first_at].filter(Boolean).map(t => new Date(t).getTime());
        if (times.length) masterCreatedMs = Math.min(...times);
    }

    const effectiveStart = Math.min(winEnd, masterCreatedMs !== null ? Math.max(winStart, masterCreatedMs) : winStart);

    const requestedSeverities = severityFilter === 'ALL' ? ['DOWN', 'CRITICAL'] : [severityFilter];

    let query = `
        SELECT created_at, resolved_at
        FROM active_alerts
        WHERE IFNULL(resolved_at, CURRENT_TIMESTAMP) > ? AND created_at < ?
          AND IFNULL(original_severity, severity) IN (${requestedSeverities.map(() => '?').join(',')})
    `;
    const params = [new Date(effectiveStart), new Date(winEnd), ...requestedSeverities];
    if (Number.isInteger(targetId) && targetId > 0 && targetType) {
        const types = targetType === 'NETWORK' ? ['NETWORK'] : ['PROXMOX', 'NODE', 'VM', 'LXC'];
        query += ` AND target_id = ? AND target_type IN (${types.map(() => '?').join(',')})`;
        params.push(targetId, ...types);
    }
    const [rows] = await db.query(query, params);

    const terapkanFilter = (m) => {
        if (severityFilter !== 'WARNING') return m;
        const { total_downtime_sec, downtime_duration, ...rest } = m;
        const uptimeSec = m.total_period_sec;
        const mtbfSec = m.incident_count > 0 ? Math.round(uptimeSec / m.incident_count) : uptimeSec;
        return {
            ...rest,
            total_degradation_sec: total_downtime_sec,
            degradation_duration: downtime_duration,
            total_downtime_sec: 0,
            downtime_duration: '0d',
            total_uptime_sec: uptimeSec,
            uptime_duration: formatPreciseDuration(uptimeSec),
            mtbf_sec: mtbfSec,
            mtbf_duration: formatPreciseDuration(mtbfSec),
            availability: '100.00'
        };
    };
    const incidents = rows.map(r => ({
        start: new Date(r.created_at).getTime(),
        end: r.resolved_at ? new Date(r.resolved_at).getTime() : winEnd
    }));

    const summary = {
        period: periodKey,
        severity: severityFilter,
        ...terapkanFilter(hitungMetrikITIL(incidents, effectiveStart, winEnd))
    };

    const chartData = [];
    const stepMs = period.bucket === 'hour' ? 3600 * 1000 : 24 * 3600 * 1000;
    let cursorMs = Math.floor((effectiveStart + WIB_OFFSET_MS) / stepMs) * stepMs - WIB_OFFSET_MS;

    while (cursorMs < winEnd) {
        const bs = Math.max(cursorMs, effectiveStart);
        const nextMs = cursorMs + stepMs;
        const be = Math.min(nextMs, winEnd);

        const wib = new Date(cursorMs + WIB_OFFSET_MS);
        const label = period.bucket === 'hour'
            ? `${String(wib.getUTCHours()).padStart(2, '0')}:00`
            : `${wib.getUTCDate()} ${BULAN[wib.getUTCMonth()]}`;

        chartData.push({
            label,
            ...terapkanFilter(hitungMetrikITIL(incidents, bs, be))
        });
        cursorMs = nextMs;
    }

    return { summary, chartData };
};

export const getAnalytics = async (req, res) => {
    try {
        const result = await fetchAnalyticsData({
            period: req.query.period,
            severity: req.query.severity,
            targetId: req.query.target_id,
            targetType: req.query.target_type
        });
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("Error Analytics:", error);
        res.status(500).json({ success: false, message: 'Gagal memuat grafik analitik' });
    }
};

export const getMobileAnalyticsSummary = async (req, res) => {
    try {
        const { summary } = await fetchAnalyticsData({
            period: req.query.period,
            severity: req.query.severity,
            targetId: req.query.target_id,
            targetType: req.query.target_type
        });

        res.json({
            success: true,
            data: {
                ...summary,
                availability_num: parseFloat(summary.availability),
                availability_percent: `${summary.availability}%`
            }
        });
    } catch (error) {
        console.error("Error getMobileAnalyticsSummary:", error);
        res.status(500).json({ success: false, message: 'Gagal memuat ringkasan metrik SLA & MTBF' });
    }
};
