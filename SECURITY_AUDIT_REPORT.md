# LAPORAN AUDIT KEAMANAN MENYELURUH (SECURITY AUDIT REPORT)
**Aplikasi**: ProxView (Sistem Pemantauan Infrastruktur Proxmox VE & Jaringan)  
**Teknologi**: Node.js, Express.js, MySQL, Vue.js 3, Vite, Tailwind CSS  
**Tanggal Audit**: 23 Oktober 2026  
**Status Audit**: Selesai (Analisis Statis & Arsitektural Basis Kode)  

---

## 1. Ringkasan Eksekutif (Executive Summary)

Audit keamanan independen telah dilaksanakan terhadap seluruh basis kode aplikasi **ProxView**. Audit difokuskan pada tiga domain utama:
1. **Backend (Node.js & Express.js)**: Keamanan injeksi, autentikasi/otorisasi (JWT, session, RBAC), middleware keamanan (Helmet, CORS, Rate Limiting), penanganan galat/logging, dan penyimpanan rahasia.
2. **Frontend (Vue.js)**: Cross-Site Scripting (XSS), penyimpanan data sensitif sisi klien, proteksi CSRF, dan konfigurasi cookie.
3. **Dependensi & Arsitektur Umum**: Audit dependensi eksternal, integritas CDN, dan desain keamanan sistem.

### Ringkasan Tingkat Keparahan Temuan:
- **Critical**: 2 temuan
- **High**: 9 temuan
- **Medium**: 7 temuan
- **Low**: 3 temuan
- **Info**: 1 temuan
- **Total Temuan**: 22 temuan

> [!CAUTION]
> **Temuan Kritis Utama**: Ditemukan ketiadaan mekanisme autentikasi dan otorisasi pada seluruh endpoint Web API backend. Siapa pun dapat mengakses, memanipulasi, dan menghapus data pengguna, konfigurasi Proxmox, target monitoring, serta seluruh log sistem secara langsung tanpa perlu melakukan login.

---

## 2. Matriks Rekapitulasi Temuan Keamanan

| ID | Kategori | Temuan Keamanan | Tingkat Keparahan | Komponen / File Terkait |
| :--- | :--- | :--- | :--- | :--- |
| **1.1** | Otorisasi & Auth | Ketiadaan Autentikasi pada Seluruh Endpoint Web API | **Critical** | `src/backend/server.js` |
| **1.2** | Audit & Logging | Pembersihan & Penghapusan Seluruh Log Audit Tanpa Autentikasi | **Critical** | `src/backend/controllers/cleanupController.js` |
| **1.3** | Kriptografi & TLS | Penonaktifan Validasi Sertifikat SSL/TLS (`rejectUnauthorized: false`) | **High** | `src/backend/controllers/proxmoxController.js`, `monitoringDaemon.js` |
| **1.4** | Konfigurasi CORS | Kebijakan CORS Terlalu Longgar dengan Refleksi Origin & Kredensial | **High** | `src/backend/server.js` |
| **1.5** | Validasi Input / SSRF | Potensi Server-Side Request Forgery pada Host Proxmox & Target Jaringan | **High** | `src/backend/controllers/proxmoxController.js`, `targetController.js` |
| **1.6** | Otorisasi & Integritas | Pemalsuan Identitas Teknisi (*Identity Spoofing*) pada Tiket Insiden | **High** | `src/backend/controllers/incidentController.js` |
| **1.7** | Hardcoded Secret | Skrip Reset Password Administrator Teks Polos Tersimpan di Repositori | **High** | `fix-admin.js` |
| **1.8** | Manajemen Sesi | Ketiadaan Proteksi Brute Force & Rate Limiting pada Endpoint Login | **High** | `src/backend/server.js`, `authController.js` |
| **1.9** | Perlindungan Rahasia | Penyimpanan Kunci Rahasia API Proxmox Teks Polos di Database | **High** | `src/backend/controllers/proxmoxController.js` |
| **2.1** | Otentikasi Frontend | Otorisasi Navigasi Klien Berbasis LocalStorage Saja (*Bypassable*) | **High** | `src/frontend/router/index.js`, `Login.vue` |
| **2.2** | Otentikasi Frontend | Validasi CAPTCHA Hanya di Sisi Klien (*Bypassable CAPTCHA*) | **High** | `src/frontend/components/auth/Login.vue`, `authController.js` |
| **2.3** | XSS Frontend | Stored XSS melalui Skema URI `javascript:` pada Tautan Host Proxmox | **High** | `src/frontend/components/config/ProxmoxConfig.vue` |
| **1.10** | Injeksi / Traversal | Potensi API Path Traversal pada Endpoint Task Log Proxmox | **Medium** | `src/backend/controllers/proxmoxLogController.js` |
| **1.11** | Header Keamanan | Ketiadaan Middleware Keamanan HTTP (Helmet) & Kebocoran Header Fingerprint | **Medium** | `src/backend/server.js` |
| **1.12** | Information Leak | Kebocoran Pesan Galat & Exception Internal ke Respon Klien | **Medium** | `src/backend/controllers/proxmoxLogController.js` |
| **2.4** | Proteksi CSRF | Ketiadaan Mekanisme Perlindungan Anti-CSRF Token | **Medium** | `src/backend/server.js`, `authController.js` |
| **2.5** | Manajemen Sesi | Timeout Inaktivitas Lokal Tidak Mencabut Sesi Server | **Medium** | `src/frontend/App.vue` |
| **3.1** | Dependensi / Integritas | Pemuatan Aset Skrip Eksternal CDN Tanpa Atribut Subresource Integrity (SRI) | **Medium** | `src/backend/views/index.ejs` |
| **3.2** | Ketersediaan Sistem | Potensi Resource Exhaustion & DoS Internal pada Daemon Pemantauan | **Medium** | `src/backend/services/monitoringDaemon.js` |
| **1.13** | Validasi Input | Ketiadaan Validasi Skema Input Terpusat | **Low** | `src/backend/controllers/userController.js`, `targetController.js` |
| **2.6** | Keamanan Navigasi | Kerentanan Reverse Tabnabbing pada Tautan Eksternal (`target="_blank"`) | **Low** | `src/frontend/components/config/ProxmoxConfig.vue` |
| **3.3** | Arsitektur | Evaluasi Kompatibilitas Ekosistem Express 5.x | **Info** | `package.json` |

