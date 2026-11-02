# DOKUMEN ANALISIS PERHITUNGAN UPTIME, DOWNTIME, MTTR & AVAILABILITY (SLA)
**Aplikasi**: ProxView (Sistem Pemantauan Infrastruktur Proxmox VE & Jaringan)  
**Komponen Utama**: `incidentController.js`, `monitoringDaemon.js`, `proxmoxController.js`, `RekapGangguan.vue`, `Dashboard.vue`, `pdfExportService.js`  
**Tanggal Analisis**: 2 November 2026  

---

## 1. Gambaran Umum & Arsitektur Sumber Data

Seluruh perhitungan analitik keandalan sistem (*Service Level Agreement* / SLA) berpusat pada [`src/backend/controllers/incidentController.js`](src/backend/controllers/incidentController.js), sementara pencatatan waktu kejadian mentahnya (*raw timestamps*) dihasilkan secara otomatis oleh daemon latar belakang di [`src/backend/services/monitoringDaemon.js`](src/backend/services/monitoringDaemon.js).

Berdasarkan [`src/backend/config/timezone.js`](src/backend/config/timezone.js), seluruh waktu di sisi backend dan database disimpan dalam standar **UTC** (`process.env.TZ = 'UTC'`), sedangkan penyelarasan batas jam/hari laporan dan tampilan antarmuka menggunakan zona waktu **WIB (`UTC+7` / `WIB_OFFSET_MS = 25.200.000 ms`)**.

### Peta File yang Berkaitan dengan Uptime & Downtime

| File | Peran dalam Perhitungan Uptime / Downtime |
| :--- | :--- |
| `src/backend/services/monitoringDaemon.js` | Mendeteksi gangguan ICMP/TCP & Proxmox, membuat tiket (`created_at`), mengubah status eskalasi (`original_severity`), menutup tiket otomatis (`resolved_at`), serta mencatat riwayat hidup ke `down_history`. |
| `src/backend/controllers/incidentController.js` | Menghitung durasi downtime & penanganan per tiket (`fetchIncidentsData`), menutup tiket manual (`resolveIncident`), serta menghitung metrik ITIL: Uptime, Downtime, MTTR, dan Availability (`fetchAnalyticsData` & `hitungMetrikITIL`). |
| `src/backend/controllers/proxmoxController.js` | Mengambil dan memformat nilai *kernel/hypervisor uptime* langsung dari API Proxmox VE untuk Node, VM, dan LXC (`formatUptime`). |
| `src/frontend/components/dashboard/RekapGangguan.vue` | Menampilkan kartu KPI Uptime, Downtime, MTTR, Availability, grafik per jam/hari, serta durasi per tiket. |
| `src/frontend/components/dashboard/Dashboard.vue` | Menampilkan ringkasan metrik SLA dan grafik perbandingan Uptime vs Downtime vs MTTR di halaman utama. |
| `src/backend/services/pdfExportService.js` | Mencetak hasil perhitungan `fetchAnalyticsData` dan `fetchIncidentsData` ke dalam dokumen laporan PDF resmi. |
| `src/backend/controllers/cleanupController.js` | Membersihkan riwayat tiket selesai (`active_alerts` dengan `is_resolved = 1`) dan log `down_history` sesuai jadwal retensi. |

---

## 2. Siklus Hidup Tiket Gangguan (Penentu Awal & Akhir Waktu)

Akurasi perhitungan Downtime bergantung penuh pada kapan `created_at` dan `resolved_at` tercatat di tabel `active_alerts`:

### 2.1. Kapan Waktu Mulai (`created_at`) Dicatat?
Pada fungsi `triggerAlert` di `monitoringDaemon.js`:
1. **Target Jaringan (`NETWORK` — ICMP Ping / TCP Socket):**
   - **Status `DOWN`:** Jika target gagal merespons sejumlah batas toleransi RTO berturut-turut (`currentFails >= limitRTO`, di mana `limitRTO = Math.max(1, Number(target.max_retries) || 3)`), daemon memanggil `triggerAlert` dan membuat baris baru di `active_alerts` (`created_at = CURRENT_TIMESTAMP`).
   - **Status `WARNING` / `CRITICAL`:** Jika target merespons (`UP`) tetapi nilai *latency* melewati ambang `latency_warning` atau `latency_critical` sebanyak `notify_warning_max` atau `notify_critical_max` kali berturut-turut, tiket dibuat di `active_alerts`.
