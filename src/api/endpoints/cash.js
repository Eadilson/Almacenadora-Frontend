import { api, unwrap, unwrapPage } from '../client.js';

function toQuery(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export const cashApi = {
  current: () => api.get('/cash-sessions/current').then(unwrap),
  list: (filters = {}) => api.get(`/cash-sessions?${toQuery(filters)}`).then(unwrapPage),
  detail: (id, filters = {}) => api.get(`/cash-sessions/${id}?${toQuery(filters)}`).then(unwrap),
  open: (payload) => api.post('/cash-sessions', payload).then(unwrap),
  addMovement: ({ sessionId, payload }) =>
    api.post(`/cash-sessions/${sessionId}/movements`, payload).then(unwrap),
  close: ({ sessionId, payload }) =>
    api.post(`/cash-sessions/${sessionId}/close`, payload).then(unwrap),
};
