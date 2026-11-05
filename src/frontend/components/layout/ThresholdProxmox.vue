<template>
  <div class="animate-fade-in relative min-h-[80vh] font-sans">

    <div class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-6">

      <div class="flex items-center gap-2.5 flex-1 max-w-lg">
        <div class="relative flex-1 h-[42px]">
          <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm"></i>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Cari target node / VM / LXC..." 
            class="pl-9 pr-8 h-full w-full border border-slate-200 bg-white text-slate-900 rounded-lg text-xs font-medium hover:bg-slate-50 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition outline-none placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          >
          <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition">
            <i class="ph-bold ph-x text-xs"></i>
          </button>
        </div>

        <div class="relative h-[42px] min-w-[160px]">
          <select 
            v-model="filterType" 
            title="Filter Tipe Target" 
            class="w-full h-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg pl-8 pr-8 hover:bg-slate-50 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition outline-none appearance-none cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          >
            <option value="ALL">Semua Tipe Target</option>
            <option value="NODE">Node Fisik</option>
            <option value="VM">Virtual Machine (VM)</option>
            <option value="LXC">LXC Container</option>
          </select>
          <i class="ph-bold ph-funnel text-xs absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" :class="filterType !== 'ALL' ? 'text-emerald-500' : 'text-slate-400'"></i>
          <i class="ph-bold ph-caret-down text-xs absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
        </div>
      </div>

      <div class="flex items-center gap-2.5 shrink-0 justify-end">
        <div class="relative" ref="presetDropdownRef">
          <button 
            type="button" 
            @click="showPresetMenu = !showPresetMenu" 
            class="px-3.5 h-[42px] bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg flex items-center gap-2 text-xs font-semibold transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            title="Terapkan preset ke target yang ditampilkan"
          >
            <i class="ph-bold ph-sliders-horizontal text-sm text-slate-500"></i>
            <span>Preset Nilai</span>
            <i class="ph-bold ph-caret-down text-xs transition-transform duration-200 text-slate-400" :class="showPresetMenu ? 'rotate-180' : ''"></i>
          </button>

          <div 
            v-if="showPresetMenu" 
            class="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200/80 rounded-xl shadow-xl py-1.5 z-50 overflow-hidden animate-fade-in font-sans"
          >
            <div class="px-3.5 py-2 bg-slate-50/80 border-b border-slate-100">
              <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Terapkan Preset Proxmox</p>
              <p class="text-[11px] text-slate-400 mt-0.5">Berlaku untuk target yang difilter</p>
            </div>
            <button 
              type="button" 
              @click="applyPreset('standard')"
              class="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-start gap-2.5 transition text-xs group"
            >
              <div class="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                <i class="ph-bold ph-check text-xs"></i>
              </div>
              <div>
                <p class="font-bold text-slate-800 group-hover:text-slate-900">Standar / Rekomendasi</p>
                <p class="text-[11px] text-slate-500">CPU: 75%/90% | RAM: 80%/95%</p>
              </div>
            </button>
            <button 
              type="button" 
              @click="applyPreset('aggressive')"
              class="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-start gap-2.5 transition text-xs group"
            >
              <div class="w-6 h-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 border border-rose-100">
                <i class="ph-bold ph-lightning text-xs"></i>
              </div>
              <div>
                <p class="font-bold text-slate-800 group-hover:text-slate-900">Ketat / Server Kritis</p>
                <p class="text-[11px] text-slate-500">CPU: 60%/80% | RAM: 70%/85%</p>
              </div>
            </button>
            <button 
              type="button" 
              @click="applyPreset('relaxed')"
              class="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-start gap-2.5 transition text-xs group"
            >
              <div class="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-100">
                <i class="ph-bold ph-shield-check text-xs"></i>
              </div>
              <div>
                <p class="font-bold text-slate-800 group-hover:text-slate-900">Toleran / Beban Tinggi</p>
                <p class="text-[11px] text-slate-500">CPU: 85%/95% | RAM: 90%/98%</p>
              </div>
            </button>
          </div>
        </div>

        <button 
          @click="openAddModal" 
          class="px-3.5 h-[42px] bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg flex items-center gap-2 text-xs font-semibold transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] whitespace-nowrap"
        >
          <i class="ph-bold ph-plus text-sm"></i> Tambah Target
        </button>

        <button 
          v-if="hasUnsavedChanges && !isSaving" 
          @click="discardChanges" 
          class="px-3.5 h-[42px] bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg flex items-center gap-2 text-xs font-semibold transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
        >
          Batal
        </button>

        <button 
          @click="saveChanges" 
          :disabled="!hasUnsavedChanges || isSaving" 
          class="px-4 h-[42px] rounded-lg flex items-center gap-2 text-xs font-bold transition-all duration-300 shadow-sm whitespace-nowrap" 
          :class="hasUnsavedChanges ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer' : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'"
        >
          <i class="text-sm" :class="isSaving ? 'ph-bold ph-spinner animate-spin' : 'ph-bold ph-floppy-disk'"></i> 
          {{ isSaving ? 'Menyimpan...' : 'Simpan' }}
        </button>
      </div>

    </div>

    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 bg-white border border-slate-200/80 rounded-xl shadow-sm">
      <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i>
      <p class="text-slate-500 font-medium text-xs">Memuat konfigurasi Proxmox...</p>
    </div>

    <div v-else-if="filteredTargets.length === 0" class="flex flex-col items-center justify-center py-16 bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-slate-500">
      <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <i class="ph-bold ph-magnifying-glass text-xl"></i>
      </div>
      <p class="font-bold text-sm text-slate-800">Tidak Ada Target Proxmox yang Sesuai</p>
      <p class="font-medium text-xs text-slate-500 mt-1">Coba ubah kata kunci pencarian atau pilihan filter tipe target.</p>
      <button @click="searchQuery = ''; filterType = 'ALL'" class="mt-4 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition">
        Reset Filter
      </button>
    </div>

    <div v-else class="columns-1 xl:columns-2 gap-6">

      <div 
        v-for="target in filteredTargets" 
        :key="target.id" 
        class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-visible flex flex-col transition-all hover:border-slate-300 hover:shadow-md break-inside-avoid mb-6 w-full"
      >

        <div class="px-6 py-4 bg-slate-50/80 border-b border-slate-200/80 flex justify-between items-center rounded-t-xl">
          <div class="flex items-center gap-3">
            <div>
              <h3 class="text-slate-900 font-bold flex items-center gap-2 text-base tracking-tight">
                {{ target.name }}
                <span 
                  class="px-2 py-0.5 rounded-md text-[9px] uppercase font-bold tracking-wider border" 
                  :class="target.type === 'NODE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : (target.type === 'VM' ? 'bg-blue-50 text-blue-700 border-blue-200/60' : 'bg-purple-50 text-purple-700 border-purple-200/60')"
                >
                  {{ target.type }} {{ target.vmid || target.node }}
                </span>
              </h3>
              <p class="text-slate-500 text-[11px] font-medium mt-0.5">
                Node: <span class="font-mono tracking-tight text-slate-700 font-semibold">{{ target.node }}</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <div class="relative card-menu-container">
              <button 
                type="button" 
                @click="toggleCardMenu(target.id)" 
                class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition" 
                title="Opsi Preset Target Ini"
              >
                <i class="ph-bold ph-dots-three-vertical text-lg"></i>
              </button>

              <div 
                v-if="activeCardMenuId === target.id" 
                class="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200/90 rounded-xl shadow-lg py-1 z-30 animate-fade-in font-sans"
              >
                <div class="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                  <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Preset Target Ini</p>
                </div>
                <button 
                  type="button" 
                  @click="applySinglePreset(target, 'standard')" 
                  class="w-full px-3 py-1.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition"
                >
                  <i class="ph-bold ph-check text-blue-600 text-xs"></i> Standar (CPU 75/90%)
                </button>
                <button 
                  type="button" 
                  @click="applySinglePreset(target, 'aggressive')" 
                  class="w-full px-3 py-1.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition"
                >
                  <i class="ph-bold ph-lightning text-rose-600 text-xs"></i> Ketat (CPU 60/80%)
                </button>
                <button 
                  type="button" 
                  @click="applySinglePreset(target, 'relaxed')" 
                  class="w-full px-3 py-1.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition"
                >
                  <i class="ph-bold ph-shield-check text-emerald-600 text-xs"></i> Toleran (CPU 85/95%)
                </button>
                <div class="border-t border-slate-100 my-1"></div>
                <button 
                  type="button" 
                  @click="removeTarget(target); activeCardMenuId = null;" 
                  class="w-full px-3 py-1.5 text-left text-[11px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
                >
                  <i class="ph-bold ph-trash text-xs"></i> Hapus Notifikasi
                </button>
              </div>
            </div>

            <button @click="removeTarget(target)" class="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Hapus Notifikasi">
              <i class="ph-bold ph-trash text-lg"></i>
            </button>
          </div>
        </div>

        <div class="p-6 space-y-6 flex-1">
          <div>
            <div class="flex justify-between items-end mb-3">
              <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <i class="ph-fill ph-cpu text-blue-500 text-sm"></i> Utilisasi CPU
              </label>
            </div>
            <div class="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <div class="flex items-center gap-4">
                <div class="w-20 text-[10px] font-bold text-amber-600 tracking-wider">WARNING</div>
                <input type="range" min="1" max="99" v-model="target.cpu.warning" @input="triggerChange" class="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                <div class="w-12 text-right text-sm font-black text-slate-900 font-mono tracking-tight">{{ target.cpu.warning }}%</div>
              </div>
              <div class="flex items-center gap-4">
                <div class="w-20 text-[10px] font-bold text-rose-600 tracking-wider">CRITICAL</div>
                <input type="range" min="1" max="100" v-model="target.cpu.critical" @input="triggerChange" class="w-full accent-rose-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                <div class="w-12 text-right text-sm font-black text-slate-900 font-mono tracking-tight">{{ target.cpu.critical }}%</div>
              </div>
            </div>
          </div>

          <div>
            <div class="flex justify-between items-end mb-3">
              <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <i class="ph-fill ph-memory text-purple-500 text-sm"></i> Penggunaan Memory (RAM)
              </label>
            </div>
            <div class="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <div class="flex items-center gap-4">
                <div class="w-20 text-[10px] font-bold text-amber-600 tracking-wider">WARNING</div>
                <input type="range" min="1" max="99" v-model="target.ram.warning" @input="triggerChange" class="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                <div class="w-12 text-right text-sm font-black text-slate-900 font-mono tracking-tight">{{ target.ram.warning }}%</div>
              </div>
              <div class="flex items-center gap-4">
                <div class="w-20 text-[10px] font-bold text-rose-600 tracking-wider">CRITICAL</div>
                <input type="range" min="1" max="100" v-model="target.ram.critical" @input="triggerChange" class="w-full accent-rose-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                <div class="w-12 text-right text-sm font-black text-slate-900 font-mono tracking-tight">{{ target.ram.critical }}%</div>
              </div>
            </div>
          </div>

          <div v-if="target.type === 'NODE'">
            <div class="flex justify-between items-end mb-3">
              <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <i class="ph-fill ph-hard-drives text-amber-500 text-sm"></i> Keterlambatan I/O Disk (IO Delay)
              </label>
            </div>
            <div class="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <div class="flex items-center gap-4">
                <div class="w-20 text-[10px] font-bold text-amber-600 tracking-wider">WARNING</div>
                <input type="range" min="1" max="99" v-model="target.ioDelay.warning" @input="triggerChange" class="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                <div class="w-12 text-right text-sm font-black text-slate-900 font-mono tracking-tight">{{ target.ioDelay.warning }}%</div>
              </div>
              <div class="flex items-center gap-4">
                <div class="w-20 text-[10px] font-bold text-rose-600 tracking-wider">CRITICAL</div>
                <input type="range" min="1" max="100" v-model="target.ioDelay.critical" @input="triggerChange" class="w-full accent-rose-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                <div class="w-12 text-right text-sm font-black text-slate-900 font-mono tracking-tight">{{ target.ioDelay.critical }}%</div>
              </div>
            </div>
          </div>

          <div class="pt-5 border-t border-slate-100">
            <div class="flex justify-between items-end mb-4">
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <i class="ph-fill ph-bell-ringing text-slate-400 text-sm"></i> Aturan Notifikasi
              </label>
              <div class="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cek API per:</span>
                <input 
                  type="number" 
                  v-model="target.alertSettings.checkInterval" 
                  @input="triggerChange" 
                  class="w-10 bg-transparent text-slate-900 font-mono font-bold text-center outline-none border-b border-slate-300 focus:border-slate-500 transition appearance-none"
                >
                <span class="text-[9px] font-medium text-slate-500">detik</span>
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between bg-amber-50/30 p-3 rounded-xl border border-amber-200/60 shadow-sm">
                <div class="flex items-center gap-2 w-1/3">
                  <i class="ph-fill ph-warning text-amber-500 text-base"></i>
                  <span class="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Warning</span>
                </div>
                <div class="flex items-center justify-center gap-2 w-1/3 border-x border-slate-200/60 px-2">
                  <span class="text-[10px] font-medium text-slate-500">Ulangi</span>
                  <input 
                    type="number" 
                    v-model="target.alertSettings.warning.maxCount" 
                    @input="triggerChange" 
                    class="w-12 bg-white border border-slate-200 text-slate-900 font-mono font-bold text-center rounded-md text-[11px] py-1 outline-none shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                  <span class="text-[10px] font-medium text-slate-500">kali</span>
                </div>
                <div class="w-1/3 flex justify-end pl-2">
                  <div class="relative w-full">
                    <select 
                      v-model="target.alertSettings.warning.type" 
                      @change="triggerChange" 
                      class="w-full bg-white border border-slate-200/90 hover:border-slate-300 text-slate-700 font-semibold text-[11px] rounded-lg py-1.5 pl-2.5 pr-6 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 appearance-none cursor-pointer transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <option value="Pesan">Teks Pesan</option>
                      <option value="Call">Panggilan</option>
                    </select>
                    <i class="ph-bold ph-caret-down text-[10px] text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between bg-orange-50/30 p-3 rounded-xl border border-orange-200/60 shadow-sm">
                <div class="flex items-center gap-2 w-1/3">
                  <i class="ph-fill ph-warning-circle text-orange-500 text-base"></i>
                  <span class="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Critical</span>
                </div>
                <div class="flex items-center justify-center gap-2 w-1/3 border-x border-slate-200/60 px-2">
                  <span class="text-[10px] font-medium text-slate-500">Ulangi</span>
                  <input 
                    type="number" 
                    v-model="target.alertSettings.critical.maxCount" 
                    @input="triggerChange" 
                    class="w-12 bg-white border border-slate-200 text-slate-900 font-mono font-bold text-center rounded-md text-[11px] py-1 outline-none shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                  <span class="text-[10px] font-medium text-slate-500">kali</span>
                </div>
                <div class="w-1/3 flex justify-end pl-2">
                  <div class="relative w-full">
                    <select 
                      v-model="target.alertSettings.critical.type" 
                      @change="triggerChange" 
                      class="w-full bg-white border border-slate-200/90 hover:border-slate-300 text-slate-700 font-semibold text-[11px] rounded-lg py-1.5 pl-2.5 pr-6 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 appearance-none cursor-pointer transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <option value="Pesan">Teks Pesan</option>
                      <option value="Call">Panggilan</option>
                    </select>
                    <i class="ph-bold ph-caret-down text-[10px] text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between bg-rose-50/30 p-3 rounded-xl border border-rose-200/60 shadow-sm">
                <div class="flex items-center gap-2 w-1/3">
                  <i class="ph-bold ph-power text-rose-500 text-base"></i>
                  <span class="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Down</span>
                </div>
                <div class="flex items-center justify-center gap-2 w-1/3 border-x border-slate-200/60 px-2">
                  <span class="text-[10px] font-medium text-slate-500">Ulangi</span>
                  <input 
                    type="number" 
                    v-model="target.alertSettings.down.maxCount" 
                    @input="triggerChange" 
                    class="w-12 bg-white border border-slate-200 text-slate-900 font-mono font-bold text-center rounded-md text-[11px] py-1 outline-none shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                  <span class="text-[10px] font-medium text-slate-500">kali</span>
                </div>
                <div class="w-1/3 flex justify-end pl-2">
                  <div class="relative w-full">
                    <select 
                      v-model="target.alertSettings.down.type" 
                      @change="triggerChange" 
                      class="w-full bg-white border border-slate-200/90 hover:border-slate-300 text-slate-700 font-semibold text-[11px] rounded-lg py-1.5 pl-2.5 pr-6 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 appearance-none cursor-pointer transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <option value="Pesan">Teks Pesan</option>
                      <option value="Call">Panggilan</option>
                    </select>
                    <i class="ph-bold ph-caret-down text-[10px] text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeAddModal">
        <div class="bg-white border border-slate-200/80 shadow-xl rounded-2xl w-full max-w-md overflow-hidden transform transition-all">

          <div class="flex justify-between items-center p-6 border-b border-slate-200/80 bg-slate-50/50">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i class="ph-bold ph-plus-circle text-emerald-500"></i> Aktifkan Notifikasi Proxmox
            </h3>
            <button @click="closeAddModal" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center transition">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Pilih Target Dari Katalog</label>
              <div class="relative">
                <select 
                  v-model="selectedTargetJSON" 
                  class="w-full bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg pl-9 pr-10 py-2.5 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 appearance-none cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <option value="" disabled>{{ isFetchingCatalog ? 'Mengambil data live dari Proxmox...' : '-- Pilih Node / VM / LXC --' }}</option>
                  <option v-for="target in availableTargets" :key="target.uniqueKey" :value="JSON.stringify(target)">
                    {{ target.name }} ({{ target.node }}) - {{ target.type }} {{ target.vmid || '' }}
                  </option>
                </select>
                <i class="ph-bold ph-hard-drives absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm"></i>
                <i class="ph-bold ph-caret-down absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
              </div>
              <p v-if="availableTargets.length === 0" class="text-xs font-medium text-amber-600 mt-2">Semua target Proxmox sudah diaktifkan notifikasinya.</p>
            </div>

            <div class="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-4">
              <button 
                type="button" 
                @click="closeAddModal" 
                class="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                Batal
              </button>
              <button 
                @click="submitNewTarget" 
                :disabled="!selectedTargetJSON" 
                class="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition shadow-[0_1px_2px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Tambahkan
              </button>
            </div>
          </div>

        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="confirmModal.show" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeConfirmModal">
        <div class="bg-white border border-slate-200/80 shadow-xl rounded-2xl w-full max-w-sm overflow-hidden text-center p-6 transform transition-all">
          <div 
            class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border"
            :class="confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-amber-50 text-amber-500 border-amber-100'"
          >
            <i :class="confirmModal.type === 'danger' ? 'ph-fill ph-trash' : 'ph-fill ph-warning-circle'" class="text-3xl"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">{{ confirmModal.title }}</h3>
          <p class="text-xs font-medium text-slate-500 mb-6 leading-relaxed">
            {{ confirmModal.message }}
          </p>
          <div class="flex justify-center gap-3">
            <button @click="closeConfirmModal" class="w-full py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 transition">
              Batal
            </button>
            <button 
              @click="executeConfirm" 
              class="w-full py-2.5 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
              :class="confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'"
            >
              {{ confirmModal.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import ToastNotification from '@/components/common/ToastNotification.vue';

const monitoredTargets = ref([]);
const liveCatalog = ref([]);
const availableTargets = ref([]);
const selectedTargetJSON = ref('');

const searchQuery = ref('');
const filterType = ref('ALL');
const showPresetMenu = ref(false);
const presetDropdownRef = ref(null);
const activeCardMenuId = ref(null);

const hasUnsavedChanges = ref(false);
const isSaving = ref(false);
const isLoading = ref(true);
const isFetchingCatalog = ref(false);
const showAddModal = ref(false);

const filteredTargets = computed(() => {
  return monitoredTargets.value.filter(target => {
    const query = searchQuery.value.trim().toLowerCase();
    const matchesQuery = !query || 
      (target.name && target.name.toLowerCase().includes(query)) ||
      (target.node && target.node.toLowerCase().includes(query)) ||
      (target.vmid && String(target.vmid).includes(query));
    const matchesType = filterType.value === 'ALL' || target.type === filterType.value;
    return matchesQuery && matchesType;
  });
});

const toast = ref({ show: false, type: 'success', title: '', message: '' });
let toastTimeout = null;
const showToast = (type, title, message) => {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.value = { show: true, type, title, message };
  toastTimeout = setTimeout(() => { toast.value.show = false; }, 4000);
};

const confirmModal = ref({
  show: false,
  type: 'warning',
  title: '',
  message: '',
  confirmText: 'Ya, Lanjutkan',
  onConfirm: null
});
const closeConfirmModal = () => { confirmModal.value.show = false; };
const executeConfirm = () => {
  if (confirmModal.value.onConfirm) confirmModal.value.onConfirm();
  closeConfirmModal();
};

const fetchThresholds = async () => {
  isLoading.value = true;
  try {
    const res = await fetch('/api/thresholds/proxmox');
    const data = await res.json();
    if (data.success) {
      monitoredTargets.value = data.data;
    }
    hasUnsavedChanges.value = false;
  } catch (error) {
    console.error("Gagal memuat target threshold:", error);
  } finally {
    isLoading.value = false;
  }
};

const fetchLiveCatalog = async () => {
  isFetchingCatalog.value = true;
  liveCatalog.value = [];

  try {
    const resNodes = await fetch('/api/proxmox');
    const nodesData = await resNodes.json();

    if (nodesData.success) {
      for (const server of nodesData.data) {
        if (server.status === 'TERHUBUNG') {

          try {
            const resStatus = await fetch(`/api/proxmox/${server.id}/status`);
            const statusJson = await resStatus.json();
            if (statusJson.success) {
              statusJson.data.forEach(n => {
                liveCatalog.value.push({
                  uniqueKey: `NODE_${n.node_name}`,
                  vmid: null, name: n.node_name, type: 'NODE', node: n.node_name
                });
              });
            }
          } catch (e) {}

          try {
            const resResources = await fetch(`/api/proxmox/${server.id}/resources`);
            const resJson = await resResources.json();
            if (resJson.success) {
              const rd = resJson.data;
              if (rd.vms) {
                rd.vms.forEach(vm => liveCatalog.value.push({
                  uniqueKey: `VM_${vm.node}_${vm.vmid}`,
                  vmid: vm.vmid, name: vm.name, type: 'VM', node: vm.node
                }));
              }
              if (rd.lxcs) {
                rd.lxcs.forEach(lxc => liveCatalog.value.push({
                  uniqueKey: `LXC_${lxc.node}_${lxc.vmid}`,
                  vmid: lxc.vmid, name: lxc.name, type: 'LXC', node: lxc.node
                }));
              }
            }
          } catch (e) {}
        }
      }
    }
  } catch (error) {
    console.error('Gagal memuat live catalog:', error);
  } finally {
    isFetchingCatalog.value = false;
    filterAvailableTargets();
  }
};

const filterAvailableTargets = () => {
  availableTargets.value = liveCatalog.value.filter(catItem => {
    return !monitoredTargets.value.some(monItem => 
      monItem.type === catItem.type && 
      monItem.node === catItem.node && 
      (monItem.vmid === catItem.vmid || monItem.name === catItem.name)
    );
  });
};

const openAddModal = async () => {
  selectedTargetJSON.value = '';
  showAddModal.value = true; 
  await fetchLiveCatalog();
};

const closeAddModal = () => { showAddModal.value = false; };

const submitNewTarget = () => {
  if (!selectedTargetJSON.value) return;
  const targetData = JSON.parse(selectedTargetJSON.value);

  monitoredTargets.value.push({
    id: `temp_${Date.now()}`,
    vmid: targetData.vmid,
    name: targetData.name,
    type: targetData.type,
    node: targetData.node,
    cpu: { warning: 75, critical: 90 },
    ram: { warning: 80, critical: 95 },
    ioDelay: { warning: 5, critical: 15 }, 
    alertSettings: { checkInterval: 10, warning: { maxCount: 1, type: 'Pesan' }, critical: { maxCount: 3, type: 'Call' }, down: { maxCount: 5, type: 'Call' } }
  });

  triggerChange();
  closeAddModal();
};

const saveChanges = async () => {
  if (!hasUnsavedChanges.value) return;
  isSaving.value = true;

  try {
    const res = await fetch('/api/thresholds/proxmox', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets: monitoredTargets.value })
    });

    const data = await res.json();
    if (data.success) {
      hasUnsavedChanges.value = false;
      showToast('success', 'Konfigurasi Disimpan', 'Konfigurasi threshold Proxmox berhasil disimpan!');
      fetchThresholds();
    } else {
      showToast('error', 'Gagal Menyimpan', data.message || 'Gagal menyimpan konfigurasi threshold Proxmox.');
    }
  } catch (error) {
    showToast('error', 'Kesalahan Jaringan', 'Terjadi kesalahan jaringan saat menyimpan konfigurasi.');
  } finally {
    isSaving.value = false;
  }
};

