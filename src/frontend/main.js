import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/dark-theme.css';
import { initTheme } from './utils/theme.js';

initTheme();

const app = createApp(App);
app.use(router);
app.mount('#app');

const originalFetch = window.fetch;
window.fetch = async function() {
    const response = await originalFetch.apply(this, arguments);
    
    if (response.status === 401) {
        // Bersihkan tanda login
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');
        
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    }
    return response;
};