2. **Target Proxmox (`PROXMOX` — Node / VM / LXC):**
   - Jika mesin mati/offline (`!metrics.isUp`), atau penggunaan CPU / RAM / IO Delay melewati batas *warning* maupun *critical*, `triggerAlert` langsung membuat tiket baru jika belum ada tiket aktif (`is_resolved = 0`) untuk target tersebut.
3. **Eskalasi Keparahan (`original_severity`):**
   - Apabila sebuah tiket awalnya berstatus `WARNING` lalu memburuk menjadi `CRITICAL` atau `DOWN`, sistem tidak membuat tiket baru, melainkan memperbarui kolom `original_severity` dengan tingkat keparahan tertinggi yang pernah dicapai (`SEVERITY_RANK`: `RECOVERED: 0 < WARNING: 1 < CRITICAL: 2 < DOWN: 3`).

### 2.2. Kapan Waktu Selesai (`resolved_at`) Dicatat?
Terdapat **dua mekanisme berbeda** pada fungsi `resolveAlert` (`monitoringDaemon.js`) dan `resolveIncident` (`incidentController.js`):

1. **Jalur Otomatis (*Auto-Resolve* — Belum Ada Teknisi Join):**
   - Ketika indikator target kembali normal dan belum ada teknisi yang terdaftar di tabel `alert_handlers` (`COUNT(id) == 0`), daemon langsung mengeksekusi:
     ```sql
     UPDATE active_alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = ?
     ```
   - Durasi downtime langsung berhenti tepat saat perangkat pulih.
2. **Jalur Validasi Manual (*Manual-Resolve* — Sudah Ada Teknisi Join):**
   - Jika minimal 1 teknisi telah mengonfirmasi penanganan (`joinIncident`), maka saat perangkat pulih daemon **tidak menutup tiket**, melainkan hanya mengubah `severity = 'RECOVERED'`.
   - Kolom `is_resolved` tetap `0` dan `resolved_at` tetap `NULL` hingga teknisi menekan tombol selesai (`resolveIncident`), yang barulah mengisi `resolved_at = CURRENT_TIMESTAMP`.
   - **Implikasi:** Selama teknisi belum menutup tiket yang sudah `RECOVERED`, durasi downtime dan waktu penanganan tiket tersebut terus berjalan.

---

## 3. Perhitungan Durasi per Tiket (`fetchIncidentsData`)

Digunakan pada endpoint `GET /api/incidents` (`incidentController.js` baris 28–68) untuk menampilkan durasi masing-masing tiket.

### 3.1. Rumus Matematika
Misalkan:
- $t_{\text{created}}$ = waktu tiket tercatat (`a.created_at`)
- $t_{\text{joined}} = \min(h.\text{joined\_at})$ = waktu teknisi pertama bergabung menangani tiket
- $t_{\text{end}}$ = waktu akhir evaluasi:
  $$t_{\text{end}} = \begin{cases} t_{\text{resolved}}, & \text{jika } \text{is\_resolved} = 1 \\ t_{\text{now}}, & \text{jika } \text{is\_resolved} = 0 \end{cases}$$

Maka:
$$\text{Downtime Tiket } (D_{\text{tiket}}) = t_{\text{end}} - t_{\text{created}} \quad (\text{detik})$$

$$\text{Durasi Penanganan } (H_{\text{tiket}}) = \begin{cases} t_{\text{end}} - t_{\text{joined}}, & \text{jika } t_{\text{joined}} \neq \text{NULL} \\ \text{"-"}, & \text{jika tidak ada teknisi (Auto-Recover)} \end{cases}$$

