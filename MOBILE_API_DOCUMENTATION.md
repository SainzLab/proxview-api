# Dokumentasi API Mobile: Network Tools & Export PDF
**Sistem Monitoring ProxView (Helper API Viewmox)**

Dokumentasi ini disusun khusus untuk tim pengembang **Frontend Mobile (Flutter / Android / iOS)** dalam mengintegrasikan fitur:
1. **Network Tools** (`Ping`, `Traceroute`, `IP Scan`)
2. **Unduh Laporan PDF** (`Rekap Gangguan & SLA`, `Ringkasan Dashboard Infrastruktur`)

---

## 1. Konfigurasi Dasar & Otentikasi

### 1.1 Base URL & Versi API
Semua endpoint mobile disarankan menggunakan prefix `v1`:
```http
Base URL: http://<HOST_SERVER>:3000/api/mobile/v1
```
*(Catatan: Rute fallback `/api/mobile/tools/*` juga aktif untuk kompatibilitas ke belakang).*

### 1.2 Header Otentikasi
Setiap permintaan ke endpoint mobile **wajib** menyertakan API Token pada header `Authorization`:

```http
Authorization: Bearer <API_TOKEN_PENGGUNA>
Accept: application/json
```

> **Catatan Token:**
> - Token diperoleh saat pengguna (Role: `Teknisi` atau `Kepala Bidang`) login melalui endpoint `/api/mobile/v1/auth/login`.
> - Jika token kedaluwarsa atau tidak valid, server mengembalikan status **HTTP 401**.
> - Jika akun pengguna dinonaktifkan oleh Administrator, server mengembalikan status **HTTP 403**.

---

## 2. API Network Tools

Seluruh endpoint tools mengembalikan data utuh dalam format **JSON** (bukan streaming chunks), sehingga sangat mudah di-parse dan ditampilkan pada komponen konsol/terminal di aplikasi mobile.

```
POST /api/mobile/v1/tools/ping
POST /api/mobile/v1/tools/traceroute
POST /api/mobile/v1/tools/ipscan
```

### Format Standar Respons JSON
```typescript
interface NetworkToolResponse {
  success: boolean;  // true jika proses OS selesai sukses, false jika gagal / error
  output: string;    // Raw output stdout/stderr dari OS terminal
  message: string;   // Keterangan status ramah pengguna
}
```

---

### 2.1 Tool: Ping (ICMP Echo)

Menguji konektivitas dan latensi ke host target sebanyak **10 paket**.

- **URL:** `/api/mobile/v1/tools/ping`
- **Method:** `POST`
- **Headers:**
  ```http
  Authorization: Bearer <API_TOKEN>
  Content-Type: application/json
  ```
- **Request Body:**
  ```json
  {
    "target": "8.8.8.8"
  }
  ```
- **Aturan Validasi Input (`target`):**
  - Hanya menerima huruf, angka, titik (`.`), dan tanda hubung/strip (`-`).
  - Maksimal 253 karakter.
  - Nilai target berupa IP (mis. `192.168.1.1`) atau Hostname/Domain (mis. `google.com`).
  - Karakter berbahaya (`;`, `&`, `|`, `$`, spasi, kutip) otomatis ditolak dengan kode 400 (Anti OS Command Injection).

#### Contoh Respons

**Berhasil (HTTP 200):**
```json
{
  "success": true,
  "output": "PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.\n64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=14.2 ms\n64 bytes from 8.8.8.8: icmp_seq=2 ttl=118 time=13.8 ms\n...\n--- 8.8.8.8 ping statistics ---\n10 packets transmitted, 10 received, 0% packet loss, time 9012ms\nrtt min/avg/max/mdev = 13.512/14.104/15.221/0.450 ms",
  "message": "Ping berhasil dijalankan."
}
```

**Validasi Gagal / Karakter Ilegal (HTTP 400):**
```json
{
  "success": false,
  "output": "",
  "message": "Target tidak valid. Hanya huruf, angka, titik, dan strip yang diperbolehkan."
}
```

