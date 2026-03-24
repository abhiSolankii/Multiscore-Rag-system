import client from './client';

const STREAMING = import.meta.env.VITE_ENABLE_STREAMING === 'true';
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// ── Chat CRUD ─────────────────────────────────────────────────────────────────
export const createChat = (title, config = {}) =>
  client.post('/chats/create', { title, config }).then((r) => r.data);

export const getChats = () =>
  client.get('/chats/list').then((r) => r.data);

export const updateChat = (chatId, data) =>
  client.patch(`/chats/${chatId}`, data).then((r) => r.data);

export const deleteChat = (chatId) =>
  client.delete(`/chats/${chatId}`).then((r) => r.data);

// ── Messages ──────────────────────────────────────────────────────────────────
export const getMessages = (chatId) =>
  client.get(`/chats/${chatId}/messages/list`).then((r) => r.data);

/**
 * Send a message. Returns a plain JSON response (non-streaming).
 */
export const sendMessage = (chatId, content) =>
  client
    .post(`/chats/${chatId}/messages/send`, { role: 'user', content })
    .then((r) => r.data);

/**
 * Send a message via SSE (streaming).
 * Returns an EventSource instance. Caller manages event handlers.
 * Requires access token passed manually since EventSource doesn't support headers.
 * @param {string} chatId
 * @param {string} content
 * @param {string} token - JWT access token
 */
export const sendMessageStream = (chatId, content, token) => {
  // SSE cannot send a POST body natively. We use fetch + ReadableStream instead.
  // This function returns a ReadableStream reader.
  const url = `${BASE_URL}/chats/${chatId}/messages/send`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role: 'user', content }),
  });
};

export { STREAMING };
