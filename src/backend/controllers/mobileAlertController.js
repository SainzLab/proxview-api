import db from '../config/database.js';

// GET /api/alerts/active & GET /api/mobile/v1/alerts/active
export const getActiveAlerts = async (req, res) => {
    try {
        // Hanya ambil notifikasi yang belum diselesaikan (is_resolved = 0) beserta informasi teknisi yang menangani
        const [alerts] = await db.query(`
            SELECT 
                a.*,
                GROUP_CONCAT(h.user_name SEPARATOR ', ') AS technicians,
                COUNT(h.id) AS handler_count,
                MIN(h.joined_at) AS handled_at
            FROM active_alerts a
            LEFT JOIN alert_handlers h ON a.id = h.alert_id
            WHERE a.is_resolved = 0
            GROUP BY a.id
            ORDER BY a.created_at DESC
        `);
        
        res.json({
            success: true,
            total_active: alerts.length,
            data: alerts
        });
    } catch (error) {
        console.error("Error getActiveAlerts:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/alerts/history & GET /api/mobile/v1/alerts/history
// Riwayat gangguan yang sudah selesai (is_resolved = 1)
export const getAlertHistory = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const [alerts] = await db.query(`
            SELECT 
                a.*,
                GROUP_CONCAT(h.user_name SEPARATOR ', ') AS technicians,
                COUNT(h.id) AS handler_count,
                MIN(h.joined_at) AS handled_at
            FROM active_alerts a
            LEFT JOIN alert_handlers h ON a.id = h.alert_id
            WHERE a.is_resolved = 1
            GROUP BY a.id
            ORDER BY a.resolved_at DESC, a.created_at DESC
            LIMIT ?
        `, [limit]);

        res.json({
            success: true,
            total: alerts.length,
            data: alerts
        });
    } catch (error) {
        console.error("Error getAlertHistory:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};