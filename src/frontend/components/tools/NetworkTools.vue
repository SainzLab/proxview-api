<template>
  <!-- 
    Ubah ke h-[calc(100vh-64px)] atau flex min-h-screen agar menyesuaikan tinggi layar.
    Flex col membuat elemen anak berbaris ke bawah, dan flex-1 di terminal mengisi sisanya.
  -->
  <main class="bg-[#f8f9fa] p-8 min-h-screen flex flex-col font-sans animate-fade-in">
    
    <!-- Header Halaman -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 shrink-0">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2.5">
          <i class="ph-bold ph-terminal-window text-slate-700"></i> Network Tools
        </h2>
        <p class="text-slate-500 text-sm font-medium">Diagnosa konektivitas jaringan dan pemindaian infrastruktur</p>
      </div>
    </div>

    <!-- Kartu Form Eksekusi -->
    <div class="bg-white border border-slate-200/80 rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-6 shrink-0">
      <form @submit.prevent="runNetworkTool" class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <!-- Dropdown Pilihan Tool -->
        <div class="lg:col-span-3">
          <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2"> Pilih Utilitas </label>
          <div class="relative">
            <i class="ph-bold ph-wrench absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
            <select v-model="form.tool" :disabled="isLoading" class="w-full h-[42px] pl-10 pr-8 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 cursor-pointer transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-60 disabled:cursor-not-allowed">
              <option value="ping">Ping (ICMP)</option>
              <option value="traceroute">Traceroute</option>
              <option value="ipscan">IP Scan (Nmap)</option>
            </select>
          </div>
        </div>

        <!-- Area Input Target -->
        <div class="lg:col-span-6">
          <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {{ form.tool === 'ipscan' ? 'Alamat Network IP & Prefix Subnet' : 'Alamat Target (IPv4 / IPv6 / Domain)' }}
          </label>
          
          <!-- Mode IP Scan: Input IP + Dropdown Prefix Subnet -->
          <div v-if="form.tool === 'ipscan'" class="flex gap-2.5">
            <div class="relative flex-1">
              <i class="ph-bold ph-network absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
              <input v-model="form.target_ip" type="text" placeholder="Misal: 192.168.1.0 atau 2001:db8::" autocomplete="off" :disabled="isLoading" class="w-full h-[42px] pl-10 pr-3.5 bg-white border border-slate-200 rounded-lg text-sm font-mono font-medium text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-60" />
            </div>
            <select v-model="form.target_subnet" :disabled="isLoading" aria-label="Prefix Subnet" class="w-28 h-[42px] px-3 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 cursor-pointer transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-60">
              <option v-for="prefix in SUBNET_PREFIXES" :key="prefix" :value="prefix">{{ prefix }}</option>
            </select>
          </div>
          
          <!-- Mode Ping / Traceroute: Input Teks Penuh -->
          <div v-else class="relative">
            <i class="ph-bold ph-globe absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
            <input v-model="form.target" type="text" placeholder="Contoh: 8.8.8.8, google.com, atau 2001:4860::8888" autocomplete="off" :disabled="isLoading" class="w-full h-[42px] pl-10 pr-3.5 bg-white border border-slate-200 rounded-lg text-sm font-mono font-medium text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-60" />
          </div>
        </div>

        <!-- Tombol Aksi Submit / Stop -->
        <div class="lg:col-span-3 flex gap-2">
          <button type="submit" :disabled="isLoading || !hasTarget" class="flex-1 px-4 h-[42px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed">
            <i class="ph-bold text-base" :class="isLoading ? 'ph-spinner animate-spin' : 'ph-play'"></i>
            <span>{{ isLoading ? 'Memproses...' : `Jalankan ${toolLabel}` }}</span>
          </button>
          
          <button v-if="isLoading" type="button" @click="stopExecution" title="Hentikan Eksekusi" class="px-3.5 h-[42px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center justify-center shrink-0">
            <i class="ph-bold ph-stop text-base"></i>
          </button>
        </div>
      </form>

      <!-- Keterangan Ringkas Sesuai Utilitas -->
      <div class="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-medium">
        <span class="flex items-center gap-1.5">
          <i class="ph-fill ph-info text-slate-400 text-sm"></i>
          <template v-if="form.tool === 'ping'">Mengirim 10 paket ICMP Echo Request untuk menguji latensi dan packet loss target.</template>
          <template v-else-if="form.tool === 'traceroute'">Melacak setiap lompatan router (hop) dari server monitoring menuju alamat tujuan.</template>
          <template v-else>Memindai host aktif di dalam jaringan menggunakan <code class="font-mono font-bold text-slate-700">nmap -sn</code> tanpa port scanning.</template>
        </span>
        <div class="flex items-center gap-3">
          <span class="font-mono text-[11px] text-slate-400">
            Preview: <strong class="text-slate-700">{{ commandPreview }}</strong>
          </span>
        </div>
      </div>
    </div>

    <!-- Pesan Validasi / Error -->
    <div v-if="errorMessage" class="mb-6 bg-rose-50 border border-rose-200/60 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-3 animate-fade-in shrink-0">
      <div class="flex items-center gap-2.5">
        <i class="ph-bold ph-warning-circle text-base text-rose-600 shrink-0"></i>
        <span>{{ errorMessage }}</span>
      </div>
      <button @click="errorMessage = ''" class="text-rose-500 hover:text-rose-800 transition">
        <i class="ph-bold ph-x"></i>
      </button>
    </div>

    <!-- Area Terminal Output (Console macOS Style) -->
    <!-- flex-1 dan flex flex-col akan memaksanya mengisi sisa tinggi layar -->
    <div class="terminal-panel flex-1 flex flex-col bg-slate-900 rounded-xl p-5 shadow-sm overflow-hidden border border-slate-800 min-h-0">
      
      <!-- Header Terminal ala macOS (Tetap diam di atas) -->
      <div class="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800 shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          </div>
          <span class="text-xs font-mono text-slate-400 truncate">
            console@proxview:~# {{ lastExecutedCommand || commandPreview }}
          </span>
        </div>
        
        <!-- Status & Tombol Utilitas Terminal -->
        <div class="flex items-center gap-2 shrink-0">
          <span v-if="isLoading" class="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <i class="ph-bold ph-spinner animate-spin"></i> Live Stream
          </span>
          <button v-if="outputResult" type="button" @click="copyOutput" class="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition flex items-center gap-1.5">
            <i class="ph-bold" :class="copied ? 'ph-check text-emerald-400' : 'ph-copy'"></i>
            <span>{{ copied ? 'Tersalin' : 'Salin' }}</span>
          </button>
          <button v-if="outputResult && !isLoading" type="button" @click="clearOutput" class="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition flex items-center gap-1.5">
            <i class="ph-bold ph-trash"></i>
            <span>Bersihkan</span>
          </button>
        </div>
      </div>

      <!-- Konten Output Stream (Scrollable) -->
      <!-- Menghapus batasan max-h agar pre mengisi ruang sisa secara penuh -->
      <pre ref="terminalPre" class="flex-1 font-mono text-xs text-emerald-400 whitespace-pre-wrap break-words overflow-y-auto leading-relaxed"><template v-if="outputResult">{{ outputResult }}</template><template v-else-if="isLoading">Memproses {{ toolLabel.toLowerCase() }}... harap tunggu...</template><span v-else class="text-slate-500 select-none">$ Siap mengeksekusi perintah diagnosa jaringan. Pilih utilitas dan masukkan target di atas...</span></pre>
    </div>
  </main>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onUnmounted } from 'vue';

