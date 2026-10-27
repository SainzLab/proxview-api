import { createRouter, createWebHistory } from 'vue-router';

// Import semua halaman
import Login from '@/components/auth/Login.vue';
import Dashboard from '@/components/dashboard/Dashboard.vue';
import KelolaPengguna from '@/components/dashboard/KelolaPengguna.vue';
import TargetMonitoring from '@/components/dashboard/TargetMonitoring.vue';
import ThresholdConfig from '@/components/dashboard/ThresholdConfig.vue';
import ProxmoxConfig from '@/components/config/ProxmoxConfig.vue';
import RekapGangguan from '@/components/dashboard/RekapGangguan.vue';
import LogSystem from '@/components/dashboard/log.vue';

const routes = [
  { path: '/', 
    redirect: '/dashboard' 
  },
  { path: '/login', 
    name: 'login', 
    component: Login, meta: { 
      requiresGuest: true 
    } 
  },
  { path: '/dashboard', 
    name: 'dashboard', 
    component: Dashboard, meta: { 
      requiresAuth: true 
    } 
  },
  { path: '/kelola-pengguna', 
    name: 'kelola-pengguna', 
    component: KelolaPengguna, meta: { 
      requiresAuth: true 
    } 
  },
  { path: '/target-monitoring', 
    name: 'target-monitoring', 
    component: TargetMonitoring, meta: { 
      requiresAuth: true 
    } 
  },
  { path: '/threshold-config', 
    name: 'threshold-config', component: ThresholdConfig, meta: { 
      requiresAuth: true 
    } 
  },
  { path: '/proxmox-config', 
    name: 'proxmox-config', component: ProxmoxConfig, meta: { 
      requiresAuth: true 
    } 
  },
  { path: '/rekap-gangguan', 
    name: 'rekap-gangguan', component: RekapGangguan, meta: { 
      requiresAuth: true 
    } 
  },
  { path: '/log', 
    name: 'Log', component: LogSystem, meta: { 
      requiresAuth: true 
    } 
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Middleware (Navigation Guard) untuk mengunci rute
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('isLoggedIn') === 'true';

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login'); // Lempar ke login jika belum masuk
  } else if (to.meta.requiresGuest && isAuthenticated) {
    next('/dashboard'); // Lempar ke dashboard jika sudah masuk tapi mencoba akses /login
  } else {
    next();
  }
});

export default router;