<template>
  <header class="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 sm:px-8 sticky top-0 z-40 font-sans shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors">
    <!-- Breadcrumb Menu & Jam Digital WIB -->
    <div class="flex items-center gap-3">
      <!-- Breadcrumb Navigasi Halaman Aktif -->
      <div class="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
        <router-link to="/dashboard" class="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition">
          <i class="ph-bold ph-hard-drives text-slate-400 text-sm"></i>
          <span class="tracking-wide">ProxView</span>
        </router-link>
        <i class="ph-bold ph-caret-right text-[10px] text-slate-400"></i>
        <span class="flex items-center gap-1.5 text-slate-800 font-bold bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <i class="ph-bold" :class="currentRouteMeta.icon"></i>
          {{ currentRouteMeta.title }}
        </span>
      </div>

      <div class="hidden sm:block h-4 w-px bg-slate-200"></div>

      <!-- Jam Digital WIB -->
      <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-slate-700 tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <i class="ph-fill ph-clock text-slate-400 text-sm"></i>
        <span class="font-mono text-[11px] font-bold tracking-tight">{{ currentTime }}</span>
      </div>
    </div>

    <!-- Aksi Kanan Atas: Toggle Tema, Notifikasi, Pengaturan Master -->
    <div class="flex items-center gap-2">
      <!-- Quick Toggle Mode Terang / Gelap -->
      <button 
        @click="toggleTheme" 
        :title="isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'" 
        class="w-9 h-9 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-50 hover:text-slate-900 border border-slate-200 transition relative shadow-sm"
        aria-label="Toggle Tema"
      >
        <i class="ph-bold text-lg" :class="isDark ? 'ph-sun text-amber-500' : 'ph-moon text-slate-600'"></i>
      </button>

      <!-- Tombol Notifikasi + Dropdown -->
      <div class="relative" ref="notifWrapper">
        <button 
          @click.stop="toggleDropdown" 
          title="Notifikasi Gangguan"
          class="w-9 h-9 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-50 hover:text-slate-900 border border-slate-200 transition relative shadow-sm" 
          :class="showDropdown ? 'bg-slate-50 text-slate-900 border-slate-300' : ''"
        >
          <i class="ph ph-bell text-lg" :class="alerts.length > 0 ? 'animate-pulse text-rose-500' : ''"></i>
          <span 
            v-if="alerts.length > 0" 
            class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-rose-500 text-white text-[9px] font-bold font-mono tracking-tight rounded-full border border-white dark:border-slate-700 shadow-sm"
          >
            {{ alerts.length > 99 ? '99+' : alerts.length }}
          </span>
        </button>

        <!-- Dropdown Notifikasi -->
        <div v-if="showDropdown" @click.stop class="absolute right-0 mt-3 w-96 bg-white border border-slate-200/80 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in font-sans">
          <div class="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <h4 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i class="ph-bold ph-bell-ringing text-slate-500"></i>
              Notifikasi Gangguan
            </h4>
            <span class="text-[10px] font-semibold text-slate-600 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              {{ alerts.length }} aktif
            </span>
          </div>

          <div class="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
            <div v-if="isLoading && alerts.length === 0" class="p-8 text-center text-slate-500">
              <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
              <p class="text-xs font-medium">Memuat notifikasi...</p>
            </div>
            <div v-else-if="alerts.length === 0" class="p-6 text-center text-xs text-slate-500 font-medium">
              <i class="ph-fill ph-check-circle text-2xl text-emerald-500 block mb-1"></i>
              Tidak ada gangguan aktif
            </div>
            <div 
              v-else 
              v-for="alert in alerts" 
              :key="alert.id" 
              @click="openAllModal('active')"
              class="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer"
            >
              <div class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center border" :class="severityStyle(alert.severity).icon">
                <i class="ph-bold text-base" :class="severityStyle(alert.severity).iconClass"></i>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-slate-900 truncate font-mono">{{ alert.target_name }}</p>
                <p class="text-[11px] text-slate-500 font-medium truncate">{{ alert.message }}</p>
                <p class="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5">{{ formatTime(alert.created_at) }}</p>
              </div>
              <span class="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider" :class="severityStyle(alert.severity).badge">
                {{ alert.severity }}
              </span>
            </div>
          </div>
          <button 
            @click="openAllModal('active')" 
            class="w-full px-4 py-3 bg-slate-50/50 border-t border-slate-100 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition flex items-center justify-center gap-1.5"
          >
            Lihat Semua Riwayat & Gangguan <i class="ph-bold ph-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Tombol Pengaturan Master -->
      <button 
        @click.stop="openSettingsModal('appearance')" 
        title="Pengaturan Sistem" 
        class="w-9 h-9 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-50 hover:text-slate-900 border border-slate-200 transition relative shadow-sm" 
        :class="showSettingsModal ? 'bg-slate-50 text-slate-900 border-slate-300 ring-2 ring-slate-100' : ''"
      >
        <i class="ph ph-gear text-lg" :class="showSettingsModal ? 'animate-spin-slow' : ''"></i>
      </button>
    </div>
  </header>

  <!-- Modal Master Pengaturan -->
  <Teleport to="body">
    <div 
      v-if="showSettingsModal" 
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" 
      @click.self="showSettingsModal = false"
    >
      <div class="bg-white border border-slate-200/80 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden min-h-[550px] max-h-[90vh]">
        
        <!-- Sidebar Menu Pengaturan -->
        <div class="w-full md:w-64 bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col shrink-0">
          <div class="p-6 border-b border-slate-200/80">
            <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <i class="ph-bold ph-faders-horizontal text-slate-700"></i>
              Pengaturan Sistem
            </h3>
            <p class="text-xs text-slate-500 mt-1">Konfigurasi preferensi aplikasi</p>
          </div>
          <div class="p-3 flex flex-col gap-1 overflow-y-auto">
            <button 
              @click="setSettingTab('appearance')" 
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition" 
              :class="activeSettingTab === 'appearance' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'"
            >
              <i class="ph-bold ph-palette text-lg"></i>
              Tampilan & Tema
            </button>
            <button 
              @click="setSettingTab('cleanup')" 
              class="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition" 
              :class="activeSettingTab === 'cleanup' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'"
            >
              <div class="flex items-center gap-3">
                <i class="ph-bold ph-broom text-lg"></i>
                Pembersihan Otomatis
              </div>
              <span v-if="!isAdmin" class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase">Admin</span>
            </button>
            <button 
              @click="setSettingTab('simulation')" 
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition" 
              :class="activeSettingTab === 'simulation' ? 'bg-slate-900 text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'"
            >
              <i class="ph-bold ph-flask text-lg"></i>
              Simulasi Pengujian
            </button>
          </div>
        </div>

        <!-- Konten Pengaturan -->
        <div class="flex-1 flex flex-col bg-white overflow-hidden relative">
          
          <!-- Header Konten -->
          <div class="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h2 class="text-xl font-bold text-slate-900 mb-1" v-if="activeSettingTab === 'appearance'">Tampilan & Tema</h2>
              <h2 class="text-xl font-bold text-slate-900 mb-1" v-if="activeSettingTab === 'cleanup'">Cronjob Pembersihan Otomatis</h2>
              <h2 class="text-xl font-bold text-slate-900 mb-1" v-if="activeSettingTab === 'simulation'">Simulasi & Pengujian Sistem</h2>
              
              <p class="text-sm text-slate-500" v-if="activeSettingTab === 'appearance'">Sesuaikan mode antarmuka antarmuka monitoring sesuai kenyamanan visual Anda.</p>
              <p class="text-sm text-slate-500" v-if="activeSettingTab === 'cleanup'">Konfigurasi interval penghapusan otomatis data log sistem dan riwayat gangguan.</p>
              <p class="text-sm text-slate-500" v-if="activeSettingTab === 'simulation'">Uji kesiapan pengiriman notifikasi push Firebase dan panggilan darurat VoIP.</p>
            </div>
            <button @click="showSettingsModal = false" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition shrink-0">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-8 pt-6">
            
            <!-- TAB: TAMPILAN & TEMA -->
            <div v-if="activeSettingTab === 'appearance'" class="animate-fade-in">
              <label class="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Pilih Tema Antarmuka</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                <!-- Mode Terang -->
                <button 
                  type="button"
                  @click="isDark ? toggleTheme() : null" 
                  class="border-2 rounded-xl p-5 flex flex-col items-center gap-3 transition-all relative text-left" 
                  :class="!isDark ? 'border-slate-900 bg-slate-50/80 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'"
                >
                  <div v-if="!isDark" class="absolute top-3 right-3 text-emerald-600">
                    <i class="ph-fill ph-check-circle text-xl"></i>
                  </div>
                  <div class="w-12 h-12 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center mb-1">
                    <i class="ph-fill ph-sun text-2xl text-amber-500"></i>
                  </div>
                  <div class="text-center">
                    <span class="font-bold text-slate-800 text-sm block">Mode Terang</span>
                    <span class="text-[11px] text-slate-500 mt-0.5 block">Tampilan cerah standar untuk lingkungan terang</span>
                  </div>
                </button>

                <!-- Mode Gelap -->
                <button 
                  type="button"
                  @click="!isDark ? toggleTheme() : null" 
                  class="border-2 rounded-xl p-5 flex flex-col items-center gap-3 transition-all relative text-left" 
                  :class="isDark ? 'border-emerald-500 bg-[#0f172a] shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'"
                >
                  <div v-if="isDark" class="absolute top-3 right-3 text-emerald-400">
                    <i class="ph-fill ph-check-circle text-xl"></i>
                  </div>
                  <div class="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-1">
                    <i class="ph-fill ph-moon text-2xl text-amber-300"></i>
                  </div>
                  <div class="text-center">
                    <span class="font-bold text-slate-700 text-sm block" :class="isDark ? 'text-slate-100' : ''">Mode Gelap</span>
                    <span class="text-[11px] text-slate-500 mt-0.5 block" :class="isDark ? 'text-slate-400' : ''">Kontras nyaman untuk pemantauan malam hari</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- TAB: PEMBERSIHAN (CRONJOB) -->
            <div v-if="activeSettingTab === 'cleanup'" class="animate-fade-in flex flex-col h-full">
              <!-- Warning Banner untuk Non-Admin -->
              <div v-if="!isAdmin" class="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-800 text-xs font-medium flex items-center gap-2">
                <i class="ph-bold ph-shield-warning text-base text-amber-600 shrink-0"></i>
                <span>Anda masuk dengan role <strong>{{ currentUser.role }}</strong>. Hanya role <strong>Admin</strong> yang berwenang mengubah jadwal cronjob atau memicu pembersihan data secara manual.</span>
              </div>

              <!-- Feedback Alert -->
              <div v-if="cleanupFeedback.message" class="mb-5 px-4 py-3 rounded-lg border text-xs font-semibold flex items-center justify-between" :class="cleanupFeedback.isError ? 'bg-rose-50 border-rose-200/60 text-rose-700' : 'bg-emerald-50 border-emerald-200/60 text-emerald-700'">
                <span class="flex items-center gap-2">
                  <i class="ph-bold" :class="cleanupFeedback.isError ? 'ph-warning-circle' : 'ph-check-circle'"></i>
                  {{ cleanupFeedback.message }}
                </span>
                <button @click="cleanupFeedback.message = ''" class="hover:opacity-75 transition">
                  <i class="ph-bold ph-x"></i>
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                <!-- CARD 1: LOG SISTEM -->
                <div class="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-sm">
                  <div>
                    <div class="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
                      <div>
                        <div class="flex items-center gap-2">
                          <i class="ph-bold ph-terminal-window text-slate-500 text-lg"></i>
                          <h4 class="text-base font-bold text-slate-900">Cronjob Log Sistem</h4>
                        </div>
                        <p class="text-xs text-slate-500 mt-1">Tabel <code class="text-slate-700 bg-slate-50 border border-slate-200 px-1 rounded">system_logs</code> (<span class="font-mono font-bold">{{ cleanupForm.system_logs.current_count }}</span> baris)</p>
                      </div>
                      <button 
                        type="button" 
                        :disabled="!isAdmin"
                        @click="cleanupForm.system_logs.is_enabled = !cleanupForm.system_logs.is_enabled" 
                        class="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider border transition shrink-0 disabled:opacity-50" 
                        :class="cleanupForm.system_logs.is_enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-slate-50 text-slate-500 border-slate-200'"
                      >
                        {{ cleanupForm.system_logs.is_enabled ? 'Aktif' : 'Nonaktif' }}
                      </button>
                    </div>
                    
                    <div class="mb-4">
                      <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Preset Interval Cepat</label>
                      <div class="grid grid-cols-4 gap-2">
                        <button 
                          type="button" 
                          :disabled="!isAdmin"
                          @click="applyPreset('system_logs', 1, 'HOURS')" 
                          class="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold text-slate-600 transition whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                          :class="cleanupForm.system_logs.interval_value === 1 && cleanupForm.system_logs.interval_unit === 'HOURS' ? 'border-slate-900 text-slate-900 bg-slate-50 font-bold' : ''"
                        >
                          1 Jam
                        </button>
                        <button 
                          type="button" 
                          :disabled="!isAdmin"
                          @click="applyPreset('system_logs', 24, 'HOURS')" 
                          class="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold text-slate-600 transition whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                          :class="cleanupForm.system_logs.interval_value === 24 && cleanupForm.system_logs.interval_unit === 'HOURS' ? 'border-slate-900 text-slate-900 bg-slate-50 font-bold' : ''"
                        >
                          24 Jam
                        </button>
                        <button 
                          type="button" 
                          :disabled="!isAdmin"
                          @click="applyPreset('system_logs', 7, 'DAYS')" 
                          class="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold text-slate-600 transition whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                          :class="cleanupForm.system_logs.interval_value === 7 && cleanupForm.system_logs.interval_unit === 'DAYS' ? 'border-slate-900 text-slate-900 bg-slate-50 font-bold' : ''"
                        >
                          7 Hari
                        </button>
                        <button 
                          type="button" 
                          :disabled="!isAdmin"
                          @click="applyPreset('system_logs', 30, 'DAYS')" 
                          class="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold text-slate-600 transition whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                          :class="cleanupForm.system_logs.interval_value === 30 && cleanupForm.system_logs.interval_unit === 'DAYS' ? 'border-slate-900 text-slate-900 bg-slate-50 font-bold' : ''"
                        >
                          30 Hari
                        </button>
                      </div>
                    </div>

                    <div class="mb-4">
                      <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Interval Kustom</label>
                      <div class="flex gap-2">
                        <input 
                          v-model.number="cleanupForm.system_logs.interval_value" 
                          type="number" 
                          min="1" 
                          :disabled="!isAdmin"
                          class="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 font-bold font-mono focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50" 
                        />
                        <select 
                          v-model="cleanupForm.system_logs.interval_unit" 
                          :disabled="!isAdmin"
                          class="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                        >
                          <option value="MINUTES">Menit Sekali</option>
                          <option value="HOURS">Jam Sekali</option>
                          <option value="DAYS">Hari Sekali</option>
                        </select>
                      </div>
                    </div>

                    <div class="mb-6">
                      <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Metode Pembersihan</label>
                      <select 
                        v-model="cleanupForm.system_logs.retention_mode" 
                        :disabled="!isAdmin"
                        class="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 font-medium focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                      >
                        <option value="OLDER_THAN">Hapus log lebih lama dari interval waktu</option>
                        <option value="ALL">Hapus seluruh log sistem (Reset Total)</option>
                      </select>
                    </div>
                  </div>

                  <div class="pt-4 border-t border-slate-100 space-y-3">
                    <div class="text-xs text-slate-500 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p class="flex justify-between items-center">
                        <span>Terakhir dieksekusi:</span> 
                        <span class="text-slate-700 font-semibold font-mono">{{ formatTime(cleanupForm.system_logs.last_run) }}</span>
                      </p>
                      <p class="flex justify-between items-center">
                        <span>Jadwal berikutnya:</span> 
                        <span class="font-semibold font-mono" :class="cleanupForm.system_logs.is_enabled ? 'text-emerald-700' : 'text-slate-400'">
                          {{ cleanupForm.system_logs.is_enabled ? formatTime(cleanupForm.system_logs.next_run) : 'Nonaktif' }}
                        </span>
                      </p>
                    </div>
                    <button 
                      type="button" 
                      @click="requestManualCleanup('system_logs')" 
                      :disabled="isRunningManual === 'system_logs' || !isAdmin" 
                      class="w-full py-2.5 px-3 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <i class="ph-bold" :class="isRunningManual === 'system_logs' ? 'ph-spinner animate-spin' : 'ph-trash'"></i>
                      Bersihkan Log Sistem Sekarang
                    </button>
                  </div>
                </div>

                <!-- CARD 2: RIWAYAT GANGGUAN -->
                <div class="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-sm">
                  <div>
                    <div class="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
                      <div>
                        <div class="flex items-center gap-2">
                          <i class="ph-bold ph-clock-counter-clockwise text-slate-500 text-lg"></i>
                          <h4 class="text-base font-bold text-slate-900">Cronjob Riwayat Gangguan</h4>
                        </div>
                        <p class="text-xs text-slate-500 mt-1">Tiket Selesai (<span class="font-mono font-bold">{{ cleanupForm.incident_history.current_count }}</span> riwayat)</p>
                      </div>
                      <button 
                        type="button" 
                        :disabled="!isAdmin"
                        @click="cleanupForm.incident_history.is_enabled = !cleanupForm.incident_history.is_enabled" 
                        class="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider border transition shrink-0 disabled:opacity-50" 
                        :class="cleanupForm.incident_history.is_enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-slate-50 text-slate-500 border-slate-200'"
                      >
                        {{ cleanupForm.incident_history.is_enabled ? 'Aktif' : 'Nonaktif' }}
                      </button>
                    </div>
                    
                    <div class="mb-4">
                      <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Preset Interval Cepat</label>
                      <div class="grid grid-cols-4 gap-2">
                        <button 
                          type="button" 
                          :disabled="!isAdmin"
                          @click="applyPreset('incident_history', 1, 'HOURS')" 
                          class="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold text-slate-600 transition whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                          :class="cleanupForm.incident_history.interval_value === 1 && cleanupForm.incident_history.interval_unit === 'HOURS' ? 'border-slate-900 text-slate-900 bg-slate-50 font-bold' : ''"
                        >
                          1 Jam
                        </button>
                        <button 
                          type="button" 
                          :disabled="!isAdmin"
                          @click="applyPreset('incident_history', 24, 'HOURS')" 
                          class="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold text-slate-600 transition whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                          :class="cleanupForm.incident_history.interval_value === 24 && cleanupForm.incident_history.interval_unit === 'HOURS' ? 'border-slate-900 text-slate-900 bg-slate-50 font-bold' : ''"
                        >
                          24 Jam
                        </button>
                        <button 
                          type="button" 
                          :disabled="!isAdmin"
                          @click="applyPreset('incident_history', 7, 'DAYS')" 
                          class="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold text-slate-600 transition whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                          :class="cleanupForm.incident_history.interval_value === 7 && cleanupForm.incident_history.interval_unit === 'DAYS' ? 'border-slate-900 text-slate-900 bg-slate-50 font-bold' : ''"
                        >
                          7 Hari
                        </button>
                        <button 
                          type="button" 
                          :disabled="!isAdmin"
                          @click="applyPreset('incident_history', 30, 'DAYS')" 
                          class="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold text-slate-600 transition whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                          :class="cleanupForm.incident_history.interval_value === 30 && cleanupForm.incident_history.interval_unit === 'DAYS' ? 'border-slate-900 text-slate-900 bg-slate-50 font-bold' : ''"
                        >
                          30 Hari
                        </button>
                      </div>
                    </div>

                    <div class="mb-4">
                      <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Interval Kustom</label>
                      <div class="flex gap-2">
                        <input 
                          v-model.number="cleanupForm.incident_history.interval_value" 
                          type="number" 
                          min="1" 
                          :disabled="!isAdmin"
                          class="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 font-bold font-mono focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50" 
                        />
                        <select 
                          v-model="cleanupForm.incident_history.interval_unit" 
                          :disabled="!isAdmin"
                          class="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                        >
                          <option value="MINUTES">Menit Sekali</option>
                          <option value="HOURS">Jam Sekali</option>
                          <option value="DAYS">Hari Sekali</option>
                        </select>
                      </div>
                    </div>

                    <div class="mb-6">
                      <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Metode Pembersihan</label>
                      <select 
                        v-model="cleanupForm.incident_history.retention_mode" 
                        :disabled="!isAdmin"
                        class="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 font-medium focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-50"
                      >
                        <option value="OLDER_THAN">Hapus tiket riwayat lebih lama dari interval waktu</option>
                        <option value="ALL">Hapus seluruh tiket riwayat selesai (Reset Total)</option>
                      </select>
                    </div>
                  </div>

                  <div class="pt-4 border-t border-slate-100 space-y-3">
                    <div class="text-xs text-slate-500 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p class="flex justify-between items-center">
                        <span>Terakhir dieksekusi:</span> 
                        <span class="text-slate-700 font-semibold font-mono">{{ formatTime(cleanupForm.incident_history.last_run) }}</span>
                      </p>
                      <p class="flex justify-between items-center">
                        <span>Jadwal berikutnya:</span> 
                        <span class="font-semibold font-mono" :class="cleanupForm.incident_history.is_enabled ? 'text-emerald-700' : 'text-slate-400'">
                          {{ cleanupForm.incident_history.is_enabled ? formatTime(cleanupForm.incident_history.next_run) : 'Nonaktif' }}
                        </span>
                      </p>
                    </div>
                    <button 
                      type="button" 
                      @click="requestManualCleanup('incident_history')" 
                      :disabled="isRunningManual === 'incident_history' || !isAdmin" 
                      class="w-full py-2.5 px-3 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <i class="ph-bold" :class="isRunningManual === 'incident_history' ? 'ph-spinner animate-spin' : 'ph-trash'"></i>
                      Bersihkan Riwayat Gangguan Sekarang
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB: SIMULASI PENGUJIAN -->
            <div v-if="activeSettingTab === 'simulation'" class="animate-fade-in space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
                <!-- Uji Notifikasi Biasa -->
                <div class="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 transition shadow-sm flex flex-col justify-between">
                  <div class="mb-6">
                    <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mb-4">
                      <i class="ph-fill ph-bell-ringing text-2xl"></i>
                    </div>
                    <h4 class="text-base font-bold text-slate-900 mb-2">Push Notification (FCM)</h4>
                    <p class="text-xs text-slate-500 leading-relaxed">Mensimulasikan insiden skala Warning yang mengirim pesan teks notifikasi ke aplikasi mobile seluruh teknisi aktif.</p>
                  </div>
                  <button 
                    @click="triggerSimulasi('Pesan')" 
                    :disabled="isTesting" 
                    class="w-full py-2.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg text-sm font-bold transition disabled:opacity-50 flex justify-center items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <i v-if="isTestingType === 'Pesan'" class="ph-bold ph-spinner animate-spin"></i>
                    <i v-else class="ph-bold ph-paper-plane-tilt"></i>
                    Kirim Pesan Uji Coba
                  </button>
                </div>

                <!-- Uji CallKit -->
                <div class="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 transition shadow-sm flex flex-col justify-between">
                  <div class="mb-6">
                    <div class="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center mb-4">
                      <i class="ph-fill ph-phone-call text-2xl"></i>
                    </div>
                    <h4 class="text-base font-bold text-slate-900 mb-2">Panggilan Darurat (CallKit)</h4>
                    <p class="text-xs text-slate-500 leading-relaxed">Mensimulasikan insiden skala CRITICAL/DOWN yang memicu layar panggilan penuh (VoIP) dengan dering prioritas tinggi.</p>
                  </div>
                  <button 
                    @click="triggerSimulasi('Call')" 
                    :disabled="isTesting" 
                    class="w-full py-2.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-sm font-bold transition disabled:opacity-50 flex justify-center items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <i v-if="isTestingType === 'Call'" class="ph-bold ph-spinner animate-spin"></i>
                    <i v-else class="ph-bold ph-phone"></i>
                    Picu Panggilan Darurat Uji Coba
                  </button>
                </div>
              </div>

              <!-- Hasil Pengujian Simulasi -->
              <div 
                v-if="testResult.text" 
                class="flex items-start gap-3 text-xs font-semibold px-4 py-3.5 rounded-xl border animate-fade-in max-w-3xl"
                :class="testResult.isError ? 'bg-rose-50 border-rose-200/60 text-rose-800' : (testResult.isLoading ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-emerald-50 border-emerald-200/60 text-emerald-800')"
              >
                <i class="text-lg mt-0.5 shrink-0" :class="testResult.isError ? 'ph-bold ph-warning-circle text-rose-600' : (testResult.isLoading ? 'ph-bold ph-spinner animate-spin text-slate-600' : 'ph-bold ph-check-circle text-emerald-600')"></i>
                <span class="break-words leading-relaxed">{{ testResult.text }}</span>
              </div>
            </div>

          </div>

          <!-- Footer Konten (Hanya tampil untuk tab Cleanup) -->
          <div v-if="activeSettingTab === 'cleanup'" class="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            <span class="text-xs text-slate-500 font-medium">
              Perubahan parameter akan segera diterapkan pada daemon monitoring.
            </span>
            <button 
              type="button" 
              @click="saveCleanupConfig" 
              :disabled="isSavingCleanup || !isAdmin" 
              class="px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <i class="ph-bold" :class="isSavingCleanup ? 'ph-spinner animate-spin' : 'ph-floppy-disk'"></i>
              {{ isSavingCleanup ? 'Menyimpan...' : 'Simpan Konfigurasi Cronjob' }}
            </button>
          </div>

        </div>
      </div>
    </div>
  </Teleport>

  <!-- Popup Semua Notifikasi Gangguan -->
  <Teleport to="body">
    <div 
      v-if="showModal" 
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" 
      @click.self="showModal = false"
    >
      <div class="bg-white border border-slate-200/80 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 bg-slate-50/50 border-b border-slate-200/80 rounded-t-2xl flex items-center justify-between shrink-0">
          <div>
            <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <i class="ph-bold ph-bell-ringing text-slate-700"></i>
              Semua Notifikasi & Riwayat Gangguan
            </h3>
            <p class="text-xs text-slate-500 font-medium mt-0.5">
              <span class="font-mono font-bold">{{ alerts.length }}</span> aktif &bull; <span class="font-mono font-bold">{{ history.length }}</span> riwayat selesai tercatat
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button 
              @click="activeTab === 'history' ? fetchHistory() : fetchAlerts(false)" 
              title="Segarkan Data"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200 bg-white"
            >
              <i class="ph-bold ph-arrows-clockwise text-sm" :class="{ 'animate-spin': isLoading }"></i>
            </button>
            <button 
              @click="showModal = false" 
              class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>
        </div>

        <div class="px-6 pt-3 border-b border-slate-200/80 flex gap-6 shrink-0 bg-white">
          <button 
            @click="setModalTab('active')" 
            class="pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2" 
            :class="activeTab === 'active' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'"
          >
            <i class="ph-bold ph-warning" :class="activeTab === 'active' ? 'text-rose-500' : ''"></i> 
            Gangguan Aktif 
            <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono" :class="activeTab === 'active' ? 'bg-rose-50 text-rose-700 border border-rose-200/60' : 'bg-slate-50 text-slate-500 border border-slate-200'">
              {{ alerts.length }}
            </span>
          </button>
          <button 
            @click="setModalTab('history')" 
            class="pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2" 
            :class="activeTab === 'history' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'"
          >
            <i class="ph-bold ph-check-circle" :class="activeTab === 'history' ? 'text-emerald-500' : ''"></i> 
            Riwayat Selesai 
            <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono" :class="activeTab === 'history' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-50 text-slate-500 border border-slate-200'">
              {{ history.length }}
            </span>
          </button>
        </div>

        <!-- Tab Aktif -->
        <div v-if="activeTab === 'active'" class="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
          <div v-if="alerts.length === 0" class="p-12 text-center text-sm text-slate-500 font-medium">
            <i class="ph-fill ph-check-circle text-3xl text-emerald-500 block mb-2"></i> 
            Tidak ada gangguan yang sedang aktif saat ini.
          </div>
          <div v-for="alert in alerts" :key="alert.id" class="px-6 py-4 flex items-start gap-4 hover:bg-slate-50/70 transition">
            <div class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center border" :class="severityStyle(alert.severity).icon">
              <i class="ph-bold text-lg" :class="severityStyle(alert.severity).iconClass"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <p class="text-sm font-bold text-slate-900 font-mono tracking-tight truncate">{{ alert.target_name }}</p>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider" :class="severityStyle(alert.severity).badge">{{ alert.severity }}</span>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-500 uppercase tracking-wider">{{ alert.target_type }}</span>
              </div>
              <p class="text-xs text-slate-600 font-medium break-words">{{ alert.message }}</p>
              <p class="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1 font-mono tracking-tight"><i class="ph ph-clock"></i> {{ formatTime(alert.created_at) }}</p>
            </div>
          </div>
        </div>

        <!-- Tab Riwayat -->
        <div v-else class="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
          <div v-if="history.length === 0" class="p-12 text-center text-sm text-slate-500 font-medium">
            <i class="ph ph-clock-counter-clockwise text-3xl block mb-2 text-slate-400"></i> 
            Belum ada data riwayat gangguan yang terselesaikan.
          </div>
          <div v-for="item in history" :key="item.id" class="px-6 py-4 flex items-start gap-4 hover:bg-slate-50/70 transition">
            <div class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600">
              <i class="ph-bold ph-check-circle text-lg"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <p class="text-sm font-bold text-slate-900 font-mono tracking-tight truncate">{{ item.target_name }}</p>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider" :class="severityStyle(item.original_severity || item.severity).badge">{{ item.original_severity || item.severity }}</span>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-500 uppercase tracking-wider">{{ item.target_type }}</span>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 uppercase tracking-wider">Selesai</span>
              </div>
              <p class="text-xs text-slate-600 font-medium break-words">{{ item.message }}</p>
              <div class="text-[11px] text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tracking-tight">
                <span class="flex items-center gap-1"><i class="ph ph-clock text-slate-400"></i> Mulai: {{ formatTime(item.created_at) }}</span>
                <span class="flex items-center gap-1"><i class="ph ph-check text-emerald-500"></i> Selesai: {{ formatTime(item.resolved_at) }}</span>
                <span class="flex items-center gap-1 text-slate-600 font-semibold"><i class="ph ph-timer text-slate-400"></i> Durasi: {{ formatDuration(item.created_at, item.resolved_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-200/80 rounded-b-2xl flex justify-between items-center shrink-0">
          <router-link to="/rekap-gangguan" @click="showModal = false" class="text-xs font-semibold text-slate-600 hover:text-slate-900 transition underline underline-offset-2 flex items-center gap-1">
            <i class="ph ph-arrow-square-out"></i> Buka Halaman Rekap Gangguan Lengkap
          </router-link>
          <button @click="showModal = false" class="px-5 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-xs font-semibold transition shadow-sm">
            Tutup
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Modal Konfirmasi Pembersihan Manual -->
  <Teleport to="body">
    <div 
      v-if="confirmCleanupModal.show" 
      class="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" 
      @click.self="confirmCleanupModal.show = false"
    >
      <div class="bg-white border border-slate-200/80 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden relative">
        <div class="p-6 pt-7">
          <div class="flex items-start gap-4">
            <div class="shrink-0 w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-600 mt-0.5">
              <i class="ph-bold ph-trash text-2xl"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900 mb-2">Konfirmasi Pembersihan Data</h3>
              <p class="text-xs text-slate-600 font-medium leading-relaxed">
                {{ confirmCleanupModal.message }}
              </p>
              <div class="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
                <p><strong>Target:</strong> {{ confirmCleanupModal.target === 'system_logs' ? 'Log Sistem (system_logs)' : 'Riwayat Gangguan (active_alerts)' }}</p>
                <p><strong>Metode:</strong> {{ confirmCleanupModal.mode === 'ALL' ? 'Hapus Seluruh Data (Reset Total)' : 'Hapus data lebih lama dari interval waktu' }}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-slate-50/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200/80">
          <button 
            type="button" 
            @click="confirmCleanupModal.show = false"
            class="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          >
            Batal
          </button>
          <button 
            type="button" 
            @click="executeManualCleanup"
            class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2"
          >
            <i class="ph-bold ph-trash"></i>
            <span>Ya, Bersihkan Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { parseUtcDate, formatWibDateTime } from '../../utils/datetime.js';
import { isDark, toggleTheme } from '../../utils/theme.js';

const route = useRoute();
const currentTime = ref('');
let timer = null;

// ==========================================
// BREADCRUMB METADATA HAPALAN RUTE
// ==========================================
const routeMetaMap = {
  'dashboard': { title: 'Dashboard', icon: 'ph-squares-four' },
  'kelola-pengguna': { title: 'Kelola Pengguna', icon: 'ph-users' },
  'target-monitoring': { title: 'Monitoring Target', icon: 'ph-graph' },
  'rekap-gangguan': { title: 'Rekap Gangguan', icon: 'ph-ticket' },
  'threshold-config': { title: 'Threshold Config', icon: 'ph-sliders' },
  'proxmox-config': { title: 'Proxmox API Config', icon: 'ph-hard-drives' },
  'Log': { title: 'Log Sistem', icon: 'ph-terminal' }
};

const currentRouteMeta = computed(() => {
  return routeMetaMap[route.name] || { title: 'Monitoring', icon: 'ph-monitor' };
});

// Update Digital Clock (WIB / Asia/Jakarta)
const updateClock = () => {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
  currentTime.value = `${time} WIB`;
};

// ==========================================
// USER AUTH & RBAC CHECK
// ==========================================
const currentUser = ref({ role: 'Admin' });
const isAdmin = computed(() => currentUser.value?.role === 'Admin');

const loadCurrentUser = () => {
  try {
    const raw = localStorage.getItem('userData');
    if (raw) {
      currentUser.value = JSON.parse(raw);
    }
  } catch (e) {
    currentUser.value = { role: 'Admin' };
  }
};

// ==========================================
// MASTER PENGATURAN (SETTINGS) STATE
// ==========================================
const showSettingsModal = ref(false);
const activeSettingTab = ref('appearance'); // Opsi: appearance, cleanup, simulation

const setSettingTab = (tab) => {
  activeSettingTab.value = tab;
  if (tab === 'cleanup') {
    cleanupFeedback.value = { message: '', isError: false };
    fetchCleanupConfig();
  } else if (tab === 'simulation') {
    testResult.value = { text: '', isError: false, isLoading: false };
    isTesting.value = false;
    isTestingType.value = '';
  }
};

const openSettingsModal = (tab = 'appearance') => {
  showDropdown.value = false;
  setSettingTab(tab);
  showSettingsModal.value = true;
};

// ==========================================
// PENGATURAN CRONJOB PEMBERSIHAN OTOMATIS
// ==========================================
const isSavingCleanup = ref(false);
const isRunningManual = ref('');
const cleanupFeedback = ref({ message: '', isError: false });

const confirmCleanupModal = ref({
  show: false,
  target: '',
  mode: '',
  message: ''
});

const cleanupForm = ref({
  system_logs: {
    is_enabled: true, interval_value: 7, interval_unit: 'DAYS', retention_mode: 'OLDER_THAN', last_run: null, next_run: null, last_deleted_count: 0, current_count: 0
  },
  incident_history: {
    is_enabled: true, interval_value: 30, interval_unit: 'DAYS', retention_mode: 'OLDER_THAN', last_run: null, next_run: null, last_deleted_count: 0, current_count: 0
  }
});

const fetchCleanupConfig = async () => {
  try {
    const res = await fetch('/api/settings/cleanup');
    const json = await res.json();
    if (json.success && json.data) {
      cleanupForm.value = {
        system_logs: { ...cleanupForm.value.system_logs, ...json.data.system_logs },
        incident_history: { ...cleanupForm.value.incident_history, ...json.data.incident_history }
      };
    } else if (res.status === 403) {
      cleanupFeedback.value = { message: 'Akses ditolak: Hanya role Admin yang dapat melihat konfigurasi pembersihan.', isError: true };
    }
  } catch (err) {
    console.error('Gagal memuat konfigurasi cronjob:', err);
  }
};

const applyPreset = (targetKey, val, unit) => {
  if (!cleanupForm.value[targetKey] || !isAdmin.value) return;
  cleanupForm.value[targetKey].interval_value = val;
  cleanupForm.value[targetKey].interval_unit = unit;
};

const saveCleanupConfig = async () => {
  if (!isAdmin.value) {
    cleanupFeedback.value = { message: 'Akses ditolak: Hanya Admin yang dapat menyimpan konfigurasi.', isError: true };
    return;
  }
  isSavingCleanup.value = true;
  cleanupFeedback.value = { message: '', isError: false };
  try {
    const payload = {
      system_logs: {
        ...cleanupForm.value.system_logs,
        interval_value: Math.max(1, Math.floor(Number(cleanupForm.value.system_logs.interval_value) || 1))
      },
      incident_history: {
        ...cleanupForm.value.incident_history,
        interval_value: Math.max(1, Math.floor(Number(cleanupForm.value.incident_history.interval_value) || 1))
      }
    };

    const res = await fetch('/api/settings/cleanup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menyimpan pengaturan');
    await fetchCleanupConfig();
    cleanupFeedback.value = { message: json.message || 'Pengaturan cronjob berhasil disimpan.', isError: false };
  } catch (err) {
    cleanupFeedback.value = { message: err.message || 'Gagal menyimpan pengaturan cronjob.', isError: true };
  } finally {
    isSavingCleanup.value = false;
  }
};

const requestManualCleanup = (targetKey) => {
  if (!isAdmin.value || isRunningManual.value) return;
  const targetName = targetKey === 'system_logs' ? 'Log Sistem' : 'Riwayat Gangguan';
  const mode = cleanupForm.value[targetKey]?.retention_mode || 'OLDER_THAN';
  const modeText = mode === 'ALL' ? 'menghapus SELURUH data' : `menghapus data lebih lama dari ${cleanupForm.value[targetKey].interval_value} ${cleanupForm.value[targetKey].interval_unit}`;
  
  confirmCleanupModal.value = {
    show: true,
    target: targetKey,
    mode: mode,
    message: `Tindakan ini akan segera ${modeText} pada tabel ${targetName}. Apakah Anda yakin ingin melanjutkan?`
  };
};

const executeManualCleanup = async () => {
  const targetKey = confirmCleanupModal.value.target;
  const mode = confirmCleanupModal.value.mode;
  confirmCleanupModal.value.show = false;

  if (!targetKey || isRunningManual.value) return;
  isRunningManual.value = targetKey;
  cleanupFeedback.value = { message: '', isError: false };

  try {
    const res = await fetch('/api/settings/cleanup/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: targetKey, mode })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menjalankan pembersihan');
    await fetchCleanupConfig();
    if (showModal.value) fetchHistory();
    cleanupFeedback.value = { message: json.message || 'Pembersihan manual berhasil dijalankan.', isError: false };
  } catch (err) {
    cleanupFeedback.value = { message: err.message || 'Gagal menjalankan pembersihan manual.', isError: true };
  } finally {
    isRunningManual.value = '';
  }
};

// ==========================================
// SIMULASI ALARM (FCM & CALLKIT)
// ==========================================
const isTesting = ref(false);
const isTestingType = ref('');
const testResult = ref({ text: '', isError: false, isLoading: false });

const triggerSimulasi = async (type) => {
  isTesting.value = true;
  isTestingType.value = type;
  testResult.value = { text: 'Sedang menghubungi server dan mengirim muatan sinyal...', isError: false, isLoading: true };
  
  try {
    const res = await fetch('/api/auth/simulate-fcm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type: type })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      testResult.value = { text: data.message || `Simulasi ${type} berhasil dikirim ke perangkat teknisi.`, isError: false, isLoading: false };
    } else {
      testResult.value = { text: data.message || 'Simulasi gagal dikirim oleh server.', isError: true, isLoading: false };
    }
  } catch (err) {
    testResult.value = { text: 'Terjadi kesalahan jaringan saat mengirim instruksi simulasi ke server.', isError: true, isLoading: false };
  } finally {
    isTesting.value = false;
    isTestingType.value = '';
  }
};

// ==========================================
// NOTIFIKASI GANGGUAN (REALTIME AUTO-REFRESH)
// ==========================================
const alerts = ref([]);
const history = ref([]);
const activeTab = ref('active');
const isLoading = ref(false);
const showDropdown = ref(false);
const showModal = ref(false);
const notifWrapper = ref(null);
let alertTimer = null;

const fetchAlerts = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await fetch('/api/alerts/active');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      alerts.value = json.data;
    }
  } catch (err) {
    console.error('Gagal memuat notifikasi:', err);
  } finally {
    if (!silent) isLoading.value = false;
  }
};

