<template>
  <main class="bg-[#f8f9fa] p-8 pb-12 overflow-x-hidden min-h-screen font-sans animate-fade-in">
    
    <!-- Header Dashboard -->
    <div class="flex justify-between items-end mb-8">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2.5">
          <i class="ph-bold ph-squares-four text-slate-700"></i> Ringkasan Infrastruktur
        </h2>
        <p class="text-slate-500 text-sm font-medium">Pemantauan performa cluster Proxmox VE dan konektivitas jaringan secara langsung.</p>
      </div>
      <div class="flex gap-3 items-center">
        <button 
          @click="fetchDashboardData(true)" 
          class="w-[42px] h-[42px] flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]" 
          title="Segarkan Data Secara Manual"
        >
          <i class="ph-bold ph-arrows-clockwise text-lg" :class="{ 'animate-spin text-slate-900': isRefreshing }"></i>
        </button>
        <button 
          @click="exportDashboardPdf" 
          :disabled="isExporting" 
          class="px-4 h-[42px] bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 rounded-lg flex items-center gap-2 text-xs font-bold transition shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <i class="ph-bold" :class="isExporting ? 'ph-spinner animate-spin' : 'ph-download-simple text-base'"></i>
          {{ isExporting ? 'Menyiapkan PDF...' : 'Ekspor Laporan' }}
        </button>
      </div>
    </div>

    <!-- Widgets Grid (4 Kartu Utama) -->
    <div class="grid grid-cols-4 gap-5 mb-6">
      
      <!-- Widget 1: Total Pengguna -->
      <div class="bg-white border border-slate-200/80 p-5 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div class="flex justify-between items-start mb-2">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Pengguna</p>
          <div class="p-1.5 bg-slate-50 border border-slate-100 rounded-md text-slate-500"><i class="ph ph-users text-lg"></i></div>
        </div>
        <h3 class="text-3xl font-black text-slate-900 mb-1 font-mono tracking-tight flex items-baseline gap-2">
          {{ summary.users.total }} 
          <span class="text-sm font-medium text-slate-500 font-sans tracking-normal">Akun Terdaftar</span>
        </h3>
        <div class="flex items-center gap-1.5 text-xs text-slate-600 font-medium mt-4">
          <i class="ph-fill ph-check-circle text-emerald-500"></i> 
          {{ summary.users.active }} Akun Aktif ({{ summary.users.active_roles }} Role)
        </div>
      </div>

      <!-- Widget 2: Server Proxmox VE -->
      <div class="bg-white border border-slate-200/80 p-5 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div class="flex justify-between items-start mb-2">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Server Fisik</p>
          <div class="p-1.5 bg-slate-50 border border-slate-100 rounded-md text-slate-500"><i class="ph ph-hard-drives text-lg"></i></div>
        </div>
        <h3 
          class="text-3xl font-black mb-1 font-mono tracking-tight flex items-baseline gap-2" 
          :class="summary.proxmox.online_nodes > 0 && summary.proxmox.offline_nodes === 0 ? 'text-slate-900' : (summary.proxmox.online_nodes > 0 ? 'text-amber-600' : 'text-rose-600')"
        >
          {{ summary.proxmox.online_nodes }} / {{ summary.proxmox.total_nodes }} 
          <span class="text-sm font-medium text-slate-500 font-sans tracking-normal">Node Online</span>
        </h3>
        <div class="flex items-center justify-between text-xs font-medium mt-4">
          <!-- Pastel Badges Pill -->
          <span 
            class="flex items-center gap-1.5 px-2 py-0.5 rounded-md border" 
            :class="summary.proxmox.health_percent === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : (summary.proxmox.health_percent > 0 ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 'bg-rose-50 text-rose-700 border-rose-200/60')"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="summary.proxmox.health_percent === 100 ? 'bg-emerald-500' : (summary.proxmox.health_percent > 0 ? 'bg-amber-500' : 'bg-rose-500')"></span>
            <span class="font-mono font-semibold">{{ summary.proxmox.health_percent }}%</span> Healthy
          </span>
          <span class="text-slate-500"><span class="font-mono">{{ summary.proxmox.running_vms }}/{{ summary.proxmox.total_vms }}</span> VM/CT</span>
        </div>
      </div>

      <!-- Widget 3: Target Ping (ICMP) -->
      <div class="bg-white border border-slate-200/80 p-5 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div class="flex justify-between items-start mb-2">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Ping (ICMP)</p>
          <div class="p-1.5 bg-slate-50 border border-slate-100 rounded-md text-slate-500"><i class="ph ph-waves text-lg"></i></div>
        </div>
        <h3 class="text-3xl font-black text-slate-900 mb-1 font-mono tracking-tight flex items-baseline gap-2">
          {{ summary.icmp.total }} 
          <span v-if="summary.icmp.down > 0" class="text-sm font-bold text-rose-600 font-sans tracking-normal">({{ summary.icmp.down }} RTO)</span>
          <span v-else class="text-sm font-medium text-slate-500 font-sans tracking-normal">Target Aktif</span>
        </h3>
        <div class="flex items-center justify-between text-xs mt-4">
          <span v-if="summary.icmp.down === 0 && summary.icmp.active > 0" class="flex items-center gap-1.5 text-emerald-600 font-semibold">
            <i class="ph-bold ph-check"></i> OK ({{ summary.icmp.up }} UP)
          </span>
          <span v-else-if="summary.icmp.down > 0" class="flex items-center gap-1.5 text-rose-600 font-semibold">
            <i class="ph-bold ph-warning"></i> {{ summary.icmp.down }} Target Terputus
          </span>
          <span v-else class="text-slate-500">Belum ada target aktif</span>
          <span class="text-slate-500">Avg: <strong class="text-slate-900 font-mono tracking-tight">{{ summary.icmp.avg_latency_ms }} ms</strong></span>
        </div>
      </div>

      <!-- Widget 4: Target TCP Port -->
      <div class="bg-white border border-slate-200/80 p-5 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div class="flex justify-between items-start mb-2">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target TCP Port</p>
          <div class="p-1.5 bg-slate-50 border border-slate-100 rounded-md text-slate-500"><i class="ph ph-cpu text-lg"></i></div>
        </div>
        <h3 class="text-3xl font-black text-slate-900 mb-1 font-mono tracking-tight flex items-baseline gap-2">
          {{ summary.tcp.total }} 
          <span v-if="summary.tcp.down > 0" class="text-sm font-bold text-rose-600 font-sans tracking-normal">({{ summary.tcp.down }} Down)</span>
          <span v-else class="text-sm font-medium text-slate-500 font-sans tracking-normal">Port Aktif</span>
        </h3>
        <div class="flex items-center justify-between text-xs mt-4">
          <span v-if="summary.tcp.down === 0 && summary.tcp.active > 0" class="flex items-center gap-1.5 text-emerald-600 font-semibold">
            <i class="ph-bold ph-check"></i> OK ({{ summary.tcp.up }} UP)
          </span>
          <span v-else-if="summary.tcp.down > 0" class="flex items-center gap-1.5 text-rose-600 font-semibold">
            <i class="ph-bold ph-warning"></i> {{ summary.tcp.down }} Port Terputus
          </span>
          <span v-else class="text-slate-500">Belum ada target aktif</span>
          <span class="text-slate-500">Avg: <strong class="text-slate-900 font-mono tracking-tight">{{ summary.tcp.avg_latency_ms }} ms</strong></span>
        </div>
      </div>

    </div>

    <!-- Chart Area 1: Rata-rata Penggunaan CPU, RAM & IO Delay -->
    <div class="bg-white border border-slate-200/80 p-6 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i class="ph-bold ph-trend-up text-slate-500"></i> Rata-rata Penggunaan CPU, RAM &amp; IO Delay ({{ timeframeLabel }})
          </h3>
          <p class="text-xs text-slate-500 mt-1">
            Agregasi performa <span class="font-mono">{{ summary.proxmox.total_nodes }}</span> Node Proxmox VE 
            <span v-if="summary.proxmox.node_names.length" class="text-slate-400">({{ summary.proxmox.node_names.join(', ') }})</span> 
            &bull; Saat ini: 
            CPU <span class="text-emerald-600 font-bold font-mono">{{ summary.proxmox.avg_cpu }}%</span> | 
            RAM <span class="text-blue-600 font-bold font-mono">{{ summary.proxmox.avg_ram }}%</span> | 
            IO Delay <span class="text-amber-600 font-bold font-mono">{{ summary.proxmox.avg_io }}%</span>
          </p>
        </div>
        <div class="flex items-center gap-6">
          <div class="flex gap-4 text-xs font-medium text-slate-600">
            <span class="flex items-center gap-2"><div class="w-3 h-3 rounded bg-emerald-500"></div> CPU</span>
            <span class="flex items-center gap-2"><div class="w-3 h-3 rounded bg-blue-500"></div> RAM</span>
            <span class="flex items-center gap-2"><div class="w-3 h-3 rounded bg-amber-500"></div> IO Delay</span>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span class="text-slate-500 font-medium">Rekap:</span>
            <select 
              v-model="selectedTimeframe" 
              @change="fetchDashboardData(true)" 
              class="bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400 text-xs font-medium cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <option value="1h">1 Jam</option>
              <option value="24h">24 Jam</option>
              <option value="7d">7 Hari</option>
            </select>
          </div>
        </div>
      </div>
      <!-- Canvas Wrapper -->
      <div class="h-64 w-full relative">
        <canvas ref="chartCanvas"></canvas>
      </div>
    </div>

    <!-- Chart Area 2: Grafik & Ringkasan Total Uptime, Downtime, MTTR & Availability -->
    <div class="bg-white border border-slate-200/80 p-6 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-6">
      <div class="flex flex-wrap justify-between items-center gap-4 mb-5">
        <div>
          <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i class="ph-bold ph-chart-bar text-slate-500"></i> Analitik Kinerja (Uptime, Downtime, MTTR &amp; Availability)
          </h3>
          <p class="text-xs text-slate-500 mt-1">
            Rekap keandalan sistem &bull; {{ slaFilterLabel }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <!-- Filter Level Severity SLA -->
          <div class="flex bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button @click="setSlaSeverity('ALL')" class="px-3 py-1 rounded-md text-xs font-semibold transition border" :class="slaSeverity === 'ALL' ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border-slate-200' : 'text-slate-500 hover:text-slate-900 border-transparent'">Semua</button>
            <button @click="setSlaSeverity('DOWN')" class="px-3 py-1 rounded-md text-xs font-semibold transition border" :class="slaSeverity === 'DOWN' ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border-slate-200' : 'text-slate-500 hover:text-slate-900 border-transparent'">Down</button>
            <button @click="setSlaSeverity('CRITICAL')" class="px-3 py-1 rounded-md text-xs font-semibold transition border" :class="slaSeverity === 'CRITICAL' ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border-slate-200' : 'text-slate-500 hover:text-slate-900 border-transparent'">Critical</button>
            <button @click="setSlaSeverity('WARNING')" class="px-3 py-1 rounded-md text-xs font-semibold transition border" :class="slaSeverity === 'WARNING' ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border-slate-200' : 'text-slate-500 hover:text-slate-900 border-transparent'">Warning</button>
          </div>
          <!-- Filter Periode SLA -->
          <div class="flex bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button @click="setSlaPeriod('24h')" class="px-3.5 py-1 rounded-md text-xs font-semibold transition border" :class="slaPeriod === '24h' ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border-slate-200' : 'text-slate-500 hover:text-slate-900 border-transparent'">24 Jam</button>
            <button @click="setSlaPeriod('7d')" class="px-3.5 py-1 rounded-md text-xs font-semibold transition border" :class="slaPeriod === '7d' ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border-slate-200' : 'text-slate-500 hover:text-slate-900 border-transparent'">7 Hari</button>
            <button @click="setSlaPeriod('30d')" class="px-3.5 py-1 rounded-md text-xs font-semibold transition border" :class="slaPeriod === '30d' ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border-slate-200' : 'text-slate-500 hover:text-slate-900 border-transparent'">30 Hari</button>
          </div>
        </div>
      </div>

      <!-- 4 Mini KPI Cards -->
      <div class="grid grid-cols-4 gap-4 mb-5">
        <div class="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <i class="ph-bold ph-arrow-circle-up text-emerald-500"></i> Total Uptime
          </p>
          <h4 class="text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">{{ formatPreciseDuration(slaAnalytics.summary.total_uptime_sec) }}</h4>
          <p class="text-[11px] text-slate-500 mt-2">Waktu sistem beroperasi normal</p>
        </div>
        <!-- TOTAL DOWNTIME / GANGGUAN (DINAMIS) -->
        <div class="bg-slate-50 border border-slate-100 rounded-xl p-4 transition-colors">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <i class="ph-bold ph-arrow-circle-down" :class="slaSeverity === 'CRITICAL' || slaSeverity === 'WARNING' ? 'text-amber-500' : 'text-rose-500'"></i>
            {{ slaSeverity === 'ALL' ? 'Total Downtime & Gangguan' : (slaSeverity === 'DOWN' ? 'Total Downtime' : 'Total Gangguan') }}
          </p>
          <h4 class="text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
            {{ formatPreciseDuration(slaAnalytics.summary.total_downtime_sec) }}
          </h4>
          <p class="text-[11px] text-slate-500 mt-2">
            {{ slaSeverity === 'ALL' ? 'Waktu insiden' : (slaSeverity === 'DOWN' ? 'Waktu downtime' : 'Performa menurun') }} 
            (<span class="font-mono font-semibold">{{ slaAnalytics.summary.incident_count }}</span> insiden)
          </p>
        </div>
        <div class="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <i class="ph-bold ph-timer text-cyan-500"></i> MTTR
          </p>
          <h4 class="text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">{{ formatPreciseDuration(slaAnalytics.summary.mttr_sec) }}</h4>
          <p class="text-[11px] text-slate-500 mt-2">Rata-rata waktu pemulihan</p>
        </div>
        <div class="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <i class="ph-bold ph-shield-check text-emerald-500"></i> Availability
          </p>
          <h4 class="text-2xl font-black font-mono tracking-tight leading-none" :class="slaAvailabilityColor">
            {{ slaAnalytics.summary.availability }}<span class="text-sm font-semibold ml-0.5">%</span>
          </h4>
          <div class="w-full h-1.5 bg-slate-200 rounded-full mt-2.5 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700" :class="slaAvailabilityBar" :style="{ width: Math.min(100, slaAnalytics.summary.availability) + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- 2 Grafik Berdampingan -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div class="flex justify-between items-center mb-1">
            <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider">Grafik Uptime, Downtime &amp; MTTR</h4>
            <span class="text-[10px] text-slate-500 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Satuan: {{ slaDurationUnit.name }}</span>
          </div>
          <p class="text-[11px] text-slate-500 mb-2">Perbandingan durasi operasional vs gangguan per {{ slaPeriod === '24h' ? 'jam' : 'hari' }}</p>
          <apexchart type="bar" height="250" :options="slaDurationChartOptions" :series="slaDurationSeries" />
        </div>
        <div class="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div class="flex justify-between items-center mb-1">
            <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider">Grafik Availability (%)</h4>
            <span class="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Target SLA: 99.00%</span>
          </div>
          <p class="text-[11px] text-slate-500 mb-2">Persentase ketersediaan sistem per {{ slaPeriod === '24h' ? 'jam' : 'hari' }}</p>
          <apexchart type="area" height="250" :options="slaAvailabilityChartOptions" :series="slaAvailabilitySeries" />
        </div>
      </div>
    </div>

    <!-- Table Area: Log Alert & Incident Terbaru -->
    <div class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
      <div class="flex justify-between items-center p-6 pb-4">
        <div>
          <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i class="ph-bold ph-warning text-rose-500"></i> Log Alert &amp; Incident Terbaru
          </h3>
          <p class="text-xs text-slate-500 mt-1">Notifikasi otomatis berdasarkan batas threshold ambang batas</p>
        </div>
        <router-link to="/rekap-gangguan" class="text-xs text-slate-600 hover:text-slate-900 font-medium transition flex items-center gap-1">
          Lihat Semua Insiden <i class="ph-bold ph-arrow-right"></i>
        </router-link>
      </div>
      
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 border-y border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <th class="py-2.5 px-6 w-44">Waktu (WIB)</th>
              <th class="py-2.5 px-3 w-36">Severity</th>
              <th class="py-2.5 px-3 w-64">Komponen Target</th>
              <th class="py-2.5 px-3">Deskripsi Peristiwa</th>
              <th class="py-2.5 px-6 text-right w-36">Status</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-if="isLoading && summary.recent_incidents.length === 0">
              <td colspan="5" class="py-12 text-center text-slate-500">
                <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
                <p class="text-xs font-medium">Memuat data insiden terbaru...</p>
              </td>
            </tr>
            <tr v-else-if="summary.recent_incidents.length === 0">
              <td colspan="5" class="py-12 text-center text-slate-500 text-xs font-medium">
                Belum ada riwayat alert atau insiden yang tercatat.
              </td>
            </tr>
            <tr 
              v-else 
              v-for="inc in summary.recent_incidents" 
              :key="inc.id" 
              class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition"
            >
              <td class="py-2.5 px-6 text-slate-600 font-mono text-xs whitespace-nowrap">
                {{ formatWibDateTime(inc.time) }}
              </td>
              <td class="py-2.5 px-3">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border" :class="getSeverityBadgeClass(inc.severity)">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getSeverityDotClass(inc.severity)"></span>
                  {{ inc.severity }}
                </span>
              </td>
              <td class="py-2.5 px-3 text-xs">
                <span class="text-slate-400 font-semibold mr-1">[{{ inc.target_type }}]</span>
                <span class="font-mono text-slate-900 font-medium">{{ inc.target_name }}</span>
              </td>
              <td class="py-2.5 px-3 text-slate-500 text-xs font-medium">
                {{ inc.message }}
              </td>
              <td class="py-2.5 px-6 text-right text-xs font-semibold" :class="getStatusTextClass(inc.status_label)">
                {{ inc.status_label }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TOAST NOTIFICATION -->
    <ToastNotification
      :show="toast.show"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      @close="toast.show = false"
    />
    
  </main>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatWibDateTime } from '../../utils/datetime.js';
import { isDark } from '../../utils/theme.js';
import ToastNotification from '@/components/common/ToastNotification.vue';

const apexchart = VueApexCharts;

const chartCanvas = ref(null);
let chartInstance = null;
let refreshTimer = null;

const isLoading = ref(false);
const isRefreshing = ref(false);
const isExporting = ref(false);
const selectedTimeframe = ref('1h');

const toast = ref({ show: false, type: 'success', title: '', message: '' });
let toastTimer = null;
const showToast = (type, title, message) => {
  toast.value = { show: true, type, title, message };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value.show = false; }, 5000);
};

