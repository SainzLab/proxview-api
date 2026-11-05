<template>
  <div class="animate-fade-in space-y-6 font-sans">

    <div class="flex justify-between items-end mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-3">
          <i class="ph-bold ph-terminal-window text-slate-700"></i> Log Sistem (Internal)
        </h2>
        <p class="text-slate-500 text-sm font-medium">Catatan aktivitas internal aplikasi, daemon dan autentifikasi.</p>
      </div>

      <div class="flex gap-3 items-center">
        <div class="flex bg-slate-50 border border-slate-200/80 p-1 rounded-lg shadow-inner h-[42px] items-center shrink-0">
          <button class="px-3 rounded-md text-xs font-bold transition-all duration-300 flex items-center gap-1.5 bg-white text-slate-900 shadow-sm border border-slate-200 h-full whitespace-nowrap">
            <i class="ph-bold ph-terminal-window text-sm"></i> LOG SISTEM
          </button>
          <button @click="$emit('change-view', 'proxmox')" class="px-3 rounded-md text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent h-full whitespace-nowrap">
            <i class="ph-bold ph-hard-drives text-sm"></i> LOG PROXMOX
          </button>
        </div>

        <div class="relative flex items-center h-[42px]">
          <i class="ph ph-magnifying-glass absolute left-3 text-slate-400 pointer-events-none"></i>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Cari pesan atau sumber..." 
            class="pl-9 pr-8 h-full w-64 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm font-medium focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400"
          >
          <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 text-slate-400 hover:text-slate-700 transition">
             <i class="ph-bold ph-x"></i>
          </button>
        </div>

        <div class="relative h-[42px] w-[42px] shrink-0">
          <select 
            v-model="filterLevel" 
            title="Filter Level" 
            class="w-full h-full bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition outline-none appearance-none cursor-pointer text-center opacity-0 absolute inset-0 z-10"
          >
            <option value="ALL">Semua Level</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>
          <div class="w-full h-full bg-white border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] rounded-lg flex items-center justify-center text-slate-500 pointer-events-none transition group-hover:bg-slate-50">
            <i class="ph-bold ph-funnel text-base" :class="{'text-emerald-500': filterLevel !== 'ALL'}"></i>
          </div>
        </div>

      </div>
    </div>

    <div class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th class="px-6 py-3.5 w-48">Waktu (Timestamp)</th>
              <th class="px-6 py-3.5 w-32">Level</th>
              <th class="px-6 py-3.5 w-40">Sumber (Source)</th>
              <th class="px-6 py-3.5">Pesan Aktivitas</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <template v-if="isLoading && logs.length === 0">
              <tr class="border-b border-slate-100">
                <td colspan="4" class="px-6 py-12 text-center text-slate-500">
                  <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
                  <p class="font-medium text-xs">Memuat log sistem...</p>
                </td>
              </tr>
            </template>

            <template v-else-if="displayedLogs.length === 0">
              <tr class="border-b border-slate-100">
                <td colspan="4" class="px-6 py-12 text-center text-slate-500 font-sans">
                  <span v-if="searchQuery || filterLevel !== 'ALL'" class="font-medium text-sm">
                    Tidak ada log yang cocok dengan filter dan pencarian Anda.
                  </span>
                  <span v-else class="font-medium text-sm">Tidak ada data log yang ditemukan.</span>
                </td>
              </tr>
            </template>

            <template v-else>
              <tr 
                v-for="log in displayedLogs" 
                :key="log.id" 
                class="border-b border-slate-100 hover:bg-slate-50 transition"
              >
                <td class="px-6 py-3 text-slate-500 text-[11px] font-mono tracking-tight whitespace-nowrap">{{ formatWibDateTime(log.timestamp) }}</td>

                <td class="px-6 py-3">
                  <span :class="{
                    'text-blue-700 bg-blue-50 border-blue-200/60': log.level === 'INFO',
                    'text-amber-700 bg-amber-50 border-amber-200/60': log.level === 'WARNING',
                    'text-rose-700 bg-rose-50 border-rose-200/60': log.level === 'ERROR'
                  }" class="px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider">
                    {{ log.level }}
                  </span>
                </td>

                <td class="px-6 py-3 text-slate-900 text-[11px] font-mono font-bold tracking-tight">{{ log.source }}</td>
                <td class="px-6 py-3 text-slate-700 text-xs font-mono tracking-tight">{{ log.message }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div ref="loadMoreTrigger" class="h-10 w-full flex items-center justify-center text-[11px] font-medium text-slate-500 gap-2">
      <template v-if="hasMoreToRender">
        <i class="ph-bold ph-spinner animate-spin text-slate-400 text-base"></i>
        <span>Memuat baris log berikutnya (<span class="font-mono font-bold">{{ displayedLogs.length }}</span> / <span class="font-mono">{{ filteredLogs.length }}</span>)...</span>
      </template>
      <template v-else-if="displayedLogs.length > 0">
        <span>Menampilkan seluruh <span class="font-mono font-bold">{{ displayedLogs.length }}</span> baris log.</span>
      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { formatWibDateTime } from '../../utils/datetime.js';

defineEmits(['change-view']);

const BATCH_SIZE = 30;
const isLoading = ref(false);
const route = useRoute();
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '');
const filterLevel = ref('ALL');
const logs = ref([]);
const totalDbLogs = ref(0);

