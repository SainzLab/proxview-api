<template>
  <div class="animate-fade-in space-y-6 font-sans">
    
    <!-- Header Khusus Proxmox -->
    <div class="flex justify-between items-end mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-3">
          <i class="ph-bold ph-hard-drives text-slate-700"></i> Proxmox Cluster Dashboard
        </h2>
        <p class="text-slate-500 text-sm font-medium">Pemantauan real-time resource Node, VM dan LXC.</p>
      </div>
      <div class="flex gap-3 items-center">
        <!-- TOGGLE MODE BUTTON -->
        <div class="flex bg-slate-50 border border-slate-200/80 p-1 rounded-lg shadow-inner h-[42px] items-center shrink-0">
          <button @click="$emit('change-view', 'icmp')" class="px-3 rounded-md text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent h-full whitespace-nowrap">
            <i class="ph-bold ph-plugs text-sm"></i> ICMP / TCP
          </button>
          <button class="px-3 rounded-md text-xs font-bold transition-all duration-300 flex items-center gap-1.5 bg-white text-slate-900 shadow-sm border border-slate-200 h-full whitespace-nowrap">
            <i class="ph-bold ph-hard-drives text-sm"></i> PROXMOX
          </button>
        </div>
        <button @click="fetchProxmoxData(true)" class="w-[42px] h-[42px] flex items-center justify-center border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]" title="Segarkan Data Secara Manual">
          <i class="ph-bold ph-arrows-clockwise text-lg" :class="{'animate-spin text-slate-900': isRefreshing}"></i>
        </button>
        <router-link to="/proxmox-config" class="px-4 h-[42px] bg-slate-900 text-white rounded-lg flex items-center gap-2 hover:bg-slate-800 text-xs font-bold transition shadow-[0_1px_2px_rgba(0,0,0,0.04)] whitespace-nowrap">
          <i class="ph-bold ph-gear text-base"></i> Konfigurasi Node
        </router-link>
      </div>
    </div>

    <!-- PROXMOX DASHBOARD STATES -->
    <div v-if="isLoadingProxmox" class="flex flex-col items-center justify-center py-20 bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-slate-500">
      <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2"></i>
      <p class="text-xs font-medium">Menghubungkan ke API Cluster Proxmox...</p>
    </div>
    <div v-else-if="proxmoxNodesData.length === 0" class="text-center py-20 bg-slate-50 border border-slate-200/80 rounded-xl shadow-sm">
      <i class="ph-duotone ph-hard-drives text-5xl text-slate-400 mb-3"></i>
      <h3 class="text-lg font-bold text-slate-800">Tidak ada Node Proxmox terhubung.</h3>
      <p class="text-sm text-slate-500 mt-2 font-medium">Silakan tambahkan server Proxmox terlebih dahulu di menu Konfigurasi.</p>
      <router-link to="/proxmox-config" class="inline-block mt-5 px-5 py-2.5 bg-emerald-50 text-emerald-700 font-bold text-xs tracking-wider uppercase border border-emerald-200/60 rounded-lg hover:bg-emerald-100 transition shadow-sm">Ke Konfigurasi Node</router-link>
    </div>

    <!-- RENDER DATA CLUSTER -->
    <template v-else>
      <div v-for="cluster in proxmoxNodesData" :key="cluster.id" class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        
        <!-- Header Cluster -->
        <div class="bg-slate-50/80 px-6 py-4 flex items-center justify-between border-b border-slate-200/80">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
              <i class="ph-fill ph-hard-drives text-2xl"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                {{ cluster.name }}
                <span v-if="cluster.statusData && cluster.statusData.length > 0" class="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600 font-mono font-bold tracking-tight shadow-sm">
                  {{ cluster.statusData.length }} Nodes
                </span>
              </h3>
              <p class="text-[11px] text-slate-500 font-mono tracking-tight mt-0.5 font-medium">{{ cluster.hostUrl }}</p>
            </div>
          </div>
        </div>

        <!-- Body Metrik -->
        <div v-if="cluster.status === 'TERHUBUNG' && cluster.statusData && cluster.statusData.length > 0" class="p-6">
          
          <!-- Looping Semua Physical Node -->
          <div v-for="physNode in cluster.statusData" :key="physNode.node_name" class="mb-8 border-b border-slate-100 pb-8 last:border-0 last:pb-4 last:mb-2">
            <!-- Judul Node Fisik -->
            <h4 class="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
              <i class="ph-fill ph-server text-emerald-500 text-lg"></i> Node <span class="text-slate-800">{{ physNode.node_name }}</span>
              <span class="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded ml-2 font-mono tracking-tight border border-slate-200 font-semibold shadow-sm">Uptime: {{ physNode.uptime }}</span>
            </h4>
            
            <!-- 4 Kolom Metrik Utama Host -->
            <div class="grid grid-cols-4 gap-6">
              <!-- CPU -->
              <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative overflow-hidden">
                <div class="flex justify-between items-start mb-2">
                  <span class="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider"><i class="ph-fill ph-cpu text-blue-500 text-lg"></i> CPU Usage</span>
                  <span class="text-sm font-black text-slate-900 font-mono tracking-tight">{{ physNode.cpu_usage }}</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-1.5 mb-2 mt-3 overflow-hidden">
                  <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-700 ease-in-out" :style="{ width: physNode.cpu_usage.replace(' ', '') }"></div>
                </div>
                <p class="text-[10px] text-slate-500 font-medium truncate" :title="physNode.cpu_model">{{ physNode.cpu_model }} (<span class="font-mono font-bold">{{ physNode.cpu_cores }}</span> Cores)</p>
              </div>
              
              <!-- RAM -->
              <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative overflow-hidden">
                <div class="flex justify-between items-start mb-2">
                  <span class="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider"><i class="ph-fill ph-memory text-purple-500 text-lg"></i> Memory (RAM)</span>
                  <span class="text-sm font-black text-slate-900 font-mono tracking-tight">{{ physNode.ram_percentage }}</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-1.5 mb-2 mt-3 overflow-hidden">
                  <div class="bg-purple-500 h-1.5 rounded-full transition-all duration-700 ease-in-out" :style="{ width: physNode.ram_percentage.replace(' ', '') }"></div>
                </div>
                <p class="text-[10px] text-slate-500 font-mono font-bold tracking-tight">{{ physNode.ram_used }} / {{ physNode.ram_total }}</p>
              </div>
              
              <!-- IO DELAY -->
              <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative overflow-hidden">
                <div class="flex justify-between items-start mb-2">
                  <span class="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider"><i class="ph-fill ph-clock-counter-clockwise text-amber-500 text-lg"></i> IO Delay</span>
                  <span class="text-lg font-black font-mono tracking-tight" :class="parseFloat(physNode.io_delay) > 5 ? 'text-rose-600' : 'text-amber-500'">{{ physNode.io_delay }}</span>
                </div>
                <p class="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-4 mb-0.5">Load Average:</p>
                <p class="text-[11px] text-slate-700 font-bold font-mono tracking-tight">{{ physNode.load_average }}</p>
              </div>
              
              <!-- NETWORK -->
              <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative overflow-hidden">
                <div class="flex items-center gap-1.5 mb-3">
                  <i class="ph-fill ph-arrows-down-up text-emerald-500 text-lg"></i>
                  <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Network Traffic</span>
                </div>
                <div class="space-y-2">
                  <div class="flex justify-between items-center bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-md">
                    <span class="text-[10px] text-slate-500 font-bold flex items-center gap-1"><i class="ph-bold ph-arrow-down text-emerald-500"></i> RX (In)</span>
                    <span class="text-xs text-slate-900 font-bold font-mono tracking-tight">{{ physNode.network_traffic.rx_in }}</span>
                  </div>
                  <div class="flex justify-between items-center bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-md">
                    <span class="text-[10px] text-slate-500 font-bold flex items-center gap-1"><i class="ph-bold ph-arrow-up text-blue-500"></i> TX (Out)</span>
                    <span class="text-xs text-slate-900 font-bold font-mono tracking-tight">{{ physNode.network_traffic.tx_out }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div> 
          <!-- SELESAI LOOPING NODE FISIK (Penutup tag dipindah ke sini) -->

          <!-- List VM, LXC & Storage Mendetail -->
          <!-- PENTING: Ditaruh di luar looping physNode agar dirender 1 kali saja per Cluster -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start mt-4 pt-6 border-t border-slate-200 border-dashed" v-if="cluster.resourceData">
            
            <!-- Virtual Machines Detailed List (Kiri) -->
            <div class="border border-slate-200/80 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm">
              <div class="bg-slate-50/80 px-5 py-4 border-b border-slate-200/80 flex justify-between items-center">
                <h4 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="ph-fill ph-desktop text-blue-500 text-lg"></i> Virtual Machines (QEMU)</h4>
                <span class="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-blue-200/60">{{ cluster.resourceData.vms.length }} Total</span>
              </div>
              <ul class="p-5 space-y-4 bg-[#fcfcfc]">
                <li v-for="vm in cluster.resourceData.vms" :key="vm.vmid" @click="openProxmoxAdmin(cluster.hostUrl, 'qemu', vm.vmid)" class="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition flex flex-col gap-3 cursor-pointer group shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md">
                  <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-3">
                      <span class="w-2.5 h-2.5 rounded-full shadow-sm" :class="vm.status === 'running' ? 'bg-emerald-500' : 'bg-slate-300'"></span>
                      <span class="font-bold text-slate-900 text-sm truncate max-w-[250px] group-hover:text-blue-600 transition tracking-tight" :title="vm.name">{{ vm.name }}</span>
                    </div>
                    <span class="text-slate-600 font-mono font-bold tracking-tight text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-200 shadow-inner">
                      <span class="text-slate-900">{{ vm.node }}</span> | ID: {{ vm.vmid }}
                    </span>
                  </div>
                  <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-[11px]">
                    <div class="flex justify-between text-slate-500 font-medium"><span>CPU:</span> <span class="text-slate-900 font-mono font-bold tracking-tight">{{ vm.cpu_usage }} ({{ vm.cpu_cores }}C)</span></div>
                    <div class="flex justify-between text-slate-500 font-medium"><span>RAM:</span> <span class="text-slate-900 font-mono font-bold tracking-tight">{{ vm.ram_used }} / {{ vm.ram_total }}</span></div>
                    <div class="flex justify-between text-slate-500 font-medium"><span>Disk:</span> <span class="text-slate-900 font-mono font-bold tracking-tight">{{ vm.disk_total }} <span class="text-[9px] text-slate-400 ml-0.5 font-sans font-medium">(Bootdisk size)</span></span></div>
                    <div class="flex justify-between text-slate-500 font-medium"><span>Uptime:</span> <span class="text-slate-900 font-mono font-bold tracking-tight">{{ vm.uptime }}</span></div>
                    <div class="col-span-2 flex justify-between text-slate-500 font-medium pt-3 mt-1 border-t border-slate-100">
                      <span class="flex items-center gap-1.5"><i class="ph-bold ph-arrow-down text-emerald-500"></i> RX: <span class="text-slate-900 font-mono font-bold tracking-tight">{{ vm.net_in }}</span></span>
                      <span class="flex items-center gap-1.5"><i class="ph-bold ph-arrow-up text-blue-500"></i> TX: <span class="text-slate-900 font-mono font-bold tracking-tight">{{ vm.net_out }}</span></span>
                    </div>
                  </div>
                </li>
                <li v-if="cluster.resourceData.vms.length === 0" class="text-center text-slate-400 font-medium text-sm py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Tidak ada VM ditemukan.
                </li>
              </ul>
            </div>

            <!-- LXC & Storage Gabungan (Kanan) -->
            <div class="flex flex-col gap-8">
              <!-- LXC Detailed List -->
              <div class="border border-slate-200/80 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm">
                <div class="bg-slate-50/80 px-5 py-4 border-b border-slate-200/80 flex justify-between items-center">
                  <h4 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="ph-fill ph-cube text-purple-500 text-lg"></i> LXC Containers</h4>
                  <span class="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-purple-200/60">{{ cluster.resourceData.lxcs.length }} Total</span>
                </div>
                <ul class="p-5 space-y-4 bg-[#fcfcfc]">
                  <li v-for="lxc in cluster.resourceData.lxcs" :key="lxc.vmid" @click="openProxmoxAdmin(cluster.hostUrl, 'lxc', lxc.vmid)" class="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition flex flex-col gap-3 cursor-pointer group shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md">
                    <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div class="flex items-center gap-3">
                        <span class="w-2.5 h-2.5 rounded-full shadow-sm" :class="lxc.status === 'running' ? 'bg-emerald-500' : 'bg-slate-300'"></span>
                        <span class="font-bold text-slate-900 text-sm truncate max-w-[250px] group-hover:text-purple-600 transition tracking-tight" :title="lxc.name">{{ lxc.name }}</span>
                      </div>
                      <span class="text-slate-600 font-mono font-bold tracking-tight text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-200 shadow-inner">
                        <span class="text-slate-900">{{ lxc.node }}</span> | ID: {{ lxc.vmid }}
                      </span>
                    </div>
                    <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-[11px]">
                      <div class="flex justify-between text-slate-500 font-medium"><span>CPU:</span> <span class="text-slate-900 font-mono font-bold tracking-tight">{{ lxc.cpu_usage }} ({{ lxc.cpu_cores }}C)</span></div>
                      <div class="flex justify-between text-slate-500 font-medium"><span>RAM:</span> <span class="text-slate-900 font-mono font-bold tracking-tight">{{ lxc.ram_used }} / {{ lxc.ram_total }}</span></div>
                      <div class="flex justify-between text-slate-500 font-medium"><span>Disk:</span> <span class="text-slate-900 font-mono font-bold tracking-tight">{{ lxc.disk_used }} / {{ lxc.disk_total }}</span></div>
                      <div class="flex justify-between text-slate-500 font-medium"><span>Uptime:</span> <span class="text-slate-900 font-mono font-bold tracking-tight">{{ lxc.uptime }}</span></div>
                      <div class="col-span-2 flex justify-between text-slate-500 font-medium pt-3 mt-1 border-t border-slate-100">
                        <span class="flex items-center gap-1.5"><i class="ph-bold ph-arrow-down text-emerald-500"></i> RX: <span class="text-slate-900 font-mono font-bold tracking-tight">{{ lxc.net_in }}</span></span>
                        <span class="flex items-center gap-1.5"><i class="ph-bold ph-arrow-up text-blue-500"></i> TX: <span class="text-slate-900 font-mono font-bold tracking-tight">{{ lxc.net_out }}</span></span>
                      </div>
                    </div>
                  </li>
                  <li v-if="cluster.resourceData.lxcs.length === 0" class="text-center text-slate-400 font-medium text-sm py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Tidak ada LXC ditemukan.
                  </li>
                </ul>
              </div>

              <!-- Storage -->
              <div class="border border-slate-200/80 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm">
                <div class="bg-slate-50/80 px-5 py-4 border-b border-slate-200/80 flex justify-between items-center">
                  <h4 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="ph-fill ph-hard-drive text-amber-500 text-lg"></i> Data Storage</h4>
                </div>
                <ul class="p-5 space-y-3 bg-[#fcfcfc]">
                  <li v-for="storage in cluster.resourceData.storages" :key="storage.storage + storage.node" class="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md">
                    <div class="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                      <span class="font-bold text-slate-900 text-sm flex items-center gap-2 tracking-tight">
                        <i class="ph-fill ph-database text-amber-500"></i> {{ storage.storage }}
                        <span class="text-[10px] text-slate-600 font-bold font-mono tracking-tight bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shadow-inner">Node: {{ storage.node }}</span>
                      </span>
                      <span class="uppercase text-slate-600 text-[9px] tracking-wider font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">{{ storage.type }}</span>
                    </div>
                    <div class="flex justify-between text-slate-500 font-medium text-[11px]">
                      <span>Terpakai: <span class="text-amber-600 font-bold font-mono tracking-tight ml-1">{{ storage.used }}</span></span>
                      <span>Total: <span class="text-slate-900 font-bold font-mono tracking-tight">{{ storage.total }}</span></span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>

        </div>

        <!-- Jika Cluster Disconnect -->
        <div v-else-if="cluster.status !== 'TERHUBUNG'" class="p-6 text-center text-slate-500 font-medium text-sm">
          <p>API Node tidak merespon atau status koneksi terputus.</p>
        </div>
        
      </div>
    </template>
    
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

defineEmits(['change-view']);

const proxmoxNodesData = ref([]);
const isLoadingProxmox = ref(false);
const isRefreshing = ref(false);
let pollTimerProxmox = null;

const fetchProxmoxData = async (isBackground = false) => {
  if (!isBackground) isLoadingProxmox.value = true;
  else isRefreshing.value = true;

  const startTime = Date.now();
  try {
    const resNodes = await fetch('/api/proxmox');
    const nodesData = await resNodes.json();

    if (nodesData.success) {
      const nodes = nodesData.data;

      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].status === 'TERHUBUNG') {
          // Fetch Status Detail
          try {
            const resStatus = await fetch(`/api/proxmox/${nodes[i].id}/status`);
            const statusJson = await resStatus.json();
            if (statusJson.success) {
              nodes[i].statusData = statusJson.data.sort((a, b) => a.node_name.localeCompare(b.node_name));
            }
          } catch (e) {}

          // Fetch Resources (VM, LXC, Storage)
          try {
            const resResources = await fetch(`/api/proxmox/${nodes[i].id}/resources`);
            const resJson = await resResources.json();
            
            if (resJson.success) {
              let rd = resJson.data;
              if (rd.vms) rd.vms.sort((a, b) => a.vmid - b.vmid);
              if (rd.lxcs) rd.lxcs.sort((a, b) => a.vmid - b.vmid);
              if (rd.storages) {
                rd.storages.sort((a, b) => {
                  if (a.storage === b.storage) return a.node.localeCompare(b.node);
                  return a.storage.localeCompare(b.storage);
                });
              }
              nodes[i].resourceData = rd;
            }
          } catch (e) {}
        }
      }
      proxmoxNodesData.value = nodes;
    }
  } catch (error) {
    console.error('Gagal memuat data Proxmox:', error);
  } finally {
    isLoadingProxmox.value = false;
    const timeElapsed = Date.now() - startTime;
    const minimumSpinTime = 1000;
    
    if (isBackground && timeElapsed < minimumSpinTime) {
      setTimeout(() => {
        isRefreshing.value = false;
      }, minimumSpinTime - timeElapsed);
    } else {
      isRefreshing.value = false;
    }
  }
};

onMounted(() => {
  fetchProxmoxData();
  pollTimerProxmox = setInterval(() => {
    fetchProxmoxData(true);
  }, 5000);
});

onUnmounted(() => {
  if (pollTimerProxmox) clearInterval(pollTimerProxmox);
});

// Fungsi Navigasi Tab Baru
const openProxmoxAdmin = (hostUrl, type, vmid) => {
  const baseUrl = hostUrl.endsWith('/') ? hostUrl.slice(0, -1) : hostUrl;
  const targetUrl = `${baseUrl}/#v1:0:=${type}/${vmid}`;
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
};
</script>

<style scoped>
</style>