// STATE ANALITIK SLA (UPTIME, DOWNTIME, MTTR, AVAILABILITY)
const slaPeriod = ref('24h');
const slaSeverity = ref('ALL');
const slaAnalytics = ref({
  summary: {
    total_uptime_sec: 0,
    total_downtime_sec: 0,
    mttr_sec: 0,
    availability: 100,
    incident_count: 0
  },
  chartData: []
});

const slaFilterLabel = computed(() => {
  const pTxt = slaPeriod.value === '24h' ? '24 Jam Terakhir' : (slaPeriod.value === '7d' ? '7 Hari Terakhir' : '30 Hari Terakhir');
  const sTxt = slaSeverity.value === 'ALL' ? 'Semua Level (Warning, Critical, Down)' : `Level ${slaSeverity.value}`;
  return `${pTxt} - ${sTxt}`;
});

const slaAvailabilityColor = computed(() => {
  const a = slaAnalytics.value.summary.availability;
  return a >= 99 ? 'text-emerald-600' : a >= 95 ? 'text-amber-600' : 'text-rose-600';
});

const slaAvailabilityBar = computed(() => {
  const a = slaAnalytics.value.summary.availability;
  return a >= 99 ? 'bg-emerald-500' : a >= 95 ? 'bg-amber-500' : 'bg-rose-500';
});

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

