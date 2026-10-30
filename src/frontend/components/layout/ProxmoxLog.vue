<template>
  <div class="animate-fade-in space-y-4 relative font-sans">
    
    <!-- Header Khusus Proxmox Log -->
    <div class="flex justify-between items-end mb-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-3">
          <i class="ph-bold ph-hard-drives text-slate-700"></i> Log Aktivitas Proxmox
        </h2>
        <p class="text-slate-500 text-sm font-medium">Riwayat tugas (Tasks) dan rekam jejak aksi (Cluster Log) Proxmox VE.</p>
      </div>
      
      <div class="flex gap-3 items-center">
        <!-- TOGGLE MODE BUTTON -->
        <div class="flex bg-slate-50 border border-slate-200/80 p-1 rounded-lg shadow-inner h-[42px] items-center shrink-0">
          <button @click="$emit('change-view', 'system')" class="px-3 rounded-md text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent h-full whitespace-nowrap">
            <i class="ph-bold ph-terminal-window text-sm"></i> LOG SISTEM
          </button>
          <button class="px-3 rounded-md text-xs font-bold transition-all duration-300 flex items-center gap-1.5 bg-white text-slate-900 border border-slate-200 shadow-sm h-full whitespace-nowrap">
            <i class="ph-bold ph-hard-drives text-sm"></i> LOG PROXMOX
          </button>
        </div>

        <!-- SEARCH BAR -->
        <div class="relative flex items-center h-[42px]">
          <i class="ph ph-magnifying-glass absolute left-3 text-slate-400 pointer-events-none"></i>
          <input 
            type="text" 
            v-model="searchQuery" 
            :placeholder="activeTab === 'tasks' ? 'Cari deskripsi, user...' : 'Cari pesan, service...'" 
            class="pl-9 pr-8 h-full w-64 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm font-medium focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400"
          >
          <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 text-slate-400 hover:text-slate-700 transition">
             <i class="ph-bold ph-x"></i>  
          </button>
        </div>
      </div>
    </div>

    <!-- SUB-TABS (TASKS vs CLUSTER LOG) -->
    <div class="flex gap-6 border-b border-slate-200/80 px-2 mt-2">
      <button 
        @click="activeTab = 'tasks'" 
        class="pb-3 text-sm font-bold transition-all relative"
        :class="activeTab === 'tasks' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'"
      >
        <i class="ph-bold ph-list-checks mr-1.5" :class="activeTab === 'tasks' ? 'text-emerald-500' : ''"></i> Tasks
        <span v-if="activeTab === 'tasks'" class="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-md"></span>
      </button>
      <button 
        @click="activeTab = 'cluster'" 
        class="pb-3 text-sm font-bold transition-all relative"
        :class="activeTab === 'cluster' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'"
      >
        <i class="ph-bold ph-list-dashes mr-1.5" :class="activeTab === 'cluster' ? 'text-blue-500' : ''"></i> Cluster log
        <span v-if="activeTab === 'cluster'" class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-t-md"></span>
      </button>
    </div>

    <!-- WRAPPER TABEL -->
    <div class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col mb-4">
      
      <!-- ================= TAB 1: TASKS LOG ================= -->
      <div v-if="activeTab === 'tasks'" class="overflow-x-auto animate-fade-in">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th class="px-6 py-3.5 w-40">Waktu Mulai</th>
              <th class="px-6 py-3.5 w-40">Waktu Selesai</th>
              <th class="px-6 py-3.5 w-24">Node</th>
              <th class="px-6 py-3.5 w-32">User name</th>
              <th class="px-6 py-3.5">Deskripsi (Action)</th>
              <th class="px-6 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <template v-if="isLoadingTasks && proxmoxTasks.length === 0">
              <tr class="border-b border-slate-100">
                <td colspan="6" class="px-6 py-12 text-center text-slate-500">
                  <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
                  <p class="text-xs font-medium">Menarik data Tasks Log dari API Proxmox...</p>
                </td>
              </tr>
            </template>
            <template v-else-if="displayedTasks.length === 0">
              <tr class="border-b border-slate-100">
                <td colspan="6" class="px-6 py-12 text-center text-slate-500">
                  <span v-if="searchQuery" class="font-medium text-sm">Tidak ada log Tasks yang cocok dengan pencarian "<span class="text-slate-900 font-bold">{{ searchQuery }}</span>".</span>
                  <span v-else class="font-medium text-sm">Tidak ada data log Tasks yang ditemukan.</span>
                </td>
              </tr>
            </template>
            <template v-else>
              <tr 
                v-for="log in displayedTasks" 
                :key="log.upid" 
                @click="openLogDetail(log)" 
                class="border-b border-slate-100 hover:bg-slate-50 transition cursor-pointer group"
              >
                <td class="px-6 py-3.5 text-slate-500 font-mono tracking-tight text-[11px] whitespace-nowrap">{{ log.starttime }}</td>
                <td class="px-6 py-3.5 text-slate-600 font-mono tracking-tight text-[11px] whitespace-nowrap group-hover:text-emerald-600 transition">{{ log.endtime }}</td>
                <td class="px-6 py-3.5 text-slate-900 font-bold font-mono tracking-tight text-xs">{{ log.node }}</td>
                <td class="px-6 py-3.5 text-slate-600 font-medium text-xs">{{ log.user }}</td>
                <td class="px-6 py-3.5 text-slate-800 text-xs font-semibold">{{ log.description }}</td>
                <td class="px-6 py-3.5 flex items-center justify-between min-w-0 gap-4">
                    <div class="truncate">
                        <span v-if="log.status === 'OK'" class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60">OK</span>
                        <span v-else-if="log.status === 'RUNNING'" class="text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-cyan-200/60 animate-pulse">RUNNING</span>
                        <span v-else class="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-rose-200/60 truncate inline-block max-w-[300px] align-bottom" title="Klik untuk melihat detail error penuh">{{ log.status }}</span>
                    </div>
                    <i class="ph-bold ph-caret-right text-slate-400 group-hover:text-emerald-500 transition transform group-hover:translate-x-1 shrink-0"></i>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- ================= TAB 2: CLUSTER LOG ================= -->
      <div v-if="activeTab === 'cluster'" class="overflow-x-auto animate-fade-in">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th class="px-6 py-3.5 w-40">Time</th>
              <th class="px-6 py-3.5 w-24">Node</th>
              <th class="px-6 py-3.5 w-32">Service</th>
              <th class="px-6 py-3.5 w-24">PID</th>
              <th class="px-6 py-3.5 w-32">User name</th>
              <th class="px-6 py-3.5 w-24">Severity</th>
              <th class="px-6 py-3.5">Message</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <template v-if="isLoadingCluster && proxmoxClusterLogs.length === 0">
              <tr class="border-b border-slate-100">
                <td colspan="7" class="px-6 py-12 text-center text-slate-500">
                  <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
                  <p class="text-xs font-medium">Menarik data Cluster Log dari API Proxmox...</p>
                </td>
              </tr>
            </template>
            <template v-else-if="displayedClusterLogs.length === 0">
              <tr class="border-b border-slate-100">
                <td colspan="7" class="px-6 py-12 text-center text-slate-500">
                  <span v-if="searchQuery" class="font-medium text-sm">Tidak ada Cluster log yang cocok dengan pencarian "<span class="text-slate-900 font-bold">{{ searchQuery }}</span>".</span>
                  <span v-else class="font-medium text-sm">Tidak ada data Cluster log yang ditemukan.</span>
                </td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="(cLog, idx) in displayedClusterLogs" :key="`${cLog.rawTime}-${cLog.pid}-${idx}`" class="border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="px-6 py-3 text-slate-500 font-mono tracking-tight text-[11px] whitespace-nowrap">{{ cLog.time }}</td>
                <td class="px-6 py-3 text-slate-900 font-mono tracking-tight font-bold text-xs">{{ cLog.node }}</td>
                <td class="px-6 py-3 text-slate-600 font-medium text-xs">{{ cLog.service }}</td>
                <td class="px-6 py-3 text-slate-600 font-mono tracking-tight text-xs">{{ cLog.pid }}</td>
                <td class="px-6 py-3 text-slate-600 font-medium text-xs">{{ cLog.user }}</td>
                <td class="px-6 py-3">
                  <span 
                    :class="cLog.severity === 'info' ? 'text-blue-600 bg-blue-50 border-blue-200/60' : cLog.severity === 'error' ? 'text-rose-600 bg-rose-50 border-rose-200/60' : 'text-amber-700 bg-amber-50 border-amber-200/60'" 
                    class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border"
                  >
                    {{ cLog.severity }}
                  </span>
                </td>
                <td class="px-6 py-3 text-slate-700 font-mono tracking-tight text-xs break-all leading-relaxed">{{ cLog.message }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- SENTINEL TRIGGER INFINITE / UNLIMITED SCROLL -->
    <div ref="loadMoreTrigger" class="h-10 w-full flex items-center justify-center text-[11px] font-medium text-slate-500 gap-2">
      <template v-if="hasMoreToRender">
        <i class="ph-bold ph-spinner animate-spin text-slate-400 text-base"></i>
        <span>Memuat baris berikutnya (<span class="font-mono">{{ currentDisplayedCount }}</span> / <span class="font-mono">{{ currentTotalFilteredCount }}</span>)...</span>
      </template>
      <template v-else-if="currentDisplayedCount > 0">
        <span>Menampilkan seluruh <span class="font-mono font-bold">{{ currentDisplayedCount }}</span> baris log.</span>
      </template>
    </div>

    <!-- MODAL LOG DETAIL (Task Viewer) -->
    <Teleport to="body">
      <div v-if="showDetailModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeDetailModal">
        <div class="bg-white border border-slate-200/80 rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col h-[80vh]">
          
          <div class="flex justify-between items-center px-6 py-4 border-b border-slate-200/80 bg-slate-50/50">
            <h3 class="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <i class="ph-bold ph-terminal text-emerald-500 text-lg"></i> 
              Task viewer: <span class="text-blue-600">{{ selectedLog?.description }}</span>
            </h3>
            <button @click="closeDetailModal" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center transition"><i class="ph-bold ph-x text-lg"></i></button>
          </div>
          
          <div class="px-6 py-4 bg-white border-b border-slate-100 flex flex-wrap gap-x-8 gap-y-3 text-xs">
            <div class="flex flex-col"><span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Node</span> <span class="text-slate-900 font-bold font-mono">{{ selectedLog?.node }}</span></div>
            <div class="flex flex-col"><span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">User name</span> <span class="text-slate-700 font-medium">{{ selectedLog?.user }}</span></div>
            <div class="flex flex-col"><span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Status</span> <span class="font-bold tracking-wider" :class="selectedLog?.status === 'OK' ? 'text-emerald-600' : (selectedLog?.status === 'RUNNING' ? 'text-cyan-600 animate-pulse' : 'text-rose-600')">{{ selectedLog?.status }}</span></div>
            <div class="flex flex-col"><span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Start Time</span> <span class="text-slate-700 font-mono tracking-tight">{{ selectedLog?.starttime }}</span></div>
            <div class="flex flex-col"><span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">End Time</span> <span class="text-slate-700 font-mono tracking-tight">{{ selectedLog?.endtime }}</span></div>
            <div class="w-full mt-1 flex flex-col items-start gap-1">
              <span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Unique task ID</span> 
              <span class="font-mono text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 tracking-tight">{{ selectedLog?.upid }}</span>
            </div>
          </div>

          <!-- Terminal Area (Light Console Style) -->
          <div class="flex-1 overflow-y-auto p-6 bg-slate-50 font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed no-scrollbar relative border-t border-slate-100 shadow-inner">
            <div v-if="isLoadingDetail && detailedLogText.length === 0" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-10 text-slate-500 font-sans">
              <i class="ph-bold ph-spinner animate-spin text-2xl mb-2 text-slate-400"></i>
              <p class="font-medium text-xs">Menarik detail log langsung dari daemon pveproxy node <span class="font-mono font-bold text-slate-900">{{ selectedLog?.node }}</span>...</p>
            </div>
            <div v-else class="space-y-1">
              <template v-for="(line, idx) in detailedLogText" :key="idx">
                <div :class="line.toLowerCase().includes('error') || line.toLowerCase().includes('failed') ? 'text-rose-600 font-semibold' : ''">
                  {{ line }}
                </div>
              </template>
            </div>
          </div>

        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

defineEmits(['change-view']);

const BATCH_SIZE = 30;
const isLoadingTasks = ref(false);
const isLoadingCluster = ref(false);
const searchQuery = ref('');
const activeTab = ref('tasks');

// === UNLIMITED SCROLL STATE ===
const displayLimit = ref(BATCH_SIZE);
const loadMoreTrigger = ref(null);
let observer = null;
let logInterval = null;
let detailInterval = null;

// === STATE: TASKS & CLUSTER LOG ===
const showDetailModal = ref(false);
const selectedLog = ref(null);
const isLoadingDetail = ref(false);
const detailedLogText = ref([]);

const proxmoxTasks = ref([]);
const proxmoxClusterLogs = ref([]);

// === FUNGSI HELPER ===
const formatUnixTime = (unixTime) => {
  if (!unixTime) return '-';
  const date = new Date(unixTime * 1000);
  const options = { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' };
  return date.toLocaleString('en-US', options).replace(/,/g, '');
};

const getSeverityLevel = (pri) => {
  if (pri <= 3) return 'error';
  if (pri === 4) return 'warning';
  return 'info';
};

const formatTaskDescription = (type, id) => {
  if (!type) return '-';
  const t = type.toLowerCase();
  if (t === 'aptupdate') return 'Update package database';
  if (t === 'vncproxy') return `VM/CT ${id} - Console`;
  if (t === 'spiceproxy') return `VM/CT ${id} - Console (SPICE)`;
  if (t === 'download') return `File ${id} - Download`;
  if (t === 'qmdestroy' || t === 'destroy') return `VM/CT ${id} - Destroy`;
  if (t === 'qmstart' || t === 'startall') return `VM/CT ${id || 'All'} - Start`;
  if (t === 'qmstop' || t === 'stopall') return `VM/CT ${id || 'All'} - Stop`;
  if (t === 'qmreboot') return `VM/CT ${id} - Reboot`;
  if (t === 'qmsuspend') return `VM/CT ${id} - Suspend`;
  if (t === 'qmresume') return `VM/CT ${id} - Resume`;
  if (t === 'vzdump') return `VM/CT ${id || ''} - Backup`;
  if (t === 'shell') return 'Shell';
  if (t === 'erasedata') return 'Erase data';
  if (t === 'vzcreate' || t === 'qmcreate') return `VM/CT ${id} - Create`;
  return id ? `${type} ${id}` : type; 
};

// === FILTER PENCARIAN ===
const filteredTasks = computed(() => {
  if (!searchQuery.value) return proxmoxTasks.value;
  const q = searchQuery.value.toLowerCase();
  return proxmoxTasks.value.filter(l => 
    (l.user && l.user.toLowerCase().includes(q)) || 
    (l.node && l.node.toLowerCase().includes(q)) || 
    (l.description && l.description.toLowerCase().includes(q)) || 
    (l.upid && l.upid.toLowerCase().includes(q))
  );
});

const filteredClusterLogs = computed(() => {
  if (!searchQuery.value) return proxmoxClusterLogs.value;
  const q = searchQuery.value.toLowerCase();
  return proxmoxClusterLogs.value.filter(l => 
    (l.service && l.service.toLowerCase().includes(q)) || 
    (l.node && l.node.toLowerCase().includes(q)) || 
    (l.user && l.user.toLowerCase().includes(q)) || 
    (l.message && l.message.toLowerCase().includes(q))
  );
});

// === HASIL SLICE UNTUK RENDER (UNLIMITED SCROLL) ===
const displayedTasks = computed(() => filteredTasks.value.slice(0, displayLimit.value));
const displayedClusterLogs = computed(() => filteredClusterLogs.value.slice(0, displayLimit.value));

const currentDisplayedCount = computed(() =>
  activeTab.value === 'tasks' ? displayedTasks.value.length : displayedClusterLogs.value.length
);

const currentTotalFilteredCount = computed(() =>
  activeTab.value === 'tasks' ? filteredTasks.value.length : filteredClusterLogs.value.length
);

const hasMoreToRender = computed(() => currentDisplayedCount.value < currentTotalFilteredCount.value);

// === FETCH HANYA UNTUK TAB YANG SEDANG DIBUKA ===
const fetchTasksOnly = async (isSilent = false) => {
  if (isSilent && document.hidden) return;
  if (!isSilent && proxmoxTasks.value.length === 0) isLoadingTasks.value = true;
  try {
    const resTasks = await fetch('/api/proxmox/logs/tasks');
    const dataTasks = await resTasks.json();
    if (dataTasks.success && Array.isArray(dataTasks.data)) {
      proxmoxTasks.value = dataTasks.data
        .map(t => ({
          upid: t.upid,
          rawStartTime: t.starttime,
          starttime: formatUnixTime(t.starttime),
          endtime: formatUnixTime(t.endtime),
          user: t.user,
          node: t.node,
          description: formatTaskDescription(t.type, t.id),
          status: t.status ? (t.status === 'OK' ? 'OK' : t.status) : 'RUNNING'
        }))
        .sort((a, b) => b.rawStartTime - a.rawStartTime);

      // Update status pada selectedLog jika modal detail sedang dibuka
      if (showDetailModal.value && selectedLog.value) {
        const updated = proxmoxTasks.value.find(item => item.upid === selectedLog.value.upid);
        if (updated) selectedLog.value = updated;
      }
    }
  } catch (error) {
    console.error("Gagal menarik data Tasks Log dari backend:", error);
  } finally {
    if (!isSilent) isLoadingTasks.value = false;
  }
};

const fetchClusterOnly = async (isSilent = false) => {
  if (isSilent && document.hidden) return;
  if (!isSilent && proxmoxClusterLogs.value.length === 0) isLoadingCluster.value = true;
  try {
    const resCluster = await fetch('/api/proxmox/logs/cluster');
    const dataCluster = await resCluster.json();
    if (dataCluster.success && Array.isArray(dataCluster.data)) {
      proxmoxClusterLogs.value = dataCluster.data
        .map(l => ({
          rawTime: l.time,
          time: formatUnixTime(l.time),
          node: l.node,
          service: l.tag,
          pid: l.pid,
          user: l.user,
          severity: getSeverityLevel(l.pri),
          message: l.msg
        }))
        .sort((a, b) => b.rawTime - a.rawTime);
    }
  } catch (error) {
    console.error("Gagal menarik data Cluster Log dari backend:", error);
  } finally {
    if (!isSilent) isLoadingCluster.value = false;
  }
};

const fetchActiveTabData = async (isSilent = false) => {
  if (activeTab.value === 'tasks') {
    await fetchTasksOnly(isSilent);
  } else {
    await fetchClusterOnly(isSilent);
  }
};

// Reset displayLimit saat ganti sub-tab atau kata kunci pencarian, dan tarik data tab yang baru dibuka
watch(activeTab, (newTab) => {
  displayLimit.value = BATCH_SIZE;
  if (newTab === 'tasks') {
    fetchTasksOnly(proxmoxTasks.value.length > 0);
  } else {
    fetchClusterOnly(proxmoxClusterLogs.value.length > 0);
  }
});

watch(searchQuery, () => {
  displayLimit.value = BATCH_SIZE;
});

const fetchTaskDetailSilent = async (log) => {
  if (!log || document.hidden) return;
  try {
    const res = await fetch(`/api/proxmox/logs/task-detail?node=${log.node}&upid=${encodeURIComponent(log.upid)}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
      detailedLogText.value = data.data.map(line => line.t);
    }
  } catch (err) {
    // Abaikan error saat background refresh detail
  }
};

const openLogDetail = async (log) => {
  selectedLog.value = log;
  showDetailModal.value = true;
  isLoadingDetail.value = true;
  detailedLogText.value = [];

  try {
    const res = await fetch(`/api/proxmox/logs/task-detail?node=${log.node}&upid=${encodeURIComponent(log.upid)}`);
    const data = await res.json();
    
    if (data.success) {
      detailedLogText.value = data.data.map(line => line.t);
    } else {
      detailedLogText.value = ["Gagal merender log dari server Proxmox: " + data.message];
    }
  } catch (error) {
    detailedLogText.value = ["Koneksi terputus saat mencoba menarik detail log."];
  } finally {
    isLoadingDetail.value = false;
  }

  if (detailInterval) clearInterval(detailInterval);
  detailInterval = setInterval(() => {
    if (showDetailModal.value && selectedLog.value) {
      fetchTaskDetailSilent(selectedLog.value);
    }
  }, 3000);
};

const closeDetailModal = () => {
  showDetailModal.value = false;
  selectedLog.value = null;
  detailedLogText.value = [];
  if (detailInterval) {
    clearInterval(detailInterval);
    detailInterval = null;
  }
};

const handleVisibilityChange = () => {
  if (!document.hidden) {
    fetchActiveTabData(true);
  }
};

onMounted(() => {
  // Hanya fetch tab yang sedang dibuka pertama kali ('tasks')
  fetchActiveTabData(false);

  // Auto-Refresh Realtime: Hit API secara SILENT setiap 3 detik hanya untuk tab yang sedang aktif
  logInterval = setInterval(() => {
    fetchActiveTabData(true);
  }, 3000);

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // === SETUP OBSERVER UNTUK UNLIMITED SCROLL ===
  observer = new IntersectionObserver(async (entries) => {
    if (entries[0]?.isIntersecting && hasMoreToRender.value) {
      displayLimit.value += BATCH_SIZE;
      await nextTick();
    }
  }, {
    rootMargin: '150px'
  });

  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value);
  }
});

onUnmounted(() => {
  if (logInterval) clearInterval(logInterval);
  if (detailInterval) clearInterval(detailInterval);
  if (observer) observer.disconnect();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<style scoped>
</style>