const displayLimit = ref(BATCH_SIZE);
const loadMoreTrigger = ref(null);
let observer = null;
let logInterval = null;

watch([searchQuery, filterLevel], () => {
  displayLimit.value = BATCH_SIZE;
});

const filteredLogs = computed(() => {
  let result = logs.value;

  if (filterLevel.value !== 'ALL') {
    result = result.filter(log => log.level === filterLevel.value);
  }

  if (searchQuery.value.trim() !== '') {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(log => 
      (log.message && log.message.toLowerCase().includes(query)) || 
      (log.source && log.source.toLowerCase().includes(query))
    );
  }

  return result;
});

const displayedLogs = computed(() => filteredLogs.value.slice(0, displayLimit.value));

const hasMoreToRender = computed(() => {
  return displayedLogs.value.length < filteredLogs.value.length || logs.value.length < totalDbLogs.value;
});

const fetchSystemLogs = async (isSilent = false) => {
  if (isSilent && document.hidden) return;
  if (!isSilent && logs.value.length === 0) isLoading.value = true;

  try {
    const fetchLimit = Math.max(150, displayLimit.value + 90);
    const res = await fetch(`/api/logs/system?limit=${fetchLimit}`);
    const data = await res.json();

    if (data.success) {
      logs.value = data.data || [];
      totalDbLogs.value = Number(data.total) || logs.value.length;
    }
  } catch (error) {
    console.error("Gagal menarik data log sistem:", error);
  } finally {
    if (!isSilent) isLoading.value = false;
  }
};

const loadMoreRows = async () => {
  if (isLoading.value) return;
  if (displayedLogs.value.length < filteredLogs.value.length) {
    displayLimit.value += BATCH_SIZE;
    if (displayLimit.value + BATCH_SIZE >= logs.value.length && logs.value.length < totalDbLogs.value) {
      await fetchSystemLogs(true);
    }
  } else if (logs.value.length < totalDbLogs.value) {
    displayLimit.value += BATCH_SIZE;
    await fetchSystemLogs(true);
  }
};

const handleVisibilityChange = () => {
  if (!document.hidden) {
    fetchSystemLogs(true);
  }
};

onMounted(() => {
  fetchSystemLogs(false);

  logInterval = setInterval(() => {
    fetchSystemLogs(true);
  }, 3000);

  document.addEventListener('visibilitychange', handleVisibilityChange);

  observer = new IntersectionObserver(async (entries) => {
    if (entries[0]?.isIntersecting && hasMoreToRender.value) {
      await loadMoreRows();
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
  if (observer) observer.disconnect();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<style scoped>
</style>