const CHART_UNITS = [
  { name: 'Detik', div: 1 },
  { name: 'Menit', div: 60 },
  { name: 'Jam', div: 3600 },
  { name: 'Hari', div: 86400 }
];

const pickChartUnit = (maxSec) => {
  if (maxSec < 120) return CHART_UNITS[0];
  if (maxSec < 7200) return CHART_UNITS[1];
  if (maxSec < 172800) return CHART_UNITS[2];
  return CHART_UNITS[3];
};

const slaDurationUnit = computed(() => {
  const maxVal = Math.max(
    0,
    ...slaAnalytics.value.chartData.map(d => Math.max(d.total_uptime_sec || 0, d.total_downtime_sec || 0, d.mttr_sec || 0))
  );
  return pickChartUnit(maxVal);
});

const slaLabels = computed(() => slaAnalytics.value.chartData.map(d => d.label));

const slaDurationSeries = computed(() => {
  const div = slaDurationUnit.value.div;
  return [
    {
      name: 'Total Uptime',
      data: slaAnalytics.value.chartData.map(d => Number(((d.total_uptime_sec || 0) / div).toFixed(2)))
    },
    {
      name: 'Total Downtime',
      data: slaAnalytics.value.chartData.map(d => Number(((d.total_downtime_sec || 0) / div).toFixed(2)))
    },
    {
      name: 'MTTR',
      data: slaAnalytics.value.chartData.map(d => Number(((d.mttr_sec || 0) / div).toFixed(2)))
    }
  ];
});

