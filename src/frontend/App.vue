<template>
  <div class="flex md:hidden min-h-screen bg-[#f8f9fa] items-center justify-center p-6 relative overflow-hidden font-sans">
    <div class="absolute top-[-10%] left-[-10%] w-64 h-64 bg-rose-500/5 blur-[80px] rounded-full pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none"></div>

    <div class="bg-white border border-slate-200/80 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative z-10">
      <div class="w-16 h-16 bg-blue-50 border border-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
        <i class="ph-bold ph-monitor text-3xl"></i>
      </div>
      <h2 class="text-xl font-bold text-slate-900 mb-3 tracking-tight">Resolusi Tidak Didukung</h2>
      <p class="text-sm text-slate-500 font-medium leading-relaxed mb-8">
        Sistem ProxView ini dirancang khusus untuk layar besar agar pemantauan infrastruktur lebih maksimal. Mohon akses menggunakan <span class="font-bold text-slate-900">Tablet</span> atau <span class="font-bold text-slate-900">Desktop</span>.
      </p>
      <div class="flex items-center justify-center gap-4 text-slate-400">
        <div class="relative">
          <i class="ph ph-device-mobile text-4xl text-slate-300"></i>
          <i class="ph-fill ph-prohibit text-rose-500 absolute -bottom-1 -right-2 text-xl bg-white rounded-full border-2 border-white"></i>
        </div>
        <i class="ph-bold ph-arrow-right text-sm mx-2"></i>
        <i class="ph ph-device-tablet text-4xl text-blue-500"></i>
        <i class="ph ph-monitor text-4xl text-blue-500"></i>
      </div>
    </div>
  </div>

  <div class="hidden md:block relative font-sans">

    <ToastNotification
      :show="showSuccessToast"
      type="success"
      title="Login Berhasil!"
      @close="showSuccessToast = false"
    >
      <p class="text-slate-600 font-medium text-xs leading-relaxed mb-1">
        Selamat datang kembali, <span class="font-bold text-slate-900">{{ userName }}</span>.
      </p>
      <p class="text-slate-600 font-medium text-xs leading-relaxed">
        Sesi otentikasi aktif untuk role <span class="text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md font-mono tracking-tight font-bold text-[10px] uppercase ml-0.5">{{ userRole }}</span>.
      </p>
    </ToastNotification>

    <ToastNotification
      :show="showLogoutToast"
      type="logout"
      title="Sesi Telah Ditutup"
      message="Token sesi Anda telah berhasil dihapus. Sampai jumpa kembali di konsol monitoring."
      @close="showLogoutToast = false"
    />

    <ToastNotification
      :show="globalToast.show"
      :type="globalToast.type"
      :title="globalToast.title"
      :message="globalToast.message"
      @close="hideGlobalToast"
    />

    <Teleport to="body">
      <div v-if="showTimeoutModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans">
        <div class="bg-white border border-slate-200/80 rounded-2xl p-8 max-w-sm w-full text-center shadow-xl relative overflow-hidden">

          <div class="absolute -top-10 -right-10 w-32 h-32 bg-rose-50 rounded-full blur-[30px]"></div>

          <div class="w-16 h-16 bg-rose-50 border border-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-5 relative z-10 shadow-sm">
            <i class="ph-fill ph-clock-countdown text-3xl"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2 relative z-10 tracking-tight">Sesi Telah Berakhir</h3>
          <p class="text-sm text-slate-500 font-medium mb-6 relative z-10 leading-relaxed">
            Sistem mendeteksi tidak ada aktivitas selama 5 menit. Demi keamanan Anda telah dikeluarkan secara otomatis.
          </p>
          <button @click="confirmTimeout" class="w-full px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shadow-sm relative z-10 flex justify-center items-center gap-2">
            Kembali ke Login <i class="ph-bold ph-arrow-right"></i>
          </button>
        </div>
      </div>
    </Teleport>

    <router-view v-if="$route.name === 'login'" />

    <div v-else class="min-h-screen flex text-slate-900 bg-[#f8f9fa]">
      <Sidebar />
      <div class="ml-64 flex-1 flex flex-col w-[calc(100%-16rem)]">
        <Navbar />
        <router-view />
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Sidebar from '@/components/layout/Sidebar.vue';
import Navbar from '@/components/layout/Navbar.vue';
import ToastNotification from '@/components/common/ToastNotification.vue';
import { globalToast, hideGlobalToast } from '@/utils/toast.js';

