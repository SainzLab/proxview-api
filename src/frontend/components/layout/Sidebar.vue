<template>
  <aside class="w-64 bg-white h-screen fixed left-0 top-0 border-r border-slate-200/80 flex flex-col z-20 font-sans shadow-[1px_0_2px_rgba(0,0,0,0.02)]">
    
    <!-- Logo -->
    <div class="p-5 flex flex-col items-start border-b border-slate-100 mb-2">
        <img 
            src="/diskominfosubang.png" 
            alt="Logo Diskominfo Subang" 
            class="h-16 object-contain mb-3 filter drop-shadow-[0_4px_5px_rgba(0,0,0,0.4)] drop-shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
        >
        <p class="text-[9px] text-slate-500 mt-1 uppercase tracking-widest font-bold">
            Porxview Monitoring Proxmox
        </p>
    </div>

    <!-- Navigation -->
    <div class="flex-1 overflow-y-auto py-3 flex flex-col gap-8 no-scrollbar">
      <!-- Menu Utama -->
      <nav class="px-4">
        <p class="text-[11px] text-slate-400 mb-3 font-semibold tracking-wider uppercase">Menu Utama</p>
        <ul class="space-y-1">
          <li>
            <router-link
              to="/dashboard"
              :class="['flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition',
                       route.name === 'dashboard' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              ]"
            >
              <div class="flex items-center gap-3"><i class="ph ph-squares-four text-lg"></i> Dashboard</div>
            </router-link>
          </li>
          
          <li>
            <router-link
              to="/kelola-pengguna"
              :class="['flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition',
                       route.name === 'kelola-pengguna' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              ]"
            >
              <div class="flex items-center gap-3"><i class="ph ph-users text-lg"></i> Kelola Pengguna</div>
            </router-link>
          </li>
          
          <li>
            <router-link
              to="/target-monitoring"
              :class="['flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition',
                       route.name === 'target-monitoring' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              ]"
            >
              <div class="flex items-center gap-3"><i class="ph ph-graph text-lg"></i> Monitoring</div>
              <div class="flex items-center gap-2">
                <!-- Badge Pastel jika ada downCount -->
                <span v-if="downCount > 0" class="text-[10px] px-1.5 py-0.5 rounded-md border bg-rose-50 text-rose-700 border-rose-200/60 font-bold font-mono animate-pulse">
                  {{ downCount }}
                </span>
              </div>
            </router-link>
          </li>
          
          <li>
            <router-link
              to="/rekap-gangguan"
              :class="['flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition',
                       route.name === 'rekap-gangguan' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              ]"
            >
              <div class="flex items-center gap-3"><i class="ph ph-ticket text-lg"></i> Rekap Gangguan</div>
              <div class="flex items-center gap-2">
                 <span v-if="downCount > 0" class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              </div>
            </router-link>
          </li>

          <li>
            <router-link
              to="/threshold-config"
              :class="['flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition',
                       route.name === 'threshold-config' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              ]"
            >
              <div class="flex items-center gap-3"><i class="ph ph-sliders text-lg"></i> Threshold Config</div>
            </router-link>
          </li>

          <li>
            <router-link
              to="/proxmox-config"
              :class="['flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition',
                       route.name === 'proxmox-config' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              ]"
            >
              <div class="flex items-center gap-3"><i class="ph ph-hard-drives text-lg"></i> Proxmox API Config</div>
            </router-link>
          </li>

          <li>
            <router-link
              to="/log"
              :class="['flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition',
                       route.name === 'Log' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              ]"
            >
              <div class="flex items-center gap-3"><i class="ph ph-terminal text-lg"></i> Log Sistem</div>
            </router-link>
          </li>
        </ul>
      </nav>
    </div>

    <!-- User Profile & Logout -->
    <div class="p-4 border-t border-slate-200/80 bg-slate-50/50">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-sm">
          {{ userProfile.initials }}
        </div>
        <div class="overflow-hidden">
          <p class="text-sm text-slate-900 font-semibold truncate">{{ userProfile.name }}</p>
          <p class="text-[11px] text-slate-500 font-medium truncate">{{ userProfile.email || userProfile.role }}</p>
        </div>
      </div>
      <button 
        @click="showLogoutModal = true"
        class="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 py-2 rounded-lg text-xs font-semibold transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
      >
        <i class="ph-bold ph-sign-out text-base"></i> Keluar Sistem
      </button>
    </div>
  </aside>

  <!-- Modal Konfirmasi Logout -->
  <Teleport to="body">
    <div v-if="showLogoutModal" 
         class="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans"
         @click.self="showLogoutModal = false"
    >
      <div class="bg-white border border-slate-200/80 shadow-xl rounded-2xl w-full max-w-md overflow-hidden transform transition-all relative">
        <div class="p-6 pt-7">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0 w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-600 mt-0.5">
               <i class="ph-bold ph-sign-out text-2xl"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900 mb-2">Konfirmasi Keluar</h3>
              <p class="text-sm text-slate-600 font-medium leading-relaxed">
                Apakah Anda yakin ingin keluar dari sistem? Sesi aktif Anda akan diakhiri dan Anda harus masuk kembali untuk mengakses sistem.
              </p>
            </div>
          </div>
        </div>
        <div class="bg-slate-50/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200/80">
          <button 
            type="button" 
            @click="showLogoutModal = false"
            class="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            :disabled="isLoggingOut"
          >
            Batal
          </button>
          <button 
            type="button" 
            @click="handleLogout"
            class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-50"
            :disabled="isLoggingOut"
          >
            <i v-if="isLoggingOut" class="ph-bold ph-spinner animate-spin text-base"></i>
            <i v-else class="ph-bold ph-sign-out text-base"></i>
            <span>{{ isLoggingOut ? 'Memproses...' : 'Ya, Keluar' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

// State Sidebar
const showLogoutModal = ref(false);
const isLoggingOut = ref(false);
const targetCount = ref(0);
const downCount = ref(0);
const userProfile = ref({
  name: 'Administrator',
  email: 'admin@diskominfo.go.id',
  role: 'Admin',
  initials: 'AD'
});
let pollTimer = null;

// Fungsi Mengambil Data Sidebar
const fetchSidebarData = async () => {
  try {
    // Ambil jumlah target dan deteksi target yang DOWN
    const resTargets = await fetch('/api/targets');
    if (resTargets.ok) {
      const dataTargets = await resTargets.json();
      if (dataTargets.success) {
        targetCount.value = dataTargets.data.length;
        downCount.value = dataTargets.data.filter(t => t.status === 'DOWN').length;
      }
    }
  } catch (error) {
    console.error('Gagal mengambil data target:', error);
  }
};

const handleLogout = async () => {
  isLoggingOut.value = true;
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    isLoggingOut.value = false;
    showLogoutModal.value = false;
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userData');
    router.push('/login');
  }
};

onMounted(() => {
  const storedUser = localStorage.getItem('userData');
  if (storedUser) {
    const parsedUser = JSON.parse(storedUser);
    userProfile.value.name = parsedUser.name || 'Administrator';
    userProfile.value.email = parsedUser.email || parsedUser.username;
    userProfile.value.role = parsedUser.role || 'Admin';
    userProfile.value.initials = (parsedUser.name ? parsedUser.name.substring(0, 2).toUpperCase() : 'AD');
  }

  fetchSidebarData();
  pollTimer = setInterval(fetchSidebarData, 10000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>