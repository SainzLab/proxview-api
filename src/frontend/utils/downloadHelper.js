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
    }
    throw new Error(errorMsg);
  }

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