---

## 3. Rincian Temuan Audit: Backend (Node.js & Express.js)

### Temuan 1.1: Ketiadaan Autentikasi dan Otorisasi pada Seluruh Endpoint Web API
- **Level Keparahan**: Critical
- **Komponen / File Terkait**: `src/backend/server.js` (Baris 66–126), `src/backend/controllers/authController.js` (Baris 78–83)
- **Deskripsi Temuan**: 
  Fungsi login web membuat token JWT dan menyimpannya di cookie `mox_token`. Namun, tidak ada satu pun middleware verifikasi cookie atau token JWT yang dipasang pada rute Web API di `server.js` (`/api/users`, `/api/targets`, `/api/proxmox`, `/api/thresholds`, `/api/settings/cleanup`, `/api/incidents`, dll.). Middleware verifikasi `verifyApiToken` hanya diaplikasikan pada rute mobile (`/api/mobile/v1/*`).
- **Potensi Dampak**: 
  Setiap pihak tanpa kredensial (*unauthenticated*) dapat langsung mengirimkan HTTP request (GET, POST, PUT, DELETE) ke backend untuk membaca seluruh data user, menambahkan user Admin baru, membaca dan mereset API token, menghapus target infrastruktur, serta memodifikasi ambang batas alerting.
- **Rekomendasi Perbaikan**: 
  Konseptualnya, buat middleware autentikasi sesi web (misal `verifyWebAuth`) yang mengekstrak dan memverifikasi tanda tangan JWT dari cookie `mox_token` pada setiap request rute `/api/*`. Terapkan kontrol akses berbasis peran (RBAC) di mana aksi administratif hanya dapat dijalankan oleh role `Admin`.

---

### Temuan 1.2: Pembersihan dan Penghapusan Seluruh Log Audit Tanpa Autentikasi
- **Level Keparahan**: Critical
- **Komponen / File Terkait**: `src/backend/controllers/cleanupController.js` (Baris 269–303), `src/backend/server.js` (Baris 110)
- **Deskripsi Temuan**: 
  Endpoint `POST /api/settings/cleanup/run` terekspos ke publik tanpa proteksi autentikasi. Endpoint ini menjalankan fungsi `performCleanupByKey` yang mengeksekusi `DELETE FROM system_logs` saat parameter `mode: 'ALL'` dikirimkan.
