import { translations } from './translations';

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export async function request(path, { token, body, ...options } = {}) {
  let response;
  try {
    const formData = body instanceof FormData;
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { ...(body !== undefined && !formData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: formData ? body : JSON.stringify(body) } : {})
    });
  } catch {
    throw new ApiError('Unable to reach the shop. Please check your connection and try again.', 0);
  }
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event('admin-session-expired'));
    const messages = {
      400: 'Please check the information and try again.',
      401: token ? 'Your session has expired. Please sign in again.' : 'Incorrect username or password.',
      403: 'An admin account is required for this action.',
      404: 'This resource is not available yet.',
      409: 'This change conflicts with the current stock or an existing record.',
      429: 'Too many attempts. Please wait a minute and try again.'
    };
    // Keep message keys so existing errors follow language changes. Unknown server errors
    // use the translated HTTP fallback instead of displaying diagnostics or English text.
    const serverMessage = typeof data?.error === 'string' ? data.error : '';
    const message = translations[serverMessage] ? serverMessage
      : /^Product \d+ was not found\.$/.test(serverMessage) ? 'This resource is not available yet.'
      : /^Insufficient stock for product .+\.$/.test(serverMessage) ? 'Insufficient stock.'
      : /^A pack named '.+' already exists\.$/.test(serverMessage) ? 'A pack with this name already exists.'
      : messages[response.status] || 'The server could not complete this request. Please try again.';
    throw new ApiError(message, response.status);
  }
  return data;
}

export function mediaUrl(path) {
  if (!path || /^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path || '';
  if (baseUrl.startsWith('http')) return `${new URL(baseUrl).origin}${path.startsWith('/') ? path : `/${path}`}`;
  return path.startsWith('/') ? path : `/${path}`;
}

export function uploadProductImage(id, image, token) {
  const body = new FormData();
  body.append('image', image);
  return request(`/products/${id}/image`, { method: 'PUT', token, body });
}

export async function getProducts() {
  const products = await request('/products');
  if (!Array.isArray(products)) throw new ApiError('The catalog returned an unexpected response.', 0);
  return products;
}
export const categories = ['Proteine', 'Creatine', 'MassGainer', 'PreWorkout', 'Vitamin', 'Snack', 'Boisson', 'Booster', 'FatBurner', 'AcidesAmine', 'Collagene'];
export const categoryName = value => value === 'Packs' ? value : typeof value === 'number' ? categories[value] || 'Unknown' : categories.includes(value) ? value : 'Unknown';
export const categoryValue = value => typeof value === 'number' ? value : categories.indexOf(value);
export async function getPacks(token) {
  const packs = await request(token ? '/packs/all' : '/packs', { token });
  if (!Array.isArray(packs)) throw new ApiError('The catalog returned an unexpected response.', 0);
  return packs;
}