const triggerChange = () => { hasUnsavedChanges.value = true; };

const discardChanges = () => {
  confirmModal.value = {
    show: true,
    type: 'warning',
    title: 'Batalkan Perubahan?',
    message: 'Semua perubahan konfigurasi threshold Proxmox yang belum disimpan akan dikembalikan ke pengaturan awal.',
    confirmText: 'Ya, Batalkan',
    onConfirm: () => fetchThresholds()
  };
};

const removeTarget = (target) => {
  confirmModal.value = {
    show: true,
    type: 'danger',
    title: 'Hapus Target Pemantauan?',
    message: `Anda akan menghapus target "${target?.name}" dari sistem monitoring threshold Proxmox. Tekan Simpan Perubahan untuk menerapkan.`,
    confirmText: 'Ya, Hapus',
    onConfirm: () => {
      const idx = monitoredTargets.value.findIndex(t => t.id === target.id);
      if (idx !== -1) {
        monitoredTargets.value.splice(idx, 1);
        triggerChange();
      }
    }
  };
};

const applyPreset = (presetKey) => {
  showPresetMenu.value = false;
  if (!monitoredTargets.value || monitoredTargets.value.length === 0) {
    showToast('error', 'Tidak Ada Target', 'Belum ada target yang dikonfigurasi untuk menerapkan preset.');
    return;
  }

  const targetsToUpdate = filteredTargets.value;
  if (targetsToUpdate.length === 0) {
    showToast('error', 'Tidak Ada Target Sesuai', 'Tidak ada target yang cocok dengan filter saat ini.');
    return;
  }

  targetsToUpdate.forEach(t => {
    if (presetKey === 'standard') {
      t.cpu.warning = 75;
      t.cpu.critical = 90;
      t.ram.warning = 80;
      t.ram.critical = 95;
      if (t.ioDelay) {
        t.ioDelay.warning = 5;
        t.ioDelay.critical = 15;
      }
    } else if (presetKey === 'aggressive') {
      t.cpu.warning = 60;
      t.cpu.critical = 80;
      t.ram.warning = 70;
      t.ram.critical = 85;
      if (t.ioDelay) {
        t.ioDelay.warning = 3;
        t.ioDelay.critical = 10;
      }
    } else if (presetKey === 'relaxed') {
      t.cpu.warning = 85;
      t.cpu.critical = 95;
      t.ram.warning = 90;
      t.ram.critical = 98;
      if (t.ioDelay) {
        t.ioDelay.warning = 10;
        t.ioDelay.critical = 25;
      }
    }
  });

  const presetName = presetKey === 'standard' ? 'Standar' : (presetKey === 'aggressive' ? 'Ketat' : 'Toleran');
  showToast('success', `Preset ${presetName} Diterapkan`, `Preset berhasil diterapkan ke ${targetsToUpdate.length} target Proxmox.`);
  triggerChange();
};

