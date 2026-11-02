<template>
  <div class="animate-fade-in font-sans">
    <!-- Header Halaman ICMP -->
    <div class="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 mb-6">
      <!-- Judul Kiri -->
      <div class="shrink-0">
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-3">
          <i class="ph-bold ph-tree-structure text-slate-700"></i>
          Daftar Layanan Ping & TCP
        </h2>
        <p class="text-slate-500 text-sm font-medium">Pemantauan status untuk protokol ICMP Ping dan TCP Port.</p>
      </div>

      <!-- Aksi Kanan (Dibungkus dengan flex-wrap agar otomatis turun jika tidak muat) -->
      <div class="flex flex-wrap items-center gap-3 w-full 2xl:w-auto">
        
        <!-- TOGGLE MODE BUTTON -->
        <div class="flex bg-slate-50 border border-slate-200/80 p-1 rounded-lg shadow-inner h-[42px] items-center shrink-0">
          <button type="button" aria-pressed="true" class="px-3 rounded-md text-xs font-bold transition-all duration-300 flex justify-center items-center gap-1.5 bg-white text-slate-900 border border-slate-200 shadow-sm cursor-default whitespace-nowrap h-full">
            <i class="ph-bold ph-plugs text-sm"></i> ICMP / TCP
          </button>
          <button type="button" aria-pressed="false" @click="$emit('change-view', 'proxmox')" class="px-3 rounded-md text-xs font-semibold transition-all duration-300 flex justify-center items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent cursor-pointer whitespace-nowrap h-full">
            <i class="ph-bold ph-hard-drives text-sm"></i> PROXMOX
          </button>
        </div>

        <!-- SEARCH BAR -->
        <div class="relative h-[42px] flex items-center grow min-w-[200px] md:max-w-[320px]">
          <i class="ph ph-magnifying-glass absolute left-3 text-slate-400 pointer-events-none"></i>
          <input type="text" v-model="searchQuery" placeholder="Cari nama, IP, atau deskripsi..." class="pl-9 pr-8 h-full w-full border border-slate-200 bg-white text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-50 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition outline-none placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 text-slate-400 hover:text-slate-700 transition">
            <i class="ph-bold ph-x"></i>
          </button>
        </div>

        <!-- FILTER & TOMBOL TAMBAH (Digabung agar selalu berdampingan) -->
        <div class="flex items-center gap-3 shrink-0">
          <!-- Filter Status -->
          <div class="relative h-[42px] w-[42px] shrink-0">
            <select v-model="filterStatus" title="Filter Status" class="w-full h-full border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition outline-none appearance-none cursor-pointer text-center opacity-0 absolute inset-0 z-10">
              <option value="ALL">Semua Status</option>
              <option value="UP">UP (Online)</option>
              <option value="DOWN">DOWN (Offline)</option>
              <option value="PAUSED">PAUSED</option>
            </select>
            <div class="w-full h-full border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] rounded-lg flex items-center justify-center text-slate-500 pointer-events-none transition group-hover:bg-slate-50">
              <i class="ph-bold ph-funnel text-base" :class="{'text-emerald-500': filterStatus !== 'ALL'}"></i>
            </div>
          </div>

          <!-- Tombol Tambah -->
          <button @click="openAddModal" class="px-4 h-[42px] bg-slate-900 text-white rounded-lg flex items-center gap-2 hover:bg-slate-800 text-xs font-bold transition shadow-[0_1px_2px_rgba(0,0,0,0.04)] whitespace-nowrap shrink-0">
            <i class="ph-bold ph-plus-circle text-lg"></i>
            TAMBAH TARGET
          </button>
        </div>
        
      </div>
    </div>

    <!-- Tabel ICMP/TCP -->
    <div class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr class="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th class="px-6 py-3.5 w-1/4">Nama Layanan</th>
              <th class="px-6 py-3.5">Jenis Protokol</th>
              <th class="px-6 py-3.5">Target (IP / Port)</th>
              <th class="px-6 py-3.5">Latency / Terakhir Dicek</th>
              <th class="px-6 py-3.5">Status Terkini</th>
              <th class="px-6 py-3.5 text-right w-32">Aksi</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-if="isLoading" class="border-b border-slate-100">
              <td colspan="6" class="px-6 py-12 text-center text-slate-500">
                <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
                <p class="text-xs font-medium">Memuat dan menyinkronkan data target...</p>
              </td>
            </tr>
            <tr v-else-if="filteredTargets.length === 0" class="border-b border-slate-100">
              <td colspan="6" class="px-6 py-12 text-center text-slate-500">
                <i class="ph-duotone ph-magnifying-glass text-4xl mb-2 text-slate-300" v-if="searchQuery"></i>
                <i class="ph-duotone ph-tree-structure text-4xl mb-2 text-slate-300" v-else></i>
                <p class="text-sm font-medium" v-if="searchQuery">Tidak ada target yang cocok dengan kata kunci "<span class="text-slate-900 font-bold">{{ searchQuery }}</span>".</p>
                <p class="text-sm font-medium" v-else>Tidak ada target yang cocok dengan filter.</p>
              </td>
            </tr>
            <template v-else v-for="target in paginatedTargets" :key="target.id">
              <tr @click="toggleExpanded(target)" class="border-b border-slate-100 transition cursor-pointer group" :class="[ !target.is_active ? 'bg-slate-50/50 opacity-70 grayscale-[20%]' : target.status === 'DOWN' ? 'bg-rose-50/30 hover:bg-rose-50/60' : 'hover:bg-slate-50', expandedTargetId === target.id ? 'bg-slate-50/80 border-b-transparent' : '' ]">
                <td class="px-6 py-4">
                  <p class="font-bold text-slate-900 group-hover:text-slate-700 transition flex items-center gap-2">
                    {{ target.name }}
                    <i v-if="expandedTargetId === target.id" class="ph-bold ph-caret-up text-xs text-slate-400"></i>
                    <i v-else class="ph-bold ph-caret-down text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition"></i>
                  </p>
                  <p :class="['text-[11px] font-medium mt-1', target.status === 'DOWN' && target.is_active ? 'text-rose-600' : 'text-slate-500']">
                    {{ target.description }}
                  </p>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-block bg-blue-50 border border-blue-200/60 text-blue-700 font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase">
                    {{ target.protocol }}
                  </span>
                </td>
                <td class="px-6 py-4 text-slate-900 font-mono text-xs font-bold tracking-tight">
                  {{ target.ip_address }} <span v-if="target.protocol === 'TCP SOCKET' && target.port" class="text-slate-500">: {{ target.port }}</span>
                </td>
                <td class="px-6 py-4 text-xs">
                  <span v-if="!target.is_active" class="text-slate-500 font-medium italic">PAUSED</span>
                  <template v-else>
                    <span :class="['font-bold font-mono tracking-tight', target.status === 'DOWN' ? 'text-rose-600' : 'text-slate-900']">
                      {{ target.last_latency || '-' }}
                    </span>
                    <span class="text-slate-500 ml-1 font-mono tracking-tight text-[11px]">({{ formatTimeAgo(target.last_check) }})</span>
                  </template>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex flex-col gap-1.5 items-start">
                    <span v-if="!target.is_active" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold tracking-wider">
                      <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> PAUSED
                    </span>
                    <span v-else-if="target.status === 'UP' || target.status === 'TERHUBUNG'" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold tracking-wider">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> UP
                    </span>
                    <span v-else-if="target.status === 'DOWN'" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-50 border border-rose-200/60 text-rose-700 text-[10px] font-bold tracking-wider">
                      <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> DOWN
                    </span>
                    <span v-else class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold tracking-wider">
                      <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> UNKNOWN
                    </span>
                    <span v-if="target.is_active && (target.status === 'UP' || target.status === 'TERHUBUNG')" class="text-[10px] font-medium text-slate-500 pl-1 font-mono tracking-tight">
                      Uptime: <span class="text-slate-700 font-semibold">{{ getUptimeDuration(target.last_status_change) }}</span>
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 text-right" @click.stop>
                  <div class="flex items-center justify-end gap-1.5 text-slate-400">
                    <button @click="togglePause(target)" class="p-1.5 rounded-md hover:bg-amber-50 hover:text-amber-600 transition" :title="target.is_active ? 'Jeda Monitoring' : 'Mulai Monitoring'">
                      <i :class="target.is_active ? 'ph-bold ph-pause' : 'ph-bold ph-play'" class="text-base"></i>
                    </button>
                    <button @click="editTarget(target)" class="p-1.5 rounded-md hover:bg-blue-50 hover:text-blue-600 transition" title="Pengaturan">
                      <i class="ph-bold ph-gear text-base"></i>
                    </button>
                    <button @click="confirmDeleteTarget(target)" class="p-1.5 rounded-md hover:bg-rose-50 hover:text-rose-600 transition" title="Hapus">
                      <i class="ph-bold ph-trash text-base"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedTargetId === target.id">
                <td colspan="6" class="p-0 border-b border-slate-100 bg-slate-50/50">
                  <div class="px-8 py-6 flex flex-col lg:flex-row gap-6 animate-fade-in">
                    <div class="flex-1 bg-white border border-slate-200 rounded-xl p-5 h-[220px] relative shadow-sm">
                      <div class="flex justify-between items-center mb-4">
                        <h4 class="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                          <i class="ph-bold ph-chart-line-up text-slate-500"></i> Riwayat Latency
                        </h4>
                        <button @click="fetchHistory(target.id, false)" class="text-slate-500 hover:text-slate-900 transition text-[11px] font-semibold flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                          <i class="ph-bold ph-arrows-clockwise" :class="{'animate-spin text-slate-900': isLoadingHistory}"></i> Segarkan
                        </button>
                      </div>
                      <div v-if="isLoadingHistory && !chartData" class="absolute inset-0 flex items-center justify-center">
                        <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400"></i>
                      </div>
                      <div v-else-if="chartData" class="w-full h-[140px]">
                        <Line :data="chartData" :options="chartOptions" />
                      </div>
                    </div>
                    <div class="w-full lg:w-64 bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm h-fit">
                      <h4 class="text-[11px] font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2.5 uppercase tracking-wider flex items-center gap-2">
                        <i class="ph-bold ph-sliders text-slate-400"></i> Konfigurasi Daemon
                      </h4>
                      <div>
                        <p class="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">Interval Pengecekan</p>
                        <p class="text-sm text-slate-900 font-mono font-bold mt-0.5">{{ target.check_interval }} <span class="font-sans text-xs font-medium text-slate-500">detik</span></p>
                      </div>
                      <div>
                        <p class="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">Toleransi Time Out</p>
                        <p class="text-sm text-slate-900 font-mono font-bold mt-0.5">{{ target.max_retries }} <span class="font-sans text-xs font-medium text-slate-500">kali gagal</span></p>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="!isLoading && filteredTargets.length > 0" class="bg-slate-50/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
        <span class="text-xs text-slate-500 font-medium text-center sm:text-left">
          Menampilkan <span class="font-bold text-slate-900">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> sampai <span class="font-bold text-slate-900">{{ Math.min(currentPage * itemsPerPage, filteredTargets.length) }}</span> dari <span class="font-bold text-slate-900">{{ filteredTargets.length }}</span> target
        </span>
        <div class="flex items-center gap-2">
          <button @click="prevPage" :disabled="currentPage === 1" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <i class="ph-bold ph-caret-left"></i>
          </button>
          <button @click="nextPage" :disabled="currentPage === totalPages" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <i class="ph-bold ph-caret-right"></i>
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <!-- Modal Edit/Tambah -->
      <div v-if="showModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeModal">
        <div class="bg-white border border-slate-200/80 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
          <div class="flex justify-between items-center p-6 bg-slate-50/50 border-b border-slate-200/80 shrink-0">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i class="ph-bold" :class="isEditMode ? 'ph-gear text-blue-500' : 'ph-plus-circle text-emerald-500'"></i>
              {{ isEditMode ? 'Edit Target Monitoring' : 'Tambah Target Baru' }}
            </h3>
            <button @click="closeModal" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center transition"><i class="ph-bold ph-x text-lg"></i></button>
          </div>
          <div class="overflow-y-auto">
            <form @submit.prevent="saveTarget" class="p-6 space-y-5">
              <div class="space-y-4">
                <div>
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nama Layanan</label>
                  <input type="text" v-model="form.name" required placeholder="Contoh: Core Gateway Diskominfo" class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg px-4 py-2 focus:border-slate-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400">
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Deskripsi Layanan</label>
                  <input type="text" v-model="form.description" placeholder="Contoh: Router Utama Mikrotik CCR" class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg px-4 py-2 focus:border-slate-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400">
                </div>
              </div>
              <div class="p-4 bg-slate-50/50 border border-slate-200/80 rounded-xl space-y-4">
                <div>
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Jenis Protokol</label>
                  <select v-model="form.protocol" class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg px-4 py-2 focus:border-slate-400 outline-none appearance-none cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <option value="ICMP PING">ICMP PING (Test Konektivitas)</option>
                    <option value="TCP SOCKET">TCP SOCKET (Test Port Spesifik)</option>
                  </select>
                </div>
                <div class="flex flex-col sm:flex-row gap-4">
                  <div class="flex-[2]">
                    <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">IP Address / Host</label>
                    <input type="text" v-model="form.ip_address" required placeholder="Contoh: 10.10.0.1" class="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2 font-mono font-bold tracking-tight focus:border-slate-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400 placeholder:font-sans">
                  </div>
                  <div class="flex-1" v-if="form.protocol === 'TCP SOCKET'">
                    <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Port</label>
                    <input type="number" v-model="form.port" required placeholder="443" class="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2 font-mono font-bold tracking-tight focus:border-slate-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] placeholder:text-slate-400 placeholder:font-sans">
                  </div>
                </div>
              </div>
              <div class="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-4 shadow-inner">
                <h4 class="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <i class="ph-bold ph-sliders text-amber-500"></i> Parameter Pengecekan
                </h4>
                <div class="flex flex-col sm:flex-row gap-4">
                  <div class="flex-1">
                    <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Interval Cek</label>
                    <div class="relative">
                      <input type="number" v-model="form.check_interval" required min="1" class="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-lg pl-4 pr-10 py-2 font-mono font-bold focus:border-amber-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold uppercase">dtk</span>
                    </div>
                  </div>
                  <div class="flex-1">
                    <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Batas Gagal</label>
                    <div class="relative">
                      <input type="number" v-model="form.max_retries" required min="1" max="10" class="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-lg pl-4 pr-12 py-2 font-mono font-bold focus:border-amber-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold uppercase">kali</span>
                    </div>
                  </div>
                </div>
                <p class="text-[10px] font-medium text-slate-500 leading-relaxed mt-2">
                  Sistem akan melakukan test setiap <span class="font-bold font-mono tracking-tight text-slate-900">{{ form.check_interval }} detik</span>. Jika terjadi Timeout berturut-turut <span class="font-bold font-mono tracking-tight text-slate-900">{{ form.max_retries }} kali</span>, status akan diubah ke <span class="text-rose-600 font-bold">DOWN</span>.
                </p>
              </div>
              <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 mt-6">
                <button type="button" @click="closeModal" class="px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full sm:w-auto text-center">Batal</button>
                <button type="submit" class="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex justify-center items-center gap-2 w-full sm:w-auto" :disabled="isSaving">
                  <i v-if="isSaving" class="ph-bold ph-spinner animate-spin"></i>
                  <i v-else class="ph-bold ph-floppy-disk"></i>
                  {{ isSaving ? 'Menyimpan...' : (isEditMode ? 'Simpan Perubahan' : 'Tambah Target') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal Confirm Delete -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeDeleteModal">
        <div class="bg-white border border-slate-200/80 shadow-xl rounded-2xl w-full max-w-md overflow-hidden transform transition-all relative">
          <div class="p-6 pt-7">
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-600 mt-0.5">
                <i class="ph-bold ph-warning-circle text-2xl"></i>
              </div>
              <div>
                <h3 class="text-lg font-bold text-slate-900 mb-2">Hapus Target Monitoring?</h3>
                <p class="text-sm font-medium text-slate-600 leading-relaxed">
                  Anda akan menghapus target <span class="font-bold text-slate-900">{{ targetToDelete?.name }}</span> (<span class="font-mono tracking-tight font-bold text-slate-700">{{ targetToDelete?.ip_address }}</span>).
                  <br><br>
                  Sistem daemon tidak akan lagi memantau infrastruktur ini. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
          </div>
          <div class="bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-200/80">
            <button @click="closeDeleteModal" class="px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] w-full sm:w-auto text-center">
              Batal
            </button>
            <button @click="executeDeleteTarget" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm flex justify-center items-center gap-2 w-full sm:w-auto" :disabled="isDeleting">
              <i class="ph-bold" :class="isDeleting ? 'ph-spinner animate-spin' : 'ph-trash'"></i>
              {{ isDeleting ? 'Menghapus...' : 'Ya, Hapus Target' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Toast -->
    <ToastNotification :show="toast.show" :type="toast.type" :title="toast.title" :message="toast.message" @close="toast.show = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler } from 'chart.js';
import { Line } from 'vue-chartjs';
import { parseUtcDate, formatWibTime } from '../../utils/datetime.js';
import { isDark } from '../../utils/theme.js';
import ToastNotification from '@/components/common/ToastNotification.vue';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

defineEmits(['change-view']);

const targets = ref([]);
const isLoading = ref(true);
const expandedTargetId = ref(null);
const isLoadingHistory = ref(false);
const chartData = ref(null);
let pollTimerICMP = null;

const chartOptions = computed(() => {
  const dark = isDark.value;
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: dark ? '#334155' : '#f1f5f9' },
        ticks: { color: dark ? '#94a3b8' : '#64748b', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: dark ? '#94a3b8' : '#64748b', font: { size: 10 }, maxRotation: 0 }
      }
    },
    elements: {
      line: { tension: 0.3, borderWidth: 2, borderColor: '#10b981' },
      point: { radius: 2, backgroundColor: '#10b981' }
    }
  };
});