- **Potensi Dampak**: 
  Penyerang dapat menghapus seluruh riwayat audit dan log aktivitas sistem (*tampering audit trail / anti-forensics*) secara anonim setelah melakukan intrusi, menghilangkan jejak forensik bagi tim keamanan.
- **Rekomendasi Perbaikan**: 
  Kunci endpoint ini hanya untuk peran `Admin` yang terotentikasi. Batasi penghapusan log audit agar mematuhi kebijakan retensi minimum, atau kirimkan salinan log secara real-time ke penyimpanan terpusat yang bersifat *immutable / append-only* (seperti server Syslog/SIEM eksternal).

---

### Temuan 1.3: Penonaktifan Verifikasi Sertifikat TLS/SSL pada Agen HTTPS
- **Level Keparahan**: High
- **Komponen / File Terkait**: 
  - `src/backend/controllers/proxmoxController.js` (Baris 42)
  - `src/backend/controllers/proxmoxLogController.js` (Baris 24)
  - `src/backend/controllers/dashboardController.js` (Baris 32)
  - `src/backend/services/monitoringDaemon.js` (Baris 210)
- **Deskripsi Temuan**: 
  Seluruh agen HTTPS Axios yang digunakan untuk berkomunikasi dengan Proxmox VE secara eksplisit mengonfigurasi `new https.Agent({ rejectUnauthorized: false })`.
- **Potensi Dampak**: 
  Mematikan validasi sertifikat membuat koneksi rentan terhadap serangan Man-in-the-Middle (MitM). Penyerang pada segmen jaringan yang sama dapat mencegat komunikasi dan mencuri Proxmox API Token ID dan Token Secret yang dikirimkan pada header HTTP.
- **Rekomendasi Perbaikan**: 
  Aktifkan kembali validasi sertifikat TLS (`rejectUnauthorized: true`). Untuk server Proxmox yang menggunakan sertifikat self-signed internal, sertakan berkas CA internal yang sah ke dalam opsi `ca` pada konfigurasi agen HTTPS backend.

---

### Temuan 1.4: Kebijakan CORS Terlalu Longgar dengan Refleksi Origin Dinamis & Kredensial
- **Level Keparahan**: High
- **Komponen / File Terkait**: `src/backend/server.js` (Baris 49)
- **Deskripsi Temuan**: 
  Konfigurasi CORS diatur dengan `app.use(cors({ origin: true, credentials: true }))`. Konfigurasi ini merefleksikan nilai header `Origin` dari domain mana pun yang memanggil server ke dalam `Access-Control-Allow-Origin` serta mengizinkan pengiriman kredensial cookie.
- **Potensi Dampak**: 
  Situs berbahaya yang dikunjungi oleh administrator dapat melakukan request asinkron (*cross-origin fetch*) ke backend ProxView. Browser akan menyertakan cookie otentikasi korban, dan situs penyerang dapat membaca respon sensitif (daftar user, token, node Proxmox).
- **Rekomendasi Perbaikan**: 
  Ganti `origin: true` dengan daftar putih (*whitelist*) domain asal yang jelas dan terbatas pada domain dashboard resmi. Tolak permintaan dari origin yang tidak terdaftar saat `credentials: true` diaktifkan.

---

### Temuan 1.5: Potensi Server-Side Request Forgery (SSRF) pada Penambahan Host & Target
- **Level Keparahan**: High
- **Komponen / File Terkait**: 
  - `src/backend/controllers/proxmoxController.js` (Baris 61–73)
  - `src/backend/controllers/targetController.js` (Baris 31–49)
  - `src/backend/services/monitoringDaemon.js` (Baris 70–92)
- **Deskripsi Temuan**: 
  Input `hostUrl` untuk server Proxmox serta `ip_address` dan `port` untuk target monitoring diterima dari klien tanpa validasi alamat jaringan terlarang (seperti loopback `127.0.0.1`, link-local cloud metadata `169.254.169.254`, atau subnet manajemen internal). Backend kemudian melakukan HTTP request atau membuka raw TCP socket ke alamat tersebut.
- **Potensi Dampak**: 
  Server dapat disalahgunakan sebagai proksi penyerang untuk melakukan pemindaian port jaringan internal (*port scanning*), mengakses API metadata cloud internal, atau mengeksploitasi layanan internal yang tidak terekspos ke publik.
