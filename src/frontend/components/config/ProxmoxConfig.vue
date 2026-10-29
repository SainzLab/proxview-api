<template>
  <main class="bg-[#f8f9fa] min-h-screen font-sans p-8 pb-12 overflow-x-hidden relative animate-fade-in">
    
    <!-- Header Halaman -->
    <div class="flex justify-between items-end mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-3">
          <i class="ph-bold ph-hard-drives text-slate-700"></i> Konfigurasi API Proxmox
        </h2>
        <p class="text-slate-500 text-sm font-medium">Pengaturan koneksi dan kredensial API Token untuk multi-server Proxmox VE.</p>
      </div>
      <div>
        <button 
          @click="openAddModal" 
          class="px-4 h-[42px] bg-slate-900 text-white rounded-lg flex items-center gap-2 hover:bg-slate-800 text-xs font-bold transition shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <i class="ph-bold ph-plus-circle text-lg"></i> TAMBAH SERVER PROXMOX
        </button>
      </div>
    </div>

    <!-- Info Banner -->
    <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex gap-4 items-start shadow-sm">
      <div class="w-10 h-10 rounded-full bg-blue-100/50 border border-blue-200/50 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
        <i class="ph-fill ph-info text-xl"></i>
      </div>
      <div>
        <h4 class="text-sm font-bold text-blue-800 mb-1">Rekomendasi Keamanan Token API</h4>
        <p class="text-xs text-blue-700/80 font-medium leading-relaxed max-w-4xl">
          Disarankan untuk membuat API Token di Proxmox dengan hak akses (Privilege) 
          <span class="text-blue-900 font-mono font-bold tracking-tight bg-white border border-blue-100 px-1.5 py-0.5 rounded shadow-sm">PVEAuditor</span> 
          pada path 
          <span class="text-blue-900 font-mono font-bold tracking-tight bg-white border border-blue-100 px-1.5 py-0.5 rounded shadow-sm">/</span>. 
          Hal ini memastikan ProxView hanya dapat memantau data secara <i>Read-Only</i> dan tidak memiliki akses untuk mengubah atau menghapus VM/Container di server Anda.
        </p>
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th class="px-6 py-3.5 w-1/4">Label / Nama Server</th>
            <th class="px-6 py-3.5 w-1/4">Host URL</th>
            <th class="px-6 py-3.5">API Token ID</th>
            <th class="px-6 py-3.5">Status Koneksi</th>
            <th class="px-6 py-3.5 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          <tr v-if="isLoading" class="border-b border-slate-100">
            <td colspan="5" class="px-6 py-12 text-center text-slate-500">
              <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
              <p class="font-medium text-xs">Memuat data server Proxmox...</p>
            </td>
          </tr>
          <tr v-else-if="proxmoxNodes.length === 0" class="border-b border-slate-100">
            <td colspan="5" class="px-6 py-12 text-center text-slate-500">
              <i class="ph-duotone ph-hard-drives text-4xl mb-2 text-slate-300"></i>
              <p class="font-medium text-sm">Belum ada server Proxmox yang ditambahkan.</p>
            </td>
          </tr>
          
          <!-- MENGGUNAKAN <template> UNTUK ACCORDION -->
          <template v-else v-for="node in proxmoxNodes" :key="node.id">
            
            <!-- Baris Utama (Bisa di-klik) -->
            <tr 
              @click="toggleExpanded(node)" 
              class="border-b border-slate-100 transition cursor-pointer group"
              :class="expandedNodeId === node.id ? 'bg-slate-50/80' : 'hover:bg-slate-50'"
            >
              
              <!-- Label Server -->
              <td class="px-6 py-4">
                <p class="font-bold text-slate-900 group-hover:text-slate-700 transition flex items-center gap-2">
                  {{ node.name }}
                  <i v-if="expandedNodeId === node.id" class="ph-bold ph-caret-up text-xs text-slate-400"></i>
                  <i v-else class="ph-bold ph-caret-down text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition"></i>
                </p>
                <p class="text-[10px] text-slate-500 font-medium mt-0.5" v-if="node.pveVersion">PVE Version: <span class="font-mono tracking-tight font-bold text-slate-700">{{ node.pveVersion }}</span></p>
              </td>
              
              <!-- Host URL -->
              <td class="px-6 py-4 text-slate-700 font-mono tracking-tight font-bold text-xs">
                <a :href="node.hostUrl" target="_blank" @click.stop class="hover:text-blue-600 hover:underline underline-offset-2 transition flex items-center gap-1.5 w-fit">
                  {{ node.hostUrl }} <i class="ph-bold ph-arrow-up-right text-[10px]"></i>
                </a>
              </td>

              <!-- Token ID -->
              <td class="px-6 py-4">
                <span class="inline-block bg-slate-50 border border-slate-200 text-slate-600 font-mono tracking-tight font-bold text-[11px] px-2.5 py-1 rounded-md shadow-inner">
                  {{ node.tokenId }}
                </span>
              </td>
              
              <!-- Status Koneksi -->
              <td class="px-6 py-4">
                <div v-if="node.isTesting" class="flex items-center gap-2 text-slate-500 text-xs font-medium">
                  <i class="ph-bold ph-spinner animate-spin text-base text-slate-400"></i> Menguji...
                </div>
                <div v-else-if="node.status === 'TERHUBUNG'" class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold tracking-wider">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> UP
                  </span>
                  <span class="text-[10px] font-mono tracking-tight font-semibold text-slate-500">{{ node.latency }}</span>
                </div>
                <div v-else-if="node.status === 'GAGAL'" class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-50 border border-rose-200/60 text-rose-700 text-[10px] font-bold tracking-wider">
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> DOWN
                  </span>
                </div>
                <div v-else class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold tracking-wider">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> BELUM DIUJI
                  </span>
                </div>
              </td>
              
              <!-- Aksi (@click.stop Mencegah row accordion terbuka) -->
              <td class="px-6 py-4 text-right" @click.stop>
                <div class="flex items-center justify-end gap-1.5 text-slate-400">
                  <button @click="testConnection(node)" class="p-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-600 transition" title="Uji Koneksi API" :disabled="node.isTesting">
                    <i class="ph-bold ph-plugs-connected text-lg" :class="{'animate-pulse text-slate-600': node.isTesting}"></i>
                  </button>
                  <button @click="editNode(node)" class="p-1.5 rounded-md hover:bg-blue-50 hover:text-blue-600 transition" title="Edit Konfigurasi">
                    <i class="ph-bold ph-gear text-lg"></i>
                  </button>
                  <button @click="confirmDeleteNode(node)" class="p-1.5 rounded-md hover:bg-rose-50 hover:text-rose-600 transition" title="Hapus Server">
                    <i class="ph-bold ph-trash text-lg"></i>
                  </button>
                </div>
              </td>
            </tr>

            <!-- Baris Detail (Hanya Di-render saat Node di-klik) -->
            <tr v-if="expandedNodeId === node.id">
              <td colspan="5" class="p-0 border-b border-slate-100 bg-slate-50/50">
                <div class="p-6 animate-fade-in shadow-inner">
                  
                  <!-- Loader saat Fetching API -->
                  <div v-if="isLoadingDetails" class="flex flex-col items-center justify-center py-10 text-slate-500">
                    <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
                    <p class="text-xs font-medium">Menarik data Resources dari node <span class="font-bold text-slate-900">{{ node.name }}</span>...</p>
                  </div>
                  
                  <!-- Data Resources (Jika tidak UP) -->
                  <div v-else-if="node.status !== 'TERHUBUNG'" class="flex flex-col items-center justify-center py-8 text-slate-500">
                    <i class="ph-duotone ph-plugs text-4xl mb-2 text-slate-400"></i>
                    <p class="text-sm font-medium">Silakan 'Uji Koneksi' terlebih dahulu agar sistem dapat menarik data resource.</p>
                  </div>

                  <div v-else class="grid grid-cols-3 gap-6">
                    
                    <!-- VM Card -->
                    <div class="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm">
                      <h4 class="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                        <span class="flex items-center gap-2"><i class="ph-fill ph-desktop text-blue-500 text-base"></i> Virtual Machines</span>
                        <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border border-blue-200/60">{{ nodeDetails.vms.length }}</span>
                      </h4>
                      <ul class="space-y-2 max-h-40 overflow-y-auto no-scrollbar pr-1">
                        <li v-for="vm in nodeDetails.vms" :key="vm.vmid" class="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                          <div class="flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full" :class="vm.status === 'running' ? 'bg-emerald-500' : 'bg-slate-400'"></span>
                            <span class="text-slate-900 font-semibold tracking-tight">{{ vm.name }}</span>
                          </div>
                          <span class="text-slate-500 font-mono tracking-tight font-medium text-[10px]">ID: <span class="font-bold text-slate-700">{{ vm.vmid }}</span></span>
                        </li>
                        <li v-if="nodeDetails.vms.length === 0" class="text-xs text-slate-400 font-medium text-center py-3 border border-dashed border-slate-200 rounded-lg bg-slate-50">Tidak ada VM ditemukan.</li>
                      </ul>
                    </div>

                    <!-- LXC Card -->
                    <div class="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm">
                      <h4 class="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                        <span class="flex items-center gap-2"><i class="ph-fill ph-cube text-purple-500 text-base"></i> LXC Containers</span>
                        <span class="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border border-purple-200/60">{{ nodeDetails.lxcs.length }}</span>
                      </h4>
                      <ul class="space-y-2 max-h-40 overflow-y-auto no-scrollbar pr-1">
                        <li v-for="lxc in nodeDetails.lxcs" :key="lxc.vmid" class="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                          <div class="flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full" :class="lxc.status === 'running' ? 'bg-emerald-500' : 'bg-slate-400'"></span>
                            <span class="text-slate-900 font-semibold tracking-tight">{{ lxc.name }}</span>
                          </div>
                          <span class="text-slate-500 font-mono tracking-tight font-medium text-[10px]">ID: <span class="font-bold text-slate-700">{{ lxc.vmid }}</span></span>
                        </li>
                        <li v-if="nodeDetails.lxcs.length === 0" class="text-xs text-slate-400 font-medium text-center py-3 border border-dashed border-slate-200 rounded-lg bg-slate-50">Tidak ada LXC ditemukan.</li>
                      </ul>
                    </div>

                    <!-- Storage Card -->
                    <div class="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm">
                      <h4 class="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                        <span class="flex items-center gap-2"><i class="ph-fill ph-hard-drive text-amber-500 text-base"></i> Data Storages</span>
                        <span class="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border border-amber-200/60">{{ nodeDetails.storages.length }}</span>
                      </h4>
                      <ul class="space-y-3 max-h-40 overflow-y-auto no-scrollbar pr-1">
                        <li v-for="storage in nodeDetails.storages" :key="storage.storage" class="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                          <div class="flex justify-between items-center mb-1.5">
                            <span class="font-bold text-slate-900 tracking-tight">{{ storage.storage }}</span>
                            <span class="text-[9px] font-bold uppercase tracking-wider bg-white px-1.5 py-0.5 rounded-md text-slate-600 border border-slate-200">{{ storage.type }}</span>
                          </div>
                          <div class="flex items-center justify-between text-[10px] font-medium font-mono tracking-tight">
                            <span class="text-slate-500">Used: <span class="text-amber-600 font-bold ml-0.5">{{ storage.used }}</span></span>
                            <span class="text-slate-500">Total: <span class="text-slate-900 font-bold ml-0.5">{{ storage.total }}</span></span>
                          </div>
                        </li>
                        <li v-if="nodeDetails.storages.length === 0" class="text-xs text-slate-400 font-medium text-center py-3 border border-dashed border-slate-200 rounded-lg bg-slate-50">Tidak ada storage.</li>
                      </ul>
                    </div>

                  </div>
                </div>
              </td>
            </tr>
          </template>

        </tbody>
      </table>
    </div>

    <!-- ========================================== -->
    <!-- MODAL FORM PROXMOX (TAMBAH / EDIT)         -->
    <!-- ========================================== -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeModal">
        <div class="bg-white border border-slate-200/80 shadow-xl rounded-2xl w-full max-w-xl overflow-hidden transform transition-all relative">
          
          <div class="flex justify-between items-center p-6 border-b border-slate-200/80 bg-slate-50/50">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i class="ph-bold" :class="isEditMode ? 'ph-pencil-simple text-blue-500' : 'ph-plus-circle text-emerald-500'"></i> 
              {{ isEditMode ? 'Edit Server Proxmox' : 'Tambah Server Proxmox' }}
            </h3>
            <button @click="closeModal" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center transition">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form @submit.prevent="saveNode" class="p-6 space-y-5">
            <!-- Input Nama Label -->
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Label / Nama Server</label>
              <div class="relative">
                <i class="ph ph-tag absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                <input 
                  type="text" 
                  v-model="form.name" 
                  required 
                  placeholder="Contoh: Datacenter Utama" 
                  class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400"
                >
              </div>
            </div>

            <!-- Input Host URL -->
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Proxmox Host URL</label>
              <div class="relative">
                <i class="ph ph-link absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                <input 
                  type="url" 
                  v-model="form.hostUrl" 
                  required 
                  placeholder="https://10.10.1.10:8006" 
                  class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-mono tracking-tight font-bold rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400 placeholder:font-sans placeholder:font-medium"
                >
              </div>
              <p class="text-[10px] font-medium text-slate-500 mt-1.5">Gunakan protokol HTTPS dan port (default: 8006).</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Input Token ID -->
              <div>
                <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">API Token ID</label>
                <div class="relative">
                  <i class="ph ph-identification-card absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                  <input 
                    type="text" 
                    v-model="form.tokenId" 
                    required 
                    placeholder="root@pam!appmonitor" 
                    class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-mono tracking-tight font-bold rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400 placeholder:font-sans placeholder:font-medium"
                  >
                </div>
              </div>

              <!-- Input Token Secret -->
              <div>
                <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">API Token Secret</label>
                <div class="relative">
                  <i class="ph ph-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                  <input 
                    :type="showSecret ? 'text' : 'password'" 
                    v-model="form.tokenSecret" 
                    :required="!isEditMode" 
                    placeholder="UUID Kredensial" 
                    class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-mono tracking-tight font-bold rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400 placeholder:font-sans placeholder:font-medium"
                  >
                  <button type="button" @click="showSecret = !showSecret" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                    <i :class="showSecret ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye'" class="text-lg"></i>
                  </button>
                </div>
              </div>
            </div>
            <p v-if="isEditMode" class="text-[10px] font-medium text-amber-600 mt-1 flex items-center gap-1.5"><i class="ph-fill ph-warning-circle text-amber-500"></i> Kosongkan Token Secret jika tidak ingin mengubah secret lama.</p>

            <div class="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-6">
              <button type="button" @click="closeModal" class="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-xs font-semibold transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">Batal</button>
              <button type="submit" class="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-2" :disabled="isSaving">
                <i class="ph-bold ph-floppy-disk" v-if="!isSaving"></i>
                <i class="ph-bold ph-spinner animate-spin" v-if="isSaving"></i>
                {{ isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- ========================================== -->
    <!-- MODAL KONFIRMASI HAPUS                     -->
    <!-- ========================================== -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeDeleteModal">
        <div class="bg-white border border-slate-200/80 shadow-xl rounded-2xl w-full max-w-md overflow-hidden transform transition-all relative">
          <div class="p-6 pt-7">
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-600 mt-0.5">
                <i class="ph-bold ph-warning-circle text-2xl"></i>
              </div>
              <div>
                <h3 class="text-lg font-bold text-slate-900 mb-2">Hapus Server Proxmox?</h3>
                <p class="text-sm text-slate-600 font-medium leading-relaxed">
                  Anda akan menghapus koneksi ke <span class="font-bold text-slate-900">{{ nodeToDelete?.name }}</span>. 
                  <br><br>
                  Semua data metrik terkait server ini tidak akan dilacak lagi. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
          </div>
          <div class="bg-slate-50/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200/80">
            <button @click="closeDeleteModal" class="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              Batal
            </button>
            <button @click="executeDeleteNode" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2" :disabled="isDeleting">
              <i class="ph-bold ph-trash" v-if="!isDeleting"></i>
              <i class="ph-bold ph-spinner animate-spin" v-if="isDeleting"></i>
              {{ isDeleting ? 'Menghapus...' : 'Ya, Hapus' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ========================================== -->
    <!-- TOAST NOTIFICATION                         -->
    <!-- ========================================== -->
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
import { ref, onMounted } from 'vue';
import ToastNotification from '@/components/common/ToastNotification.vue';

const proxmoxNodes = ref([]);
const isLoading = ref(true);

// State Accordion
const expandedNodeId = ref(null);
const isLoadingDetails = ref(false);
const nodeDetails = ref({ vms: [], lxcs: [], storages: [] });

// State Modal
const showModal = ref(false);
const isSaving = ref(false);
const isEditMode = ref(false);
const editNodeId = ref(null);
const showSecret = ref(false);

const form = ref({ name: '', hostUrl: '', tokenId: '', tokenSecret: '' });

// State Delete Modal
const showDeleteModal = ref(false);
const nodeToDelete = ref(null);
const isDeleting = ref(false);

const toast = ref({ show: false, type: 'success', title: '', message: '' });
let toastTimer = null;

const showToast = (type, title, message) => {
  toast.value = { show: true, type, title, message };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value.show = false; }, 5000);
};

// ==========================================
// API CALLS
// ==========================================
const fetchNodes = async () => {
  isLoading.value = true;
  try {
    const res = await fetch('/api/proxmox');
    const data = await res.json();
    if (data.success) {
      proxmoxNodes.value = data.data.map(node => ({ ...node, isTesting: false }));
    }
  } catch (error) {
    showToast('error', 'Gagal Memuat', 'Tidak dapat mengambil data server Proxmox.');
  } finally {
    isLoading.value = false;
  }
};

const saveNode = async () => {
  isSaving.value = true;
  try {
    const url = isEditMode.value ? `/api/proxmox/${editNodeId.value}` : '/api/proxmox';
    const method = isEditMode.value ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });
    const data = await res.json();

    if (data.success) {
      closeModal();
      fetchNodes();
      showToast('success', 'Berhasil', data.message);
    } else {
      showToast('error', 'Gagal', data.message);
    }
  } catch (error) {
    showToast('error', 'Kesalahan', 'Gagal menghubungi server.');
  } finally {
    isSaving.value = false;
  }
};

