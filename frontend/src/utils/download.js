import api from '../api/client';

export async function downloadExport(productId, format = 'txt') {
  const res = await api.get(`/products/${productId}/export?format=${format}`);
  downloadFile(res.data.content, res.data.filename, res.data.mime);
}

export async function downloadAllProjects(format = 'csv') {
  const res = await api.get(`/products/export-all?format=${format}`);
  downloadFile(res.data.content, res.data.filename, res.data.mime);
}

export function downloadFile(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