- **Rekomendasi Perbaikan**: 
  Terapkan filter alamat IP (*IP denylist/allowlist*) sebelum melakukan koneksi. Blokir alamat loopback, link-local, multicast, dan subnet lokal privat yang tidak termasuk dalam daftar infrastruktur yang diizinkan.

---

### Temuan 1.6: Pemalsuan Identitas Teknisi (*Identity Spoofing*) pada Tiket Insiden
- **Level Keparahan**: High
- **Komponen / File Terkait**: `src/backend/controllers/incidentController.js` (Baris 81–85, 120–123)
- **Deskripsi Temuan**: 
  Pada fungsi `joinIncident` dan `resolveIncident`, identitas penangan tiket (`user_id` dan `user_name`) diambil secara prioritas dari request body (`req.body.user_id`, `req.body.user_name`), baru kemudian beralih ke `req.user`.
- **Potensi Dampak**: 
  Pengguna mana pun dapat memalsukan parameter request body untuk mengatasnamakan teknisi atau pimpinan lain saat mengonfirmasi maupun menutup tiket insiden, merusak integritas pelaporan SLA dan jejak audit kepatuhan (*non-repudiation*).
- **Rekomendasi Perbaikan**: 
  Identitas pelaksana aksi wajib diambil secara eksklusif dari sesi pengguna yang terotentikasi di server (`req.user`), bukan dari input body request klien.

---

### Temuan 1.7: Skrip Reset Password Administrator Teks Polos Tersimpan di Repositori
- **Level Keparahan**: High
- **Komponen / File Terkait**: `fix-admin.js` (Baris 6–12)
- **Deskripsi Temuan**: 
  Terdapat skrip pemulihan `fix-admin.js` di direktori proyek yang mendefinisikan password teks polos `'admin123'` dan langsung mengeksekusi update hash kata sandi akun `admin` di database.
- **Potensi Dampak**: 
  Kredensial default ini terekspos kepada siapa saja yang memiliki akses ke repositori atau direktori server. Eksekusi yang tidak disengaja di lingkungan produksi akan mereset password administrator ke nilai yang mudah ditebak.
- **Rekomendasi Perbaikan**: 
  Hapus skrip pemulihan sekali pakai (*one-off script*) dari repositori kerja. Jika diperlukan mekanisme administrasi darurat, gunakan CLI interaktif yang meminta input password baru secara aman saat runtime tanpa menyimpannya di kode sumber.

---

### Temuan 1.8: Ketiadaan Proteksi Brute Force & Rate Limiting pada Endpoint Login
- **Level Keparahan**: High
- **Komponen / File Terkait**: `src/backend/server.js` (Baris 62, 130), `src/backend/controllers/authController.js` (Baris 40, 124)
- **Deskripsi Temuan**: 
  Endpoint `/api/auth/login` dan `/api/mobile/v1/auth/login` tidak memiliki pembatasan frekuensi request (*rate limiting*) atau penundaan progresif (*throttling*).
- **Potensi Dampak**: 
  Penyerang dapat melancarkan serangan tebak kata sandi (*brute-force* atau *credential stuffing*) secara masif tanpa memicu blokir otomatis dari server.
- **Rekomendasi Perbaikan**: 
  Pasang middleware pembatasan laju request (seperti konsep `express-rate-limit`) pada seluruh endpoint autentikasi, serta terapkan penguncian akun sementara setelah sejumlah percobaan gagal berturut-turut.

---

### Temuan 1.9: Penyimpanan Kunci Rahasia API Proxmox Teks Polos di Database
- **Level Keparahan**: High
- **Komponen / File Terkait**: `src/backend/controllers/proxmoxController.js` (Baris 65, 85)
- **Deskripsi Temuan**: 
  Nilai `token_secret` untuk otentikasi ke Proxmox disimpan langsung dalam format teks polos (*plaintext*) pada tabel database `proxmox_nodes`.
- **Potensi Dampak**: 
  Jika terjadi insiden kebocoran database (misal backup file bocor atau SQL dump terekspos), seluruh rahasia API Proxmox dapat disalahgunakan penyerang untuk mengendalikan VM, storage, dan hypervisor Proxmox.
