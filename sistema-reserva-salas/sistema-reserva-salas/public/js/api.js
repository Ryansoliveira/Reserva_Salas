const api = {
  async request(path, options = {}) {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || `Erro HTTP ${response.status}`);
    return data;
  },
  get: path => api.request(path),
  post: (path, data) => api.request(path, { method:'POST', body:JSON.stringify(data) }),
  put: (path, data) => api.request(path, { method:'PUT', body:JSON.stringify(data) }),
  delete: path => api.request(path, { method:'DELETE' })
};