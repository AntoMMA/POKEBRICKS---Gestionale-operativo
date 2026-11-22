const crypto = require('node:crypto');

const API_BASE = 'https://open-api.tiktokglobalshop.com';
const AUTH_BASE = 'https://auth.tiktok-shops.com';

function signature(path, params, body, appSecret) {
  const canonical = Object.keys(params)
    .filter(key => key !== 'sign' && key !== 'access_token')
    .sort()
    .map(key => `${key}${params[key]}`)
    .join('');
  const payload = `${appSecret}${path}${canonical}${body ? JSON.stringify(body) : ''}${appSecret}`;
  return crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
}

function apiError(payload, status) {
  if (status >= 200 && status < 300 && Number(payload?.code) === 0) return;
  const code = payload?.code ?? status;
  const message = payload?.message || payload?.error_description || `Risposta HTTP ${status}`;
  const error = new Error(`TikTok Shop (${code}): ${message}`);
  error.code = Number(code);
  throw error;
}

async function parseResponse(response) {
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`TikTok Shop ha restituito una risposta non valida (HTTP ${response.status}).`); }
  apiError(payload, response.status);
  return payload;
}

async function refreshCredentials(credentials) {
  if (!credentials.refreshToken) throw new Error('Il token TikTok è scaduto. Inserisci un token di aggiornamento valido nella sezione TikTok Shop.');
  const query = new URLSearchParams({ app_key: credentials.appKey, app_secret: credentials.appSecret, refresh_token: credentials.refreshToken, grant_type: 'refresh_token' });
  const response = await fetch(`${AUTH_BASE}/api/v2/token/refresh?${query}`, { signal: AbortSignal.timeout(15000) });
  const payload = await parseResponse(response);
  const data = payload.data || payload;
  if (!data.access_token) throw new Error('TikTok Shop non ha restituito un nuovo token di accesso.');
  credentials.accessToken = data.access_token;
  credentials.refreshToken = data.refresh_token || credentials.refreshToken;
  return credentials;
}

async function request(credentials, path, method = 'GET', body = null, extra = {}) {
  const params = { app_key: credentials.appKey, timestamp: String(Math.floor(Date.now() / 1000)), ...extra };
  if (credentials.shopCipher) params.shop_cipher = credentials.shopCipher;
  const jsonBody = body ? JSON.stringify(body) : '';
  params.sign = signature(path, params, body, credentials.appSecret);
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', 'x-tts-access-token': credentials.accessToken },
    ...(body ? { body: jsonBody } : {}),
    signal: AbortSignal.timeout(20000)
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`TikTok Shop ha restituito una risposta non valida (HTTP ${response.status}).`); }
  if (Number(payload?.code) === 105002 || Number(payload?.code) === 36009004 && /expired/i.test(payload?.message || '')) {
    await refreshCredentials(credentials);
    params.timestamp = String(Math.floor(Date.now() / 1000));
    params.sign = signature(path, params, body, credentials.appSecret);
    const retryUrl = new URL(`${API_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) retryUrl.searchParams.set(key, value);
    response = await fetch(retryUrl, {
      method,
      headers: { 'content-type': 'application/json', 'x-tts-access-token': credentials.accessToken },
      ...(body ? { body: jsonBody } : {}),
      signal: AbortSignal.timeout(20000)
    });
    payload = await response.json();
  }
  apiError(payload, response.status);
  return payload;
}

async function getAuthorizedShops(credentials) {
  const payload = await request({ ...credentials, shopCipher: '' }, '/authorization/202309/shops');
  return payload.data?.shops || [];
}

async function getOrderDetails(credentials, orderIds) {
  if (!orderIds.length) return [];
  const payload = await request(credentials, '/order/202507/orders', 'GET', null, { ids: orderIds.join(',') });
  const orders = payload.data?.orders || (payload.data?.order ? [payload.data.order] : []);
  return Array.isArray(orders) ? orders : [];
}

async function listOrders(credentials, updateTimeGe, updateTimeLt) {
  const all = [];
  let pageToken = '';
  for (let page = 0; page < 100; page++) {
    const extra = { page_size: '100', sort_field: 'update_time', sort_order: 'ASC' };
    if (pageToken) extra.page_token = pageToken;
    const body = { update_time_ge: updateTimeGe, update_time_lt: updateTimeLt };
    const payload = await request(credentials, '/order/202309/orders/search', 'POST', body, extra);
    all.push(...(payload.data?.orders || []));
    pageToken = payload.data?.next_page_token || '';
    if (!pageToken) return all;
  }
  throw new Error('La sincronizzazione ha superato il limite di pagine; riprova con una finestra più breve.');
}

async function syncOrders(credentials, updateTimeGe) {
  const now = Math.floor(Date.now() / 1000);
  const windowSeconds = 7 * 24 * 60 * 60;
  const orders = [];
  let windowStart = updateTimeGe;
  for (let window = 0; windowStart < now && window < 104; window++) {
    const windowEnd = Math.min(windowStart + windowSeconds, now);
    orders.push(...await listOrders(credentials, windowStart, windowEnd));
    windowStart = windowEnd;
  }
  if (windowStart < now) throw new Error('La pausa tra le sincronizzazioni supera il limite recuperabile in un’unica operazione. Esegui prima una sincronizzazione manuale o contatta l’assistenza.');
  const uniqueOrders = [...new Map(orders.filter(order => order?.id).map(order => [String(order.id), order])).values()];
  const details = new Map();
  for (let index = 0; index < uniqueOrders.length; index += 50) {
    const batch = uniqueOrders.slice(index, index + 50);
    const fetched = await getOrderDetails(credentials, batch.map(order => String(order.id)));
    for (const order of fetched) {
      if (order?.id) details.set(String(order.id), order);
    }
  }
  return { orders: uniqueOrders.map(order => details.get(String(order.id)) || order), refreshedCredentials: credentials };
}

module.exports = { getAuthorizedShops, syncOrders };