- **Rekomendasi Perbaikan**: 
  Enkripsi data rahasia di tingkat aplikasi (*encryption-at-rest*) sebelum disimpan ke database (misal menggunakan enkripsi authenticated AES-256-GCM), dengan kunci enkripsi yang disimpan di variabel lingkungan terisolasi.

---

### Temuan 1.10: Potensi API Path Traversal pada Endpoint Task Log Proxmox
- **Level Keparahan**: Medium
- **Komponen / File Terkait**: `src/backend/controllers/proxmoxLogController.js` (Baris 77–89)
- **Deskripsi Temuan**: 
  Parameter `node` dan `upid` dari query string langsung diinterpolasi ke URL path request Proxmox (`/api2/json/nodes/${node}/tasks/${upid}/log`) tanpa sanitasi karakter khusus seperti `../` atau URL encoding.
- **Potensi Dampak**: 
  Penyerang dapat melakukan manipulasi path URL pada API upstream Proxmox untuk mengakses endpoint API internal Proxmox di luar modul log.
- **Rekomendasi Perbaikan**: 
  Validasi nilai parameter dengan pola alfanumerik yang ketat dan gunakan `encodeURIComponent()` sebelum menyisipkannya ke path URL.

---

### Temuan 1.11: Ketiadaan Middleware Keamanan HTTP (Helmet) & Kebocoran Header
- **Level Keparahan**: Medium
- **Komponen / File Terkait**: `src/backend/server.js`
- **Deskripsi Temuan**: 
  Server tidak menerapkan middleware proteksi header HTTP (seperti `helmet`). Header penting seperti `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, dan `Strict-Transport-Security` tidak disertakan. Header default `X-Powered-By: Express` juga aktif.
- **Potensi Dampak**: 
  Memudahkan pemindaian sidik jari teknologi server (*fingerprinting*), meningkatkan risiko serangan Clickjacking melalui `<iframe>`, dan risiko MIME-type sniffing oleh peramban klien.
- **Rekomendasi Perbaikan**: 
  Pasang middleware header keamanan (konsep `helmet()`), sembunyikan header `X-Powered-By`, dan tetapkan kebijakan CSP serta HSTS yang ketat.

---

### Temuan 1.12: Kebocoran Pesan Galat & Exception Internal ke Respon Klien
- **Level Keparahan**: Medium
- **Komponen / File Terkait**: `src/backend/controllers/proxmoxLogController.js` (Baris 48, 69, 100)
- **Deskripsi Temuan**: 
  Blok penanganan error mengembalikan string pesan exception internal pustaka (`error: error.message`) langsung ke respon JSON klien.
- **Potensi Dampak**: 
  Pesan galat mentah dapat membocorkan detail infrastruktur internal, IP privat, atau status dependensi backend kepada pihak luar.
- **Rekomendasi Perbaikan**: 
  Catat rincian error pada log internal server dan kembalikan pesan galat generik yang aman ke pengguna akhir.

---

### Temuan 1.13: Ketiadaan Validasi Skema Input Terpusat
- **Level Keparahan**: Low
- **Komponen / File Terkait**: `src/backend/controllers/userController.js`, `targetController.js`
- **Deskripsi Temuan**: 
  Tidak ada pustaka validasi skema input (seperti `express-validator` atau `zod`). Format string email, panjang karakter kata sandi, dan jangkauan port angka tidak diverifikasi sebelum diproses.
- **Potensi Dampak**: 
  Dapat menyebabkan anomali data di database atau error tak terduga pada daemon background.
- **Rekomendasi Perbaikan**: 
  Terapkan skema validasi tipe dan format data input pada tingkat router sebelum diteruskan ke fungsi controller.

---

## 4. Rincian Temuan Audit: Frontend (Vue.js)

### Temuan 2.1: Otorisasi Navigasi Klien Berbasis LocalStorage Saja (*Bypassable*)
- **Level Keparahan**: High
- **Komponen / File Terkait**: `src/frontend/router/index.js` (Baris 69–79), `src/frontend/components/auth/Login.vue` (Baris 268)
- **Deskripsi Temuan**: 
  Navigation guard Vue Router hanya memvalidasi string pada local storage: `localStorage.getItem('isLoggedIn') === 'true'`.
- **Potensi Dampak**: 
  Pengguna mana pun dapat memanipulasi local storage melalui konsol browser (`localStorage.setItem('isLoggedIn', 'true')`) untuk melewati guard dan membuka semua halaman antarmuka. Dipadukan dengan Temuan 1.1, penyerang langsung memperoleh kendali administratif penuh.
- **Rekomendasi Perbaikan**: 
  Status otentikasi harus selalu dikonfirmasi secara aktif ke server backend melalui endpoint verifikasi sesi sebelum mengizinkan transisi navigasi rute privat.

---

### Temuan 2.2: Validasi CAPTCHA Hanya di Sisi Klien (*Bypassable CAPTCHA*)
- **Level Keparahan**: High
- **Komponen / File Terkait**: `src/frontend/components/auth/Login.vue` (Baris 205–210, 243–248), `src/backend/controllers/authController.js` (Baris 40)
- **Deskripsi Temuan**: 
  Teks CAPTCHA digenerate secara lokal menggunakan JavaScript `<canvas>` di browser dan dicocokkan di dalam fungsi `handleLogin()` sebelum request dikirim. Endpoint backend `/api/auth/login` sama sekali tidak memvalidasi atau mewajibkan pengiriman nilai CAPTCHA.
- **Potensi Dampak**: 
  CAPTCHA ini sepenuhnya tidak efektif mencegah bot otomatis. Penyerang dapat mengabaikan CAPTCHA dengan mengirimkan request HTTP POST langsung ke backend.
- **Rekomendasi Perbaikan**: 
  Pindahkan pembuatan CAPTCHA ke sisi server backend, simpan token verifikasi di server, dan validasi input CAPTCHA di backend sebelum mengecek kredensial login.

---

### Temuan 2.3: Stored XSS melalui Skema URI `javascript:` pada Tautan Host Proxmox
- **Level Keparahan**: High
- **Komponen / File Terkait**: `src/frontend/components/config/ProxmoxConfig.vue` (Baris 87–90), `src/backend/controllers/proxmoxController.js` (Baris 61)
- **Deskripsi Temuan**: 
  Pada tabel konfigurasi Proxmox, URL host di-bind langsung ke tag `<a>`: `<a :href="node.hostUrl" target="_blank">`. Backend dan frontend tidak membatasi protokol URL.
- **Potensi Dampak**: 
  Jika pengguna memasukkan nilai host seperti `javascript:/* kode berbahaya */`, saat admin mengeklik tautan tersebut, skrip JavaScript asing akan dieksekusi di browser korban dalam konteks domain aplikasi (Stored Cross-Site Scripting).
- **Rekomendasi Perbaikan**: 
  Lakukan sanitasi dan validasi protokol URL agar hanya mengizinkan awalan `http://` dan `https://`. Tolak atau buang URL yang menggunakan skema `javascript:`.