const slaDurationChartOptions = computed(() => {
  const unit = slaDurationUnit.value;
  const dark = isDark.value;
  const gridColor = dark ? '#334155' : '#f1f5f9';
  const axisColor = dark ? '#334155' : '#e2e8f0';
  const labelColor = dark ? '#94a3b8' : '#64748b';
  const legendColor = dark ? '#cbd5e1' : '#475569';
  return {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
    theme: { mode: dark ? 'dark' : 'light' },
    colors: ['#10b981', '#f43f5e', '#06b6d4'],
    plotOptions: { bar: { borderRadius: 3, columnWidth: '65%' } },
    grid: { borderColor: gridColor, strokeDashArray: 4 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: slaLabels.value,
      labels: { style: { colors: labelColor, fontSize: '10px' } },
      axisBorder: { color: axisColor },
      axisTicks: { color: axisColor }
    },
    yaxis: {
      min: 0,
      labels: {
        style: { colors: labelColor, fontSize: '10px' },
        formatter: (v) => formatPreciseDuration(Math.round(v * unit.div))
      }
    },
    tooltip: {
      theme: dark ? 'dark' : 'light',
      y: {
        formatter: (v, { seriesIndex, dataPointIndex }) => {
          const row = slaAnalytics.value.chartData[dataPointIndex];
          if (!row) return '0d';
          const rawSec = seriesIndex === 0
            ? row.total_uptime_sec
            : (seriesIndex === 1 ? row.total_downtime_sec : row.mttr_sec);
          return formatPreciseDuration(rawSec);
        }
      }
    },
    legend: { labels: { colors: legendColor }, fontSize: '11px', position: 'top' }
  };
});

