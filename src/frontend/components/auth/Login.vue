<template>
    <div class="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6 relative overflow-hidden font-sans">
        
        <!-- Tombol Toggle Mode Gelap / Terang (Pojok Kanan Atas) -->
        <button type="button" @click="toggleTheme" :title="isDark ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'"
            class="fixed top-6 right-6 z-30 w-10 h-10 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-50 hover:text-slate-900 border border-slate-200 transition shadow-sm"
        >
            <i v-if="isDark" class="ph-fill ph-sun text-lg text-amber-400"></i>
            <i v-else class="ph ph-moon text-lg"></i>
        </button>

        <!-- Efek Latar Belakang Ambien (Sangat Halus untuk Light Theme) -->
        <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none"></div>

        <!-- Login Container -->
        <div class="flex max-w-5xl w-full h-[550px] bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden border border-slate-200/80 relative z-10 animate-fade-in">
            
            <!-- Panel Form Kiri (Fix Width 450px) -->
            <div class="w-[450px] shrink-0 p-10 flex flex-col justify-center bg-white relative z-20">
                
                <form @submit.prevent="handleLogin" class="space-y-5">
                    <!-- Username -->
                    <div>
                        <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Username</label>
                        <div class="relative">
                            <i class="ph-bold ph-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                            <input type="text" v-model="form.username" placeholder="Masukkan username admin" class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400" required >
                        </div>
                    </div>

                    <!-- Password -->
                    <div>
                        <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                        <div class="relative">
                            <i class="ph-bold ph-lock-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                            <input :type="showPassword ? 'text' : 'password'" v-model="form.password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400" required >
                            <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition flex items-center justify-center p-1" :title="showPassword ? 'Sembunyikan password' : 'Lihat password'" >
                                <i :class="showPassword ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye'" class="text-lg"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Captcha Display & Input -->
                    <div class="pt-2">
                        <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Verifikasi Keamanan</label>
                        <div class="flex items-center gap-3 mb-3">
                            <!-- Canvas Container -->
                            <div class="bg-slate-50/50 p-1 rounded-lg border border-slate-200 w-[140px] h-[45px] overflow-hidden shadow-inner">
                                <canvas ref="captchaCanvas" width="130" height="35" class="w-full h-full cursor-crosshair"></canvas>
                            </div>
                            <button type="button" @click="generateCaptcha" class="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]" title="Refresh CAPTCHA" >
                                <i class="ph-bold ph-arrows-clockwise text-lg"></i>
                            </button>
                        </div>
                        <input type="text" v-model="form.captchaInput" placeholder="Ketik kode di atas" class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-bold tracking-tight rounded-lg px-4 py-2.5 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] uppercase font-mono placeholder:text-slate-400 placeholder:font-sans placeholder:font-medium placeholder:tracking-normal" required >
                        <p v-if="captchaError" class="text-rose-600 text-xs mt-2 font-medium flex items-center gap-1.5">
                            <i class="ph-bold ph-warning-circle"></i> Kode CAPTCHA tidak cocok, coba lagi.
                        </p>
                    </div>

                    <!-- Login Button -->
                    <div class="pt-4">
                        <button type="submit" :disabled="isLoggingIn" class="w-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 font-bold text-xs py-3 rounded-lg transition shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md flex justify-center items-center gap-2" >
                            <i v-if="isLoggingIn" class="ph-bold ph-spinner animate-spin text-base"></i>
                            <i v-else class="ph-bold ph-sign-in text-base"></i>
                            {{ isLoggingIn ? 'Memverifikasi...' : 'Masuk Sistem' }}
                        </button>
                    </div>
                </form>

                <!-- Footer Copyright -->
                <div class="mt-auto pt-8 text-xs text-slate-400 font-medium">
                    &copy; {{ new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric' }) }} Dinas Komunikasi dan Informatika Kabupaten Subang.
                </div>
            </div>

           <!-- Panel Akses Kanan (Hero Graphic - Selalu Tampil) -->
            <div class="flex flex-1 bg-slate-50 relative items-center justify-center overflow-hidden border-l border-slate-200/80">
                <!-- Grid Pattern Overlay -->
                <div class="absolute inset-0 opacity-50 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                
                <!-- Glowing Center -->
                <div class="absolute w-96 h-96 bg-white blur-[100px] rounded-full"></div>
                
                <!-- Icon Graphic (Watermark) -->
                <i class="ph-duotone ph-shield-check text-[18rem] text-slate-200/60 absolute -right-16 -bottom-16 rotate-12"></i>
                
                <div class="text-center z-10 px-12 relative flex flex-col items-center">
                    <!-- PERBAIKAN: Menambahkan drop-shadow hitam pekat agar teks putih terbaca -->
                    <img 
                        src="https://cdn.sainzlab.my.id/sainzlab-storage/diskominfosubang.png" 
                        alt="Logo Diskominfo Subang" 
                        class="h-24 object-contain mb-8 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] drop-shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                    >
                    
                    <h2 class="text-2xl font-black text-slate-900 mb-4 tracking-tight">PROXVIEW</h2>
                    <p class="text-slate-500 text-sm font-medium leading-relaxed max-w-sm mx-auto">
                        Sistem pemantauan terpusat Proxmox VE Dinas Komunikasi dan Informatika. Hanya untuk personel dengan otorisasi Administrator.
                    </p>
                </div>
            </div>
        </div>

        <!-- TOAST NOTIFICATION -->
        <ToastNotification 
            :show="toast.show" 
            :type="toast.type" 
            :title="toast.title" 
            :message="toast.message" 
            @close="toast.show = false" 
        />
    </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { isDark, toggleTheme } from '../../utils/theme.js';
import ToastNotification from '@/components/common/ToastNotification.vue';

const router = useRouter();
const form = ref({
    username: '',
    password: '',
    captchaInput: ''
});
const showPassword = ref(false);
const captchaCanvas = ref(null);
const actualCaptchaText = ref('');
const captchaError = ref(false);
const isLoggingIn = ref(false);
const toast = ref({ show: false, type: 'error', title: '', message: '' });
let toastTimer = null;

const showToast = (type, title, message) => {
    toast.value = { show: true, type, title, message };
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.value.show = false;
    }, 5000);
};