### 3.2. Rumus Sistem (SQL & JavaScript)
```sql
SELECT 
    ...,
    MIN(h.joined_at) AS handled_at,
    TIMESTAMPDIFF(SECOND, a.created_at, IFNULL(a.resolved_at, CURRENT_TIMESTAMP)) AS downtime_sec,
    TIMESTAMPDIFF(SECOND, MIN(h.joined_at), IFNULL(a.resolved_at, CURRENT_TIMESTAMP)) AS handling_sec
FROM active_alerts a
LEFT JOIN alert_handlers h ON a.id = h.alert_id
GROUP BY a.id
```
Di JavaScript (`incidentController.js` baris 64–65):
```js
downtime_duration: formatSec(row.downtime_sec),
handling_duration: row.handled_at ? formatSec(row.handling_sec) : '-'
```

---

## 4. Perhitungan Analitik SLA Sistem (`fetchAnalyticsData` & `hitungMetrikITIL`)

Digunakan pada endpoint `GET /api/analytics` dan `GET /api/mobile/v1/analytics` (`incidentController.js` baris 217–363). Perhitungan mengikuti kerangka metrik **ITIL** dalam 4 tahapan berurutan.

### Tahap 1: Penentuan Jendela Waktu Efektif (*Effective Window*)

Sistem menyediakan 3 pilihan rentang waktu ($P$):
- `24h` = $24 \times 3600 \times 1000\text{ ms} = 86.400\text{ detik}$ (interval grafik: per jam / $3.600\text{ detik}$)
- `7d` = $7 \times 86.400 \times 1000\text{ ms} = 604.800\text{ detik}$ (interval grafik: per hari / $86.400\text{ detik}$)
- `30d` = $30 \times 86.400 \times 1000\text{ ms} = 2.592.000\text{ detik}$ (interval grafik: per hari / $86.400\text{ detik}$)

Untuk mencegah perhitungan Uptime dari waktu sebelum target monitoring didaftarkan ke sistem, batas awal jendela dikoreksi terhadap tanggal pembuatan target (`created_at` pada tabel `monitoring_targets` / `proxmox_targets`):

#### Rumus Matematika
$$W_{\text{end}} = t_{\text{now}}$$
$$W_{\text{start}} = W_{\text{end}} - P$$
$$W_{\text{eff}} = \min\Big(W_{\text{end}},\; \max(W_{\text{start}},\, t_{\text{master}})\Big)$$

Keterangan $t_{\text{master}}$:
- **Mode Target Spesifik** (`target_id` & `target_type` disertakan): `created_at` milik target tersebut.
- **Mode Agregat Global** (tanpa `target_id`): nilai paling tua `MIN(created_at)` dari gabungan tabel `monitoring_targets` dan `proxmox_targets`.

#### Rumus Sistem (`incidentController.js` baris 260–284)
```js
const winEnd = Date.now();
const winStart = winEnd - period.ms;
// ... query masterCreatedMs dari monitoring_targets / proxmox_targets ...
const effectiveStart = Math.min(winEnd, masterCreatedMs !== null ? Math.max(winStart, masterCreatedMs) : winStart);
```
> **Contoh:** Jika pengguna memilih periode **30 Hari**, namun server/target tertua di database baru didaftarkan **3 hari yang lalu**, maka total periode evaluasi otomatis menyesuaikan menjadi **3 hari** ($259.200\text{ detik}$), bukan 30 hari.

---

### Tahap 2: Penyaringan Insiden & Perlakuan Level Severity

Query SQL mengambil seluruh tiket yang memiliki irisan waktu dengan $[W_{\text{eff}}, W_{\text{end}}]$:
```sql
SELECT created_at, resolved_at
FROM active_alerts
WHERE IFNULL(resolved_at, CURRENT_TIMESTAMP) > ? 
  AND created_at < ?
  AND IFNULL(original_severity, severity) IN (...)
```

Perlakuan sistem terhadap parameter `severity`:

