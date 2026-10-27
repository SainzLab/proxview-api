<template>
  <main class="bg-[#f8f9fa] min-h-screen font-sans p-8 pb-12 overflow-x-hidden animate-fade-in" @click="closeExportMenu">
    
    <!-- Header Halaman -->
    <div class="flex justify-between items-end mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2.5">
          <i class="ph-bold ph-ticket text-slate-700"></i> Rekap & Pelacakan Status Gangguan
        </h2>
        <p class="text-slate-500 text-sm font-medium">Pemantauan riwayat insiden dan performa respons teknisi secara otomatis.</p>
      </div>
      <div class="flex gap-3 relative" @click.stop>
        <button
          @click="showExportMenu = !showExportMenu"
          :disabled="isExporting"
          class="px-4 h-[42px] bg-slate-900 text-white rounded-lg flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50 text-xs font-bold transition shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <i class="ph-bold" :class="isExporting ? 'ph-spinner animate-spin' : 'ph-file-pdf text-base'"></i>
          <span>{{ isExporting ? 'Menyiapkan PDF...' : 'Export PDF' }}</span>
          <i class="ph-bold ph-caret-down text-xs ml-0.5 transition-transform duration-200" :class="showExportMenu ? 'rotate-180' : ''"></i>
        </button>

        <!-- Dropdown Opsi Periode Export PDF -->
        <div
          v-if="showExportMenu"
          class="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200/80 rounded-xl shadow-lg py-1.5 z-50 overflow-hidden animate-fade-in"
        >
          <div class="px-3.5 py-2 bg-slate-50/50 border-b border-slate-100">
            <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pilih Rentang Laporan</p>
            <p class="text-[11px] text-slate-500 mt-0.5">Filter Level: <span class="text-slate-900 font-semibold">{{ analyticsSeverity === 'ALL' ? 'Semua Level' : analyticsSeverity }}</span></p>
          </div>
          <button
            @click="exportToPdf('24h')"
            class="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between transition"
          >
            <span class="flex items-center gap-2"><i class="ph-bold ph-clock text-slate-400"></i> 24 Jam Terakhir</span>
            <span class="text-[10px] text-slate-400 font-medium">Per Jam</span>
          </button>
          <button
            @click="exportToPdf('7d')"
            class="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between transition"
          >
            <span class="flex items-center gap-2"><i class="ph-bold ph-calendar-blank text-slate-400"></i> 7 Hari Terakhir</span>
            <span class="text-[10px] text-slate-400 font-medium">Per Hari</span>
          </button>
          <button
            @click="exportToPdf('30d')"
            class="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between transition"
          >
            <span class="flex items-center gap-2"><i class="ph-bold ph-calendar text-slate-400"></i> 30 Hari Terakhir</span>
            <span class="text-[10px] text-slate-400 font-medium">Per Hari</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Stats Bar (5 Kolom) -->
    <div class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-6 grid grid-cols-5 divide-x divide-slate-100">
      <div class="p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors rounded-l-xl">
        <div class="w-1.5 h-10 bg-rose-500 rounded-full"></div>
        <div>
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Down</p>
          <h3 class="text-3xl font-black text-slate-900 font-mono tracking-tight leading-none flex items-baseline gap-1.5">
            {{ stats.down }} <span class="text-xs font-medium text-rose-600 font-sans tracking-normal">Tiket</span>
          </h3>
        </div>
      </div>
      <div class="p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
        <div class="w-1.5 h-10 bg-orange-500 rounded-full"></div>
        <div>
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Critical</p>
          <h3 class="text-3xl font-black text-slate-900 font-mono tracking-tight leading-none flex items-baseline gap-1.5">
            {{ stats.critical }} <span class="text-xs font-medium text-orange-600 font-sans tracking-normal">Tiket</span>
          </h3>
        </div>
      </div>
      <div class="p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
        <div class="w-1.5 h-10 bg-amber-400 rounded-full"></div>
        <div>
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Warning</p>
          <h3 class="text-3xl font-black text-slate-900 font-mono tracking-tight leading-none flex items-baseline gap-1.5">
            {{ stats.warning }} <span class="text-xs font-medium text-amber-600 font-sans tracking-normal">Tiket</span>
          </h3>
        </div>
      </div>
      <div class="p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
        <div class="w-1.5 h-10 bg-cyan-500 rounded-full"></div>
        <div>
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Penanganan</p>
          <h3 class="text-3xl font-black text-slate-900 font-mono tracking-tight leading-none flex items-baseline gap-1.5">
            {{ stats.progress }} <span class="text-xs font-medium text-cyan-600 font-sans tracking-normal">Proses</span>
          </h3>
        </div>
      </div>
      <div class="p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors rounded-r-xl">
        <div class="w-1.5 h-10 bg-emerald-500 rounded-full"></div>
        <div>
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Selesai</p>
          <h3 class="text-3xl font-black text-slate-900 font-mono tracking-tight leading-none flex items-baseline gap-1.5">
            {{ stats.resolved }} <span class="text-xs font-medium text-emerald-600 font-sans tracking-normal">Tiket</span>
          </h3>
        </div>
      </div>
    </div>

    <!-- ANALITIK KINERJA SISTEM -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4 mt-10">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
             Analitik Kinerja Sistem
          </h3>
          <p class="text-xs text-slate-500 font-medium mt-0.5">Dihitung otomatis dari riwayat sistem &bull; {{ filterLabelText }}</p>
        </div>
        
        <div class="flex flex-wrap gap-3 items-center">
          <!-- Filter Level Severity Analitik -->
          <div class="flex bg-slate-50 border border-slate-200/80 rounded-lg p-1">
            <button @click="setAnalyticsSeverity('ALL')" class="px-3.5 py-1.5 rounded-md text-xs font-semibold transition border" :class="analyticsSeverity === 'ALL' ? 'bg-white text-slate-900 border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-900 border-transparent'">Semua</button>
            <button @click="setAnalyticsSeverity('DOWN')" class="px-3.5 py-1.5 rounded-md text-xs font-semibold transition border" :class="analyticsSeverity === 'DOWN' ? 'bg-white text-slate-900 border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-900 border-transparent'">Down</button>
            <button @click="setAnalyticsSeverity('CRITICAL')" class="px-3.5 py-1.5 rounded-md text-xs font-semibold transition border" :class="analyticsSeverity === 'CRITICAL' ? 'bg-white text-slate-900 border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-900 border-transparent'">Critical</button>
            <button @click="setAnalyticsSeverity('WARNING')" class="px-3.5 py-1.5 rounded-md text-xs font-semibold transition border" :class="analyticsSeverity === 'WARNING' ? 'bg-white text-slate-900 border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-900 border-transparent'">Warning</button>
          </div>
          <!-- Filter Rentang Periode Analitik -->
          <div class="flex bg-slate-50 border border-slate-200/80 rounded-lg p-1">
            <button @click="setAnalyticsFilter('24h')" class="px-4 py-1.5 rounded-md text-xs font-semibold transition border" :class="analyticsFilter === '24h' ? 'bg-white text-slate-900 border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-900 border-transparent'">24 Jam</button>
            <button @click="setAnalyticsFilter('7d')" class="px-4 py-1.5 rounded-md text-xs font-semibold transition border" :class="analyticsFilter === '7d' ? 'bg-white text-slate-900 border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-900 border-transparent'">7 Hari</button>
            <button @click="setAnalyticsFilter('30d')" class="px-4 py-1.5 rounded-md text-xs font-semibold transition border" :class="analyticsFilter === '30d' ? 'bg-white text-slate-900 border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-900 border-transparent'">30 Hari</button>
          </div>
        </div>
      </div>

      <!-- KPI Cards (4 Metrik Utama) -->
      <div class="grid grid-cols-4 gap-4 mb-4">
        <!-- TOTAL UPTIME -->
        <div class="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 relative z-10"><i class="ph-bold ph-arrow-circle-up text-emerald-500"></i> Total Uptime</p>
          <h3 class="text-3xl font-black text-slate-900 font-mono tracking-tight leading-none relative z-10">{{ formatPreciseDuration(analytics.summary.total_uptime_sec) }}</h3>
          <p class="text-[11px] text-slate-500 mt-2 relative z-10 font-medium">Waktu sistem beroperasi normal</p>
        </div>
        
        <!-- TOTAL DOWNTIME -->
        <div class="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:border-rose-300 transition-colors">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 relative z-10"><i class="ph-bold ph-arrow-circle-down text-rose-500"></i> Total Downtime</p>
          <h3 class="text-3xl font-black text-slate-900 font-mono tracking-tight leading-none relative z-10">{{ formatPreciseDuration(analytics.summary.total_downtime_sec) }}</h3>
          <p class="text-[11px] text-slate-500 mt-2 relative z-10 font-medium">Akumulasi seluruh waktu gangguan</p>
        </div>

        <!-- MTTR -->
        <div class="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:border-cyan-300 transition-colors">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 relative z-10"><i class="ph-bold ph-timer text-cyan-500"></i> MTTR</p>
          <h3 class="text-3xl font-black text-slate-900 font-mono tracking-tight leading-none relative z-10">{{ formatPreciseDuration(analytics.summary.mttr_sec) }}</h3>
          <p class="text-[11px] text-slate-500 mt-2 relative z-10 font-medium">Rata-rata waktu pemulihan per insiden</p>
        </div>
        
        <!-- AVAILABILITY -->
        <div class="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 relative z-10"><i class="ph-bold ph-shield-check text-emerald-500"></i> Availability</p>
          <h3 class="text-3xl font-black font-mono tracking-tight leading-none relative z-10" :class="availabilityColor">{{ analytics.summary.availability }}<span class="text-sm font-semibold ml-0.5">%</span></h3>
          <div class="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden relative z-10">
            <div class="h-full rounded-full transition-all duration-700" :class="availabilityBar" :style="{ width: Math.min(100, analytics.summary.availability) + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Grafik -->
      <div v-if="analyticsError" class="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-sm font-semibold text-rose-600 shadow-sm">
        <i class="ph-bold ph-warning"></i> {{ analyticsError }}
      </div>
      <div v-else class="grid grid-cols-2 gap-4">
        <!-- Grafik Availability -->
        <div class="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Availability (%)</h4>
          <p class="text-[11px] text-slate-500 mb-2 font-medium">Persentase ketersediaan sistem per {{ analyticsFilter === '24h' ? 'jam' : 'hari' }}</p>
          <apexchart type="area" height="260" :options="availabilityOptions" :series="availabilitySeries" />
        </div>
        
        <!-- Grafik MTTR -->
        <div class="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">MTTR (Hari / Jam / Menit / Detik)</h4>
          <p class="text-[11px] text-slate-500 mb-2 font-medium">Rata-rata durasi pemulihan per {{ analyticsFilter === '24h' ? 'jam' : 'hari' }}</p>
          <apexchart type="bar" height="260" :options="mttrOptions" :series="mttrSeries" />
          
          <div v-if="mttrInfo" class="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3 text-[11px]">
            <div class="bg-slate-50 rounded-lg p-2 border border-slate-100">
              <p class="text-slate-500 mb-0.5 font-medium">Terlama ({{ mttrInfo.peak.label }})</p>
              <p class="font-bold font-mono tracking-tight text-rose-600">{{ formatPreciseDuration(mttrInfo.peak.mttr_sec) }}</p>
            </div>
            <div class="bg-slate-50 rounded-lg p-2 border border-slate-100">
              <p class="text-slate-500 mb-0.5 font-medium">Tercepat ({{ mttrInfo.low.label }})</p>
              <p class="font-bold font-mono tracking-tight text-emerald-600">{{ formatPreciseDuration(mttrInfo.low.mttr_sec) }}</p>
            </div>
            <div class="bg-slate-50 rounded-lg p-2 border border-slate-100">
              <p class="text-slate-500 mb-0.5 font-medium">Rata-rata ({{ mttrInfo.count }} periode)</p>
              <p class="font-bold font-mono tracking-tight text-cyan-600">{{ formatPreciseDuration(mttrInfo.avg) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter & Search Box Laporan Tiket -->
    <div class="flex gap-4 mb-6 mt-10">
      <div class="relative flex-1">
        <i class="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Cari ID tiket / IP server / jenis gangguan..." 
          class="w-full bg-white border border-slate-200/80 text-slate-900 font-medium text-sm rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition shadow-sm placeholder:text-slate-400"
        >
      </div>
      <select 
        v-model="statusFilter" 
        class="bg-white border border-slate-200/80 text-slate-700 font-medium text-sm rounded-xl px-4 py-3 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 shadow-sm w-56 appearance-none cursor-pointer"
        style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%2364748b%22%20viewBox%3D%220%200%20256%20256%22%3E%3Cpath%20d%3D%22M213.66%2C101.66l-80%2C80a8%2C8%2C0%2C0%2C1-11.32%2C0l-80-80A8%2C8%2C0%2C0%2C1%2C53.66%2C90.34L128%2C164.69l74.34-74.35a8%2C8%2C0%2C0%2C1%2C11.32%2C11.32Z%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right 1rem center;"
      >
        <option value="">Semua Status</option>
        <option value="DOWN">DOWN</option>
        <option value="CRITICAL">CRITICAL</option>
        <option value="WARNING">WARNING</option>
        <option value="PROGRESS">Dalam Penanganan</option>
        <option value="RESOLVED">Selesai</option>
      </select>
    </div>

    <!-- Ticket List Dinamis -->
    <div class="space-y-4">
      <div v-if="isLoading" class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-center py-12 text-slate-500">
        <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
        <p class="text-xs font-medium">Memuat data tiket...</p>
      </div>
      <div v-else-if="tickets.length === 0" class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-center py-12 text-slate-500 font-medium text-xs">
        Belum ada riwayat gangguan yang tercatat.
      </div>
      <div v-else-if="filteredTickets.length === 0" class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-center py-12 text-slate-500 font-medium text-xs">
        Tidak ada tiket yang cocok dengan pencarian/filter.
      </div>
      
      <div 
        v-else 
        v-for="ticket in filteredTickets" 
        :key="ticket.id" 
        class="bg-white border rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-300" 
        :class="ticket.isExpanded ? 'border-slate-300 ring-1 ring-slate-200' : 'border-slate-200/80'"
      >
        
        <!-- Baris Utama Tiket (Header) -->
        <div 
          class="flex items-center p-5 relative cursor-pointer" 
          :class="ticket.isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/50'" 
          @click="toggleTicketExpand(ticket)"
        >
          <!-- Indikator warna dari fungsi logic Anda (Arahkan warna ke Tailwind standard/pastel jika mungkin) -->
          <div class="absolute left-4 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-full" :class="getIndicatorColor(ticket)"></div>
          
          <div class="pl-5 flex-1">
            <div class="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-2">
              <span class="text-slate-800 font-bold font-mono tracking-tight">{{ ticket.id }}</span> &bull; 
              <span class="font-mono tracking-tight font-medium" :class="ticket.is_resolved ? 'text-slate-500' : 'text-slate-800'">{{ formatDate(ticket.time) }}</span>
              <span v-if="ticket.is_resolved" class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-slate-200">Selesai</span>
            </div>
            
            <h3 class="text-base font-bold mb-1 tracking-tight" :class="[ticket.isExpanded ? 'text-slate-900' : '', ticket.is_resolved ? 'text-slate-600' : 'text-slate-900']">
              {{ ticket.title }}
            </h3>
            
            <div class="flex items-center gap-3">
              <p class="text-xs text-slate-500 font-semibold font-mono tracking-tight flex items-center gap-1.5">
                <i class="ph-bold ph-hard-drive"></i> {{ ticket.target }}
              </p>
              <!-- Fungsi getStatusBadge() harus me-return class pastel (contoh: bg-rose-50 text-rose-700 border border-rose-200/60) -->
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border" :class="getStatusBadge(ticket.status, ticket.severity)">
                {{ ticket.severity === 'RECOVERED' ? 'PULIH (RECOVERED)' : (ticket.status === 'Gangguan Aktif' ? ticket.severity : ticket.status) }}
              </span>
            </div>
          </div>
          
          <div>
            <button class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition flex items-center gap-2 shadow-sm">
              <template v-if="ticket.isExpanded"><i class="ph-bold ph-caret-up"></i> Tutup</template>
              <template v-else>Lacak Laporan <i class="ph-bold ph-caret-right ml-1"></i></template>
            </button>
          </div>
        </div>

        <!-- Bagian Expand (Timeline Tracker) -->
        <div v-if="ticket.isExpanded" class="border-t border-slate-200/80 p-6 bg-slate-50/50">
          
          <div class="flex items-center gap-2 mb-8">
            <div class="w-2 h-2 rounded-full" :class="ticket.is_resolved ? 'bg-emerald-500' : 'bg-slate-700'"></div>
            <h4 class="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Laporan Pemantauan</h4>
          </div>
          
          <div class="relative px-4 mb-10 mt-6">
            <!-- Wrapper utama garis (Track) yang menentukan batas kiri dan kanan -->
            <div class="absolute top-4 left-16 right-16 h-[2px] bg-slate-200 z-0 overflow-hidden">
              <!-- Garis progres diubah menjadi child elemen agar w-full tidak menembus batas -->
              <div class="h-full z-0 transition-all duration-1000" :class="getTimelineProgress(ticket.status)"></div>
            </div>
            
            <div class="relative z-10 flex justify-between items-start">
              <!-- Tahap 1: Deteksi -->
              <div class="flex flex-col items-center gap-3 w-24">
                <div class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white" :class="ticket.is_resolved ? 'bg-emerald-500' : 'bg-slate-700'">
                  <i class="ph-bold ph-warning text-lg"></i>
                </div>
                <span class="text-xs font-bold text-slate-800 text-center leading-tight">Gangguan Terdeteksi</span>
              </div>
              
              <!-- Tahap 2: Perbaikan -->
              <div class="flex flex-col items-center gap-3 w-24">
                <div class="w-8 h-8 shrink-0 rounded-full border flex items-center justify-center transition-colors duration-500" 
                  :class="ticket.status === 'Gangguan Aktif' ? 'bg-white text-slate-400 border-slate-200' : 
                        (ticket.status === 'Selesai' ? 'bg-emerald-500 text-white border-emerald-500' : 
                        (ticket.severity === 'RECOVERED' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-cyan-50 text-cyan-600 border-cyan-200'))">
                  <i v-if="ticket.status === 'Selesai'" class="ph-bold ph-check text-lg"></i>
                  <i v-else class="ph-fill ph-wrench text-lg"></i>
                </div>
                <span class="text-xs font-bold text-center leading-tight" 
                  :class="ticket.status === 'Gangguan Aktif' ? 'text-slate-400' : 
                        (ticket.status === 'Selesai' ? 'text-emerald-600' : 
                        (ticket.severity === 'RECOVERED' ? 'text-blue-600' : 'text-cyan-600'))">
                  Perbaikan
                </span>
              </div>
              
              <!-- Tahap 3: Selesai -->
              <div class="flex flex-col items-center gap-3 w-24">
                <div class="w-8 h-8 shrink-0 rounded-full border flex items-center justify-center transition-colors duration-500" :class="ticket.status === 'Selesai' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 border-slate-200'">
                  <i v-if="ticket.status === 'Selesai'" class="ph-bold ph-check text-lg"></i>
                  <i v-else class="ph-bold ph-check text-lg"></i>
                </div>
                <span class="text-xs text-center leading-tight" :class="ticket.status === 'Selesai' ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'">Terkonfirmasi</span>
              </div>
            </div>
          </div>
          
          <!-- FOOTER KETERANGAN TRACKING -->
          <div class="bg-white border border-slate-200 p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            
            <template v-if="ticket.status === 'Gangguan Aktif'">
              <div class="flex items-center gap-3 text-slate-600">
                <div class="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100"><i class="ph-bold ph-bell-ringing"></i></div>
                <div>
                  <p class="text-xs font-bold text-slate-900">Menunggu Penanganan</p>
                  <p class="text-[11px] font-medium">Sistem sedang menunggu respons dari teknisi.</p>
                </div>
              </div>
              <span class="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-md text-[10px] font-bold tracking-wider">TERDETEKSI</span>
            </template>
            
            <template v-else-if="ticket.status === 'Dalam Penanganan'">
              <div class="flex items-center gap-3 text-slate-600">
                <div class="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600 border border-cyan-100"><i class="ph-bold ph-users-three"></i></div>
                <div class="flex flex-col gap-0.5">
                  <p class="text-xs font-medium">Penanggung Jawab: <span class="font-bold text-cyan-700">{{ ticket.technicians }}</span></p>
                  <p v-if="ticket.severity === 'RECOVERED'" class="text-[11px] font-bold text-blue-600 flex items-center gap-1.5"><i class="ph-bold ph-info"></i> Indikator telah pulih. Menunggu teknisi menutup tiket.</p>
                  <p v-else class="text-[11px] font-semibold text-amber-600 flex items-center gap-1.5"><i class="ph-bold ph-wrench"></i> Sedang dikerjakan / perbaikan.</p>
                </div>
              </div>
              <span class="px-3 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200/60 rounded-md text-[10px] font-bold tracking-wider animate-pulse">DIPROSES</span>
            </template>
            
            <template v-else>
              <div class="flex items-center gap-3 text-slate-600">
                <div class="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200/60"><i class="ph-bold ph-check-circle"></i></div>
                <p class="text-xs font-medium">Diselesaikan oleh: <span class="font-bold text-slate-900">{{ ticket.technicians || 'Sistem Otomatis (Auto-Recover)' }}</span></p>
              </div>
              <div class="flex flex-wrap gap-4 md:gap-6 text-xs bg-slate-50/80 px-4 py-2.5 rounded-lg border border-slate-200">
                <p class="text-slate-500 font-medium">Total Downtime: <span class="font-bold font-mono tracking-tight text-rose-600 ml-1">{{ ticket.downtime_duration }}</span></p>
                <p class="text-slate-500 font-medium border-l border-slate-300 pl-4 md:pl-6">Waktu Penanganan: <span class="font-bold font-mono tracking-tight text-cyan-700 ml-1">{{ ticket.handling_duration }}</span></p>
              </div>
            </template>
            
          </div>
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

  </main>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatWibShort, formatWibDateTime, parseUtcDate } from '../../utils/datetime.js';
import { isDark } from '../../utils/theme.js';
import ToastNotification from '@/components/common/ToastNotification.vue';

const apexchart = VueApexCharts;

// STATE UMUM
const tickets = ref([]);
const expandedMap = ref({});
const hasInitializedExpand = ref(false);
const isLoading = ref(true);
const stats = ref({ down: 0, critical: 0, warning: 0, progress: 0, resolved: 0 });

const toast = ref({ show: false, type: 'success', title: '', message: '' });
let toastTimer = null;
const showToast = (type, title, message) => {
  toast.value = { show: true, type, title, message };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value.show = false; }, 5000);
};

// STATE EXPORT PDF
const showExportMenu = ref(false);
const isExporting = ref(false);
const closeExportMenu = () => {
  showExportMenu.value = false;
};

const toggleTicketExpand = (ticket) => {
  ticket.isExpanded = !ticket.isExpanded;
  expandedMap.value[ticket.id] = ticket.isExpanded;
};

// STATE SEARCH & FILTER TIKET
const searchQuery = ref('');
const statusFilter = ref('');
const filteredTickets = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return tickets.value.filter(t => {
    const open = t.status !== 'Selesai';
    let okStatus = true;
    switch (statusFilter.value) {
      case 'DOWN':
      case 'CRITICAL':
      case 'WARNING':
        okStatus = t.severity === statusFilter.value && open;
        break;
      case 'PROGRESS':
        okStatus = t.status === 'Dalam Penanganan';
        break;
      case 'RESOLVED':
        okStatus = t.status === 'Selesai';
        break;
    }
    if (!okStatus) return false;
    if (!q) return true;
    return [t.id, t.title, t.target, t.severity, t.status, t.technicians]
      .some(v => v != null && String(v).toLowerCase().includes(q));
  });
});