const fetchHistory = async () => {
  try {
    const res = await fetch('/api/alerts/history');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      history.value = json.data;
    }
  } catch (err) {
    console.error('Gagal memuat riwayat gangguan:', err);
  }
};

const pollRealtimeNotifications = () => {
  fetchAlerts(true);
  if (showModal.value && activeTab.value === 'history') {
    fetchHistory();
  }
};

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
  if (showDropdown.value) fetchAlerts(true);
};

const openAllModal = (tab = 'active') => {
  showDropdown.value = false;
  showModal.value = true;
  setModalTab(tab);
};

const setModalTab = (tab) => {
  activeTab.value = tab;
  if (tab === 'history') {
    fetchHistory();
  } else {
    fetchAlerts(true);
  }
};

const formatDuration = (start, end) => {
  if (!start || !end) return '-';
  const startD = parseUtcDate(start);
  const endD = parseUtcDate(end);
  if (!startD || !endD) return '-';
  const diffMin = Math.max(0, Math.round((endD - startD) / 60000));
  if (diffMin < 1) return '< 1 menit';
  const d = Math.floor(diffMin / 1440);
  const h = Math.floor((diffMin % 1440) / 60);
  const m = diffMin % 60;
  return [d && `${d} hari`, h && `${h} jam`, m && `${m} menit`].filter(Boolean).join(' ');
};