const filterStatus = ref('ALL');
const searchQuery = ref('');
const currentPage = ref(1);
const itemsPerPage = 15;

const showModal = ref(false);
const isSaving = ref(false);
const isEditMode = ref(false);
const editTargetId = ref(null);
const form = ref({
  name: '', description: '', protocol: 'ICMP PING', ip_address: '', port: null, check_interval: 60, max_retries: 3
});

const showDeleteModal = ref(false);
const targetToDelete = ref(null);
const isDeleting = ref(false);

const toast = ref({ show: false, type: 'success', title: '', message: '' });
let toastTimer = null;

const showToast = (type, title, message) => {
  toast.value = { show: true, type, title, message };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value.show = false; }, 5000);
};

const filteredTargets = computed(() => {
  let list = targets.value;
  if (searchQuery.value.trim() !== '') {
    const query = searchQuery.value.toLowerCase();
    list = list.filter(t => t.name.toLowerCase().includes(query) || t.ip_address.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query)));
  }
  if (filterStatus.value === 'PAUSED') return list.filter(t => t.is_active === 0);
  else if (filterStatus.value !== 'ALL') return list.filter(t => t.status === filterStatus.value && t.is_active === 1);
  return list;
});

watch(searchQuery, () => { currentPage.value = 1; });

const totalPages = computed(() => Math.ceil(filteredTargets.value.length / itemsPerPage) || 1);
const paginatedTargets = computed(() => filteredTargets.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage));

