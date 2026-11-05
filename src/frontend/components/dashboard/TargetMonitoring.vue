<template>
  <main class="bg-[#f8f9fa] min-h-screen font-sans p-8 pb-12 overflow-x-hidden relative animate-fade-in"> 
    <transition name="fade" mode="out-in">
      <IcmpTcpMonitor 
        v-if="viewMode === 'icmp'" 
        @change-view="viewMode = $event" 
      /> 

      <ProxmoxMonitor 
        v-else-if="viewMode === 'proxmox'" 
        @change-view="viewMode = $event" 
      /> 
    </transition>
  </main> 
</template>

<script setup>
import { ref } from 'vue';

import IcmpTcpMonitor from '@/components/layout/IcmpTcpMonitor.vue';
import ProxmoxMonitor from '@/components/layout/ProxmoxMonitor.vue';

const viewMode = ref('icmp');
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