| Filter `severity` | Level yang Diambil (`requestedSeverities`) | Perlakuan terhadap Uptime & Availability |
| :--- | :--- | :--- |
| **`ALL`** | `['DOWN', 'CRITICAL']` | **Memotong Uptime & Availability.** Tiket `WARNING` sengaja dikecualikan agar peringatan ringan tidak menurunkan persentase SLA keseluruhan. |
| **`DOWN`** | `['DOWN']` | **Memotong Uptime & Availability** khusus dari tiket gangguan mati total (`DOWN`). |
| **`CRITICAL`** | `['CRITICAL']` | **Memotong Uptime & Availability** khusus dari tiket kritis (`CRITICAL`). |
| **`WARNING`** | `['WARNING']` | Dianggap sebagai **degradasi performa** melalui fungsi `terapkanFilter` (baris 304–314): `total_downtime_sec` di-set menjadi `0`, `total_uptime_sec = total_period_sec`, `availability = "100.00"`, dan durasi aslinya dialihkan ke field `total_degradation_sec`. Nilai `mttr_sec` dan `incident_count` tetap dihitung normal. |

---

### Tahap 3: Rumus Inti Metrik ITIL (`hitungMetrikITIL`)

Untuk setiap jendela evaluasi $[W_s, W_e]$ dan daftar insiden dengan waktu mulai $s_i = \text{created\_at}$ serta waktu selesai $e_i = \text{resolved\_at} \ ?? \ W_{\text{end}}$:

#### 1. Pemotongan Irisan Waktu Insiden (*Window Clamping*)
Jika sebuah insiden dimulai sebelum $W_s$ atau baru selesai setelah $W_e$, hanya porsi waktu yang berada di dalam $[W_s, W_e]$ yang dihitung:

- **Rumus Matematika:**
  $$d_i = \max\left(0,\; \frac{\min(e_i, W_e) - \max(s_i, W_s)}{1000}\right)$$
  $$I_{\text{overlap}} = \{ i \mid d_i > 0 \}, \qquad N = |I_{\text{overlap}}|$$

- **Rumus Sistem (`incidentController.js` baris 226–228 & 233):**
  ```js
  const overlapped = incidents
      .map(i => ({ sec: Math.max(0, (Math.min(i.end, winEnd) - Math.max(i.start, winStart)) / 1000) }))
      .filter(i => i.sec > 0);
  const incidentCount = overlapped.length;
  ```

#### 2. Total Waktu Periode ($T_{\text{periode}}$)
- **Rumus Matematika:**
  $$T_{\text{periode}} = \max\left(1,\; \text{round}\left(\frac{W_e - W_s}{1000}\right)\right) \quad (\text{detik})$$
- **Rumus Sistem (baris 230):**
  ```js
  const totalPeriodSec = Math.max(1, Math.round((winEnd - winStart) / 1000));
  ```

#### 3. Total Downtime ($T_{\text{down}}$)
Akumulasi seluruh irisan durasi insiden di dalam jendela, dibatasi maksimum sebesar $T_{\text{periode}}$:
- **Rumus Matematika:**
  $$T_{\text{down}} = \min\left(T_{\text{periode}},\; \text{round}\left(\sum_{i \in I_{\text{overlap}}} d_i\right)\right) \quad (\text{detik})$$
- **Rumus Sistem (baris 231):**
  ```js
  const totalDowntimeSec = Math.min(totalPeriodSec, Math.round(overlapped.reduce((sum, i) => sum + i.sec, 0)));
  ```

#### 4. Total Uptime ($T_{\text{up}}$)
- **Rumus Matematika:**
  $$T_{\text{up}} = T_{\text{periode}} - T_{\text{down}} \quad (\text{detik})$$
- **Rumus Sistem (baris 232):**
  ```js
  const totalUptimeSec = totalPeriodSec - totalDowntimeSec;
  ```

#### 5. MTTR (*Mean Time To Repair / Recovery*)
Rata-rata waktu pemulihan per tiket insiden pada jendela evaluasi:
- **Rumus Matematika:**
  $$\text{MTTR} = \begin{cases} \text{round}\left(\dfrac{T_{\text{down}}}{N}\right), & \text{jika } N > 0 \\ 0, & \text{jika } N = 0 \end{cases} \quad (\text{detik})$$
- **Rumus Sistem (baris 234):**
  ```js
  const mttrSec = incidentCount > 0 ? Math.round(totalDowntimeSec / incidentCount) : 0;
  ```