const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; };
const prevPage = () => { if (currentPage.value > 1) currentPage.value--; };

const fetchTargets = async (isBackground = false) => {
  if (!isBackground) isLoading.value = true;
  try {
    const res = await fetch('/api/targets');
    const data = await res.json();
    if (data.success) {
      targets.value = data.data;
      if (expandedTargetId.value && isBackground) fetchHistory(expandedTargetId.value, true);
    }
  } catch (error) {
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

const togglePause = async (target) => {
  const newStatus = target.is_active ? 0 : 1;
  try {
    await fetch(`/api/targets/${target.id}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newStatus })
    });
    fetchTargets(true);
  } catch (err) {}
};

const toggleExpanded = (target) => {
  if (expandedTargetId.value === target.id) {
    expandedTargetId.value = null;
    chartData.value = null;
  } else {
    expandedTargetId.value = target.id;
    fetchHistory(target.id, false);
  }
};

const fetchHistory = async (targetId, isSilent) => {
  if (!isSilent) isLoadingHistory.value = true;
  try {
    const res = await fetch(`/api/targets/${targetId}/history`);
    const data = await res.json();
    if (data.success && data.data.length > 0) {
      const recent = data.data.slice(-20);
      const labels = recent.map(d => formatWibTime(d.time));
      const dataPoints = recent.map(d => d.status === 'DOWN' ? 0 : (d.latency_ms || 0));
      chartData.value = {
        labels: labels,
        datasets: [{ data: dataPoints, backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true }]
      };
    } else {
      chartData.value = null;
    }
  } catch (err) {} finally {
    isLoadingHistory.value = false;
  }
};

const openAddModal = () => {
  isEditMode.value = false;
  form.value = { name: '', description: '', protocol: 'ICMP PING', ip_address: '', port: null, check_interval: 60, max_retries: 3 };
  showModal.value = true;
};

const editTarget = (target) => {
  isEditMode.value = true;
  editTargetId.value = target.id;
  form.value = { ...target };
  showModal.value = true;
};

const saveTarget = async () => {
  isSaving.value = true;
  try {
    const url = isEditMode.value ? `/api/targets/${editTargetId.value}` : '/api/targets';
    const method = isEditMode.value ? 'PUT' : 'POST';
    if (form.value.protocol === 'ICMP PING') form.value.port = null;
    
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });
    
    const data = await res.json();
    if (data.success) {
      closeModal();
      fetchTargets();
      showToast('success', isEditMode.value ? 'Target Diperbarui' : 'Target Ditambahkan', data.message);
    } else {
      showToast('error', 'Gagal', data.message);
    }
  } catch (error) {
    showToast('error', 'Kesalahan', 'Gagal server.');
  } finally {
    isSaving.value = false;
  }
};

const confirmDeleteTarget = (target) => {
  targetToDelete.value = target;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  targetToDelete.value = null;
};

const executeDeleteTarget = async () => {
  if (!targetToDelete.value) return;
  isDeleting.value = true;
  try {
    const res = await fetch(`/api/targets/${targetToDelete.value.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      await fetchTargets();
      showToast('success', 'Target Dihapus', data.message);
      closeDeleteModal();
    }
  } catch (error) {} finally {
    isDeleting.value = false;
  }
};

const closeModal = () => {
  showModal.value = false;
};

const parseMySQLDate = (timestamp) => parseUtcDate(timestamp);

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Belum dicek';
  const dateObj = parseMySQLDate(timestamp);
  if (!dateObj || isNaN(dateObj.getTime())) return '-';
  const diffInSeconds = Math.floor((new Date() - dateObj) / 1000);
  if (diffInSeconds < 60) return `${Math.max(0, diffInSeconds)} dtk lalu`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} mnt lalu`;
  return '> 1 jam lalu';
};

const getUptimeDuration = (timestamp) => {
  if (!timestamp) return '-';
  const dateObj = parseMySQLDate(timestamp);
  if (!dateObj || isNaN(dateObj.getTime())) return '-';
  const diffSeconds = Math.floor((new Date() - dateObj) / 1000);
  if (diffSeconds < 0) return '0 dtk';
  if (diffSeconds < 60) return `${diffSeconds} dtk`;
  const d = Math.floor(diffSeconds / 86400);
  const h = Math.floor((diffSeconds % 86400) / 3600);
  const m = Math.floor((diffSeconds % 3600) / 60);
  if (d > 0) return `${d}h ${h}j`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m} mnt`;
};

onMounted(() => {
  fetchTargets();
  pollTimerICMP = setInterval(() => { fetchTargets(true); }, 5000);
});

onUnmounted(() => {
  if (pollTimerICMP) clearInterval(pollTimerICMP);
});
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}
.overflow-x-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}
.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>