/**
 * ProtSphere API Client
 *
 * Replaces direct Firestore calls. All mutations go through backend.
 * Firestore reads still happen for real-time subscriptions via SDK.
 */

import { getAuth } from 'firebase/auth';

// API base URL — same origin in production (Vercel), or configure via env
const API_BASE = import.meta.env.VITE_API_URL || '/api';

let currentToken = null;
let tokenListener = null;

/**
 * Initialize: listen for auth token changes
 */
export function initApiClient() {
  const auth = getAuth();
  if (tokenListener) return;
  tokenListener = auth.onIdTokenChanged(async (user) => {
    if (user) {
      currentToken = await user.getIdToken();
    } else {
      currentToken = null;
    }
  });
}

/**
 * Get fresh token — force refresh if needed
 */
async function getToken() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    try {
      currentToken = await user.getIdToken(true);
    } catch {
      currentToken = await user.getIdToken();
    }
  }
  return currentToken;
}

/**
 * Core request function
 */
async function request(method, path, body = null) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const resp = await fetch(`${API_BASE}${path}`, opts);
  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data.error || `API ${method} ${path} failed (${resp.status})`);
  }
  return data;
}

// ─── Auth ───
export const apiAuth = {
  verify: (idToken) => request('POST', '/auth/verify', { idToken }),
  me: () => request('GET', '/auth/me'),
  checkAdmin: (uid) => request('GET', `/auth/check-admin?uid=${uid}`),
};

// ─── People CRUD ───
export const apiPeople = {
  list: () => request('GET', '/people'),
  get: (id) => request('GET', `/people/${id}`),
  create: (data) => request('POST', '/people', data),
  update: (id, data) => request('PUT', `/people/${id}`, data),
  delete: (id) => request('DELETE', `/people/${id}`),
};

// ─── Events CRUD ───
export const apiEvents = {
  list: () => request('GET', '/events'),
  get: (id) => request('GET', `/events/${id}`),
  create: (data) => request('POST', '/events', data),
  update: (id, data) => request('PUT', `/events/${id}`, data),
  delete: (id) => request('DELETE', `/events/${id}`),
};

// ─── Memories CRUD ───
export const apiMemories = {
  list: () => request('GET', '/memories'),
  get: (id) => request('GET', `/memories/${id}`),
  create: (data) => request('POST', '/memories', data),
  update: (id, data) => request('PUT', `/memories/${id}`, data),
  delete: (id) => request('DELETE', `/memories/${id}`),
};

// ─── Places CRUD ───
export const apiPlaces = {
  list: () => request('GET', '/places'),
  get: (id) => request('GET', `/places/${id}`),
  create: (data) => request('POST', '/places', data),
  update: (id, data) => request('PUT', `/places/${id}`, data),
  delete: (id) => request('DELETE', `/places/${id}`),
};

// ─── Groups CRUD ───
export const apiGroups = {
  list: () => request('GET', '/groups'),
  get: (id) => request('GET', `/groups/${id}`),
  create: (data) => request('POST', '/groups', data),
  update: (id, data) => request('PUT', `/groups/${id}`, data),
  delete: (id) => request('DELETE', `/groups/${id}`),
};

// ─── Import / Export ───
export const apiDataHub = {
  listConnectors: () => request('GET', '/import/connectors'),
  importSheets: (url) => request('POST', '/import/sheets', { url }),
  importJson: (data) => request('POST', '/import/json', { data }),
  parseFile: (fileBase64, fileName, mimeType) => request('POST', '/import/parse-file', { fileBase64, fileName, mimeType }),
  listFormats: () => request('GET', '/export/formats'),
  exportJson: () => request('GET', '/export/json'),
  exportReport: (format, options = {}) => request('POST', '/export/report', { format, ...options }),
  exportCollection: (coll) => request('GET', `/export/${coll}`),
};

export default { initApiClient, apiAuth, apiPeople, apiEvents, apiMemories, apiPlaces, apiDataHub };