const slaAvailabilitySeries = computed(() => [
  {
    name: 'Availability (%)',
    data: slaAnalytics.value.chartData.map(d => d.availability)
  }
]);

const slaAvailabilityChartOptions = computed(() => {
  const vals = slaAnalytics.value.chartData.map(d => d.availability);
  const minVal = vals.length ? Math.max(0, Math.floor(Math.min(...vals)) - 1) : 0;
  const dark = isDark.value;
  const gridColor = dark ? '#334155' : '#f1f5f9';
  const axisColor = dark ? '#334155' : '#e2e8f0';
  const labelColor = dark ? '#94a3b8' : '#64748b';
  const legendColor = dark ? '#cbd5e1' : '#475569';
  return {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
    theme: { mode: dark ? 'dark' : 'light' },
    colors: ['#10b981'],
    stroke: { curve: 'smooth', width: 2.5 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02 } },
    grid: { borderColor: gridColor, strokeDashArray: 4 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: slaLabels.value,
      labels: { style: { colors: labelColor, fontSize: '10px' } },
      axisBorder: { color: axisColor },
      axisTicks: { color: axisColor }
    },
    yaxis: {
      min: minVal,
      max: 100,
      labels: {
        style: { colors: labelColor, fontSize: '10px' },
        formatter: (v) => `${v.toFixed(1)}%`
      }
    },
    tooltip: {
      theme: dark ? 'dark' : 'light',
      y: {
        formatter: (v) => `${Number(v).toFixed(2)}%`
      }
    },
    legend: { labels: { colors: legendColor }, fontSize: '11px', position: 'top' }
  };
});