const applySinglePreset = (target, presetKey) => {
  activeCardMenuId.value = null;
  if (presetKey === 'standard') {
    target.cpu.warning = 75;
    target.cpu.critical = 90;
    target.ram.warning = 80;
    target.ram.critical = 95;
    if (target.ioDelay) {
      target.ioDelay.warning = 5;
      target.ioDelay.critical = 15;
    }
  } else if (presetKey === 'aggressive') {
    target.cpu.warning = 60;
    target.cpu.critical = 80;
    target.ram.warning = 70;
    target.ram.critical = 85;
    if (target.ioDelay) {
      target.ioDelay.warning = 3;
      target.ioDelay.critical = 10;
    }
  } else if (presetKey === 'relaxed') {
    target.cpu.warning = 85;
    target.cpu.critical = 95;
    target.ram.warning = 90;
    target.ram.critical = 98;
    if (target.ioDelay) {
      target.ioDelay.warning = 10;
      target.ioDelay.critical = 25;
    }
  }
  const presetName = presetKey === 'standard' ? 'Standar' : (presetKey === 'aggressive' ? 'Ketat' : 'Toleran');
  showToast('success', `Preset ${presetName} Diterapkan`, `Preset berhasil diterapkan ke "${target.name}".`);
  triggerChange();
};