// STATE ANALITIK
const analyticsFilter = ref('24h');
const analyticsSeverity = ref('ALL');
const analyticsError = ref('');

const filterLabelText = computed(() => {
  const periodTxt = analyticsFilter.value === '24h' ? '24 Jam Terakhir' : (analyticsFilter.value === '7d' ? '7 Hari Terakhir' : '30 Hari Terakhir');
  const sevTxt = analyticsSeverity.value === 'ALL' ? 'Semua Level (Warning, Critical, Down)' : `Level ${analyticsSeverity.value}`;
  return `${periodTxt} - ${sevTxt}`;
});

// Hanya menampung 4 Metrik Utama
const analytics = ref({
  summary: { total_uptime_sec: 0, total_downtime_sec: 0, mttr_sec: 0, availability: 100, incident_count: 0 },
  chartData: []
});

// Format Waktu & Warna Dasar
const formatDate = (dateString) => formatWibShort(dateString);

const getIndicatorColor = (t) => t.status === 'Selesai' ? 'bg-emerald-500' : t.severity === 'RECOVERED' ? 'bg-blue-500' : t.severity === 'DOWN' ? 'bg-rose-500' : t.severity === 'CRITICAL' ? 'bg-orange-500' : 'bg-amber-400';
const getStatusBadge = (s, sv) => s === 'Selesai' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : sv === 'RECOVERED' ? 'bg-blue-50 text-blue-700 border-blue-200/60' : s === 'Dalam Penanganan' ? 'bg-cyan-50 text-cyan-700 border-cyan-200/60' : sv === 'DOWN' ? 'bg-rose-50 text-rose-700 border-rose-200/60' : sv === 'CRITICAL' ? 'bg-orange-50 text-orange-700 border-orange-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60';
const getTimelineProgress = (s) => s === 'Gangguan Aktif' ? 'bg-rose-500 w-0' : s === 'Dalam Penanganan' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 w-[50%]' : 'bg-emerald-500 w-full';