---

### Temuan 2.4: Ketiadaan Mekanisme Perlindungan Anti-CSRF Token
- **Level Keparahan**: Medium
- **Komponen / File Terkait**: `src/backend/server.js` (Baris 48–52), `src/backend/controllers/authController.js` (Baris 78–83)
- **Deskripsi Temuan**: 
  Aplikasi mengandalkan cookie otentikasi `mox_token` dengan `sameSite: 'lax'`, tetapi tidak menerapkan token perlindungan CSRF.
- **Potensi Dampak**: 
  Pengaturan `SameSite=Lax` masih mengizinkan pengiriman cookie pada navigasi tingkat atas (*top-level navigation*). Dipadukan dengan kebijakan CORS yang terlalu longgar, aplikasi memiliki kerentanan terhadap manipulasi permintaan lintas situs pada skenario tertentu.
- **Rekomendasi Perbaikan**: 
  Implementasikan proteksi CSRF, misalnya dengan mengharuskan header kustom (seperti `X-Requested-With` atau token Anti-CSRF terverifikasi) pada seluruh request mutasi data (POST, PUT, DELETE).

---

### Temuan 2.5: Timeout Inaktivitas Lokal Tidak Mencabut Sesi Server
- **Level Keparahan**: Medium
- **Komponen / File Terkait**: `src/frontend/App.vue` (Baris 143–149)
- **Deskripsi Temuan**: 
  Ketika batas inaktivitas tercapai, fungsi `confirmTimeout()` hanya menghapus data di `localStorage` peramban tanpa memanggil endpoint backend `/api/auth/logout`.