const toggleCardMenu = (targetId) => {
  activeCardMenuId.value = activeCardMenuId.value === targetId ? null : targetId;
};

const handleDocumentClick = (e) => {
  if (presetDropdownRef.value && !presetDropdownRef.value.contains(e.target)) {
    showPresetMenu.value = false;
  }
  if (activeCardMenuId.value) {
    const cardMenuEls = document.querySelectorAll('.card-menu-container');
    let clickedInside = false;
    cardMenuEls.forEach(el => {
      if (el.contains(e.target)) clickedInside = true;
    });
    if (!clickedInside) activeCardMenuId.value = null;
  }
};

watch(monitoredTargets, (newTargets) => {
  newTargets.forEach(target => {
    if (parseInt(target.cpu.warning) >= parseInt(target.cpu.critical)) target.cpu.warning = target.cpu.critical - 1;
    if (parseInt(target.ram.warning) >= parseInt(target.ram.critical)) target.ram.warning = target.ram.critical - 1;
    if (target.type === 'NODE' && parseInt(target.ioDelay.warning) >= parseInt(target.ioDelay.critical)) target.ioDelay.warning = target.ioDelay.critical - 1;
  });
}, { deep: true });

onMounted(() => {
  fetchThresholds();
  document.addEventListener('click', handleDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
});
</script>

<style scoped>
input[type=range] { -webkit-appearance: none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #ffffff; cursor: pointer; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3); margin-top: -6px; }
input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 6px; cursor: pointer; border-radius: 4px; }
input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
</style>