const TOOL_LABELS = {
  ping: 'Ping',
  traceroute: 'Traceroute',
  ipscan: 'IP Scan'
};

// Opsi prefix subnet untuk IP Scan
const SUBNET_PREFIXES = ['/16', '/23', '/24', '/32', '/64', '/128'];

const form = reactive({
  tool: 'ping',
  target: '',
  target_ip: '',
  target_subnet: '/24'
});

const isLoading = ref(false);
const outputResult = ref('');
const errorMessage = ref('');
const lastExecutedCommand = ref('');
const copied = ref(false);
const terminalPre = ref(null);
let abortController = null;

// Reset target & pesan error ketika jenis tool diganti
watch(() => form.tool, () => {
  form.target = '';
  form.target_ip = '';
  form.target_subnet = '/24';
  errorMessage.value = '';
});

const toolLabel = computed(() => TOOL_LABELS[form.tool] || 'Tool');

const hasTarget = computed(() =>
  form.tool === 'ipscan' ? !!form.target_ip.trim() : !!form.target.trim()
);

const commandPreview = computed(() => {
  if (form.tool === 'ipscan') {
    const ip = form.target_ip.trim() || '<ip_network>';
    const isV6 = ip.includes(':');
    return `nmap ${isV6 ? '-6 ' : ''}-sn ${ip}${form.target_subnet}`;
  }
  const host = form.target.trim() || '<target>';
  const isV6 = host.includes(':');
  return form.tool === 'ping'
    ? (isV6 ? `ping -6 -c 4 ${host}` : `ping -c 10 ${host}`)
    : (isV6 ? `traceroute -6 ${host}` : `traceroute ${host}`);
});

const scrollToBottom = async () => {
  await nextTick();
  if (terminalPre.value) {
    terminalPre.value.scrollTop = terminalPre.value.scrollHeight;
  }
};

const stopExecution = () => {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
};

const clearOutput = () => {
  outputResult.value = '';
  lastExecutedCommand.value = '';
  errorMessage.value = '';
};

const copyOutput = async () => {
  if (!outputResult.value) return;
  try {
    await navigator.clipboard.writeText(outputResult.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (_) {
    // Abaikan jika clipboard tidak diizinkan browser
  }
};

const runNetworkTool = async () => {
  if (isLoading.value || !hasTarget.value) return;
  
  isLoading.value = true;
  outputResult.value = '';
  errorMessage.value = '';

  const finalTarget = form.tool === 'ipscan' ? form.target_ip.trim() + form.target_subnet : form.target.trim();
  const isV6 = finalTarget.includes(':');
  
  lastExecutedCommand.value = form.tool === 'ipscan' 
    ? `nmap ${isV6 ? '-6 ' : ''}-sn ${finalTarget}` 
    : (form.tool === 'ping'
        ? (isV6 ? `ping -6 -c 4 ${finalTarget}` : `ping -c 10 ${finalTarget}`)
        : (isV6 ? `traceroute -6 ${finalTarget}` : `traceroute ${finalTarget}`));
    
  abortController = new AbortController();

  try {
    const response = await fetch(`/api/tools/${form.tool}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: abortController.signal,
      body: JSON.stringify({ target: finalTarget })
    });

    // Error validasi (400) atau sesi dikirim sebagai JSON
    if (!response.ok) {
      let message = `${toolLabel.value} gagal dijalankan.`;
      try {
        const json = await response.json();
        message = json.message || json.output || message;
      } catch (_) {
        // body bukan JSON
      }
      errorMessage.value = message;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      outputResult.value += decoder.decode(value, { stream: true });
      scrollToBottom();
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      outputResult.value += '\n[Eksekusi dihentikan oleh pengguna.]\n';
    } else {
      console.error(`Error ${form.tool}:`, err);
      errorMessage.value = 'Gagal menghubungi server backend.';
    }
  } finally {
    isLoading.value = false;
    abortController = null;
  }
};

onUnmounted(() => {
  stopExecution();
});
</script>