const executeDeleteNode = async () => {
  isDeleting.value = true;
  try {
    const res = await fetch(`/api/proxmox/${nodeToDelete.value.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchNodes();
      if (expandedNodeId.value === nodeToDelete.value.id) expandedNodeId.value = null;
      showToast('success', 'Dihapus', data.message);
      closeDeleteModal();
    }
  } catch (error) {
    showToast('error', 'Kesalahan', 'Gagal menghapus server.');
  } finally {
    isDeleting.value = false;
  }
};

const testConnection = async (node) => {
  node.isTesting = true;
  if (expandedNodeId.value === node.id) isLoadingDetails.value = true;

  try {
    const res = await fetch(`/api/proxmox/${node.id}/test`, { method: 'POST' });
    const data = await res.json();
    
    if (data.success) {
      node.status = 'TERHUBUNG';
      node.latency = data.latency;
      node.pveVersion = data.pveVersion;
      showToast('success', 'Koneksi Berhasil', data.message);
      if (expandedNodeId.value === node.id) fetchNodeResources(node.id);
    } else {
      node.status = 'GAGAL';
      node.latency = '-';
      showToast('error', 'Koneksi Gagal', data.message);
      if (expandedNodeId.value === node.id) isLoadingDetails.value = false;
    }
  } catch (error) {
    showToast('error', 'Server Error', 'Sistem tidak dapat menguji koneksi.');
  } finally {
    node.isTesting = false;
  }
};

// ==========================================
// LAZY LOAD ACCORDION (VM, LXC, STORAGE)
// ==========================================
const toggleExpanded = (node) => {
  if (expandedNodeId.value === node.id) {
    expandedNodeId.value = null;
    nodeDetails.value = { vms: [], lxcs: [], storages: [] };
  } else {
    expandedNodeId.value = node.id;
    if (node.status === 'TERHUBUNG') fetchNodeResources(node.id);
  }
};

const fetchNodeResources = async (nodeId) => {
  isLoadingDetails.value = true;
  try {
    const res = await fetch(`/api/proxmox/${nodeId}/resources`);
    const data = await res.json();
    if (data.success) {
      nodeDetails.value = data.data;
    }
  } catch (error) {
    console.error('Fetch Resources Error:', error);
  } finally {
    isLoadingDetails.value = false;
  }
};

// ==========================================
// MODAL CONTROLS
// ==========================================
const openAddModal = () => {
  isEditMode.value = false;
  form.value = { name: '', hostUrl: '', tokenId: '', tokenSecret: '' };
  showSecret.value = false;
  showModal.value = true;
};

const editNode = (node) => {
  isEditMode.value = true;
  editNodeId.value = node.id;
  form.value = { name: node.name, hostUrl: node.hostUrl, tokenId: node.tokenId, tokenSecret: '' };
  showSecret.value = false;
  showModal.value = true;
};

const closeModal = () => { showModal.value = false; };
const confirmDeleteNode = (node) => { nodeToDelete.value = node; showDeleteModal.value = true; };
const closeDeleteModal = () => { showDeleteModal.value = false; nodeToDelete.value = null; };

onMounted(() => {
  fetchNodes();
});
</script>

<style scoped>
</style>