// FORMATTER WAKTU PRESISI (Detik -> Hari, Jam, Menit, Detik)
const formatPreciseDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '0d';
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  let parts = [];
  if (d > 0) parts.push(`${d} hari`);
  if (h > 0) parts.push(`${h}j`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}d`);
  return parts.join(' ');
};

// PANGGILAN DATA API (REALTIME POLLING)
const fetchDataAll = async (silent = false) => {
  fetchTickets(silent);
  fetchAnalytics();
};

const fetchTickets = async (silent = false) => {
  if (!silent && tickets.value.length === 0) {
    isLoading.value = true;
  }
  try {
    const response = await fetch('/api/incidents');
    const json = await response.json();
    if (json.success) {
      tickets.value = json.data.map((t, i) => {
        let expanded = expandedMap.value[t.id];
        if (expanded === undefined) {
          expanded = !hasInitializedExpand.value && i === 0 && t.status !== 'Selesai';
          expandedMap.value[t.id] = expanded;
        }
        return { ...t, isExpanded: expanded };
      });
      
      hasInitializedExpand.value = true;

      // ==========================================
      // PERBAIKAN: Kalkulasi Total Riwayat (Keseluruhan)
      // Menggunakan fallback original_severity agar tiket yang sudah 
      // 'RECOVERED' tetap terhitung di kategori aslinya.
      // ==========================================
      stats.value.down = tickets.value.filter(t => (t.original_severity || t.severity) === 'DOWN').length;
      stats.value.critical = tickets.value.filter(t => (t.original_severity || t.severity) === 'CRITICAL').length;
      stats.value.warning = tickets.value.filter(t => (t.original_severity || t.severity) === 'WARNING').length;
      
      // Status progres dan selesai dibiarkan normal
      stats.value.progress = tickets.value.filter(t => t.status === 'Dalam Penanganan').length;
      stats.value.resolved = tickets.value.filter(t => t.is_resolved === 1).length;
    }
  } catch (e) {
    console.error(e);
  } finally {
    isLoading.value = false;
  }
};

const fetchAnalytics = async () => {
  try {
    const response = await fetch(`/api/analytics?period=${analyticsFilter.value}&severity=${analyticsSeverity.value}`);
    const json = await response.json();
    if (!json.success) throw new Error();

    const sum = json.summary;
    const devices = sum.total_devices || 1;
    const humanUptimeSec = sum.total_uptime_sec / devices;

    analytics.value = {
      summary: {
        total_uptime_sec: humanUptimeSec,
        total_downtime_sec: sum.total_downtime_sec,
        mttr_sec: sum.mttr_sec,
        availability: parseFloat(sum.availability),
        incident_count: sum.incident_count || 0
      },
      chartData: json.chartData.map(d => ({
        label: d.label,
        total_uptime_sec: d.total_uptime_sec,
        total_downtime_sec: d.total_downtime_sec,
        incident_count: d.incident_count || 0,
        mttr_sec: d.mttr_sec,
        availability: parseFloat(d.availability)
      }))
    };
    analyticsError.value = '';
  } catch (e) {
    analyticsError.value = 'Gagal memuat grafik analitik.';
  }
};

// FUNGSI EXPORT PDF (24 Jam, 7 Hari, 30 Hari)
const PERIOD_CONFIG = {
  '24h': { label: '24 Jam Terakhir', ms: 24 * 3600 * 1000 },
  '7d':  { label: '7 Hari Terakhir', ms: 7 * 24 * 3600 * 1000 },
  '30d': { label: '30 Hari Terakhir', ms: 30 * 24 * 3600 * 1000 }
};

const exportToPdf = async (periodKey) => {
  showExportMenu.value = false;
  if (isExporting.value) return;
  isExporting.value = true;

  try {
    const periodCfg = PERIOD_CONFIG[periodKey] || PERIOD_CONFIG['24h'];
    const sevFilter = analyticsSeverity.value;
    const sevLabel = sevFilter === 'ALL' ? 'Semua Level (Warning, Critical, Down)' : `Level ${sevFilter}`;

    // Ambil data analitik dan tiket terbaru sesuai periode yang dipilih
    const [analyticsRes, incidentsRes] = await Promise.all([
      fetch(`/api/analytics?period=${periodKey}&severity=${sevFilter}`),
      fetch('/api/incidents')
    ]);
    const analyticsJson = await analyticsRes.json();
    const incidentsJson = await incidentsRes.json();

    if (!analyticsJson.success || !incidentsJson.success) {
      throw new Error('Gagal mengambil data laporan dari server.');
    }

    const sum = analyticsJson.summary;
    const chartRows = analyticsJson.chartData || [];
    const nowMs = Date.now();
    const winStartMs = nowMs - periodCfg.ms;

    // Filter daftar tiket yang berada dalam rentang waktu periode & level severity
    const periodTickets = (incidentsJson.data || []).filter(t => {
      const startDate = parseUtcDate(t.time);
      const endDate = t.resolved_at ? parseUtcDate(t.resolved_at) : new Date(nowMs);
      const startMs = startDate ? startDate.getTime() : 0;
      const endMs = endDate ? endDate.getTime() : nowMs;
      const inWindow = endMs > winStartMs && startMs < nowMs;
      if (!inWindow) return false;
      if (sevFilter !== 'ALL') {
        const origSev = String(t.original_severity || t.severity || '').toUpperCase();
        return origSev === sevFilter;
      }
      return true;
    });

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header Laporan
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 32, 'F');
    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('VIEWMOX - LAPORAN REKAPITULASI GANGGUAN & ANALITIK SLA', 14, 13);

    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Periode Laporan: ${periodCfg.label}   |   Filter Level: ${sevLabel}`, 14, 20);
    doc.text(`Waktu Cetak: ${formatWibDateTime(new Date())} WIB`, 14, 26);

    // 1. Tabel Ringkasan Metrik Kinerja Sistem (ITIL SLA)
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('1. Ringkasan Metrik Kinerja Sistem (SLA)', 14, 40);

    autoTable(doc, {
      startY: 43,
      head: [['Total Uptime', 'Total Downtime', 'MTTR (Rata-rata Pemulihan)', 'Availability (%)', 'Total Insiden']],
      body: [[
        formatPreciseDuration(sum.total_uptime_sec),
        formatPreciseDuration(sum.total_downtime_sec),
        formatPreciseDuration(sum.mttr_sec),
        `${sum.availability}%`,
        `${sum.incident_count || 0} Tiket`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 9 },
      bodyStyles: { halign: 'center', fontSize: 9.5, fontStyle: 'bold', textColor: [30, 41, 59] },
      margin: { left: 14, right: 14 }
    });

    // 2. Tabel Rincian Analitik per Periode Bucket
    let nextY = doc.lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`2. Rincian Analitik per ${periodKey === '24h' ? 'Jam' : 'Hari'}`, 14, nextY);

    autoTable(doc, {
      startY: nextY + 3,
      head: [['Periode Waktu (WIB)', 'Total Uptime', 'Total Downtime', 'Jumlah Insiden', 'MTTR', 'Availability']],
      body: chartRows.map(r => [
        r.label,
        formatPreciseDuration(r.total_uptime_sec),
        formatPreciseDuration(r.total_downtime_sec),
        `${r.incident_count || 0}`,
        formatPreciseDuration(r.mttr_sec),
        `${r.availability}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        3: { halign: 'center' },
        5: { halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    });

    // 3. Tabel Daftar Riwayat Tiket Gangguan
    nextY = doc.lastAutoTable.finalY + 8;
    if (nextY > 175) {
      doc.addPage();
      nextY = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`3. Daftar Riwayat Tiket Gangguan (${periodTickets.length} Tiket)`, 14, nextY);

    const ticketBody = periodTickets.length > 0
      ? periodTickets.map((t, idx) => [
          idx + 1,
          t.id,
          formatWibDateTime(t.time),
          t.target,
          t.original_severity || t.severity,
          t.title,
          t.status,
          t.technicians || 'Auto-Recover / Belum Ada',
          t.downtime_duration || '-',
          t.handling_duration || '-'
        ])
      : [['-', '-', '-', '-', '-', 'Tidak ada riwayat tiket gangguan pada rentang periode dan level ini.', '-', '-', '-', '-']];

    autoTable(doc, {
      startY: nextY + 3,
      head: [['No', 'ID Tiket', 'Waktu Kejadian (WIB)', 'Target', 'Level', 'Deskripsi Gangguan', 'Status', 'Teknisi', 'Downtime', 'Penanganan']],
      body: ticketBody,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], valign: 'middle' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 9 },
        1: { fontStyle: 'bold', cellWidth: 25 },
        2: { cellWidth: 32 },
        3: { cellWidth: 34 },
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
        5: { cellWidth: 68 },
        6: { halign: 'center', cellWidth: 24 },
        7: { cellWidth: 27 },
        8: { halign: 'center', cellWidth: 16 },
        9: { halign: 'center', cellWidth: 16 }
      },
      margin: { left: 14, right: 14 }
    });

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`Laporan_Rekap_Gangguan_${periodKey}_${sevFilter}_${stamp}.pdf`);
  } catch (err) {
    console.error('Error exportToPdf:', err);
    showToast('error', 'Gagal Mengekspor', 'Gagal mengekspor laporan PDF.');
  } finally {
    isExporting.value = false;
  }
};

const setAnalyticsFilter = (filter) => {
  if (analyticsFilter.value === filter) return;
  analyticsFilter.value = filter;
  fetchAnalytics();
};

const setAnalyticsSeverity = (severity) => {
  if (analyticsSeverity.value === severity) return;
  analyticsSeverity.value = severity;
  fetchAnalytics();
};

// GRAFIK & VISUAL
const availabilityColor = computed(() => {
  const a = analytics.value.summary.availability;
  return a >= 99 ? 'text-emerald-600' : a >= 95 ? 'text-amber-600' : 'text-rose-600';
});
const availabilityBar = computed(() => {
  const a = analytics.value.summary.availability;
  return a >= 99 ? 'bg-emerald-500' : a >= 95 ? 'bg-amber-500' : 'bg-rose-500';
});

// Konfigurasi ApexCharts
const chartLabels = computed(() => analytics.value.chartData.map(d => d.label));
const seriesOf = (key) => analytics.value.chartData.map(d => d[key]);

const baseChartOptions = (type) => {
  const dark = isDark.value;
  return {
    chart: { type, background: 'transparent', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
    theme: { mode: dark ? 'dark' : 'light' },
    grid: { borderColor: dark ? '#334155' : '#f1f5f9', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: chartLabels.value,
      labels: { style: { colors: dark ? '#94a3b8' : '#64748b', fontSize: '11px' } },
      axisBorder: { color: dark ? '#334155' : '#e2e8f0' },
      axisTicks: { color: dark ? '#334155' : '#e2e8f0' }
    },
    tooltip: { theme: dark ? 'dark' : 'light' },
    legend: { labels: { colors: dark ? '#cbd5e1' : '#475569' }, fontSize: '11px' }
  };
};

const availabilitySeries = computed(() => [{ name: 'Availability', data: seriesOf('availability') }]);
const availabilityOptions = computed(() => {
  const vals = seriesOf('availability');
  const minVal = vals.length ? Math.max(0, Math.floor(Math.min(...vals)) - 1) : 0;
  const dark = isDark.value;
  return {
    ...baseChartOptions('area'), colors: ['#10b981'], stroke: { curve: 'smooth', width: 2.5 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02 } },
    yaxis: { min: minVal, max: 100, labels: { style: { colors: dark ? '#94a3b8' : '#64748b', fontSize: '11px' }, formatter: (v) => `${v.toFixed(1)}%` } },
    tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v) => `${v.toFixed(2)}%` } }
  };
});

// DETAIL WAKTU PADA CHART MTTR
const CHART_UNITS = [
  { name: 'Detik', div: 1 }, { name: 'Menit', div: 60 }, { name: 'Jam', div: 3600 }, { name: 'Hari', div: 86400 }
];

const pickChartUnit = (maxSec) => {
  if (maxSec < 120) return CHART_UNITS[0];
  if (maxSec < 7200) return CHART_UNITS[1];
  if (maxSec < 172800) return CHART_UNITS[2];
  return CHART_UNITS[3];
};

const seriesInUnit = (key, unit) => analytics.value.chartData.map(d => Math.round(((d[key] || 0) / unit.div) * 1000) / 1000);

const formatFullDuration = (totalSeconds) => {
  const total = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (total === 0) return 'Tidak ada data (0 detik)';
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (d > 0) parts.push(`${d} hari`);
  if (h > 0) parts.push(`${h} jam`);
  if (m > 0) parts.push(`${m} menit`);
  if (s > 0) parts.push(`${s} detik`);
  return `${parts.join(' ')} (${total.toLocaleString('id-ID')} detik)`;
};

const mttrUnit = computed(() => pickChartUnit(Math.max(0, ...analytics.value.chartData.map(d => d.mttr_sec))));

const describeSeries = (key) => {
  const rows = analytics.value.chartData.filter(d => d[key] > 0);
  if (rows.length === 0) return null;
  const peak = rows.reduce((a, b) => (b[key] > a[key] ? b : a));
  const low = rows.reduce((a, b) => (b[key] < a[key] ? b : a));
  const avg = rows.reduce((sum, d) => sum + d[key], 0) / rows.length;
  return { peak, low, avg, count: rows.length };
};

const mttrInfo = computed(() => describeSeries('mttr_sec'));

const durationAxis = (unit) => {
  const labelColor = isDark.value ? '#94a3b8' : '#64748b';
  return {
    min: 0,
    title: { text: `${unit.name} (label: hari/jam/menit/detik)`, style: { color: labelColor, fontSize: '10px', fontWeight: 600 } },
    labels: { style: { colors: labelColor, fontSize: '11px' }, formatter: (v) => formatPreciseDuration(Math.round(v * unit.div)) }
  };
};

const mttrSeries = computed(() => [{ name: 'MTTR', data: seriesInUnit('mttr_sec', mttrUnit.value) }]);
const mttrOptions = computed(() => ({
  ...baseChartOptions('bar'), colors: ['#06b6d4'],
  plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
  yaxis: durationAxis(mttrUnit.value),
  tooltip: { theme: isDark.value ? 'dark' : 'light', y: { formatter: (v, { dataPointIndex }) => formatFullDuration(analytics.value.chartData[dataPointIndex]?.mttr_sec) } }
}));

let refreshTimer = null;
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer); });
onMounted(() => {
  fetchDataAll(false);
  // Polling realtime setiap 3 detik tanpa me-reset status expand tiket
  refreshTimer = setInterval(() => fetchDataAll(true), 3000);
});
</script>
