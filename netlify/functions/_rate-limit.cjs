'use strict';
/** Best-effort per-instance abuse guard. Deploy platform edge limits too. */
const windows = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 15;
const ANONYMOUS_LIMIT = 300; // per-instance safety cap only; edge-level distributed controls still required
function rateLimit(event) {
  const headers = event.headers || {};
  // Netlify edge-provided IP; do not trust arbitrary X-Forwarded-For values.
  const realIp = headers['x-nf-client-connection-ip'] || headers['X-Nf-Client-Connection-Ip'] ||
    event.requestContext?.identity?.sourceIp;
  // Missing verified identity must not share the very small per-IP quota.
  // Apply a much higher per-instance ceiling rather than disabling protection.
  const anonymous = !realIp;
  const key = anonymous ? 'anonymous-global' : 'ip:' + String(realIp).slice(0,128);
  const now = Date.now();
  if (windows.size > 5000) {
    for (const [ip, entry] of windows) if (now - entry.start >= WINDOW_MS) windows.delete(ip);
    if (windows.size > 5000) windows.clear();
  }
  const existing = windows.get(key);
  const entry = !existing || now - existing.start >= WINDOW_MS ? {start:now,count:0} : existing;
  entry.count++;
  windows.set(key,entry);
  if (entry.count <= (anonymous ? ANONYMOUS_LIMIT : LIMIT)) return null;
  return {statusCode:429,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Retry-After':String(Math.max(1,Math.ceil((WINDOW_MS-(now-entry.start))/1000)))},body:JSON.stringify({error:'Repo Router is receiving too many requests from this connection. Try again shortly.',source:'reporouter',retryAfter:Math.max(1,Math.ceil((WINDOW_MS-(now-entry.start))/1000))})};
}
module.exports = {rateLimit, _reset: () => windows.clear()};