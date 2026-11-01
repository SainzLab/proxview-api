import { fetchIncidentsData, fetchAnalyticsData } from './incidentController.js';
import { fetchDashboardSummaryData } from './dashboardController.js';
import { generateRekapGangguanPdf, generateDashboardSummaryPdf, PERIOD_CONFIG } from '../services/pdfExportService.js';

/**
 * Controller Export PDF: Rekapitulasi Gangguan & SLA
 * GET /api/export/pdf/incidents
 * GET /api/mobile/v1/export/pdf/incidents
 */
export const exportIncidentsPdf = async (req, res) => {
    try {
        const period = String(req.query.period || '24h').toLowerCase();
        const severity = String(req.query.severity || 'ALL').toUpperCase();

        const [analyticsData, incidentsData] = await Promise.all([
            fetchAnalyticsData({ period, severity }),
            fetchIncidentsData()
        ]);

        const pdfBuffer = generateRekapGangguanPdf({
            analyticsData,
            incidentsData,
            periodKey: period,
            severity
        });

        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `Laporan_Rekap_Gangguan_${period}_${severity}_${stamp}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[EXPORT PDF ERROR - Incidents]:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal membuat laporan PDF rekap gangguan: ' + error.message
        });
    }
};

/**
 * Controller Export PDF: Ringkasan Infrastruktur & SLA Dashboard
 * GET /api/export/pdf/dashboard
 * GET /api/mobile/v1/export/pdf/dashboard
 */
export const exportDashboardPdf = async (req, res) => {
    try {
        const rawTf = String(req.query.timeframe || '1h').toLowerCase();
        const timeframe = ['1h', '24h', '7d'].includes(rawTf) ? rawTf : '1h';
        const period = String(req.query.period || '24h').toLowerCase();
        const severity = String(req.query.severity || 'ALL').toUpperCase();

        const timeframeLabels = {
            '1h': '1 Jam Terakhir',
            '24h': '24 Jam Terakhir',
            '7d': '7 Hari Terakhir'
        };

        const periodLabel = PERIOD_CONFIG[period]?.label || '24 Jam Terakhir';
        const sevLabel = severity === 'ALL' ? 'Semua Level' : `Level ${severity}`;
        const slaFilterLabel = `${periodLabel} - ${sevLabel}`;

        const [summary, slaAnalytics] = await Promise.all([
            fetchDashboardSummaryData(timeframe),
            fetchAnalyticsData({ period, severity })
        ]);

        const pdfBuffer = generateDashboardSummaryPdf({
            summary,
            slaAnalytics,
            timeframeLabel: timeframeLabels[timeframe] || '1 Jam Terakhir',
            slaFilterLabel
        });

        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `Ringkasan_Infrastruktur_Proxview_${stamp}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[EXPORT PDF ERROR - Dashboard]:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal membuat laporan PDF ringkasan dashboard: ' + error.message
        });
    }
};

/**
 * Router Serbaguna: Mengarahkan ekspor berdasarkan parameter query `type`
 * Default: `incidents`
 * GET /api/mobile/v1/export/pdf?type=incidents|dashboard
 */
export const exportPdf = async (req, res) => {
    const type = String(req.query.type || 'incidents').toLowerCase();
    if (type === 'dashboard') {
        return exportDashboardPdf(req, res);
    }
    return exportIncidentsPdf(req, res);
};
