<template> 
  <main class="bg-[#f8f9fa] min-h-screen font-sans p-8 pb-12 overflow-x-hidden relative animate-fade-in"> 
    <!-- Header Halaman --> 
    <div class="flex justify-between items-end mb-6"> 
      <div> 
        <h2 class="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-3"> 
          <i class="ph-bold ph-user-list text-slate-700"></i> Kelola Pengguna Sistem 
        </h2> 
        <p class="text-slate-500 text-sm font-medium">Daftar operator dan hak akses user ke API daemon.</p> 
      </div> 
      <div> 
        <button @click="openAddModal" class="px-4 h-[42px] bg-slate-900 text-white rounded-lg flex items-center gap-2 hover:bg-slate-800 text-xs font-bold transition shadow-[0_1px_2px_rgba(0,0,0,0.04)]"> 
          <i class="ph-bold ph-user-plus text-lg"></i> TAMBAH PENGGUNA 
        </button> 
      </div> 
    </div> 

    <!-- Filter & Search Bar --> 
    <div class="bg-white border border-slate-200/80 p-4 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-6 flex justify-between items-center"> 
      <div class="relative w-96"> 
        <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i> 
        <input type="text" v-model="searchQuery" placeholder="Cari nama atau username..." class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-slate-400 transition shadow-sm placeholder:text-slate-400"> 
      </div> 
      <div class="flex items-center gap-4"> 
        <select v-model="filterRole" class="bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 outline-none focus:border-slate-400 appearance-none pr-8 relative cursor-pointer shadow-sm"> 
          <option value="Semua Role">Semua Role</option> 
          <option value="Admin">Admin</option> 
          <option value="Teknisi">Teknisi</option> 
          <option value="Kepala Bidang">Kepala Bidang</option> 
        </select> 
      </div> 
    </div> 

    <!-- Data Table & Pagination Container --> 
    <div class="bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col"> 
      <div class="overflow-x-auto"> 
        <table class="w-full text-left border-collapse"> 
          <thead> 
            <tr class="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500"> 
              <th class="px-6 py-3.5">Nama Lengkap</th> 
              <th class="px-6 py-3.5">Username</th> 
              <th class="px-6 py-3.5">Role Akses</th> 
              <th class="px-6 py-3.5">Status Token API</th> 
              <th class="px-6 py-3.5 text-center">Status Akun</th> 
              <th class="px-6 py-3.5 text-center">Aksi</th> 
            </tr> 
          </thead> 
          <tbody class="text-sm"> 
            <tr v-if="isLoading" class="border-b border-slate-100"> 
              <td colspan="6" class="px-6 py-12 text-center text-slate-500"> 
                <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2 inline-block"></i> 
                <p class="text-xs font-medium">Memuat data pengguna...</p> 
              </td> 
            </tr> 
            <tr v-else-if="filteredUsers.length === 0" class="border-b border-slate-100"> 
              <td colspan="6" class="px-6 py-12 text-center text-slate-500"> 
                <i class="ph-duotone ph-users-slash text-4xl mb-2 text-slate-300"></i> 
                <p class="text-sm font-medium">Tidak ada pengguna yang ditemukan.</p> 
              </td> 
            </tr> 
            <tr v-else v-for="user in paginatedUsers" :key="user.id" class="border-b border-slate-100 hover:bg-slate-50 transition" :class="!user.is_active ? 'opacity-60 grayscale-[20%]' : ''"> 
              <td class="px-6 py-4"> 
                <div class="flex items-center gap-3"> 
                  <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border shadow-sm" :class="getAvatarStyle(user.role)"> 
                    {{ getInitials(user.name) }} 
                  </div> 
                  <div> 
                    <p class="text-slate-900 font-bold flex items-center gap-2 text-sm tracking-tight"> 
                      {{ user.name }} 
                      <i v-if="!user.is_active" class="ph-fill ph-lock-key text-rose-500 text-xs" title="Akun Dinonaktifkan"></i> 
                    </p> 
                    <p class="text-slate-500 text-[11px] font-medium">{{ user.email || '-' }}</p> 
                  </div> 
                </div> 
              </td> 
              <td class="px-6 py-4 text-slate-600 font-mono text-xs font-semibold tracking-tight">@{{ user.username }}</td> 
              <td class="px-6 py-4"> 
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-semibold uppercase tracking-wider" :class="getRoleStyle(user.role).class"> 
                  <i :class="getRoleStyle(user.role).icon"></i> {{ user.role }} 
                </span> 
              </td> 
              <td class="px-6 py-4"> 
                <div class="flex items-center gap-1.5 text-xs font-semibold" :class="getTokenStatus(user).color"> 
                  <span class="w-1.5 h-1.5 rounded-full" :class="getTokenStatus(user).dot"></span> {{ getTokenStatus(user).text }} 
                </div> 
              </td> 
              <td class="px-6 py-4 text-center"> 
                <button @click="toggleStatus(user)" :disabled="isToggling === user.id" class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none transition-colors duration-300 ease-in-out" :class="user.is_active ? 'bg-emerald-100 border border-emerald-200' : 'bg-slate-100 border border-slate-200'" :title="user.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'"> 
                  <span class="sr-only">Toggle user status</span> 
                  <span class="pointer-events-none flex h-4 w-4 items-center justify-center transform rounded-full shadow ring-0 transition duration-300 ease-in-out" :class="user.is_active ? 'translate-x-2 bg-emerald-500' : '-translate-x-2 bg-slate-400'"> 
                    <i v-if="isToggling === user.id" class="ph-bold ph-spinner animate-spin text-white text-[8px]"></i> 
                  </span> 
                </button> 
              </td> 
              <td class="px-6 py-4 text-center"> 
                <div class="flex items-center justify-center gap-1.5 text-slate-400"> 
                  <button v-if="user.role !== 'Admin'" @click="openTokenModal(user)" class="p-1.5 rounded-md hover:bg-amber-50 hover:text-amber-600 transition" title="Manajemen Token API"> 
                    <i class="ph-bold ph-key text-base"></i> 
                  </button> 
                  <button @click="editUser(user)" class="p-1.5 rounded-md hover:bg-blue-50 hover:text-blue-600 transition" title="Edit Pengguna"> 
                    <i class="ph-bold ph-pencil-simple text-base"></i> 
                  </button> 
                  <button @click="confirmDeleteUser(user)" class="p-1.5 rounded-md hover:bg-rose-50 hover:text-rose-600 transition" title="Hapus Pengguna"> 
                    <i class="ph-bold ph-trash text-base"></i> 
                  </button> 
                </div> 
              </td> 
            </tr> 
          </tbody> 
        </table> 
      </div> 
      <!-- PAGINATION CONTROLS --> 
      <div v-if="!isLoading && filteredUsers.length > 0" class="bg-slate-50/50 px-6 py-4 flex items-center justify-between border-t border-slate-100"> 
        <span class="text-xs text-slate-500 font-medium"> 
          Menampilkan <span class="font-bold text-slate-900">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> sampai <span class="font-bold text-slate-900">{{ Math.min(currentPage * itemsPerPage, filteredUsers.length) }}</span> dari <span class="font-bold text-slate-900">{{ filteredUsers.length }}</span> pengguna 
        </span> 
        <div class="flex items-center gap-2"> 
          <button @click="prevPage" :disabled="currentPage === 1" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
            <i class="ph-bold ph-caret-left"></i> 
          </button> 
          <button @click="nextPage" :disabled="currentPage === totalPages" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
            <i class="ph-bold ph-caret-right"></i> 
          </button> 
        </div> 
      </div> 
    </div> 

    <!-- MODAL MANAJEMEN TOKEN API --> 
    <Teleport to="body"> 
      <div v-if="showTokenModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeTokenModal"> 
        <div class="bg-white border border-slate-200/80 shadow-xl rounded-2xl w-full max-w-lg overflow-hidden transform transition-all relative"> 
          <div class="flex justify-between items-center p-6 bg-slate-50/50 border-b border-slate-200/80"> 
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2"> 
              <i class="ph-bold ph-key text-amber-500"></i> Manajemen Token Mobile 
            </h3> 
            <button @click="closeTokenModal" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center transition"> 
              <i class="ph-bold ph-x text-lg"></i> 
            </button> 
          </div> 
          <div class="p-6 space-y-6"> 
            <p class="text-sm text-slate-600 leading-relaxed font-medium"> 
              API Token untuk pengguna <span class="font-bold text-slate-900 font-mono tracking-tight">@{{ activeTokenUser?.username }}</span>. Gunakan kunci ini pada aplikasi Mobile untuk otentifikasi. 
            </p> 
            <div v-if="isLoadingToken" class="flex flex-col items-center justify-center py-6 text-slate-500"> 
              <i class="ph-bold ph-spinner animate-spin text-2xl text-slate-400 mb-2"></i> 
              <p class="text-xs font-medium">Memuat token API...</p> 
            </div> 
            <div v-else> 
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Access Token</label> 
              <div class="flex gap-2"> 
                <div class="relative flex-1"> 
                  <input :type="showApiToken ? 'text' : 'password'" :value="apiTokenString" readonly class="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold rounded-lg pl-4 pr-10 py-2.5 outline-none font-mono tracking-tight selection:bg-amber-100 shadow-inner"> 
                  <button type="button" @click="showApiToken = !showApiToken" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"> 
                    <i :class="showApiToken ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye'" class="text-lg"></i> 
                  </button> 
                </div> 
                <!-- PERBAIKAN: Sisipkan apiTokenString ke pemanggilan fungsi copyToken -->
                <button @click="copyToken(apiTokenString)" class="px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg transition flex items-center justify-center gap-2 shadow-sm" title="Salin Token"> 
                  <i class="ph-bold ph-copy"></i> 
                </button> 
              </div> 
            </div> 
          </div> 
          <div class="bg-slate-50/50 px-6 py-4 flex justify-between items-center border-t border-slate-200/80"> 
            <button @click="confirmResetToken" class="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 rounded-lg text-xs font-bold transition flex items-center gap-2"> 
              <i class="ph-bold ph-arrows-clockwise"></i> Generate Ulang Token 
            </button> 
            <button @click="closeTokenModal" class="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 bg-white border border-slate-200 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
              Tutup 
            </button> 
          </div> 
        </div> 
      </div> 
    </Teleport> 

    <!-- MODAL KONFIRMASI GENERATE ULANG TOKEN --> 
    <Teleport to="body"> 
      <div v-if="showConfirmResetTokenModal" class="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeConfirmResetTokenModal"> 
        <div class="bg-white border border-slate-200/80 shadow-xl rounded-2xl w-full max-w-md overflow-hidden transform transition-all relative"> 
          <div class="p-6 pt-7"> 
            <div class="flex items-start gap-4"> 
              <div class="flex-shrink-0 w-12 h-12 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center text-amber-600 mt-0.5"> 
                <i class="ph-bold ph-arrows-clockwise text-2xl"></i> 
              </div> 
              <div> 
                <h3 class="text-lg font-bold text-slate-900 mb-2">Generate Token Baru?</h3> 
                <p class="text-sm text-slate-600 font-medium leading-relaxed"> 
                  Anda akan mereset API Token untuk <span class="font-bold text-slate-900 font-mono tracking-tight">@{{ activeTokenUser?.username }}</span>. <br><br> Token lama akan langsung <span class="text-amber-600 font-bold">hangus</span> dan semua perangkat mobile yang menggunakan token tersebut akan terputus dari server. 
                </p> 
              </div> 
            </div> 
          </div> 
          <div class="bg-slate-50/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200/80"> 
            <button @click="closeConfirmResetTokenModal" class="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
              Batal 
            </button> 
            <button @click="executeResetToken" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2" :disabled="isResettingToken"> 
              <i class="ph-bold" :class="isResettingToken ? 'ph-spinner animate-spin' : 'ph-arrows-clockwise'"></i> {{ isResettingToken ? 'Memproses...' : 'Ya, Generate Baru' }} 
            </button> 
          </div> 
        </div> 
      </div> 
    </Teleport> 

    <!-- MODAL FORM PENGGUNA (TAMBAH / EDIT) --> 
    <Teleport to="body"> 
      <div v-if="showModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeModal"> 
        <div class="bg-white border border-slate-200/80 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden"> 
          <div class="flex justify-between items-center p-6 bg-slate-50/50 border-b border-slate-200/80"> 
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2"> 
              <i class="ph-bold" :class="isEditMode ? 'ph-pencil-simple text-blue-500' : 'ph-user-plus text-emerald-500'"></i> {{ isEditMode ? 'Edit Pengguna' : 'Tambah Pengguna Baru' }} 
            </h3> 
            <button @click="closeModal" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center transition"> 
              <i class="ph-bold ph-x text-lg"></i> 
            </button> 
          </div> 
          <form @submit.prevent="saveUser" class="p-6 space-y-4"> 
            <div class="grid grid-cols-2 gap-4"> 
              <div> 
                <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label> 
                <input type="text" v-model="form.name" required class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg px-4 py-2 focus:border-slate-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
              </div> 
              <div> 
                <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email</label> 
                <input type="email" v-model="form.email" class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg px-4 py-2 focus:border-slate-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
              </div> 
            </div> 
            <div> 
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Username</label> 
              <input type="text" v-model="form.username" required class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-semibold font-mono tracking-tight rounded-lg px-4 py-2 focus:border-slate-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
            </div> 
            <div class="grid grid-cols-2 gap-4"> 
              <div> 
                <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Password <span v-if="isEditMode" class="font-medium lowercase text-emerald-600 ml-1">(Opsional)</span></label> 
                <div class="relative"> 
                  <input :type="showPassword ? 'text' : 'password'" v-model="form.password" :required="!isEditMode" class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg pl-4 pr-10 py-2 focus:border-slate-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
                  <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"> 
                    <i :class="showPassword ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye'" class="text-lg"></i> 
                  </button> 
                </div> 
              </div> 
              <div> 
                <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Konfirmasi Password</label> 
                <div class="relative"> 
                  <input :type="showConfirmPassword ? 'text' : 'password'" v-model="form.password_confirm" :required="form.password.length > 0" class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg pl-4 pr-10 py-2 focus:border-slate-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
                  <button type="button" @click="showConfirmPassword = !showConfirmPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"> 
                    <i :class="showConfirmPassword ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye'" class="text-lg"></i> 
                  </button> 
                </div> 
              </div> 
            </div> 
            <div> 
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Role Akses</label> 
              <select v-model="form.role" class="w-full bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 focus:border-slate-400 outline-none appearance-none cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
                <option value="Admin">Admin (Akses Web Penuh)</option> 
                <option value="Teknisi">Teknisi (Akses Mobile APP API)</option> 
                <option value="Kepala Bidang">Kepala Bidang (Read-Only Mobile API)</option> 
              </select> 
            </div> 
            <!-- Conditional Field for Token Expiry --> 
            <div v-if="form.role === 'Teknisi' || form.role === 'Kepala Bidang'" class="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 mt-3 shadow-inner"> 
              <label class="block text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2"> 
                <i class="ph-bold ph-key"></i> Masa Berlaku Token API Mobile 
              </label> 
              <input type="date" v-model="form.token_expires_at" required class="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg px-4 py-2 focus:border-amber-400 outline-none transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
              <p v-if="isEditMode" class="text-[11px] text-emerald-600 mt-2 font-medium">Ubah tanggal ini untuk me-renew (memperpanjang) masa aktif token.</p> 
              <p v-else class="text-[11px] text-slate-500 mt-2 font-medium">Sistem akan men-generate API Token unik saat pengguna disimpan.</p> 
            </div> 
            <div class="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-6"> 
              <button type="button" @click="closeModal" class="px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">Batal</button> 
              <button type="submit" class="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-2" :disabled="isSaving"> 
                <i v-if="isSaving" class="ph-bold ph-spinner animate-spin"></i> 
                <i v-else class="ph-bold ph-floppy-disk"></i> {{ isSaving ? 'Menyimpan...' : (isEditMode ? 'Simpan Perubahan' : 'Simpan Pengguna') }} 
              </button> 
            </div> 
          </form> 
        </div> 
      </div> 
    </Teleport> 

    <!-- MODAL KONFIRMASI HAPUS --> 
    <Teleport to="body"> 
      <div v-if="showDeleteModal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans" @click.self="closeDeleteModal"> 
        <div class="bg-white border border-slate-200/80 shadow-xl rounded-2xl w-full max-w-md overflow-hidden transform transition-all relative"> 
          <div class="p-6 pt-7"> 
            <div class="flex items-start gap-4"> 
              <div class="flex-shrink-0 w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-600 mt-0.5"> 
                <i class="ph-bold ph-warning-circle text-2xl"></i> 
              </div> 
              <div> 
                <h3 class="text-lg font-bold text-slate-900 mb-2">Hapus Akses Pengguna?</h3> 
                <p class="text-sm text-slate-600 font-medium leading-relaxed"> 
                  Anda akan menghapus akun <span class="font-bold text-slate-900 font-mono tracking-tight">@{{ userToDelete?.username }}</span> (<span class="text-slate-700 font-semibold">{{ userToDelete?.name }}</span>) secara permanen. <br><br> Pengguna ini tidak akan bisa lagi mengakses API daemon maupun ProxView. 
                </p> 
              </div> 
            </div> 
          </div> 
          <div class="bg-slate-50/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200/80"> 
            <button @click="closeDeleteModal" class="px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]"> 
              Batal 
            </button> 
            <button @click="executeDeleteUser" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2" :disabled="isDeleting"> 
              <i class="ph-bold ph-trash" v-if="!isDeleting"></i> 
              <i class="ph-bold ph-spinner animate-spin" v-if="isDeleting"></i> {{ isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen' }} 
            </button> 
          </div> 
        </div> 
      </div> 
    </Teleport> 

    <!-- TOAST NOTIFICATION --> 
    <ToastNotification :show="toast.show" :type="toast.type" :title="toast.title" :message="toast.message" @close="toast.show = false" /> 
  </main> 
</template> 

<script setup> 
import { ref, onMounted, computed, watch } from 'vue'; 
import { toWibDateInput, isTokenExpired } from '../../utils/datetime.js'; 
import ToastNotification from '@/components/common/ToastNotification.vue'; 

const users = ref([]); 
const isLoading = ref(true); 
const showModal = ref(false); 
const isSaving = ref(false); 
const isToggling = ref(null); 

const searchQuery = ref(''); 
const filterRole = ref('Semua Role'); 
const currentPage = ref(1); 
const itemsPerPage = 10; 

const isEditMode = ref(false); 
const editUserId = ref(null); 
const showPassword = ref(false); 
const showConfirmPassword = ref(false); 

const showDeleteModal = ref(false); 
const userToDelete = ref(null); 
const isDeleting = ref(false); 

const showTokenModal = ref(false); 
const activeTokenUser = ref(null); 
const apiTokenString = ref(''); 
const showApiToken = ref(false); 
const isLoadingToken = ref(false); 
const isResettingToken = ref(false); 

const showConfirmResetTokenModal = ref(false); 

const toast = ref({ show: false, type: 'success', title: '', message: '' }); 
let toastTimer = null; 

const form = ref({ 
  name: '', 
  email: '', 
  username: '', 
  password: '', 
  password_confirm: '', 
  role: 'Teknisi', 
  token_expires_at: '' 
}); 

const showToast = (type, title, message) => { 
  toast.value = { show: true, type, title, message }; 
  if (toastTimer) clearTimeout(toastTimer); 
  toastTimer = setTimeout(() => { toast.value.show = false; }, 5000); 
}; 

const filteredUsers = computed(() => { 
  let result = users.value; 
  if (filterRole.value !== 'Semua Role') { 
    result = result.filter(user => user.role === filterRole.value); 
  } 
  if (searchQuery.value) { 
    const lowerCaseQuery = searchQuery.value.toLowerCase(); 
    result = result.filter(user => 
      user.name.toLowerCase().includes(lowerCaseQuery) || 
      user.username.toLowerCase().includes(lowerCaseQuery) 
    ); 
  } 
  return result; 
}); 

const totalPages = computed(() => Math.ceil(filteredUsers.value.length / itemsPerPage) || 1); 

const paginatedUsers = computed(() => { 
  const start = (currentPage.value - 1) * itemsPerPage; 
  const end = start + itemsPerPage; 
  return filteredUsers.value.slice(start, end); 
}); 

const nextPage = () => { 
  if (currentPage.value < totalPages.value) currentPage.value++; 
}; 

const prevPage = () => { 
  if (currentPage.value > 1) currentPage.value--; 
}; 

watch([searchQuery, filterRole], () => { 
  currentPage.value = 1; 
}); 

const fetchUsers = async () => { 
  isLoading.value = true; 
  try { 
    const res = await fetch('/api/users'); 
    const data = await res.json(); 
    if (data.success) users.value = data.data; 
  } catch (error) { 
    showToast('error', 'Koneksi Terputus', 'Gagal memuat data pengguna dari server.'); 
  } finally { 
    isLoading.value = false; 
  } 
}; 

const toggleStatus = async (user) => { 
  isToggling.value = user.id; 
  try { 
    const res = await fetch(`/api/users/${user.id}/toggle-status`, { method: 'PUT' }); 
    const data = await res.json(); 
    if (data.success) { 
      user.is_active = data.is_active; 
      showToast('success', 'Status Diperbarui', data.message); 
    } else { 
      showToast('error', 'Gagal', data.message); 
    } 
  } catch (error) { 
    showToast('error', 'Kesalahan', 'Gagal terhubung ke server saat mengubah status akun.'); 
  } finally { 
    isToggling.value = null; 
  } 
}; 

const openTokenModal = async (user) => { 
  activeTokenUser.value = user; 
  showApiToken.value = false; 
  apiTokenString.value = ''; 
  showTokenModal.value = true; 
  isLoadingToken.value = true; 
  try { 
    const res = await fetch(`/api/users/${user.id}/token`); 
    const data = await res.json(); 
    if(data.success) { 
      apiTokenString.value = data.token || 'Token API belum dibuat untuk pengguna ini.'; 
    } else { 
      showToast('error', 'Gagal', data.message); 
      closeTokenModal(); 
    } 
  } catch(e) { 
    showToast('error', 'Kesalahan', 'Gagal terhubung ke server saat mengambil token.'); 
    closeTokenModal(); 
  } finally { 
    isLoadingToken.value = false; 
  } 
}; 

const closeTokenModal = () => { 
  showTokenModal.value = false; 
  activeTokenUser.value = null; 
}; 

const copyToken = async (tokenString) => { 
  if (navigator.clipboard && window.isSecureContext) { 
    try { 
      await navigator.clipboard.writeText(tokenString); 
      showToast('success', 'Berhasil', 'Token telah disalin ke clipboard.'); 
      return; 
    } catch (err) { 
      console.error('Gagal menyalin', err); 
    } 
  } 
  try { 
    const textArea = document.createElement("textarea"); 
    textArea.value = tokenString; 
    textArea.style.position = "fixed"; 
    textArea.style.top = "0"; 
    textArea.style.left = "0"; 
    textArea.style.opacity = "0"; 
    document.body.appendChild(textArea); 
    textArea.focus(); 
    textArea.select(); 
    const successful = document.execCommand('copy'); 
    document.body.removeChild(textArea); 
    if (successful) { 
      showToast('success', 'Berhasil', 'Token telah disalin.'); 
    } else { 
      throw new Error('Gagal menyalin'); 
    } 
  } catch (err) { 
    console.error('Gagal menyalin', err); 
    showToast('error', 'Gagal', 'Sistem tidak dapat menyalin token secara otomatis.'); 
  } 
}; 

const confirmResetToken = () => { 
  showConfirmResetTokenModal.value = true; 
}; 

const closeConfirmResetTokenModal = () => { 
  showConfirmResetTokenModal.value = false; 
}; 

const executeResetToken = async () => { 
  isResettingToken.value = true; 
  try { 
    const res = await fetch(`/api/users/${activeTokenUser.value.id}/token/reset`, { method: 'POST' }); 
    const data = await res.json(); 
    if(data.success) { 
      apiTokenString.value = data.token; 
      showToast('success', 'Token Diperbarui', 'Token API yang baru berhasil dibuat.'); 
      closeConfirmResetTokenModal(); 
    } else { 
      showToast('error', 'Gagal', data.message); 
    } 
  } catch(e) { 
    showToast('error', 'Kesalahan', 'Gagal mereset token ke server.'); 
  } finally { 
    isResettingToken.value = false; 
  } 
}; 

const openAddModal = () => { 
  isEditMode.value = false; 
  form.value = { 
    name: '', 
    email: '', 
    username: '', 
    password: '', 
    password_confirm: '', 
    role: 'Teknisi', 
    token_expires_at: '' 
  }; 
  showPassword.value = false; 
  showConfirmPassword.value = false; 
  showModal.value = true; 
}; 

const editUser = (user) => { 
  isEditMode.value = true; 
  editUserId.value = user.id; 
  let formattedDate = ''; 
  if (user.token_expires_at) { 
    formattedDate = toWibDateInput(user.token_expires_at); 
  } 
  form.value = { 
    name: user.name, 
    email: user.email || '', 
    username: user.username, 
    password: '', 
    password_confirm: '', 
    role: user.role, 
    token_expires_at: formattedDate 
  }; 
  showPassword.value = false; 
  showConfirmPassword.value = false; 
  showModal.value = true; 
}; 

const saveUser = async () => { 
  if (form.value.password !== form.value.password_confirm) { 
    showToast('error', 'Validasi Gagal', 'Konfirmasi password yang Anda masukkan tidak cocok!'); 
    return; 
  } 
  isSaving.value = true; 
  try { 
    const url = isEditMode.value ? `/api/users/${editUserId.value}` : '/api/users'; 
    const method = isEditMode.value ? 'PUT' : 'POST'; 
    const res = await fetch(url, { 
      method: method, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(form.value) 
    }); 
    const data = await res.json(); 
    if (data.success) { 
      closeModal(); 
      fetchUsers(); 
      showToast('success', isEditMode.value ? 'Data Berhasil Diperbarui' : 'Pengguna Berhasil Disimpan', data.message || `Data pengguna ${form.value.name} telah disimpan.`); 
    } else { 
      showToast('error', 'Gagal Menyimpan', data.message || 'Periksa kembali data masukan Anda.'); 
    } 
  } catch (error) { 
    showToast('error', 'Kesalahan Jaringan', 'Terjadi kesalahan saat mencoba terhubung ke database server.'); 
  } finally { 
    isSaving.value = false; 
  } 
}; 

const confirmDeleteUser = (user) => { 
  userToDelete.value = user; 
  showDeleteModal.value = true; 
}; 

const closeDeleteModal = () => { 
  showDeleteModal.value = false; 
  userToDelete.value = null; 
}; 

const executeDeleteUser = async () => { 
  if (!userToDelete.value) return; 
  isDeleting.value = true; 
  try { 
    const res = await fetch(`/api/users/${userToDelete.value.id}`, { method: 'DELETE' }); 
    const data = await res.json(); 
    if (data.success) { 
      fetchUsers(); 
      showToast('success', 'Pengguna Dihapus', `Akun ${userToDelete.value.name} berhasil dihapus secara permanen dari sistem.`); 
      closeDeleteModal(); 
      if (paginatedUsers.value.length === 1 && currentPage.value > 1) { 
        currentPage.value--; 
      } 
    } else { 
      showToast('error', 'Gagal Menghapus', data.message || 'Pengguna tersebut gagal dihapus.'); 
    } 
  } catch (error) { 
    showToast('error', 'Kesalahan Jaringan', 'Terjadi kesalahan saat menghapus pengguna.'); 
  } finally { 
    isDeleting.value = false; 
  } 
}; 

const closeModal = () => { 
  showModal.value = false; 
}; 

const getInitials = (name) => { 
  const parts = name.split(' '); 
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase(); 
  return name.substring(0, 2).toUpperCase(); 
}; 

const getAvatarStyle = (role) => { 
  if (role === 'Admin') return 'bg-emerald-50 border-emerald-200 text-emerald-700'; 
  if (role === 'Kepala Bidang') return 'bg-purple-50 border-purple-200 text-purple-700'; 
  return 'bg-blue-50 border-blue-200 text-blue-700'; 
}; 

const getRoleStyle = (role) => { 
  if (role === 'Admin') return { class: 'bg-emerald-50 border-emerald-200/60 text-emerald-700', icon: 'ph-bold ph-shield-star' }; 
  if (role === 'Kepala Bidang') return { class: 'bg-purple-50 border-purple-200/60 text-purple-700', icon: 'ph-bold ph-medal' }; 
  return { class: 'bg-blue-50 border-blue-200/60 text-blue-700', icon: 'ph-bold ph-wrench' }; 
}; 

const getTokenStatus = (user) => { 
  if (user.role === 'Admin') return { text: 'Akses Web Penuh', color: 'text-slate-500', dot: 'hidden' }; 
  if (!user.token_expires_at) return { text: 'Token Tidak Aktif', color: 'text-slate-500', dot: 'bg-slate-400' }; 
  if (isTokenExpired(user.token_expires_at)) { 
    return { text: 'Kedaluwarsa', color: 'text-rose-600', dot: 'bg-rose-500' }; 
  } 
  const formattedDate = toWibDateInput(user.token_expires_at); 
  return { text: `Aktif (Exp: ${formattedDate})`, color: 'text-blue-600', dot: 'bg-blue-500' }; 
}; 

onMounted(() => { 
  fetchUsers(); 
}); 
</script> 
<style scoped> </style>