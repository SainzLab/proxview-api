import db from '../config/database.js';
import axios from 'axios';
import https from 'https';
import { WIB_OFFSET_MS, getWibYear } from '../config/timezone.js';

// Cache singkat agar request beruntun ke API Proxmox tetap cepat dan ringan
const rrdCache = new Map();
let clusterSnapshotCache = { ts: 0, data: null };

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const formatWibChartLabel = (unixSec, timeframeKey) => {
    const wib = new Date(unixSec * 1000 + WIB_OFFSET_MS);
    const hh = String(wib.getUTCHours()).padStart(2, '0');
    const mm = String(wib.getUTCMinutes()).padStart(2, '0');
    if (timeframeKey === '7d') {
        const dd = wib.getUTCDate();
        const mon = BULAN[wib.getUTCMonth()];
        return `${dd} ${mon} ${hh}:${mm}`;
    }
    return `${hh}:${mm}`;
};

const createProxmoxClient = (hostUrl, tokenId, tokenSecret) => {
    const baseURL = hostUrl.endsWith('/') ? hostUrl.slice(0, -1) : hostUrl;
    return axios.create({
        baseURL,
        timeout: 4000,
        headers: {
            Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
};

const fetchProxmoxClusterData = async (timeframeKey = '1h') => {
    const [pveServers] = await db.query(
        "SELECT id, name, host_url, token_id, token_secret, status FROM proxmox_nodes ORDER BY status = 'TERHUBUNG' DESC, id ASC"
    );

    const connectedServers = pveServers.filter(s => s.status === 'TERHUBUNG');
    if (connectedServers.length === 0) {
        return {
            total_nodes: pveServers.length,
            online_nodes: 0,
            offline_nodes: pveServers.length,
            health_percent: 0,
            total_vms: 0,
            running_vms: 0,
            avg_cpu: 0,
            avg_ram: 0,
            avg_io: 0,
            node_names: [],
            chart: { labels: [], cpu: [], ram: [], io: [] }
        };
    }

    const nowMs = Date.now();
    let clusterInfo = null;
    let activeClient = null;

    for (const srv of connectedServers) {
        try {
            const client = createProxmoxClient(srv.host_url, srv.token_id, srv.token_secret);
            if (nowMs - clusterSnapshotCache.ts < 4000 && clusterSnapshotCache.data) {
                clusterInfo = clusterSnapshotCache.data;
                activeClient = client;
                break;
            }
            const res = await client.get('/api2/json/cluster/resources');
            const resources = res.data?.data || [];
            clusterSnapshotCache = { ts: nowMs, data: resources };
            clusterInfo = resources;
            activeClient = client;
            break;
        } catch (err) {
            // Lanjut ke node cadangan berikutnya jika ada
        }
    }

    if (!clusterInfo) {
        // Fallback ke proxmox_targets di database jika API Proxmox sedang tidak dapat dihubungi
        const [pxTargets] = await db.query("SELECT type, status, name FROM proxmox_targets WHERE type = 'NODE'");
        const totalN = pxTargets.length || connectedServers.length;
        const onlineN = pxTargets.filter(n => n.status === 'UP').length;
        return {
            total_nodes: totalN,
            online_nodes: onlineN,
            offline_nodes: Math.max(0, totalN - onlineN),
            health_percent: totalN > 0 ? Math.round((onlineN / totalN) * 100) : 0,
            total_vms: 0,
            running_vms: 0,
            avg_cpu: 0,
            avg_ram: 0,
            avg_io: 0,
            node_names: pxTargets.map(n => n.name),
            chart: { labels: [], cpu: [], ram: [], io: [] }
        };
    }

    const nodes = clusterInfo.filter(r => r.type === 'node');
    const vmsAndLxcs = clusterInfo.filter(r => r.type === 'qemu' || r.type === 'lxc');
    const onlineNodes = nodes.filter(n => String(n.status || '').toLowerCase() === 'online');

    const totalNodes = nodes.length;
    const onlineNodesCount = onlineNodes.length;
    const healthPercent = totalNodes > 0 ? Math.round((onlineNodesCount / totalNodes) * 100) : 0;

    let avgCpu = 0;
    let avgRam = 0;
    let avgIo = 0;
    if (onlineNodesCount > 0) {
        const sumCpu = onlineNodes.reduce((acc, n) => acc + Number(n.cpu || 0) * 100, 0);
        const sumRam = onlineNodes.reduce(
            (acc, n) => acc + (n.maxmem ? (Number(n.mem || 0) / Number(n.maxmem)) * 100 : 0),
            0
        );
        avgCpu = Number((sumCpu / onlineNodesCount).toFixed(1));
        avgRam = Number((sumRam / onlineNodesCount).toFixed(1));
    }

    // Ambil data grafik RRD dari node online untuk 1h (hour), 24h (day), atau 7d (week)
    const rrdApiTimeframe = timeframeKey === '1h' ? 'hour' : (timeframeKey === '7d' ? 'week' : 'day');
    const windowSec = timeframeKey === '1h' ? 3600 : (timeframeKey === '7d' ? 7 * 24 * 3600 : 24 * 3600);
    const cacheKey = `rrd_${timeframeKey}`;
    const cachedRrd = rrdCache.get(cacheKey);

    let chart = { labels: [], cpu: [], ram: [], io: [] };

    if (cachedRrd && nowMs - cachedRrd.ts < 8000) {
        chart = cachedRrd.data;
        if (chart.io.length > 0) {
            avgIo = chart.io[chart.io.length - 1];
        }
    } else if (activeClient && onlineNodes.length > 0) {
        const bucketMap = new Map();
        const cutoffSec = Math.floor(nowMs / 1000) - windowSec;

        await Promise.all(
            onlineNodes.map(async (n) => {
                try {
                    const rrdRes = await activeClient.get(
                        `/api2/json/nodes/${encodeURIComponent(n.node)}/rrddata?timeframe=${rrdApiTimeframe}`
                    );
                    const points = rrdRes.data?.data || [];
                    for (const pt of points) {
                        if (!pt.time || pt.time < cutoffSec) continue;
                        if (pt.cpu === undefined && pt.memused === undefined && pt.iowait === undefined) continue;

                        const cpuVal = Number(pt.cpu || 0) * 100;
                        const ramVal = pt.memtotal ? (Number(pt.memused || 0) / Number(pt.memtotal)) * 100 : 0;
                        const ioVal = Number(pt.iowait || 0) * 100;

                        if (!bucketMap.has(pt.time)) {
                            bucketMap.set(pt.time, { cpuSum: 0, ramSum: 0, ioSum: 0, count: 0 });
                        }
                        const b = bucketMap.get(pt.time);
                        b.cpuSum += cpuVal;
                        b.ramSum += ramVal;
                        b.ioSum += ioVal;
                        b.count += 1;
                    }
                } catch (err) {
                    // Abaikan jika salah satu node gagal merespons RRD
                }
            })
        );

        const sortedTimes = Array.from(bucketMap.keys()).sort((a, b) => a - b);
        const maxPoints = 24;
        const step = sortedTimes.length > maxPoints ? Math.ceil(sortedTimes.length / maxPoints) : 1;
        const sampledTimes = sortedTimes.filter((_, idx) => idx % step === 0 || idx === sortedTimes.length - 1);

        chart = {
            labels: sampledTimes.map(t => formatWibChartLabel(t, timeframeKey)),
            cpu: sampledTimes.map(t => {
                const b = bucketMap.get(t);
                return Number((b.cpuSum / b.count).toFixed(1));
            }),
            ram: sampledTimes.map(t => {
                const b = bucketMap.get(t);
                return Number((b.ramSum / b.count).toFixed(1));
            }),
            io: sampledTimes.map(t => {
                const b = bucketMap.get(t);
                return Number((b.ioSum / b.count).toFixed(2));
            })
        };

        if (chart.io.length > 0) {
            avgIo = chart.io[chart.io.length - 1];
        }

        rrdCache.set(cacheKey, { ts: nowMs, data: chart });
    }

    return {
        total_nodes: totalNodes,
        online_nodes: onlineNodesCount,
        offline_nodes: Math.max(0, totalNodes - onlineNodesCount),
        health_percent: healthPercent,
        total_vms: vmsAndLxcs.length,
        running_vms: vmsAndLxcs.filter(v => String(v.status || '').toLowerCase() === 'running').length,
        avg_cpu: avgCpu,
        avg_ram: avgRam,
        avg_io: avgIo,
        node_names: nodes.map(n => n.node),
        chart
    };
};

// Helper ambil data ringkasan dashboard (digunakan oleh API & Export PDF)
export const fetchDashboardSummaryData = async (timeframeKey = '1h') => {
    // 1. Data Pengguna
    const [[userStats]] = await db.query(`
        SELECT 
            COUNT(*) AS total_users,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users,
            COUNT(DISTINCT CASE WHEN is_active = 1 THEN role END) AS active_roles
        FROM users
    `);

    // 2. Data Target Network (ICMP & TCP)
    const [targets] = await db.query('SELECT id, name, protocol, status, last_latency, is_active FROM monitoring_targets');

    const parseLatencyNumber = (val) => {
        if (!val) return null;
        const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
        return Number.isNaN(num) ? null : num;
    };

    const icmpTargets = targets.filter(t => t.protocol === 'ICMP PING');
    const activeIcmp = icmpTargets.filter(t => t.is_active === 1);
    const upIcmp = activeIcmp.filter(t => t.status === 'UP');
    const downIcmp = activeIcmp.filter(t => t.status === 'DOWN');
    const icmpLatencies = upIcmp.map(t => parseLatencyNumber(t.last_latency)).filter(v => v !== null);
    const avgIcmpLatency = icmpLatencies.length > 0
        ? Number((icmpLatencies.reduce((a, b) => a + b, 0) / icmpLatencies.length).toFixed(1))
        : 0;

    const tcpTargets = targets.filter(t => t.protocol === 'TCP SOCKET');
    const activeTcp = tcpTargets.filter(t => t.is_active === 1);
    const upTcp = activeTcp.filter(t => t.status === 'UP');
    const downTcp = activeTcp.filter(t => t.status === 'DOWN');
    const tcpLatencies = upTcp.map(t => parseLatencyNumber(t.last_latency)).filter(v => v !== null);
    const avgTcpLatency = tcpLatencies.length > 0
        ? Number((tcpLatencies.reduce((a, b) => a + b, 0) / tcpLatencies.length).toFixed(1))
        : 0;

    // 3. Data Riwayat Alert & Incident Terbaru (10 terbaru)
    const [alertRows] = await db.query(`
        SELECT 
            a.id, a.target_type, a.target_name, a.severity, a.original_severity,
            a.message, a.created_at, a.resolved_at, a.is_resolved,
            COUNT(h.id) AS handler_count,
            GROUP_CONCAT(h.user_name SEPARATOR ', ') AS technicians
        FROM active_alerts a
        LEFT JOIN alert_handlers h ON a.id = h.alert_id
        GROUP BY a.id
        ORDER BY a.is_resolved ASC, a.created_at DESC
        LIMIT 10
    `);

    const recentIncidents = alertRows.map(row => {
        const year = getWibYear(row.created_at);
        const ticketId = `#INC-${year}-${String(row.id).padStart(4, '0')}`;

        let statusLabel = 'TRIGGERED';
        if (row.is_resolved === 1) {
            statusLabel = 'NORMAL';
        } else if (row.handler_count > 0) {
            statusLabel = 'INVESTIGASI';
        }

        const effectiveSeverity = row.is_resolved === 1
            ? 'RESOLVED'
            : (row.severity || row.original_severity || 'WARNING');

        return {
            id: row.id,
            ticket_id: ticketId,
            time: row.created_at,
            resolved_at: row.resolved_at,
            target_type: row.target_type,
            target_name: row.target_name,
            component: `${row.target_type} - ${row.target_name}`,
            severity: effectiveSeverity,
            original_severity: row.original_severity || row.severity,
            message: row.message,
            is_resolved: row.is_resolved === 1,
            status_label: statusLabel,
            technicians: row.technicians || null
        };
    });

    // 4. Data Proxmox Cluster & RRD Chart
    const proxmoxData = await fetchProxmoxClusterData(timeframeKey);

    return {
        users: {
            total: Number(userStats?.total_users) || 0,
            active: Number(userStats?.active_users) || 0,
            active_roles: Number(userStats?.active_roles) || 0
        },
        proxmox: proxmoxData,
        icmp: {
            total: icmpTargets.length,
            active: activeIcmp.length,
            up: upIcmp.length,
            down: downIcmp.length,
            avg_latency_ms: avgIcmpLatency
        },
        tcp: {
            total: tcpTargets.length,
            active: activeTcp.length,
            up: upTcp.length,
            down: downTcp.length,
            avg_latency_ms: avgTcpLatency
        },
        recent_incidents: recentIncidents
    };
};

// GET /api/dashboard/summary
export const getDashboardSummary = async (req, res) => {
    try {
        const rawTf = String(req.query.timeframe || '1h').toLowerCase();
        const timeframeKey = ['1h', '24h', '7d'].includes(rawTf) ? rawTf : '1h';

        const data = await fetchDashboardSummaryData(timeframeKey);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error getDashboardSummary:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat ringkasan dashboard.' });
    }
};