- **Potensi Dampak**: 
  Cookie otentikasi HTTP-Only di peramban tetap aktif dan valid di server (berlaku hingga 12 jam). Jika perangkat digunakan oleh orang lain, sesi server masih dapat dieksploitasi.
- **Rekomendasi Perbaikan**: 
  Panggil endpoint logout backend secara otomatis saat terjadi timeout inaktivitas untuk menghapus cookie sesi di sisi server.

---

### Temuan 2.6: Kerentanan Reverse Tabnabbing pada Tautan Eksternal
- **Level Keparahan**: Low
- **Komponen / File Terkait**: `src/frontend/components/config/ProxmoxConfig.vue` (Baris 87)
- **Deskripsi Temuan**: 
  Tautan eksternal yang menggunakan `target="_blank"` tidak memiliki atribut `rel="noopener noreferrer"`.
- **Potensi Dampak**: 
  Halaman eksternal yang dibuka dapat mengakses objek `window.opener` dan berpotensi memanipulasi navigasi tab induk ke situs berbahaya (*reverse tabnabbing*).
- **Rekomendasi Perbaikan**: 
  Tambahkan atribut `rel="noopener noreferrer"` pada seluruh elemen tautan yang membuka jendela atau tab baru.

---

## 5. Rincian Temuan Audit: Dependensi & Arsitektur Umum

### Temuan 3.1: Pemuatan Aset Skrip CDN Pihak Ketiga Tanpa Subresource Integrity (SRI)
- **Level Keparahan**: Medium
- **Komponen / File Terkait**: `src/backend/views/index.ejs` (Baris 14, 34, 37)
- **Deskripsi Temuan**: 
  Aplikasi memuat pustaka JavaScript eksternal (Tailwind CDN, Phosphor Icons, Chart.js) langsung dari domain CDN publik tanpa menyertakan atribut hash integritas `integrity="..."` dan `crossorigin="anonymous"`.
- **Potensi Dampak**: 
  Jika jaringan CDN publik tersebut disusupi (*supply-chain attack*) atau terjadi manipulasi DNS/MitM, kode berbahaya dapat disuntikkan ke dalam browser seluruh staf yang mengakses aplikasi.
- **Rekomendasi Perbaikan**: 
  Bundel seluruh pustaka dependensi secara lokal menggunakan npm/Vite, atau tambahkan atribut Subresource Integrity (SRI) berbasis cryptographic hash yang valid jika tetap menggunakan CDN eksternal.

---

### Temuan 3.2: Potensi Resource Exhaustion & DoS Internal pada Daemon Pemantauan
- **Level Keparahan**: Medium
- **Komponen / File Terkait**: `src/backend/services/monitoringDaemon.js` (Baris 57–92, 733)
- **Deskripsi Temuan**: 
  Loop daemon pemantauan berjalan setiap 1000ms (`setInterval`) untuk memeriksa semua target tanpa mekanisme antrean tugas terkelola (*worker queue*) atau pembatasan konkurensi socket.
- **Potensi Dampak**: 
  Jika jumlah target bertambah banyak atau target mengalami timeout jaringan secara serentak, pembentukan socket TCP dan proses probe sistem dapat menumpuk dan menghabiskan *file descriptor* atau kapasitas memori server.
- **Rekomendasi Perbaikan**: 
  Gunakan arsitektur *worker pool* dengan batasan konkurensi (misalnya maksimum $N$ pemeriksaan paralel) dan antrean tugas terstruktur untuk mengontrol penggunaan sumber daya server secara stabil.

---

### Temuan 3.3: Evaluasi Kompatibilitas Ekosistem Express 5.x
- **Level Keparahan**: Info
- **Komponen / File Terkait**: `package.json` (Baris 24)
- **Deskripsi Temuan**: 
  Aplikasi menggunakan versi rilis modern `"express": "^5.3.0"`. Express 5 memiliki penanganan internal baru untuk promise reject dan parsing query string.
- **Potensi Dampak**: 
  Pustaka pihak ketiga lama berpotensi menimbulkan galat runtime tak terduga jika tidak kompatibel penuh dengan konvensi penanganan error Express 5.
- **Rekomendasi Perbaikan**: 
  Pastikan seluruh dependensi middleware telah teruji kompatibel dengan Express 5, dan sediakan centralized error handling middleware dengan empat parameter `(err, req, res, next)` di akhir konfigurasi rute Express.

---