const summary = ref({
  users: { total: 0, active: 0, active_roles: 0 },
  proxmox: {
    total_nodes: 0,
    online_nodes: 0,
    offline_nodes: 0,
    health_percent: 0,
    total_vms: 0,
    running_vms: 0,
    avg_cpu: 0,
    avg_ram: 0,
    avg_io: 0,
    node_names: [],
    chart: { labels: [], cpu: [], ram: [], io: [] }
  },
  icmp: { total: 0, active: 0, up: 0, down: 0, avg_latency_ms: 0 },
  tcp: { total: 0, active: 0, up: 0, down: 0, avg_latency_ms: 0 },
  recent_incidents: []
});

const timeframeLabel = computed(() => {
  if (selectedTimeframe.value === '24h') return '24 Jam Terakhir';
  if (selectedTimeframe.value === '7d') return '7 Hari Terakhir';
  return '1 Jam Terakhir';
});

const getSeverityBadgeClass = (sev) => {
  switch (sev) {
    case 'DOWN':
      return 'bg-rose-50 border-rose-200/60 text-rose-700';
    case 'CRITICAL':
      return 'bg-orange-50 border-orange-200/60 text-orange-700';
    case 'WARNING':
      return 'bg-amber-50 border-amber-200/60 text-amber-700';
    case 'RECOVERED':
      return 'bg-blue-50 border-blue-200/60 text-blue-700';
    case 'RESOLVED':
    default:
      return 'bg-emerald-50 border-emerald-200/60 text-emerald-700';
  }
};

const getSeverityDotClass = (sev) => {
  switch (sev) {
    case 'DOWN':
      return 'bg-rose-500';
    case 'CRITICAL':
      return 'bg-orange-500';
    case 'WARNING':
      return 'bg-amber-500';
    case 'RECOVERED':
      return 'bg-blue-500';
    case 'RESOLVED':
    default:
      return 'bg-emerald-500';
  }
};

const getStatusTextClass = (statusLabel) => {
  if (statusLabel === 'NORMAL') return 'text-emerald-600';
  if (statusLabel === 'INVESTIGASI') return 'text-cyan-600';
  return 'text-rose-600';
};