const route = useRoute();
const router = useRouter();

const showSuccessToast = ref(false);
const showLogoutToast = ref(false);
const userName = ref('');
const userRole = ref('');

let timeoutTimer = null;
const INACTIVITY_LIMIT = 300 * 1000;
const showTimeoutModal = ref(false);
let isAutoLogout = false;

const executeAutoLogout = () => {
    const isAuthenticated = localStorage.getItem('isLoggedIn') === 'true';
    if (isAuthenticated && route.name !== 'login' && !showTimeoutModal.value) {
        showTimeoutModal.value = true;
        removeActivityListeners();
    }
};

const confirmTimeout = () => {
    isAutoLogout = true;
    showTimeoutModal.value = false;

    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userData');
    localStorage.removeItem('lastActivity');

    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
};

const updateActivityAndResetTimer = () => {
    const isAuthenticated = localStorage.getItem('isLoggedIn') === 'true';

    if (route.name === 'login' || !isAuthenticated || showTimeoutModal.value) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        return;
    }

    localStorage.setItem('lastActivity', Date.now().toString());

    if (timeoutTimer) clearTimeout(timeoutTimer);
    timeoutTimer = setTimeout(executeAutoLogout, INACTIVITY_LIMIT);
};

const checkInitialIdleState = () => {
    const isAuthenticated = localStorage.getItem('isLoggedIn') === 'true';
    if (route.name === 'login' || !isAuthenticated) return;

    const lastActivity = localStorage.getItem('lastActivity');

    if (lastActivity && (Date.now() - parseInt(lastActivity)) > INACTIVITY_LIMIT) {
        isAutoLogout = true;
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userData');
        localStorage.removeItem('lastActivity');

        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        router.push('/login');
    }
};

const setupActivityListeners = () => {
    window.addEventListener('mousemove', updateActivityAndResetTimer);
    window.addEventListener('mousedown', updateActivityAndResetTimer);
    window.addEventListener('keydown', updateActivityAndResetTimer);
    window.addEventListener('scroll', updateActivityAndResetTimer);
    window.addEventListener('touchstart', updateActivityAndResetTimer);
};

const removeActivityListeners = () => {
    window.removeEventListener('mousemove', updateActivityAndResetTimer);
    window.removeEventListener('mousedown', updateActivityAndResetTimer);
    window.removeEventListener('keydown', updateActivityAndResetTimer);
    window.removeEventListener('scroll', updateActivityAndResetTimer);
    window.removeEventListener('touchstart', updateActivityAndResetTimer);
};

onMounted(() => {
    if (route.name === 'login') {
        localStorage.removeItem('lastActivity');
    } else {
        checkInitialIdleState();
        setupActivityListeners();
        updateActivityAndResetTimer();
    }
});

onUnmounted(() => {
    removeActivityListeners();
    if (timeoutTimer) clearTimeout(timeoutTimer);
});

watch(() => route.name, (newName, oldName) => {
    if (newName === 'login') {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        removeActivityListeners();

        localStorage.removeItem('lastActivity');
        showTimeoutModal.value = false;

        if (oldName && oldName !== 'login') {
            if (isAutoLogout) {
                isAutoLogout = false;
            } else {
                showLogoutToast.value = true;
                setTimeout(() => { showLogoutToast.value = false; }, 5000);
            }
        }
    } else {
        if (oldName === 'login') {
            localStorage.setItem('lastActivity', Date.now().toString());
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            if (userData.name) {
                userName.value = userData.name;
                userRole.value = userData.role;
                showSuccessToast.value = true;
                setTimeout(() => { showSuccessToast.value = false; }, 5000);
            }
        }

        checkInitialIdleState();
        setupActivityListeners();
        updateActivityAndResetTimer();
    }
});
</script>

<style scoped>
</style>