#### 6. Availability / Persentase Ketersediaan (%)
Persentase waktu operasi normal terhadap total durasi periode dalam 2 angka desimal:
- **Rumus Matematika:**
  $$\text{Availability (\%)} = \left(\frac{T_{\text{up}}}{T_{\text{periode}}} \times 100\right)\%$$
- **Rumus Sistem (baris 235):**
  ```js
  const availability = ((totalUptimeSec / totalPeriodSec) * 100).toFixed(2);
  ```

---

### Tahap 4: Pembentukan *Bucket* Grafik Berdasarkan Zona Waktu WIB

Untuk menghasilkan deret waktu `chartData` per jam (`24h`, $\Delta = 3.600.000\text{ ms}$) atau per hari (`7d` & `30d`, $\Delta = 86.400.000\text{ ms}$), kursor awal disejajarkan dengan pergantian jam/hari **WIB (`UTC+7`)**:

- **Rumus Matematika:**
  $$\text{cursor}_0 = \left\lfloor \frac{W_{\text{eff}} + \text{WIB\_OFFSET\_MS}}{\Delta} \right\rfloor \times \Delta - \text{WIB\_OFFSET\_MS}$$
  Untuk setiap langkah iterasi selama $\text{cursor}_k < W_{\text{end}}$:
  $$b_s = \max(\text{cursor}_k,\, W_{\text{eff}}), \qquad b_e = \min(\text{cursor}_k + \Delta,\, W_{\text{end}})$$
  Setiap potongan $[b_s, b_e]$ kemudian dihitung menggunakan fungsi `hitungMetrikITIL(incidents, bs, be)`.

- **Rumus Sistem (`incidentController.js` baris 327–345):**
  ```js
  const stepMs = period.bucket === 'hour' ? 3600 * 1000 : 24 * 3600 * 1000;
  let cursorMs = Math.floor((effectiveStart + WIB_OFFSET_MS) / stepMs) * stepMs - WIB_OFFSET_MS;

  while (cursorMs < winEnd) {
      const bs = Math.max(cursorMs, effectiveStart);
      const nextMs = cursorMs + stepMs;
      const be = Math.min(nextMs, winEnd);
      // ... format label WIB & hitungMetrikITIL(incidents, bs, be) ...
      cursorMs = nextMs;
  }
  ```

---

## 5. Simulasi Contoh Perhitungan Angka Nyata

Misalkan dipilih filter **Periode = `24h`** ($T_{\text{periode}} = 86.400\text{ detik}$) dan **Severity = `ALL`**, serta umur target sudah lebih dari 1 minggu. Dalam 24 jam terakhir terdapat **2 tiket gangguan**:
1. **Tiket #1 (`DOWN`):** Mulai pukul `10:00:00`, selesai pukul `10:15:00` $\rightarrow d_1 = 900\text{ detik}$ ($15\text{ menit}$).
2. **Tiket #2 (`CRITICAL`):** Mulai pukul `14:00:00`, selesai pukul `14:05:00` $\rightarrow d_2 = 300\text{ detik}$ ($5\text{ menit}$).
3. **Tiket #3 (`WARNING`):** Mulai pukul `16:00:00`, selesai pukul `16:30:00` $\rightarrow$ **Diabaikan** pada filter `ALL` karena `ALL` hanya mengevaluasi `['DOWN', 'CRITICAL']`.

Maka hasil perhitungannya:
- **Jumlah Insiden ($N$):** $2\text{ insiden}$
- **Total Periode ($T_{\text{periode}}$):** $86.400\text{ detik}$ ($24\text{ jam}$)
- **Total Downtime ($T_{\text{down}}$):** $\min(86.400,\; 900 + 300) = 1.200\text{ detik}$ (`20m 0d`)
- **Total Uptime ($T_{\text{up}}$):** $86.400 - 1.200 = 85.200\text{ detik}$ (`23j 40m 0d`)
- **MTTR:** $\text{round}(1.200 / 2) = 600\text{ detik}$ (`10m 0d`)
- **Availability:** $(85.200 / 86.400) \times 100 = 98,6111...\% \rightarrow$ **`"98.61"`%**

---

## 6. Perhitungan Uptime Pendamping Lainnya di Sistem

Selain metrik SLA di `incidentController.js`, terdapat 3 fungsi terkait di modul lain:

