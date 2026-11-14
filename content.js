/* Read-only anchors on the real Admin Console. Never click or modify native controls. */
(()=>{
 'use strict';
 const hostId='csu-workspace-overlay';
 if(document.getElementById(hostId))return;
 const host=document.createElement('div');host.id=hostId;
 const root=host.attachShadow({mode:'open'});
 const css=document.createElement('link');css.rel='stylesheet';css.href=chrome.runtime.getURL('guidance-ui.css');root.append(css);
 const style=document.createElement('style');style.textContent=':host{all:initial;color-scheme:light}:host([hidden]){display:none!important}.csu-panel,.csu-tooltip,.csu-launcher{z-index:2147483647}.sync-bar{position:fixed;right:32px;top:74px;z-index:2147483647;background:#fff;border:1px solid #dce1e6;border-radius:8px;padding:8px 12px;max-width:330px;font:11px/1.5 system-ui;color:#546274}.sync-bar[hidden]{display:none}.sync-bar button{display:block;margin-top:5px;border:1px solid #dce1e6;border-radius:6px;background:#fff;color:#95243f;padding:5px 8px;cursor:pointer}.csu-panel-content{padding-top:100px}';root.append(style);
 let baseline=CSU_PACKAGED,selectedId=null,route='',scheduled=false,syncing=false;
 const anchors=new Map();
 const ui=CSUGuidanceUI.mount({container:root,buttonRoot:document,asset:chrome.runtime.getURL('assets/csu-wordmark.png'),onVisibility:open=>{syncbar.hidden=!open;if(open)void refresh()}});
 const syncbar=document.createElement('div');syncbar.className='sync-bar';syncbar.hidden=true;
 const syncinfo=document.createElement('span');syncinfo.setAttribute('role','status');
 const refreshButton=document.createElement('button');refreshButton.type='button';refreshButton.textContent='Refresh from GitHub';refreshButton.addEventListener('click',()=>refresh(true));syncbar.append(syncinfo,refreshButton);root.append(syncbar);
 const normalize=s=>String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
 function page(){const m=location.pathname.match(/^\/workspace\/[^/]+\/(settings|general|permissions|models)\/?$/);return m?({settings:'workspace',general:'workspace',permissions:'permissions',models:'models'})[m[1]]:''}
 function rows(){const seen=new Set();return Object.values(baseline.recommendations).map(r=>r.guidance).filter(r=>r&&r.page===page()&&!seen.has(r.id)&&seen.add(r.id))}
 function match(label,node){
  const all=rows();const stable=node.closest('[id^="workspace-permission-"]')?.id;
  if(stable){const r=all.find(r=>r.id===stable);if(r)return r}
  // Generic positional IDs in the guide are not live DOM IDs.
  if(page()==='models'&&['model','effort','speed','new chats'].includes(normalize(label))){
   const suffix=({'model':'Default model','effort':'Default effort','speed':'Default speed','new chats':'New chats'})[normalize(label)];
   for(let box=node.parentElement,depth=0;box&&depth<7;box=box.parentElement,depth++){
    const products=new Set([...box.querySelectorAll('h2,h3,h4,p,span,div,label')].filter(n=>!n.children.length).map(n=>n.textContent.trim()).filter(x=>x==='Chat'||x==='Work & Codex'));
    if(products.size===1){const full=[...products][0]+' · '+suffix;return all.find(r=>r.label===full)||null}
    if(products.size>1)return null;
   }
   return null;
  }
  let matches=all.filter(r=>normalize(r.label)===normalize(label));
  if(matches.length===1)return matches[0];
  const context=node.closest('section')?.querySelector('h2,h3')?.textContent||'';
  matches=matches.filter(r=>normalize(r.section)===normalize(context)||normalize(r.subsection)===normalize(context));
  return matches.length===1?matches[0]:null;
 }
 function clear(){for(const a of anchors.values())a.button.remove();anchors.clear();ui.hideTip()}
 function sync(){
  const current=location.pathname;
  if(route!==current){route=current;clear();ui.hide(false);selectedId=null}
  host.hidden=!page();if(!host.isConnected)document.documentElement.append(host);
  for(const [anchor,a] of anchors)if(!anchor.isConnected||!a.button.isConnected||!page()){a.button.remove();anchors.delete(anchor)}
  if(!page())return;
  const currentRows=rows(),knownLabels=new Set(currentRows.map(r=>normalize(r.label)));
  const infos=[...document.querySelectorAll('button[aria-label^="More information about "]')];
  const candidates=infos.map(node=>({node,label:node.getAttribute('aria-label').slice('More information about '.length)}));
  // Some settings/model rows have no information icon. Match exact visible labels only.
  for(const node of document.querySelectorAll('label,h3,[data-testid="setting-label"],span,div,p')){
   if(node.closest('#'+hostId+', [data-csu-pill], .csu-setting-pill, button, a, select, option, input, textarea, [role=option], [role=combobox]')||node.children.length||node.textContent.length>180)continue;
   const label=node.textContent.trim();if(!label)continue;
   if((knownLabels.has(normalize(label))||(page()==='models'&&['model','effort','speed','new chats'].includes(normalize(label))))&&!infos.some(i=>i.parentElement?.contains(node)))candidates.push({node,label});
  }
  const used=new Set([...anchors.values()].map(a=>a.id));
  for(const {node,label} of candidates){
   if(anchors.has(node))continue;const row=match(label,node);if(!row||used.has(row.id))continue;
   const button=document.createElement('button');button.dataset.csuPill='';ui.bind(button,row);
   button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectedId=row.id});
   node.after(button);anchors.set(node,{button,id:row.id});used.add(row.id);
  }
 }
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;sync()})}
 function renderSync(state={}){syncinfo.textContent=`CSU ${baseline.version}${state.checkedAt?' · Checked '+new Date(state.checkedAt).toLocaleString():''}${state.error?' · '+state.error:''}`;refreshButton.disabled=syncing;refreshButton.textContent=syncing?'Checking GitHub…':'Refresh from GitHub'}
 function apply(next){
  // Never replace a new packaged release with an older cache/download.
  if(!next||Date.parse(next.publishedAt)<Date.parse(CSU_PACKAGED.publishedAt))return;
  baseline=next;const selected=selectedId;clear();sync();
  if(selected){const row=rows().find(r=>r.id===selected);if(row&&!syncbar.hidden)ui.open(row,anchors.size?[...anchors.values()].find(a=>a.id===selected)?.button:null)}
 }
 async function refresh(force=false){if(syncing)return;syncing=true;renderSync();try{const result=await chrome.runtime.sendMessage({type:'CSU_GET_BASELINE',force});apply(result?.baseline);syncing=false;renderSync(result?.state||{})}catch{syncing=false;renderSync({error:'Sync unavailable; using available guidance.'})}}
 chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes.csuPublishedBaselineV1?.newValue)apply(changes.csuPublishedBaselineV1.newValue);if(changes.csuSyncStateV1)renderSync(changes.csuSyncStateV1.newValue||{})});
 new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label']});
 window.addEventListener('popstate',schedule);setInterval(()=>{if(route!==location.pathname)schedule()},1000);
 renderSync();sync();void refresh();
})();
