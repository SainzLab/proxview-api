<template>
  <header class="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-8 sticky top-0 z-40 font-sans shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
    <!-- Breadcrumb & Jam Digital -->
    <div class="text-xs font-semibold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
      <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-slate-700 tracking-wider">
        <i class="ph-fill ph-clock text-slate-400 text-sm"></i>
        <!-- Waktu menggunakan font-mono -->
        <span class="font-mono text-[11px] font-bold tracking-tight">{{ currentTime }}</span>
      </div>
    </div>

    <!-- Aksi Kanan Atas: Toggle Tema, Notifikasi, Pengaturan Cronjob & Simulasi Alarm -->
    <div class="flex items-center gap-2.5">
      <!-- Tombol Simulasi Alarm -->
       <button
        @click="openSimulateModal"
        title="Simulasi Alarm (Call/Pesan)"
        class="w-9 h-9 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-50 hover:text-slate-900 border border-slate-200 transition relative shadow-sm"
        :class="showSimulateModal ? 'bg-slate-50 text-slate-900 border-slate-300' : ''"
      >
        <i class="ph ph-flask text-lg"></i>
      </button>
      
      <!-- Tombol Toggle Mode Gelap / Terang -->
      <button @click="toggleTheme" :title="isDark ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'" class="w-9 h-9 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-50 hover:text-slate-900 border border-slate-200 transition relative shadow-sm" >
        <i v-if="isDark" class="ph-fill ph-sun text-lg text-amber-400"></i>
        <i v-else class="ph ph-moon text-lg"></i>
      </button>

      <!-- Tombol Notifikasi + Dropdown -->
      <div class="relative" ref="notifWrapper">
        <button @click.stop="toggleDropdown" class="w-9 h-9 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-50 hover:text-slate-900 border border-slate-200 transition relative shadow-sm" :class="showDropdown ? 'bg-slate-50 text-slate-900' : ''" >
          <i class="ph ph-bell text-lg" :class="alerts.length > 0 ? 'animate-pulse text-rose-500' : ''"></i>
          <span v-if="alerts.length > 0" class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-rose-500 text-white text-[9px] font-bold font-mono tracking-tight rounded-full border border-white" >
            {{ alerts.length > 99 ? '99+' : alerts.length }}
          </span>
        </button>

        <!-- Dropdown -->
        <div v-if="showDropdown" @click.stop class="absolute right-0 mt-3 w-96 bg-white border border-slate-200/80 rounded-xl shadow-lg overflow-hidden z-50 animate-fade-in">
          <div class="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <h4 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i class="ph-bold ph-bell-ringing text-slate-500"></i> Notifikasi Gangguan
            </h4>
            <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-white px-1.5 py-0.5 rounded border border-slate-200">{{ alerts.length }} aktif</span>
          </div>

          <!-- Maksimal 4 item terlihat, sisanya bisa di-scroll (4 x 72px) -->
          <div class="max-h-[288px] overflow-y-auto divide-y divide-slate-100">
            <div v-if="isLoading && alerts.length === 0" class="p-8 text-center text-slate-500">
              <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
              <p class="text-xs font-medium">Memuat notifikasi...</p>
            </div>
            <div v-else-if="alerts.length === 0" class="p-6 text-center text-xs text-slate-500 font-medium">
              <i class="ph ph-check-circle text-2xl text-emerald-500 block mb-1"></i> Tidak ada gangguan aktif
            </div>
            <div v-else v-for="alert in alerts" :key="alert.id" class="h-[72px] px-4 flex items-center gap-3 hover:bg-slate-50 transition">
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
          <button @click="openAllModal" class="w-full px-4 py-3 bg-slate-50/50 border-t border-slate-100 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition flex items-center justify-center gap-1.5">
            Lihat Semua <i class="ph-bold ph-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Tombol Pengaturan Cronjob Pembersihan Otomatis -->
      <button @click.stop="openCleanupModal" title="Pengaturan Cronjob Pembersihan Log & Riwayat Gangguan" class="w-9 h-9 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-50 hover:text-slate-900 border border-slate-200 transition relative shadow-sm" :class="showCleanupModal ? 'bg-slate-50 text-slate-900 border-slate-300' : ''" >
        <i class="ph ph-gear text-lg"></i>
      </button>
    </div>
  </header>

  <!-- Popup Pengaturan Cronjob Pembersihan Otomatis -->
  <Teleport to="body">
    <div v-if="showCleanupModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="showCleanupModal = false">
      <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <!-- Modal Header -->
        <div class="px-6 py-4 bg-slate-50/50 border-b border-slate-200/80 rounded-t-2xl flex items-center justify-between shrink-0">
          <div>
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i class="ph-bold ph-gear text-slate-500"></i> Pengaturan Cronjob Pembersihan Otomatis
            </h3>
            <p class="text-xs text-slate-500 font-medium mt-0.5">Konfigurasi interval penghapusan otomatis secara terpisah untuk Log Sistem dan Riwayat Gangguan.</p>
          </div>
          <button @click="showCleanupModal = false" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <i class="ph-bold ph-x text-lg"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 overflow-y-auto flex-1 space-y-5">
          <!-- Feedback Alert -->
          <div v-if="cleanupFeedback.message" class="px-4 py-3 rounded-lg border text-xs font-semibold flex items-center justify-between" :class="cleanupFeedback.isError ? 'bg-rose-50 border-rose-200/60 text-rose-700' : 'bg-emerald-50 border-emerald-200/60 text-emerald-700'">
            <span class="flex items-center gap-2">
              <i class="ph-bold" :class="cleanupFeedback.isError ? 'ph-warning-circle' : 'ph-check-circle'"></i> {{ cleanupFeedback.message }}
            </span>
            <button @click="cleanupFeedback.message = ''" class="hover:opacity-75 transition">
              <i class="ph-bold ph-x"></i>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- CARD 1: PEMBERSIHAN LOG SISTEM -->
            <div class="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div>
                <div class="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <div class="flex items-center gap-2">
                      <i class="ph-bold ph-terminal-window text-slate-500 text-base"></i>
                      <h4 class="text-sm font-bold text-slate-900">Cronjob Log Sistem</h4>
                    </div>
                    <p class="text-[11px] text-slate-500 mt-0.5">Tabel <code class="text-slate-700 bg-slate-50 border border-slate-200 px-1 rounded">system_logs</code> (<span class="font-mono font-bold">{{ cleanupForm.system_logs.current_count }}</span> baris)</p>
                  </div>
                  <button type="button" @click="cleanupForm.system_logs.is_enabled = !cleanupForm.system_logs.is_enabled" class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border transition" :class="cleanupForm.system_logs.is_enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-slate-50 text-slate-500 border-slate-200'" >
                    {{ cleanupForm.system_logs.is_enabled ? 'Aktif' : 'Nonaktif' }}
                  </button>
                </div>

                <!-- Pilihan Cepat Interval Log -->
                <div class="mb-3">
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Preset Interval Cepat</label>
                  <div class="grid grid-cols-4 gap-1.5">
                    <button type="button" @click="applyPreset('system_logs', 1, 'HOURS')" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-600 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">1 Jam</button>
                    <button type="button" @click="applyPreset('system_logs', 24, 'HOURS')" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-600 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">24 Jam</button>
                    <button type="button" @click="applyPreset('system_logs', 7, 'DAYS')" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-600 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">7 Hari</button>
                    <button type="button" @click="applyPreset('system_logs', 30, 'DAYS')" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-600 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">30 Hari</button>
                  </div>
                </div>

                <!-- Input Interval Kustom Log -->
                <div class="mb-3">
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Interval Penghapusan Otomatis</label>
                  <div class="flex gap-2">
                    <input v-model.number="cleanupForm.system_logs.interval_value" type="number" min="1" class="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 font-bold font-mono focus:outline-none focus:border-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)]" />
                    <select v-model="cleanupForm.system_logs.interval_unit" class="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:border-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer">
                      <option value="MINUTES">Menit Sekali</option>
                      <option value="HOURS">Jam Sekali</option>
                      <option value="DAYS">Hari Sekali</option>
                    </select>
                  </div>
                </div>

                <!-- Mode Cakupan Penghapusan Log -->
                <div class="mb-4">
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Metode Pembersihan Saat Cron Jalan</label>
                  <select v-model="cleanupForm.system_logs.retention_mode" class="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer">
                    <option value="OLDER_THAN">Hapus log yang lebih lama dari interval</option>
                    <option value="ALL">Hapus seluruh log setiap interval tercapai</option>
                  </select>
                </div>
              </div>

              <!-- Info Jadwal & Tombol Manual Log -->
              <div class="pt-3 border-t border-slate-100 space-y-2.5">
                <div class="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <p class="flex justify-between"><span>Terakhir jalan:</span> <span class="text-slate-700 font-semibold font-mono tracking-tight">{{ formatTime(cleanupForm.system_logs.last_run) }}</span></p>
                  <p class="flex justify-between"><span>Jadwal berikutnya:</span> <span class="font-semibold font-mono tracking-tight" :class="cleanupForm.system_logs.is_enabled ? 'text-slate-900' : 'text-slate-400'">{{ cleanupForm.system_logs.is_enabled ? formatTime(cleanupForm.system_logs.next_run) : 'Nonaktif' }}</span></p>
                </div>
                <button type="button" @click="triggerManualCleanup('system_logs')" :disabled="isRunningManual === 'system_logs'" class="w-full py-2 px-3 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]" >
                  <i class="ph-bold" :class="isRunningManual === 'system_logs' ? 'ph-spinner animate-spin' : 'ph-trash'"></i>
                  {{ isRunningManual === 'system_logs' ? 'Membersihkan Log...' : 'Bersihkan Seluruh Log Sekarang' }}
                </button>
              </div>
            </div>

            <!-- CARD 2: PEMBERSIHAN RIWAYAT GANGGUAN -->
            <div class="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div>
                <div class="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <div class="flex items-center gap-2">
                      <i class="ph-bold ph-clock-counter-clockwise text-slate-500 text-base"></i>
                      <h4 class="text-sm font-bold text-slate-900">Cronjob Riwayat Gangguan</h4>
                    </div>
                    <p class="text-[11px] text-slate-500 mt-0.5">Tiket Selesai &amp; Down History (<span class="font-mono font-bold">{{ cleanupForm.incident_history.current_count }}</span> riwayat)</p>
                  </div>
                  <button type="button" @click="cleanupForm.incident_history.is_enabled = !cleanupForm.incident_history.is_enabled" class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border transition" :class="cleanupForm.incident_history.is_enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-slate-50 text-slate-500 border-slate-200'" >
                    {{ cleanupForm.incident_history.is_enabled ? 'Aktif' : 'Nonaktif' }}
                  </button>
                </div>

                <!-- Pilihan Cepat Interval Riwayat -->
                <div class="mb-3">
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Preset Interval Cepat</label>
                  <div class="grid grid-cols-4 gap-1.5">
                    <button type="button" @click="applyPreset('incident_history', 1, 'HOURS')" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-600 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">1 Jam</button>
                    <button type="button" @click="applyPreset('incident_history', 24, 'HOURS')" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-600 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">24 Jam</button>
                    <button type="button" @click="applyPreset('incident_history', 7, 'DAYS')" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-600 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">7 Hari</button>
                    <button type="button" @click="applyPreset('incident_history', 30, 'DAYS')" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-600 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">30 Hari</button>
                  </div>
                </div>

                <!-- Input Interval Kustom Riwayat -->
                <div class="mb-3">
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Interval Penghapusan Otomatis</label>
                  <div class="flex gap-2">
                    <input v-model.number="cleanupForm.incident_history.interval_value" type="number" min="1" class="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 font-bold font-mono focus:outline-none focus:border-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)]" />
                    <select v-model="cleanupForm.incident_history.interval_unit" class="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:border-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer">
                      <option value="MINUTES">Menit Sekali</option>
                      <option value="HOURS">Jam Sekali</option>
                      <option value="DAYS">Hari Sekali</option>
                    </select>
                  </div>
                </div>

                <!-- Mode Cakupan Penghapusan Riwayat -->
                <div class="mb-4">
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Metode Pembersihan Saat Cron Jalan</label>
                  <select v-model="cleanupForm.incident_history.retention_mode" class="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer">
                    <option value="OLDER_THAN">Hapus riwayat selesai yang lebih lama dari interval</option>
                    <option value="ALL">Hapus seluruh riwayat selesai setiap interval tercapai</option>
                  </select>
                  <p class="text-[10px] text-slate-500 mt-1.5 font-medium">Gangguan yang masih aktif tidak akan dihapus oleh cronjob.</p>
                </div>
              </div>

              <!-- Info Jadwal & Tombol Manual Riwayat -->
              <div class="pt-3 border-t border-slate-100 space-y-2.5">
                <div class="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <p class="flex justify-between"><span>Terakhir jalan:</span> <span class="text-slate-700 font-semibold font-mono tracking-tight">{{ formatTime(cleanupForm.incident_history.last_run) }}</span></p>
                  <p class="flex justify-between"><span>Jadwal berikutnya:</span> <span class="font-semibold font-mono tracking-tight" :class="cleanupForm.incident_history.is_enabled ? 'text-slate-900' : 'text-slate-400'">{{ cleanupForm.incident_history.is_enabled ? formatTime(cleanupForm.incident_history.next_run) : 'Nonaktif' }}</span></p>
                </div>
                <button type="button" @click="triggerManualCleanup('incident_history')" :disabled="isRunningManual === 'incident_history'" class="w-full py-2 px-3 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]" >
                  <i class="ph-bold" :class="isRunningManual === 'incident_history' ? 'ph-spinner animate-spin' : 'ph-trash'"></i>
                  {{ isRunningManual === 'incident_history' ? 'Membersihkan Riwayat...' : 'Bersihkan Riwayat Selesai Sekarang' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-200/80 rounded-b-2xl flex justify-end items-center gap-3 shrink-0">
          <button type="button" @click="showCleanupModal = false" class="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-xs font-semibold transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]" >
            Tutup
          </button>
          <button type="button" @click="saveCleanupConfig" :disabled="isSavingCleanup" class="px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]" >
            <i class="ph-bold" :class="isSavingCleanup ? 'ph-spinner animate-spin' : 'ph-floppy-disk'"></i>
            {{ isSavingCleanup ? 'Menyimpan...' : 'Simpan Pengaturan Cronjob' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Popup Semua Notifikasi -->
  <Teleport to="body">
    <div v-if="showModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="showModal = false">
      <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div class="px-6 py-4 bg-slate-50/50 border-b border-slate-200/80 rounded-t-2xl flex items-center justify-between shrink-0">
          <div>
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i class="ph-bold ph-warning text-rose-500"></i> Semua Notifikasi Gangguan
            </h3>
            <p class="text-xs text-slate-500 font-medium mt-0.5"><span class="font-mono font-bold">{{ alerts.length }}</span> aktif &bull; <span class="font-mono font-bold">{{ history.length }}</span> riwayat selesai</p>
          </div>
          <button @click="showModal = false" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <i class="ph-bold ph-x text-lg"></i>
          </button>
        </div>

        <!-- Tab: Gangguan Aktif / Riwayat Selesai -->
        <div class="px-6 pt-3 border-b border-slate-200/80 flex gap-6 shrink-0 bg-white">
          <button @click="activeTab = 'active'" class="pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2" :class="activeTab === 'active' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'" >
            <i class="ph-bold ph-warning" :class="activeTab === 'active' ? 'text-rose-500' : ''"></i> Gangguan Aktif
            <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono" :class="activeTab === 'active' ? 'bg-rose-50 text-rose-700 border border-rose-200/60' : 'bg-slate-50 text-slate-500 border border-slate-200'">{{ alerts.length }}</span>
          </button>
          <button @click="activeTab = 'history'" class="pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2" :class="activeTab === 'history' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'" >
            <i class="ph-bold ph-check-circle" :class="activeTab === 'history' ? 'text-emerald-500' : ''"></i> Riwayat Selesai
            <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono" :class="activeTab === 'history' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-50 text-slate-500 border border-slate-200'">{{ history.length }}</span>
          </button>
        </div>

        <!-- Tab Gangguan Aktif -->
        <div v-if="activeTab === 'active'" class="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
          <div v-if="alerts.length === 0" class="p-10 text-center text-sm text-slate-500 font-medium">
            <i class="ph ph-check-circle text-3xl text-emerald-500 block mb-2"></i> Tidak ada gangguan aktif
          </div>
          <div v-for="alert in alerts" :key="alert.id" class="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition">
            <div class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center border" :class="severityStyle(alert.severity).icon">
              <i class="ph-bold text-lg" :class="severityStyle(alert.severity).iconClass"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <p class="text-sm font-bold text-slate-900 font-mono tracking-tight truncate">{{ alert.target_name }}</p>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider" :class="severityStyle(alert.severity).badge">
                  {{ alert.severity }}
                </span>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-500 uppercase tracking-wider">{{ alert.target_type }}</span>
              </div>
              <p class="text-xs text-slate-600 font-medium break-words">{{ alert.message }}</p>
              <p class="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1 font-mono tracking-tight">
                <i class="ph ph-clock"></i> {{ formatTime(alert.created_at) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Tab Riwayat Gangguan Selesai -->
        <div v-else class="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
          <div v-if="history.length === 0" class="p-10 text-center text-sm text-slate-500 font-medium">
            <i class="ph ph-clock-counter-clockwise text-3xl block mb-2 text-slate-400"></i> Belum ada riwayat gangguan yang selesai
          </div>
          <div v-for="item in history" :key="item.id" class="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition">
            <div class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600">
              <i class="ph-bold ph-check-circle text-lg"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <p class="text-sm font-bold text-slate-900 font-mono tracking-tight truncate">{{ item.target_name }}</p>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider" :class="severityStyle(item.original_severity || item.severity).badge">
                  {{ item.original_severity || item.severity }}
                </span>
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

        <!-- Modal Footer (All Notif) -->
        <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-200/80 rounded-b-2xl flex justify-between items-center shrink-0">
          <router-link to="/rekap-gangguan" @click="showModal = false" class="text-xs font-semibold text-slate-600 hover:text-slate-900 transition underline underline-offset-2">
            Buka Rekap Gangguan
          </router-link>
          <button @click="showModal = false" class="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-xs font-semibold transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            Tutup
          </button>
        </div>
      </div>
    </div>
  </Teleport>

   <!-- Popup Simulasi Alarm (Call/Pesan) -->
  <Teleport to="body">
    <div v-if="showSimulateModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="showSimulateModal = false">
      <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
        <!-- Header -->
        <div class="px-6 py-4 bg-slate-50/50 border-b border-slate-200/80 flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <i class="ph-bold ph-flask text-indigo-500"></i> Simulasi Alarm
          </h3>
          <button @click="showSimulateModal = false" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <i class="ph-bold ph-x text-lg"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6">
          <p class="text-[13px] text-slate-600 mb-5 leading-relaxed">
            Gunakan panel ini untuk menguji notifikasi <span class="font-bold">Pesan (Warning)</span> atau panggilan darurat <span class="font-bold">CallKit (Down)</span> ke perangkat teknisi tanpa membuat tiket palsu di database.
          </p>

          <div class="flex gap-4">
             <button 
                @click="triggerSimulasi('Pesan')" 
                :disabled="isTesting"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                <i v-if="isTestingType === 'Pesan'" class="ph-bold ph-spinner animate-spin text-lg"></i>
                <i v-else class="ph-bold ph-bell-ringing text-lg"></i> 
                Uji Notifikasi
              </button>
              
              <button 
                @click="triggerSimulasi('Call')" 
                :disabled="isTesting"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                <i v-if="isTestingType === 'Call'" class="ph-bold ph-spinner animate-spin text-lg"></i>
                <i v-else class="ph-bold ph-phone-call text-lg"></i> 
                Uji CallKit
              </button>
          </div>

          <div v-if="testResult" class="mt-4 flex items-start gap-2 text-[13px] font-medium text-slate-700 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 animate-fade-in">
             <i class="ph-bold ph-info text-indigo-500 mt-0.5 shrink-0 text-base"></i> 
             <span class="break-words">{{ testResult }}</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-200/80 flex justify-end">
          <button @click="showSimulateModal = false" class="px-5 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-xs font-semibold transition">
            Tutup
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { parseUtcDate, formatWibDateTime } from '../../utils/datetime.js';
import { isDark, toggleTheme } from '../../utils/theme.js';

const currentTime = ref('');
let timer = null;

const updateClock = () => {
  // Selalu pakai zona waktu Asia/Jakarta, tidak bergantung zona waktu perangkat
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
// PENGATURAN CRONJOB PEMBERSIHAN OTOMATIS
// ==========================================
const showCleanupModal = ref(false);
const isSavingCleanup = ref(false);
const isRunningManual = ref('');
const cleanupFeedback = ref({ message: '', isError: false });

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
    }
  } catch (err) {
    console.error('Gagal memuat konfigurasi cronjob:', err);
  }
};

const openCleanupModal = () => {
  showDropdown.value = false;
  cleanupFeedback.value = { message: '', isError: false };
  showCleanupModal.value = true;
  fetchCleanupConfig();
};

const applyPreset = (targetKey, val, unit) => {
  if (!cleanupForm.value[targetKey]) return;
  cleanupForm.value[targetKey].interval_value = val;
  cleanupForm.value[targetKey].interval_unit = unit;
};

const saveCleanupConfig = async () => {
  isSavingCleanup.value = true;
  cleanupFeedback.value = { message: '', isError: false };
  try {
    const res = await fetch('/api/settings/cleanup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_logs: cleanupForm.value.system_logs,
        incident_history: cleanupForm.value.incident_history
      })
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

const triggerManualCleanup = async (targetKey) => {
  if (isRunningManual.value) return;
  isRunningManual.value = targetKey;
  cleanupFeedback.value = { message: '', isError: false };
  
  try {
    const res = await fetch('/api/settings/cleanup/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: targetKey, mode: 'ALL' })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menjalankan pembersihan');
    
    await fetchCleanupConfig();
    fetchHistory();
    cleanupFeedback.value = { message: json.message, isError: false };
  } catch (err) {
    cleanupFeedback.value = { message: err.message || 'Gagal menjalankan pembersihan manual.', isError: true };
  } finally {
    isRunningManual.value = '';
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
    if (json.success) alerts.value = json.data;
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
    if (json.success) history.value = json.data;
  } catch (err) {
    console.error('Gagal memuat riwayat gangguan:', err);
  }
};

const pollRealtimeNotifications = () => {
  fetchAlerts(true);
  if (showModal.value) {
    fetchHistory();
  }
};

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
  if (showDropdown.value) fetchAlerts(true);
};

const openAllModal = () => {
  showDropdown.value = false;
  showModal.value = true;
  activeTab.value = 'active';
  fetchAlerts(true);
  fetchHistory();
};

const formatDuration = (start, end) => {
  if (!start || !end) return '-';
  const diffMin = Math.max(0, Math.round((parseUtcDate(end) - parseUtcDate(start)) / 60000));
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
      return { icon: 'bg-blue-50 border-blue-100 text-blue-600', iconClass: 'ph-arrows-clockwise', badge: 'bg-blue-50 text-blue-700 border-blue-200/60' };
    default:
      return { icon: 'bg-amber-50 border-amber-100 text-amber-600', iconClass: 'ph-warning-circle', badge: 'bg-amber-50 text-amber-700 border-amber-200/60' };
  }
};

const formatTime = (value) => {
  if (!value) return '-';
  return formatWibDateTime(value, false) + ' WIB';
};

// Tutup dropdown saat klik di luar
const handleClickOutside = (e) => {
  if (showDropdown.value && notifWrapper.value && !notifWrapper.value.contains(e.target)) {
    showDropdown.value = false;
  }
};

// ==========================================
// SIMULASI ALARM (FCM & CALLKIT)
// ==========================================
const showSimulateModal = ref(false);
const isTesting = ref(false);
const isTestingType = ref('');
const testResult = ref('');

const openSimulateModal = () => {
    showSimulateModal.value = true;
    testResult.value = '';
    isTesting.value = false;
    isTestingType.value = '';
};

const triggerSimulasi = async (type) => {
    isTesting.value = true;
    isTestingType.value = type;
    testResult.value = 'Menghubungi server...';
    
    try {
        const res = await fetch('/api/auth/simulate-fcm', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action_type: type })
        });
        const data = await res.json();
        testResult.value = data.message || 'Simulasi terkirim.';
    } catch (err) {
        testResult.value = 'Gagal mengirim instruksi simulasi ke server.';
    } finally {
        isTesting.value = false;
        isTestingType.value = '';
    }
};

onMounted(() => {
  updateClock(); // Set waktu pertama kali agar tidak kosong sesaat
  timer = setInterval(updateClock, 1000); // Jalankan fungsi update setiap 1000ms (1 detik)
  
  fetchAlerts(false);
  alertTimer = setInterval(pollRealtimeNotifications, 3000); // Realtime polling tiap 3 detik
  
  document.addEventListener('click', handleClickOutside);
});

// Lifecycle Hooks: Dijalankan saat komponen dihancurkan (Unmount)
onUnmounted(() => {
  if (timer) {
    clearInterval(timer); // Hapus interval untuk mencegah memory leak
  }
  if (alertTimer) clearInterval(alertTimer);
  document.removeEventListener('click', handleClickOutside);
});
</script>