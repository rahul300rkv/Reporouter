'use strict';
/** Best-effort per-instance abuse guard. Deploy platform edge limits too. */
const windows = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 15;
function rateLimit(event) {
  const headers = event.headers || {};
  // Netlify edge-provided IP; do not trust arbitrary X-Forwarded-For values.
  const key = String(headers['x-nf-client-connection-ip'] || headers['X-Nf-Client-Connection-Ip'] || 'unknown').slice(0,128);
  const now = Date.now();
  if (windows.size > 5000) {
    for (const [ip, entry] of windows) if (now - entry.start >= WINDOW_MS) windows.delete(ip);
    if (windows.size > 5000) windows.clear();
  }
  const existing = windows.get(key);
  const entry = !existing || now - existing.start >= WINDOW_MS ? {start:now,count:0} : existing;
  entry.count++;
  windows.set(key,entry);
  if (entry.count <= LIMIT) return null;
  return {statusCode:429,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Retry-After':String(Math.max(1,Math.ceil((WINDOW_MS-(now-entry.start))/1000)))},body:JSON.stringify({error:'Too many documentation requests. Try again shortly.'})};
}
module.exports = {rateLimit};