**Host RTO / Paket Loss 100% (HTTP 200, success: false):**
```json
{
  "success": false,
  "output": "PING 192.168.200.250 (192.168.200.250) 56(84) bytes of data.\n...\n10 packets transmitted, 0 received, 100% packet loss, time 9210ms",
  "message": "Ping selesai dengan peringatan atau target tidak merespons."
}
```

---

### 2.2 Tool: Traceroute

Melacak rute lompatan router (*hops*) dari server monitoring menuju host tujuan.

- **URL:** `/api/mobile/v1/tools/traceroute`
- **Method:** `POST`
- **Headers:**
  ```http
  Authorization: Bearer <API_TOKEN>
  Content-Type: application/json
  ```
- **Request Body:**
  ```json
  {
    "target": "google.com"
  }
  ```
- **Aturan Validasi Input:** Sama dengan aturan Ping (Regex ketat huruf, angka, titik, strip).

#### Contoh Respons

**Berhasil (HTTP 200):**
```json
{
  "success": true,
  "output": "traceroute to google.com (142.250.199.110), 30 hops max, 60 byte packets\n 1  gateway (192.168.1.1)  1.231 ms  1.102 ms  1.085 ms\n 2  10.10.0.1 (10.10.0.1)  4.512 ms  4.401 ms  4.380 ms\n 3  142.250.199.110 (142.250.199.110)  18.210 ms  18.150 ms  18.090 ms",
  "message": "Traceroute berhasil dijalankan."
}
```

---

### 2.3 Tool: IP Scan (Nmap Host Discovery)

Memindai daftar host yang aktif pada suatu subnet menggunakan perintah `nmap -sn` (Ping Scan tanpa port scan) sehingga cepat dan aman.

- **URL:** `/api/mobile/v1/tools/ipscan`
- **Method:** `POST`
- **Headers:**
  ```http
  Authorization: Bearer <API_TOKEN>
  Content-Type: application/json
  ```
- **Request Body:**
  ```json
  {
    "target": "192.168.1.0/24"
  }
  ```
- **Aturan Validasi Input (`target`):**
  - Wajib format IPv4 dengan prefix CIDR opsional: `/^([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$/`.
  - Setiap oktet harus berada di rentang `0` s.d. `255`.
  - Prefix subnet dibatasi dari `16` sampai `32` (misal `/16`, `/23`, `/24`, `/32`) untuk mencegah beban server memindai rentang IP yang terlalu masif (seperti `/8`).

#### Contoh Respons

**Berhasil (HTTP 200):**
```json
{
  "success": true,
  "output": "Starting Nmap 7.93 ( https://nmap.org ) at 2026-11-01 22:45 WIB\nNmap scan report for 192.168.1.1\nHost is up (0.0012s latency).\nNmap scan report for 192.168.1.10\nHost is up (0.0025s latency).\nNmap scan report for 192.168.1.25\nHost is up (0.0041s latency).\nNmap done: 256 IP addresses (3 hosts up) scanned in 2.85 seconds",
  "message": "IP Scan berhasil dijalankan."
}
```

**Subnet di Luar Batas Aman / Format Salah (HTTP 400):**
```json
{
  "success": false,
  "output": "",
  "message": "Target tidak valid. Gunakan format IP atau IP/prefix (contoh: 192.168.1.0/24, prefix /16 sampai /32)."
}
```

**Aplikasi `nmap` Belum Terinstal di Server OS (HTTP 200, success: false):**
```json
{
  "success": false,
  "output": "[Error] Aplikasi 'nmap' belum terinstal di server backend. Silakan jalankan 'apt install nmap' terlebih dahulu.",
  "message": "Aplikasi 'nmap' belum terinstal di server backend."
}
```

---

## 3. API Unduh Laporan PDF

Respons untuk endpoint laporan adalah **aliran biner murni PDF** (`application/pdf`), bukan JSON. Pada Frontend Mobile, baca respons sebagai `bytes` lalu simpan ke penyimpanan lokal (*local storage/cache*) perangkat.

### 3.1 PDF Rekapitulasi Gangguan & SLA

