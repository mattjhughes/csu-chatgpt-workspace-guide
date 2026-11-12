'use strict';
importScripts('sync-core.js');
const syncAlarm = 'csu-baseline-refresh';
const freshnessMs = 15 * 60 * 1000;
let pending;

async function snapshot() {
  const stored = await chrome.storage.local.get([CSU_SYNC.CACHE_KEY, CSU_SYNC.STATE_KEY]);
  let baseline = null;
  try { if (stored[CSU_SYNC.CACHE_KEY]) baseline = CSU_SYNC.validate(stored[CSU_SYNC.CACHE_KEY]); } catch { /* Use packaged baseline if the cache is damaged. */ }
  return { baseline, state:stored[CSU_SYNC.STATE_KEY] || {} };
}
async function refresh(force = false) {
  if (pending) return pending;
  pending = (async () => {
    const current = await snapshot();
    if (!force && current.baseline && Date.now() - Date.parse(current.state.checkedAt || '') < freshnessMs) return current;
    try {
      const response = await fetch(CSU_SYNC.URL, {
        cache:'no-cache', credentials:'omit', redirect:'error',
        signal:AbortSignal.timeout(15000), headers:{ Accept:'application/json' }
      });
      if (!response.ok) throw new Error('Baseline download failed');
      const length = Number(response.headers.get('content-length'));
      if (length > CSU_SYNC.MAX_BYTES) throw new Error('Baseline is too large');
      // Enforce the limit even if the server omits Content-Length.
      const reader = response.body.getReader();
      const chunks = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > CSU_SYNC.MAX_BYTES) { await reader.cancel(); throw new Error('Baseline is too large'); }
        chunks.push(value);
      }
      const data = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
      const baseline = CSU_SYNC.validate(JSON.parse(new TextDecoder().decode(data)));
      const state = { checkedAt:new Date().toISOString(), error:null };
      await chrome.storage.local.set({ [CSU_SYNC.CACHE_KEY]:baseline, [CSU_SYNC.STATE_KEY]:state });
      return { baseline, state };
    } catch {
      const state = { ...current.state, attemptedAt:new Date().toISOString(), error:'Could not update from GitHub. Using the last available baseline.' };
      await chrome.storage.local.set({ [CSU_SYNC.STATE_KEY]:state });
      return { baseline:current.baseline, state };
    }
  })();
  try { return await pending; } finally { pending = null; }
}
async function ensureAlarm() {
  if (!(await chrome.alarms.get(syncAlarm))) await chrome.alarms.create(syncAlarm, { periodInMinutes:60 });
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !/^https:\/\/admin\.openai\.com\//.test(sender.url || '') || message?.type !== 'CSU_GET_BASELINE') return;
  refresh(message.force === true).then(reply).catch(() => reply({ baseline:null, state:{ error:'Baseline sync unavailable. Using packaged guidance.' } }));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === syncAlarm) void refresh(true).catch(() => {}); });
chrome.runtime.onInstalled.addListener(() => { void ensureAlarm().then(() => refresh(true)).catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { void ensureAlarm().then(() => refresh()).catch(() => {}); });
void ensureAlarm().catch(() => {});
