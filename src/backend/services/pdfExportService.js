import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==========================================
// KONFIGURASI TEMA & LAYOUT PDF
// ==========================================
export const PDF_THEME = {
  headerBg: [15, 23, 42],        // Slate-900 (#0f172a)
  headerTitle: [16, 185, 129],    // Emerald-500 (#10b981)
  headerSubtext: [226, 232, 240], // Slate-200 (#e2e8f0)
  sectionTitle: [15, 23, 42],     // Slate-900
  bodyText: [30, 41, 59],         // Slate-800 (#1e293b)
  mutedText: [100, 116, 139],     // Slate-500 (#64748b)
  footerText: [148, 163, 184],    // Slate-400 (#94a3b8)
  borderColor: [226, 232, 240],   // Slate-200 (#e2e8f0)
  tableDarkHeadBg: [15, 23, 42],
  tableSlateHeadBg: [30, 41, 59],
  tableEmeraldHeadBg: [16, 185, 129],
  tableEmeraldHeadText: [15, 23, 42],
  tableHeadTextLight: [255, 255, 255]
};

export const PDF_PAGE = {
  orientation: 'landscape',
  unit: 'mm',
  format: 'a4',
  width: 297,
  height: 210,
  margin: {
    left: 14,
    right: 14,
    top: 12,
    bottom: 12
  }
};

export const PERIOD_CONFIG = {
  '24h': { label: '24 Jam Terakhir', ms: 24 * 3600 * 1000, intervalLabel: 'Jam' },
  '7d':  { label: '7 Hari Terakhir', ms: 7 * 24 * 3600 * 1000, intervalLabel: 'Hari' },
  '30d': { label: '30 Hari Terakhir', ms: 30 * 24 * 3600 * 1000, intervalLabel: 'Hari' }
};

// ==========================================
// HELPER FORMATTING
// ==========================================
export const formatWibDateTime = (value, withSeconds = true) => {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false
  }).format(d).replace(/\./g, ':');
};

export const formatPreciseDuration = (totalSeconds) => {
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

const filterTicketsByWindow = (tickets = [], windowMs, severity = 'ALL') => {
  const cutoff = Date.now() - windowMs;
  return tickets.filter(t => {
    const ticketTime = new Date(t.time).getTime();
    if (isNaN(ticketTime) || ticketTime < cutoff) return false;
    if (severity !== 'ALL') {
      const ticketSev = (t.original_severity || t.severity || '').toUpperCase();
      if (ticketSev !== severity) return false;
    }
    return true;
  });
};

const createPdfDocument = () => {
  return new jsPDF({
    orientation: PDF_PAGE.orientation,
    unit: PDF_PAGE.unit,
    format: PDF_PAGE.format
  });
};

const renderHeaderBanner = (doc, { title, metaLines = [], height = 30 }) => {
  const width = doc.internal.pageSize.width || PDF_PAGE.width;
  const leftMargin = PDF_PAGE.margin.left;

  // Latar belakang banner
  doc.setFillColor(...PDF_THEME.headerBg);
  doc.rect(0, 0, width, height, 'F');

  // Judul utama laporan
  doc.setTextColor(...PDF_THEME.headerTitle);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, leftMargin, 13);

  // Metadata / subtitle lines
  doc.setTextColor(...PDF_THEME.headerSubtext);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  let currentY = 20;
  metaLines.forEach((line) => {
    doc.text(line, leftMargin, currentY);
    currentY += 6;
  });
};

const renderSectionTitle = (doc, title, yPos) => {
  doc.setTextColor(...PDF_THEME.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, PDF_PAGE.margin.left, yPos);
};

const renderFooters = (doc) => {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width || PDF_PAGE.width;
  const pageHeight = doc.internal.pageSize.height || PDF_PAGE.height;
  const margin = PDF_PAGE.margin.left;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.footerText);

    // Garis batas footer tipis
    doc.setDrawColor(...PDF_THEME.borderColor);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    // Teks keterangan di kiri
    doc.text('ProxView Monitoring System - Dokumen Laporan Resmi', margin, pageHeight - 5.5);

    // Teks nomor halaman di kanan
    const pageStr = `Halaman ${i} dari ${pageCount}`;
    const textWidth = doc.getTextWidth(pageStr);
    doc.text(pageStr, pageWidth - margin - textWidth, pageHeight - 5.5);
  }
};

