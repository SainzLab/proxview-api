/**
 * Helper untuk mengunduh file binary (seperti PDF) dari endpoint API backend
 * dan memicu dialog unduhan di browser.
 * 
 * @param {string} url - URL endpoint API
 * @param {string} defaultFilename - Nama file cadangan jika tidak ada di header Content-Disposition
 */
export const downloadFileFromApi = async (url, defaultFilename = 'dokumen.pdf') => {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    let errorMsg = 'Gagal mengunduh file dari server.';
    try {
      const errJson = await response.json();
      if (errJson && errJson.message) errorMsg = errJson.message;
    } catch (_) {
      // Abaikan jika body bukan JSON
    }
    throw new Error(errorMsg);
  }

  // Ambil nama file resmi dari header Content-Disposition jika tersedia
  let filename = defaultFilename;
  const disposition = response.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename=["']?([^"']+)["']?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
};
