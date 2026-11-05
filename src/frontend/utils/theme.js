import { ref, watch } from 'vue';

const STORAGE_KEY = 'proxview_theme';

const getInitialDark = () => {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return document.documentElement.classList.contains('dark');
};

export const isDark = ref(getInitialDark());

export const applyThemeClass = (dark) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (dark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const toggleTheme = () => {
  isDark.value = !isDark.value;
};

export const initTheme = () => {
  applyThemeClass(isDark.value);
};

watch(
  isDark,
  (val) => {
    applyThemeClass(val);
    try {
      localStorage.setItem(STORAGE_KEY, val ? 'dark' : 'light');
    } catch (e) {
    }
  },
  { immediate: true }
);