// ==========================================
// 1. GENERATE PDF: REKAPITULASI GANGGUAN & SLA
// ==========================================
export const generateRekapGangguanPdf = ({
  analyticsData = {},
  incidentsData = [],
  periodKey = '24h',
  severity = 'ALL'
}) => {
  const periodCfg = PERIOD_CONFIG[periodKey] || PERIOD_CONFIG['24h'];
  const sevLabel = severity === 'ALL' ? 'Semua Level (Warning, Critical, Down)' : `Level ${severity}`;

  const sum = analyticsData.summary || {};
  const chartRows = analyticsData.chartData || [];
  const periodTickets = filterTicketsByWindow(incidentsData, periodCfg.ms, severity);

  const doc = createPdfDocument();
  const margin = { left: PDF_PAGE.margin.left, right: PDF_PAGE.margin.right };

  // Header Banner
  renderHeaderBanner(doc, {
    title: 'PROXVIEW - LAPORAN REKAPITULASI GANGGUAN & ANALITIK SLA',
    metaLines: [
      `Periode Laporan: ${periodCfg.label}   |   Filter Level: ${sevLabel}`,
      `Waktu Cetak: ${formatWibDateTime(new Date())} WIB`
    ],
    height: 32
  });

  // Bagian 1: Ringkasan Metrik Kinerja Sistem (SLA)
  renderSectionTitle(doc, '1. Ringkasan Metrik Kinerja Sistem (SLA)', 40);

  autoTable(doc, {
    startY: 43,
    head: [['Total Uptime', 'Total Downtime', 'MTTR (Rata-rata Pemulihan)', 'MTBF (Antar Kegagalan)', 'Availability (%)', 'Total Insiden']],
    body: [[
      formatPreciseDuration(sum.total_uptime_sec),
      formatPreciseDuration(sum.total_downtime_sec),
      formatPreciseDuration(sum.mttr_sec),
      formatPreciseDuration(sum.mtbf_sec),
      `${sum.availability ?? '100.00'}%`,
      `${sum.incident_count || 0} Tiket`
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: PDF_THEME.tableDarkHeadBg,
      textColor: PDF_THEME.tableHeadTextLight,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9
    },
    bodyStyles: {
      halign: 'center',
      fontSize: 9.5,
      fontStyle: 'bold',
      textColor: PDF_THEME.bodyText
    },
    margin
  });

  // Bagian 2: Rincian Analitik per Jam / Hari
  let nextY = doc.lastAutoTable.finalY + 8;
  renderSectionTitle(doc, `2. Rincian Analitik per ${periodCfg.intervalLabel || 'Hari'}`, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Periode Waktu (WIB)', 'Total Uptime', 'Total Downtime', 'Jumlah Insiden', 'MTTR', 'MTBF', 'Availability']],
    body: chartRows.map(r => [
      r.label,
      formatPreciseDuration(r.total_uptime_sec),
      formatPreciseDuration(r.total_downtime_sec),
      `${r.incident_count || 0}`,
      formatPreciseDuration(r.mttr_sec),
      formatPreciseDuration(r.mtbf_sec),
      `${r.availability ?? '100.00'}%`
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: PDF_THEME.tableSlateHeadBg,
      textColor: PDF_THEME.tableHeadTextLight,
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: PDF_THEME.bodyText
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold' }
    },
    margin
  });

  // Bagian 3: Daftar Riwayat Tiket Gangguan
  nextY = doc.lastAutoTable.finalY + 8;
  if (nextY > 175) {
    doc.addPage();
    nextY = 16;
  }

  renderSectionTitle(doc, `3. Daftar Riwayat Tiket Gangguan (${periodTickets.length} Tiket)`, nextY);

  const ticketBody = periodTickets.length > 0
    ? periodTickets.map((t, idx) => [
        idx + 1,
        t.id,
        formatWibDateTime(t.time),
        t.target,
        t.original_severity || t.severity,
        t.title,
        t.status,
        t.technicians || 'Auto-Recover / Belum Ada',
        t.downtime_duration || '-',
        t.handling_duration || '-'
      ])
    : [['-', '-', '-', '-', '-', 'Tidak ada riwayat tiket gangguan pada rentang periode dan level ini.', '-', '-', '-', '-']];

  autoTable(doc, {
    startY: nextY + 3,
    head: [['No', 'ID Tiket', 'Waktu Kejadian (WIB)', 'Target', 'Level', 'Deskripsi Gangguan', 'Status', 'Teknisi', 'Downtime', 'Penanganan']],
    body: ticketBody,
    theme: 'grid',
    headStyles: {
      fillColor: PDF_THEME.tableEmeraldHeadBg,
      textColor: PDF_THEME.tableEmeraldHeadText,
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: PDF_THEME.bodyText,
      valign: 'middle'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { fontStyle: 'bold', cellWidth: 25 },
      2: { cellWidth: 32 },
      3: { cellWidth: 34 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      5: { cellWidth: 68 },
      6: { halign: 'center', cellWidth: 24 },
      7: { cellWidth: 27 },
      8: { halign: 'center', cellWidth: 16 },
      9: { halign: 'center', cellWidth: 16 }
    },
    margin
  });

  renderFooters(doc);
  return Buffer.from(doc.output('arraybuffer'));
};

// ==========================================
// 2. GENERATE PDF: RINGKASAN DASHBOARD & SLA
// ==========================================
export const generateDashboardSummaryPdf = ({
  summary = {},
  slaAnalytics = {},
  timeframeLabel = '1 Jam Terakhir',
  slaFilterLabel = '24 Jam Terakhir - Semua Level'
}) => {
  const doc = createPdfDocument();
  const margin = { left: PDF_PAGE.margin.left, right: PDF_PAGE.margin.right };

  // Header Banner
  renderHeaderBanner(doc, {
    title: 'PROXVIEW - LAPORAN RINGKASAN INFRASTRUKTUR & SLA',
    metaLines: [
      `Waktu Cetak: ${formatWibDateTime(new Date())} WIB   |   Resource: ${timeframeLabel}   |   SLA: ${slaFilterLabel}`
    ],
    height: 30
  });

  // Bagian 1: Ringkasan Status Infrastruktur
  renderSectionTitle(doc, '1. Ringkasan Status Infrastruktur', 38);

  const users = summary.users || { total: 0, active: 0 };
  const proxmox = summary.proxmox || { online_nodes: 0, total_nodes: 0, health_percent: 0, running_vms: 0, total_vms: 0, avg_cpu: 0, avg_ram: 0, avg_io: 0 };
  const icmp = summary.icmp || { total: 0, down: 0, avg_latency_ms: 0 };
  const tcp = summary.tcp || { total: 0, down: 0, avg_latency_ms: 0 };

  autoTable(doc, {
    startY: 41,
    head: [['Total Pengguna', 'Node Proxmox VE', 'VM / LXC Aktif', 'Rata-rata CPU / RAM / IO', 'Target Ping (ICMP)', 'Target TCP Port']],
    body: [[
      `${users.total || 0} Akun (${users.active || 0} Aktif)`,
      `${proxmox.online_nodes || 0} / ${proxmox.total_nodes || 0} Online (${proxmox.health_percent || 0}%)`,
      `${proxmox.running_vms || 0} / ${proxmox.total_vms || 0} Running`,
      `CPU: ${proxmox.avg_cpu || 0}% | RAM: ${proxmox.avg_ram || 0}% | IO: ${proxmox.avg_io || 0}%`,
      `${icmp.total || 0} Target (${icmp.down || 0} RTO, Avg ${icmp.avg_latency_ms || 0} ms)`,
      `${tcp.total || 0} Port (${tcp.down || 0} Down, Avg ${tcp.avg_latency_ms || 0} ms)`
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: PDF_THEME.tableDarkHeadBg,
      textColor: PDF_THEME.tableHeadTextLight,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5
    },
    bodyStyles: {
      halign: 'center',
      fontSize: 8.5,
      fontStyle: 'bold',
      textColor: PDF_THEME.bodyText
    },
    margin
  });

  // Bagian 2: Ringkasan Metrik SLA
  let nextY = doc.lastAutoTable.finalY + 8;
  renderSectionTitle(doc, `2. Ringkasan Metrik SLA (${slaFilterLabel})`, nextY);

  const slaSummary = slaAnalytics.summary || {
    total_uptime_sec: 0,
    total_downtime_sec: 0,
    mttr_sec: 0,
    mtbf_sec: 0,
    availability: 100,
    incident_count: 0
  };

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Total Uptime', 'Total Downtime', 'MTTR (Rata-rata Pemulihan)', 'MTBF (Antar Kegagalan)', 'Availability (%)', 'Total Insiden']],
    body: [[
      formatPreciseDuration(slaSummary.total_uptime_sec),
      formatPreciseDuration(slaSummary.total_downtime_sec),
      formatPreciseDuration(slaSummary.mttr_sec),
      formatPreciseDuration(slaSummary.mtbf_sec),
      `${slaSummary.availability ?? '100.00'}%`,
      `${slaSummary.incident_count || 0} Insiden`
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: PDF_THEME.tableSlateHeadBg,
      textColor: PDF_THEME.tableHeadTextLight,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5
    },
    bodyStyles: {
      halign: 'center',
      fontSize: 8.5,
      fontStyle: 'bold',
      textColor: PDF_THEME.bodyText
    },
    margin
  });

  // Bagian 3: Log Alert & Incident Terbaru
  nextY = doc.lastAutoTable.finalY + 8;
  renderSectionTitle(doc, '3. Log Alert & Incident Terbaru', nextY);

  const incidents = summary.recent_incidents || [];
  const incRows = incidents.length > 0
    ? incidents.map((inc, i) => [
        i + 1,
        inc.ticket_id,
        formatWibDateTime(inc.time),
        inc.severity,
        `[${inc.target_type}] ${inc.target_name}`,
        inc.message,
        inc.status_label
      ])
    : [['-', '-', '-', '-', '-', 'Belum ada riwayat alert atau insiden.', '-']];

  autoTable(doc, {
    startY: nextY + 3,
    head: [['No', 'ID Tiket', 'Waktu (WIB)', 'Severity', 'Komponen Target', 'Deskripsi Peristiwa', 'Status']],
    body: incRows,
    theme: 'grid',
    headStyles: {
      fillColor: PDF_THEME.tableEmeraldHeadBg,
      textColor: PDF_THEME.tableEmeraldHeadText,
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: PDF_THEME.bodyText
    },
    margin
  });

  renderFooters(doc);
  return Buffer.from(doc.output('arraybuffer'));
};
