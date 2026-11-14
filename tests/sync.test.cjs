const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dir = path.resolve(__dirname, '..');
const published = JSON.parse(fs.readFileSync(path.join(dir, 'recommendations.json'), 'utf8'));
function setup() {
  const db = {};
  const listeners = {};
  let calls = 0;
  let download = () => new Response(JSON.stringify(published));
  const context = vm.createContext({
    URL, Date, TextDecoder, Uint8Array, AbortSignal,
    fetch: async (url, options) => {
      calls++;
      assert.equal(url, 'https://raw.githubusercontent.com/mattjhughes/csu-chatgpt-workspace-guide/main/recommendations.json');
      assert.equal(options.credentials, 'omit');
      return download();
    },
    chrome: {
      storage: { local: {
        get: async keys => Object.fromEntries(keys.map(k => [k, db[k]])),
        set: async data => Object.assign(db, structuredClone(data))
      } },
      alarms: { get:async () => ({}), create:async () => {}, onAlarm:{addListener:f => listeners.alarm=f} },
      runtime: { id:'test-extension', onMessage:{addListener:f => listeners.message=f}, onInstalled:{addListener:()=>{}}, onStartup:{addListener:()=>{}} }
    }
  });
  context.importScripts = file => vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(dir,'background.js'),'utf8')+'\nthis.api={refresh,snapshot,validate:CSU_SYNC.validate};', context);
  return { db, listeners, api:context.api, calls:()=>calls, download:f => { download=f; } };
}
test('published data validates; success is cached and fresh cache avoids another request', async () => {
  const s=setup();
  const result=await s.api.refresh();
  assert.equal(result.baseline.version,published.version);
  assert.equal(result.state.error,null);
  assert.ok(Object.keys(result.baseline.recommendations).length>50);
  await s.api.refresh();
  assert.equal(s.calls(),1);
});
test('offline and invalid responses preserve the last valid baseline',async () => {
  const s=setup(); await s.api.refresh();
  s.download(()=>{throw new Error('offline');});
  assert.equal((await s.api.refresh(true)).baseline.version,published.version);
  assert.ok(s.db.csuSyncStateV1.error);
  s.download(()=>new Response(JSON.stringify({...published, recommendations:{x:{decision:'execute'}}})));
  assert.equal((await s.api.refresh(true)).baseline.version,published.version);
  assert.equal(s.db.csuPublishedBaselineV1.version,published.version);
});
test('oversized or incompatible baseline is rejected; clean install can work offline',async () => {
  const s=setup();
  s.download(()=>new Response('x'.repeat(1024*1024+1)));
  assert.equal((await s.api.refresh()).baseline,null);
  assert.throws(()=>s.api.validate({...published,schemaVersion:2}));
  assert.throws(()=>s.api.validate({...published,recommendations:{x:{decision:'limited',category:'Other',rationale:'',source:''}}}));
  assert.throws(()=>s.api.validate({...published,recommendations:JSON.parse('{"__proto__":{"decision":"","category":"","rationale":"","source":""}}')}));
});
test('forced refresh receives new version, including removal of recommendations',async () => {
  const s=setup();await s.api.refresh();
  s.download(()=>new Response(JSON.stringify({...published,version:'next',recommendations:{}})));
  const next=await s.api.refresh(true);
  assert.equal(next.baseline.version,'next');
  assert.equal(Object.keys(next.baseline.recommendations).length,0);
});
test('messages accept the extension Admin Console context only',async () => {
  const s=setup();const msg={type:'CSU_GET_BASELINE'};
  const bad=s.listeners.message(msg,{id:'other',url:'https://admin.openai.com/'},()=>assert.fail());
  assert.equal(bad,undefined);
  assert.equal(s.listeners.message(msg,{id:'test-extension',url:'https://example.com/'},()=>assert.fail()),undefined);
  const result=await new Promise(resolve=>assert.equal(s.listeners.message(msg,{id:'test-extension',url:'https://admin.openai.com/workspace/x/permissions'},resolve),true));
  assert.equal(result.baseline.version,published.version);
});
test('rich guidance survives validation; unsafe links and malformed content are rejected',()=>{
 const s=setup(),clean=s.api.validate(published);
 const key='workspace-permission-library-workspace-link-sharing';
 assert.equal(clean.recommendations[key].guidance.security,'Medium');
 assert.equal(clean.recommendations[key].guidance.effort,'Low');
 const malicious=structuredClone(published);malicious.recommendations[key].guidance.sources=[{title:'Bad',url:'javascript:alert(1)'}];
 assert.throws(()=>s.api.validate(malicious));
 const malformed=structuredClone(published);malformed.recommendations[key].guidance.callouts='bad';
 assert.throws(()=>s.api.validate(malformed));
});
test('student audiences, pending Task insights and model score visibility are exported',()=>{
 const r=published.recommendations;
 assert.match(r['workspace-permission-data-export'].guidance.audience,/student/i);
 assert.equal(r['general-2'].decision,'');
 assert.equal(r['general-2'].guidance.reviewFlag,'CO leadership review');
 assert.equal(r['model-8'].guidance.showScores,false);
 assert.equal(r['general-15'].guidance.access,'Campus policy');
 assert.equal(r['workspace-permission-orbitLocalComputer'].decision,'disable');
 assert.equal(r['workspace-permission-matrix-work-thread-sync'].decision,'limited');
});
