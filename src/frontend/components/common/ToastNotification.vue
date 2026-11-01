<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform -translate-y-4 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-300 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <div 
        v-if="show" 
        class="fixed top-8 right-8 z-[1200] w-[400px] bg-white border border-slate-200 shadow-xl rounded-xl p-4 flex gap-4 font-sans"
        role="alert"
        aria-live="assertive"
      >
        <!-- Icon Container -->
        <div 
          class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border"
          :class="iconBgClass"
        >
          <i :class="[iconClass, 'text-xl ph-bold']"></i>
        </div>

        <!-- Content Container -->
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-start">
            <h3 class="text-slate-900 font-bold text-sm leading-none mb-1.5">{{ title }}</h3>
            <button 
              type="button"
              @click="$emit('close')" 
              class="text-slate-400 hover:text-slate-600 transition ml-2 p-0.5 rounded"
              title="Tutup Notifikasi"
            >
              <i class="ph-bold ph-x text-sm"></i>
            </button>
          </div>
          <slot>
            <p class="text-slate-600 text-xs font-medium leading-relaxed">{{ message }}</p>
          </slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'success' // 'success' | 'error' | 'warning' | 'info' | 'logout'
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  }
});

defineEmits(['close']);

const iconBgClass = computed(() => {
  switch (props.type) {
    case 'logout':
      return 'bg-slate-50 border-slate-200 text-slate-600';
    case 'success':
      return 'bg-emerald-50 border-emerald-100 text-emerald-600';
    case 'warning':
      return 'bg-amber-50 border-amber-100 text-amber-600';
    case 'info':
      return 'bg-blue-50 border-blue-100 text-blue-600';
    case 'error':
    default:
      return 'bg-rose-50 border-rose-100 text-rose-600';
  }
});

const iconClass = computed(() => {
  switch (props.type) {
    case 'logout':
      return 'ph-sign-out';
    case 'success':
      return 'ph-check-circle';
    case 'warning':
      return 'ph-warning';
    case 'info':
      return 'ph-info';
    case 'error':
    default:
      return 'ph-warning-circle';
  }
});
</script>