- **URL:** `/api/mobile/v1/export/pdf/incidents`
- **Method:** `GET`
- **Headers:**
  ```http
  Authorization: Bearer <API_TOKEN>
  ```
- **Query Parameters:**
  | Parameter | Tipe | Pilihan Nilai | Default | Keterangan |
  |---|---|---|---|---|
  | `period` | string | `24h`, `7d`, `30d` | `24h` | Rentang waktu analitik insiden |
  | `severity` | string | `ALL`, `DOWN`, `CRITICAL`, `WARNING` | `ALL` | Filter tingkat keparahan gangguan |

- **Header Respons:**
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="Laporan_Rekap_Gangguan_<period>_<severity>_<YYYY-MM-DD>.pdf"`

---

### 3.2 PDF Ringkasan Dashboard Infrastruktur

- **URL:** `/api/mobile/v1/export/pdf/dashboard`
- **Method:** `GET`
- **Headers:**
  ```http
  Authorization: Bearer <API_TOKEN>
  ```
- **Query Parameters:**
  | Parameter | Tipe | Pilihan Nilai | Default | Keterangan |
  |---|---|---|---|---|
  | `timeframe` | string | `1h`, `24h`, `7d` | `1h` | Rentang metrik utilisasi node/target |
  | `period` | string | `24h`, `7d`, `30d` | `24h` | Rentang data analitik SLA |
  | `severity` | string | `ALL`, `DOWN`, `CRITICAL`, `WARNING` | `ALL` | Filter tingkat keparahan |

- **Header Respons:**
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="Ringkasan_Infrastruktur_Proxview_<YYYY-MM-DD>.pdf"`

---

### 3.3 PDF Router Serbaguna (Satu Pintu)

- **URL:** `/api/mobile/v1/export/pdf`
- **Method:** `GET`
- **Query Parameters:**
  - `type`: `incidents` (default) atau `dashboard`.
  - Sertakan parameter `period`, `severity`, atau `timeframe` sesuai target yang dipilih.

---

## 4. Contoh Implementasi Flutter / Dart