const initOrUpdateChart = () => {
  if (!window.Chart || !chartCanvas.value) return;

  const labels = summary.value.proxmox.chart.labels || [];
  const cpuData = summary.value.proxmox.chart.cpu || [];
  const ramData = summary.value.proxmox.chart.ram || [];
  const ioData = summary.value.proxmox.chart.io || [];

  const dark = isDark.value;
  const gridColor = dark ? '#334155' : '#f1f5f9';
  const tickColor = dark ? '#94a3b8' : '#64748b';
  const ptBgColor = dark ? '#1e293b' : '#ffffff';

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = cpuData;
    chartInstance.data.datasets[0].pointBackgroundColor = ptBgColor;
    chartInstance.data.datasets[1].data = ramData;
    chartInstance.data.datasets[1].pointBackgroundColor = ptBgColor;
    chartInstance.data.datasets[2].data = ioData;
    chartInstance.data.datasets[2].pointBackgroundColor = ptBgColor;
    chartInstance.options.scales.x.grid.color = gridColor;
    chartInstance.options.scales.x.ticks.color = tickColor;
    chartInstance.options.scales.y.grid.color = gridColor;
    chartInstance.options.scales.y.ticks.color = tickColor;
    chartInstance.update('none');
    return;
  }

  const ctx = chartCanvas.value.getContext('2d');
  const gradientCPU = ctx.createLinearGradient(0, 0, 0, 300);
  gradientCPU.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
  gradientCPU.addColorStop(1, 'rgba(16, 185, 129, 0)');

  chartInstance = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'CPU Usage (%)',
          data: cpuData,
          borderColor: '#10b981',
          backgroundColor: gradientCPU,
          borderWidth: 2,
          pointBackgroundColor: ptBgColor,
          pointBorderColor: '#10b981',
          pointBorderWidth: 2,
          pointRadius: 3,
          fill: true,
          tension: 0.4
        },
        {
          label: 'RAM Usage (%)',
          data: ramData,
          borderColor: '#3b82f6',
          borderWidth: 2,
          pointBackgroundColor: ptBgColor,
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          pointRadius: 3,
          fill: false,
          tension: 0.4
        },
        {
          label: 'IO Delay (%)',
          data: ioData,
          borderColor: '#f59e0b',
          borderWidth: 2,
          pointBackgroundColor: ptBgColor,
          pointBorderColor: '#f59e0b',
          pointBorderWidth: 2,
          pointRadius: 3,
          fill: false,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
            drawBorder: false
          },
          ticks: {
            color: tickColor,
            font: { size: 10 }
          }
        },
        y: {
          grid: {
            color: gridColor,
            drawBorder: false
          },
          ticks: {
            color: tickColor,
            font: { size: 10 },
            callback: function (value) { return value + '%'; },
            stepSize: 10
          },
          min: 0,
          max: 100
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      }
    }
  });
};

watch(isDark, () => {
  initOrUpdateChart();
});

const fetchSlaAnalytics = async () => {
  try {
    const res = await fetch(`/api/analytics?period=${slaPeriod.value}&severity=${slaSeverity.value}`);
    const json = await res.json();
    if (json.success && json.summary) {
      const sum = json.summary;
      slaAnalytics.value = {
        summary: {
          total_uptime_sec: sum.total_uptime_sec || 0,
          total_downtime_sec: sum.total_downtime_sec || 0,
          mttr_sec: sum.mttr_sec || 0,
          availability: parseFloat(sum.availability || 100),
          incident_count: sum.incident_count || 0
        },
        chartData: (json.chartData || []).map(d => ({
          label: d.label,
          total_uptime_sec: d.total_uptime_sec || 0,
          total_downtime_sec: d.total_downtime_sec || 0,
          mttr_sec: d.mttr_sec || 0,
          availability: parseFloat(d.availability || 100),
          incident_count: d.incident_count || 0
        }))
      };
    }
  } catch (err) {
    console.error('Gagal memuat data analitik SLA di Dashboard:', err);
  }
};

const setSlaPeriod = (period) => {
  if (slaPeriod.value === period) return;
  slaPeriod.value = period;
  fetchSlaAnalytics();
};

const setSlaSeverity = (sev) => {
  if (slaSeverity.value === sev) return;
  slaSeverity.value = sev;
  fetchSlaAnalytics();
};

