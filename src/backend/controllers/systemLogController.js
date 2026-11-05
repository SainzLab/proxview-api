import db from '../config/database.js';

export const getSystemLogs = async (req, res) => {
    try {
        const requestedLimit = parseInt(req.query.limit, 10);
        const safeLimit = !Number.isNaN(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, 10000)
            : 200;

        const [[countRow]] = await db.query('SELECT COUNT(*) AS total FROM system_logs');
        const [rows] = await db.query(
            `SELECT 
                id, 
                level, 
                source, 
                message, 
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') as timestamp 
             FROM system_logs 
             ORDER BY created_at DESC, id DESC 
             LIMIT ?`,
            [safeLimit]
        );

        res.json({
            success: true,
            total: countRow?.total || rows.length,
            data: rows
        });
    } catch (error) {
        console.error("Error fetching system logs:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil log sistem.' });
    }
};

export const logSystemEvent = async (level, source, message) => {
    try {
        await db.query(
            'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
            [level, source, message]
        );
    } catch (error) {
        console.error("Gagal menyimpan log ke database:", error);
    }
};