Berikut adalah contoh kode siap pakai menggunakan package [`dio`](https://pub.dev/packages/dio), [`path_provider`](https://pub.dev/packages/path_provider), dan [`open_filex`](https://pub.dev/packages/open_filex).

### 4.1 Model Data Network Tool (`network_tool_model.dart`)

```dart
class NetworkToolResponse {
  final bool success;
  final String output;
  final String message;

  NetworkToolResponse({
    required this.success,
    required this.output,
    required this.message,
  });

  factory NetworkToolResponse.fromJson(Map<String, dynamic> json) {
    return NetworkToolResponse(
      success: json['success'] ?? false,
      output: json['output'] ?? '',
      message: json['message'] ?? '',
    );
  }
}
```

---

### 4.2 Network Tools Service (`network_tools_service.dart`)

```dart
import 'package:dio/dio.dart';
import 'network_tool_model.dart';

class NetworkToolsService {
  final Dio _dio;
  final String baseUrl;

  NetworkToolsService({
    required this.baseUrl,
    required String apiToken,
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            headers: {
              'Authorization': 'Bearer $apiToken',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(minutes: 5), // IP Scan bisa memakan waktu s.d. 5 menit
          ),
        );

  /// Eksekusi Ping (10 paket)
  Future<NetworkToolResponse> runPing(String target) async {
    try {
      final response = await _dio.post(
        '/api/mobile/v1/tools/ping',
        data: {'target': target.trim()},
      );
      return NetworkToolResponse.fromJson(response.data);
    } on DioException catch (e) {
      return _handleDioError(e, 'Ping');
    }
  }

  /// Eksekusi Traceroute
  Future<NetworkToolResponse> runTraceroute(String target) async {
    try {
      final response = await _dio.post(
        '/api/mobile/v1/tools/traceroute',
        data: {'target': target.trim()},
      );
      return NetworkToolResponse.fromJson(response.data);
    } on DioException catch (e) {
      return _handleDioError(e, 'Traceroute');
    }
  }

  /// Eksekusi IP Scan (Nmap)
  /// Contoh target: '192.168.1.0/24'
  Future<NetworkToolResponse> runIpScan({
    required String ipNetwork,
    String subnetPrefix = '/24',
  }) async {
    final fullTarget = '${ipNetwork.trim()}$subnetPrefix';
    try {
      final response = await _dio.post(
        '/api/mobile/v1/tools/ipscan',
        data: {'target': fullTarget},
      );
      return NetworkToolResponse.fromJson(response.data);
    } on DioException catch (e) {
      return _handleDioError(e, 'IP Scan');
    }
  }

  NetworkToolResponse _handleDioError(DioException e, String toolName) {
    if (e.response != null && e.response?.data is Map<String, dynamic>) {
      return NetworkToolResponse.fromJson(e.response!.data);
    }
    return NetworkToolResponse(
      success: false,
      output: '',
      message: e.message ?? 'Gagal menghubungi server untuk utilitas $toolName.',
    );
  }
}
```

---

### 4.3 PDF Download & Open Service (`pdf_export_service.dart`)

```dart
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';

class PdfExportService {
  final Dio _dio;

  PdfExportService({
    required String baseUrl,
    required String apiToken,
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            headers: {
              'Authorization': 'Bearer $apiToken',
            },
            responseType: ResponseType.bytes, // Wajib ResponseType.bytes untuk PDF
          ),
        );

  /// Unduh PDF Rekap Gangguan & langsung buka file
  Future<File?> downloadIncidentsPdf({
    String period = '24h',
    String severity = 'ALL',
    void Function(int received, int total)? onProgress,
  }) async {
    return _downloadPdfFile(
      endpoint: '/api/mobile/v1/export/pdf/incidents',
      queryParams: {'period': period, 'severity': severity},
      defaultFileName: 'Laporan_Rekap_Gangguan_${period}_$severity.pdf',
      onProgress: onProgress,
    );
  }

  /// Unduh PDF Ringkasan Dashboard & langsung buka file
  Future<File?> downloadDashboardPdf({
    String timeframe = '1h',
    String period = '24h',
    String severity = 'ALL',
    void Function(int received, int total)? onProgress,
  }) async {
    return _downloadPdfFile(
      endpoint: '/api/mobile/v1/export/pdf/dashboard',
      queryParams: {
        'timeframe': timeframe,
        'period': period,
        'severity': severity,
      },
      defaultFileName: 'Ringkasan_Infrastruktur_Proxview.pdf',
      onProgress: onProgress,
    );
  }

  Future<File?> _downloadPdfFile({
    required String endpoint,
    required Map<String, dynamic> queryParams,
    required String defaultFileName,
    void Function(int received, int total)? onProgress,
  }) async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final filePath = '${dir.path}/$defaultFileName';

      final response = await _dio.get(
        endpoint,
        queryParameters: queryParams,
        onReceiveProgress: onProgress,
      );

      final file = File(filePath);
      await file.writeAsBytes(response.data as List<int>);

      // Buka dokumen PDF otomatis dengan aplikasi default perangkat
      await OpenFilex.open(filePath);

      return file;
    } catch (e) {
      print('Error mengunduh PDF: $e');
      rethrow;
    }
  }
}
```

---

## 5. Ringkasan Status Code HTTP

| Status Code | Arti | Tindakan di Mobile App |
|---|---|---|
| **200 OK** | Permintaan sukses dieksekusi. | Tampilkan hasil ke UI console atau buka PDF. |
| **400 Bad Request** | Format parameter tidak valid (IP/Subnet salah atau karakter ilegal). | Tampilkan dialog atau Snackbar peringatan ke pengguna: `response.data['message']`. |
| **401 Unauthorized** | Token otorisasi tidak ada, salah, atau kedaluwarsa. | Arahkan pengguna ke halaman Login Mobile dan bersihkan local storage token. |
| **403 Forbidden** | Akun dinonaktifkan oleh Administrator. | Tampilkan dialog akun terblokir dan batalkan sesi. |
| **500 Server Error** | Kesalahan sistem backend / database. | Tampilkan pesan `Server sedang mengalami kendala, silakan coba beberapa saat lagi`. |