const fetchDashboardData = async (isBackground = false) => {
  if (isBackground && document.hidden) return;
  if (!isBackground) isLoading.value = true;
  isRefreshing.value = true;

  const startTime = Date.now();

  try {
    const [resSummary] = await Promise.all([
      fetch(`/api/dashboard/summary?timeframe=${selectedTimeframe.value}`),
      fetchSlaAnalytics()
    ]);
    const json = await resSummary.json();
    if (json.success && json.data) {
      summary.value = json.data;
      initOrUpdateChart();
    }
  } catch (error) {
    console.error('Gagal memuat data ringkasan dashboard:', error);
  } finally {
    isLoading.value = false;

    // Pastikan animasi putar tombol refresh terlihat halus minimal 1 detik seperti di ProxmoxMonitor.vue
    const timeElapsed = Date.now() - startTime;
    const minimumSpinTime = 1000;
    if (timeElapsed < minimumSpinTime) {
      setTimeout(() => {
        isRefreshing.value = false;
      }, minimumSpinTime - timeElapsed);
    } else {
      isRefreshing.value = false;
    }
  }
};

const exportDashboardPdf = () => {
  if (isExporting.value) return;
  isExporting.value = true;
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 30, 'F');
    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('VIEWMOX - LAPORAN RINGKASAN INFRASTRUKTUR & SLA', 14, 13);

    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Waktu Cetak: ${formatWibDateTime(new Date())} WIB   |   Resource: ${timeframeLabel.value}   |   SLA: ${slaFilterLabel.value}`, 14, 22);

    // 1. Ringkasan KPI Infrastruktur
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('1. Ringkasan Status Infrastruktur', 14, 38);

    autoTable(doc, {
      startY: 41,
      head: [['Total Pengguna', 'Node Proxmox VE', 'VM / LXC Aktif', 'Rata-rata CPU / RAM / IO', 'Target Ping (ICMP)', 'Target TCP Port']],
      body: [[
        `${summary.value.users.total} Akun (${summary.value.users.active} Aktif)`,
        `${summary.value.proxmox.online_nodes} / ${summary.value.proxmox.total_nodes} Online (${summary.value.proxmox.health_percent}%)`,
        `${summary.value.proxmox.running_vms} / ${summary.value.proxmox.total_vms} Running`,
        `CPU: ${summary.value.proxmox.avg_cpu}% | RAM: ${summary.value.proxmox.avg_ram}% | IO: ${summary.value.proxmox.avg_io}%`,
        `${summary.value.icmp.total} Target (${summary.value.icmp.down} RTO, Avg ${summary.value.icmp.avg_latency_ms} ms)`,
        `${summary.value.tcp.total} Port (${summary.value.tcp.down} Down, Avg ${summary.value.tcp.avg_latency_ms} ms)`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
      bodyStyles: { halign: 'center', fontSize: 8.5, fontStyle: 'bold', textColor: [30, 41, 59] },
      margin: { left: 14, right: 14 }
    });

    // 2. Ringkasan SLA (Total Uptime, Downtime, MTTR, Availability)
    let nextY = doc.lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`2. Ringkasan Metrik SLA (${slaFilterLabel.value})`, 14, nextY);

    autoTable(doc, {
      startY: nextY + 3,
      head: [['Total Uptime', 'Total Downtime', 'MTTR (Rata-rata Pemulihan)', 'Availability (%)', 'Total Insiden']],
      body: [[
        formatPreciseDuration(slaAnalytics.value.summary.total_uptime_sec),
        formatPreciseDuration(slaAnalytics.value.summary.total_downtime_sec),
        formatPreciseDuration(slaAnalytics.value.summary.mttr_sec),
        `${slaAnalytics.value.summary.availability}%`,
        `${slaAnalytics.value.summary.incident_count} Insiden`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
      bodyStyles: { halign: 'center', fontSize: 8.5, fontStyle: 'bold', textColor: [30, 41, 59] },
      margin: { left: 14, right: 14 }
    });

    // 3. Tabel Log Alert & Incident Terbaru
    nextY = doc.lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('3. Log Alert & Incident Terbaru', 14, nextY);

    const incRows = summary.value.recent_incidents.length > 0
      ? summary.value.recent_incidents.map((inc, i) => [
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
      headStyles: { fillColor: [16, 185, 129], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      margin: { left: 14, right: 14 }
    });

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`Ringkasan_Infrastruktur_Viewmox_${stamp}.pdf`);
  } catch (err) {
    console.error('Error exportDashboardPdf:', err);
    showToast('error', 'Gagal Mengekspor', 'Gagal membuat laporan PDF.');
  } finally {
    isExporting.value = false;
  }
};

const handleVisibilityChange = () => {
  if (!document.hidden) {
    fetchDashboardData(true);
  }
};

onMounted(() => {
  fetchDashboardData(false);
  refreshTimer = setInterval(() => {
    fetchDashboardData(true);
  }, 5000);
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>