const generateCaptcha = () => {
    if (!captchaCanvas.value) return;
    const ctx = captchaCanvas.value.getContext('2d');
    const width = captchaCanvas.value.width;
    const height = captchaCanvas.value.height;

    // Latar belakang canvas menyesuaikan tema terang / gelap
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = isDark.value ? '#0f172a' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    actualCaptchaText.value = code;

    // Tipografi Captcha disesuaikan dengan tema
    ctx.font = 'bold 24px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < code.length; i++) {
        const xOffset = 15 + (i * 18);
        const yOffset = height / 2 + (Math.random() * 6 - 3);
        const angle = (Math.random() * 0.4) - 0.2;
        
        ctx.save();
        ctx.translate(xOffset, yOffset);
        ctx.rotate(angle);
        // Warna teks menyesuaikan mode gelap / terang
        ctx.fillStyle = isDark.value ? '#f8fafc' : '#1e293b';
        ctx.fillText(code[i], 0, 0);
        ctx.restore();
    }

    // Garis noise menggunakan warna hijau Moxgreen
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
    }
};

const handleLogin = async () => {
    // Validasi Captcha
    if (form.value.captchaInput.toLowerCase() !== actualCaptchaText.value.toLowerCase()) {
        captchaError.value = true;
        form.value.captchaInput = '';
        generateCaptcha();
        return;
    }
    captchaError.value = false;
    isLoggingIn.value = true;
    
    try {
        // Tembak API Backend
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: form.value.username,
                password: form.value.password
            })
        });
        const data = await response.json();
        
        if (data.success) {
            // Simpan sesi di localStorage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(data.user));
            // Redirect ke dashboard menggunakan Vue Router
            router.push('/dashboard');
        } else {
            // Menampilkan pesan error
            showToast('error', 'Otentikasi Gagal', data.message || 'Username atau password salah.');
            form.value.password = '';
            form.value.captchaInput = '';
            generateCaptcha();
        }
    } catch (err) {
        console.error(err);
        showToast('error', 'Kesalahan Jaringan', 'Gagal terhubung ke server database.');
    } finally {
        isLoggingIn.value = false;
    }
};

watch(isDark, () => {
    generateCaptcha();
});

onMounted(() => {
    generateCaptcha();
});
</script>