### 6.1. Riwayat Uptime Berkelanjutan Sebelum Jatuh (`down_history`)
Pada `monitoringDaemon.js` (baris 568–578 untuk Network dan baris 681–691 untuk Proxmox), setiap kali status target berubah dari `UP` menjadi `DOWN`, sistem menghitung berapa lama target sempat bertahan hidup sejak perubahan status terakhir (`last_status_change`):
$$T_{\text{uptime\_streak}} = \max\left(0,\; \left\lfloor \frac{t_{\text{down\_at}} - t_{\text{last\_status\_change}}}{1000} \right\rfloor\right)$$
Nilai tersebut disimpan ke kolom `uptime_duration_sec` pada tabel `down_history`.

### 6.2. Uptime Mesin Langsung dari Hypervisor Proxmox (`proxmoxController.js`)
Pada halaman pemantauan Proxmox (`getProxmoxResources` & `getProxmoxNodeStatus`), waktu hidup Node/VM/LXC diambil langsung dari properti `uptime` milik Proxmox VE API (detik sejak mesin terakhir kali *boot*), lalu diformat oleh `formatUptime` (baris 24–30):
$$\text{hari} = \left\lfloor \frac{S}{86400} \right\rfloor, \quad \text{jam} = \left\lfloor \frac{S \bmod 86400}{3600} \right\rfloor, \quad \text{menit} = \left\lfloor \frac{S \bmod 3600}{60} \right\rfloor$$

### 6.3. Rumus Konversi Detik ke Teks Durasi (`formatSec` & `formatPreciseDuration`)
Digunakan di backend (`incidentController.js` baris 7–23), frontend (`RekapGangguan.vue`, `Dashboard.vue`), dan PDF (`pdfExportService.js` baris 62–74) untuk mengubah total detik $S$ menjadi teks `X hari Yj Zm Sd`:
$$d = \left\lfloor \frac{S}{86400} \right\rfloor, \quad h = \left\lfloor \frac{S \bmod 86400}{3600} \right\rfloor, \quad m = \left\lfloor \frac{S \bmod 3600}{60} \right\rfloor, \quad s = \lfloor S \bmod 60 \rfloor$$

---

## 7. Catatan Teknis & Karakteristik Implementasi Saat Ini

1. **Akumulasi Insiden Bersamaan Tanpa *Interval Merging*:**
   Pada mode agregat (tanpa filter `target_id`), `overlapped.reduce((sum, i) => sum + i.sec, 0)` menjumlahkan durasi semua tiket secara langsung tanpa menggabungkan irisan waktu yang tumpang tindih antar perangkat. Jika ada **2 target berbeda** yang mengalami `DOWN` secara bersamaan selama **10 menit**, maka total downtime tercatat sebesar **20 menit** (namun tetap dijaga oleh `Math.min(totalPeriodSec, ...)` agar tidak pernah melebihi panjang periode jendela evaluasi, sehingga nilai Uptime tidak pernah negatif).
2. **Perilaku Kartu KPI saat Filter `WARNING` Dipilih di UI:**
   Ketika pengguna memilih tab `Warning` pada `RekapGangguan.vue` atau `Dashboard.vue`, backend mengembalikan `total_downtime_sec: 0` dan memindahkan durasi warning ke `total_degradation_sec`. Karena komponen kartu di frontend membaca properti `summary.total_downtime_sec`, angka pada kartu **"Total Gangguan"** akan tampil `0d`, sementara kartu **MTTR** dan jumlah insiden tetap menampilkan durasi rata-rata dari tiket `WARNING` tersebut.
3. **Pembagi `total_devices` pada `RekapGangguan.vue`:**
   Pada `RekapGangguan.vue` (baris 545–546) terdapat kode:
   ```js
   const devices = sum.total_devices || 1;
   const humanUptimeSec = sum.total_uptime_sec / devices;
   ```
   Karena `incidentController.js` tidak mengirimkan field `total_devices` pada objek `summary`, variabel `devices` selalu bernilai `1`, sehingga `humanUptimeSec` bernilai identik dengan `sum.total_uptime_sec` dari backend.
