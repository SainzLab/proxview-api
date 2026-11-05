<template>
  <main class="bg-[#f8f9fa] min-h-screen font-sans p-8 pb-12 overflow-x-hidden relative animate-fade-in">

    <div class="flex justify-between items-end mb-6 pb-5">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-3">
          <i class="ph-bold ph-sliders text-slate-700"></i> Konfigurasi Threshold
        </h2>
        <p class="text-slate-500 text-sm font-medium">Atur pemicu notifikasi alarm untuk infrastruktur Anda.</p>
      </div>

      <div class="flex bg-slate-50 border border-slate-200/80 p-1 rounded-lg shadow-inner h-[42px] items-center shrink-0">
        <button 
          @click="activeTab = 'proxmox'" 
          class="px-3 h-full rounded-md text-xs transition-all duration-300 flex items-center gap-1.5 whitespace-nowrap" 
          :class="activeTab === 'proxmox' ? 'bg-white text-slate-900 font-bold border border-slate-200 shadow-sm' : 'text-slate-500 font-semibold hover:text-slate-900 hover:bg-slate-100 border border-transparent'"
        >
          <i class="ph-bold ph-hard-drives text-sm"></i> PROXMOX API
        </button>
        <button 
          @click="activeTab = 'network'" 
          class="px-3 h-full rounded-md text-xs transition-all duration-300 flex items-center gap-1.5 whitespace-nowrap" 
          :class="activeTab === 'network' ? 'bg-white text-slate-900 font-bold border border-slate-200 shadow-sm' : 'text-slate-500 font-semibold hover:text-slate-900 hover:bg-slate-100 border border-transparent'"
        >
          <i class="ph-bold ph-activity text-sm"></i> ICMP / TCP
        </button>
      </div>
    </div>

    <transition name="fade" mode="out-in">
      <component :is="activeTab === 'proxmox' ? ThresholdProxmox : ThresholdNetwork" />
    </transition>

  </main>
</template>

<script setup>
import { ref } from 'vue';
import ThresholdProxmox from '@/components/layout/ThresholdProxmox.vue';
import ThresholdNetwork from '@/components/layout/ThresholdIcmpTcp.vue';

const activeTab = ref('proxmox');
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