const severityStyle = (severity) => {
  switch (severity) {
    case 'DOWN': 
      return { icon: 'bg-rose-50 border-rose-100 text-rose-600', iconClass: 'ph-warning-octagon', badge: 'bg-rose-50 text-rose-700 border-rose-200/60' };
    case 'CRITICAL': 
      return { icon: 'bg-orange-50 border-orange-100 text-orange-600', iconClass: 'ph-warning', badge: 'bg-orange-50 text-orange-700 border-orange-200/60' };
    case 'RECOVERED': 
      return { icon: 'bg-emerald-50 border-emerald-100 text-emerald-600', iconClass: 'ph-arrows-clockwise', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };
    default: 
      return { icon: 'bg-amber-50 border-amber-100 text-amber-600', iconClass: 'ph-warning-circle', badge: 'bg-amber-50 text-amber-700 border-amber-200/60' };
  }
};

const formatTime = (value) => {
  if (!value) return '-';
  const formatted = formatWibDateTime(value, false);
  return formatted === '-' ? '-' : formatted + ' WIB';
};

const handleClickOutside = (e) => {
  if (showDropdown.value && notifWrapper.value && !notifWrapper.value.contains(e.target)) {
    showDropdown.value = false;
  }
};

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    showDropdown.value = false;
    showSettingsModal.value = false;
    showModal.value = false;
    confirmCleanupModal.value.show = false;
  }
};

onMounted(() => {
  loadCurrentUser();
  updateClock();
  timer = setInterval(updateClock, 1000);
  fetchAlerts(false);
  alertTimer = setInterval(pollRealtimeNotifications, 3000);
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (alertTimer) clearInterval(alertTimer);
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.animate-spin-slow {
  animation: spin 3s linear infinite;
}
.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