## 6. Rencana Aksi & Roadmap Perbaikan Konseptual

```
+--------------------------------------------------------------------------+
| FASE 1: PERBAIKAN DARURAT (Immediate Action)                             |
| 1. Pasang middleware otentikasi JWT/Cookie pada seluruh rute /api/* Web. |
| 2. Hapus berkas berisiko fix-admin.js dari repositori.                   |
| 3. Kunci endpoint pembersihan log (/api/settings/cleanup/run) ke Admin.  |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
| FASE 2: PENGUATAN JARINGAN & OTENTIKASI (Hardening)                      |
| 1. Perbaiki kebijakan CORS dengan whitelist domain asal yang ketat.      |
| 2. Aktifkan kembali verifikasi sertifikat TLS Proxmox dengan CA internal.|
| 3. Pindahkan pembuatan dan validasi CAPTCHA sepenuhnya ke server backend.|
| 4. Pasang middleware Rate Limiting pada seluruh endpoint otentikasi.     |
+--------------------------------------------------------------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
| FASE 3: VALIDASI DATA & DEFENSE IN DEPTH (Sanitization & Defense)        |
| 1. Ambil identitas teknisi tiket murni dari token req.user di server.    |
| 2. Enkripsi rahasia token Proxmox di database (encryption-at-rest).      |
| 3. Pasang Helmet untuk header HTTP dan terapkan validasi skema input.    |
| 4. Sanitasi protokol tautan :href di Vue (blokir skema javascript:).     |
| 5. Bundel seluruh dependensi CDN pihak ketiga secara lokal via npm/Vite. |
+--------------------------------------------------------------------------+
```

---
*Laporan ini disusun secara objektif berdasarkan audit statis arsitektur kode sumber untuk meningkatkan postur keamanan aplikasi ProxView.*

*Progres Perbaikan*
Perbaikan untuk Fase 1: Perbaikan Darurat (Immediate Action) sesuai SECURITY_AUDIT_REPORT.md telah selesai diterapkan:                                                                                                 
                                                                                                                        
  ### Ringkasan Perbaikan Fase 1                                                                                                                                                                                        
  1. Middleware Otentikasi JWT/Cookie & RBAC pada Seluruh Rute /api/* Web (Temuan 1.1)                                                                                                                                   
      • Menambahkan middleware verifyWebAuth, requireAdmin, dan attachWebUserIfPresent pada authMiddleware.js untuk memverifikasi tanda tangan JWT dari HTTP-Only cookie mox_token serta memeriksa status aktif akun di  
      database.                                                                                                                                                                                                          
      • Memperbarui attachMobileUserIfPresent agar mewajibkan otentikasi sesi Web (verifyWebAuth) apabila header Authorization: Bearer tidak disertakan, sehingga endpoint hybrid (/api/incidents*, /api/analytics) tidak
      lagi dapat diakses tanpa otentikasi.
      • Memasang verifyWebAuth dan requireAdmin pada seluruh rute Web API di server.js:61-129 (/api/users, /api/targets, /api/system/status, /api/dashboard/summary, /api/proxmox, /api/logs/system, /api/alerts,        
      /api/settings/cleanup, /api/thresholds, /api/incidents, dan /api/analytics).
  2. Penghapusan Berkas Berisiko fix-admin.js (Temuan 1.7)
      • Menghapus berkas skrip reset password teks polos fix-admin.js dari repositori kerja.
  3. Penguncian Endpoint Pembersihan Log ke Role Admin (Temuan 1.2)
      • Mengunci rute GET /api/settings/cleanup, PUT /api/settings/cleanup, dan POST /api/settings/cleanup/run di server.js:110-113 menggunakan middleware verifyWebAuth, requireAdmin.
      • Menambahkan validasi peran Admin secara eksplisit di dalam getCleanupSettings, saveCleanupSettings, dan runManualCleanup pada cleanupController.js, disertai pencatatan jejak audit identitas Admin yang
      mengeksekusi pembersihan log.
*Progres Perbaikan*



NOTE BUG
-Tutup Sesi jika tidak ada interkasi selama 1 menti bug pop up timeout muncul tapi ketika klik refresh tidak logout padahal tidak ada interkasi lebih dari 1 menit
-Sistem Matrix tidak langsung berjalan (berjalan setelah trigger ada 1 gangguan)
-salin token pada manajemen user tidak jalan