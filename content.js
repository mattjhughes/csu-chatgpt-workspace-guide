(() => {
  'use strict';
  const hostId = 'csu-workspace-overlay';
  if (document.getElementById(hostId)) return;
  const storageKey = 'csuRecommendationsV1';
  const storage = typeof chrome !== 'undefined' && chrome.storage?.local;
  const asset = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('assets/csu-wordmark.png') : '';
  const host = document.createElement('div');
  host.id = hostId;
  const root = host.attachShadow({ mode: 'open' });
  let recommendations = {};
  let selected = null;
  let opener = null;
  let editing = false;
  let dirty = false;
  let activeRoute = '';
  let scheduled = false;
  const pills = new Map();
  const decisions = { enable: 'Enabled', disable: 'Disabled', limited: 'Limited Access' };
  const categories = ['Baseline', 'Recommended', 'Campus Decision'];
  let baseline = typeof CSU_BASELINE === 'undefined' ? {} : CSU_BASELINE;
  let baselineMeta = null;
  let syncState = {};
  let syncing = false;
  function recordFor(item) { return item && (recommendations[item.key] || baseline[item.key] || baseline[item.label]); }
  const style = document.createElement('style');
  style.textContent = `
    :host { all:initial; color-scheme:light; font:14px/1.5 system-ui,sans-serif; color:#202020; }
    :host([hidden]), [hidden] { display:none !important; }
    * { box-sizing:border-box; }
    button,input,textarea,select { font:inherit; }
    button { cursor:pointer; }
    button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible { outline:3px solid #2563eb; outline-offset:3px; }
    .launcher { position:fixed; bottom:24px; right:24px; z-index:2147483646; border:1px solid #ddd; border-radius:999px; background:white; color:#a20f27; box-shadow:0 4px 20px #0002; padding:12px 18px; font-weight:650; }
    .panel { position:fixed; top:12px; bottom:12px; right:12px; width:min(380px,calc(100vw - 24px)); z-index:2147483647; background:#fff; border:1px solid #ddd; border-top:4px solid #c41230; border-radius:16px; box-shadow:0 8px 40px #0003; overflow:auto; }
    header { position:sticky; top:0; background:white; border-bottom:1px solid #eee; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
    header strong { font-size:15px; } .close { border:0; background:#f4f4f4; border-radius:8px; width:32px; height:32px; font-size:22px; line-height:1; }
    .brand { width:100%; max-height:130px; object-fit:contain; display:block; }
    main { padding:0 24px 24px; } .eyebrow { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#767676; margin:12px 0 8px; }
    h2 { font-size:23px; line-height:1.3; margin:8px 0 16px; overflow-wrap:anywhere; }
    p { margin:12px 0; } .muted { color:#666; font-size:13px; } .status { display:inline-block; color:#a20f27; background:#fff1f3; border-radius:6px; padding:4px 9px; font-size:13px; font-weight:650; }
    .status[data-decision=enable] { background:#dcfce7;color:#14532d; }
    .status[data-decision=disable] { background:#fee2e2;color:#991b1b; }
    .status[data-decision=limited] { background:#fef08a;color:#713f12; }
    .category { display:block;font-size:13px;color:#555;margin:10px 0; }
    .tooltip { position:fixed;z-index:2147483647;width:min(310px,calc(100vw - 16px));padding:12px 14px;border:1px solid #ddd;border-radius:10px;background:#fff;color:#202020;box-shadow:0 4px 20px #0003;font-size:13px;white-space:pre-line;overflow-wrap:anywhere; }
    .legend { font-size:12px;color:#555;padding:12px 0;border-top:1px solid #eee; }
    .copy { white-space:pre-wrap; overflow-wrap:anywhere; } .primary { color:white; background:#b3102d; border:0; border-radius:8px; padding:10px 14px; }
    .secondary { color:#333; background:#fff; border:1px solid #ddd; border-radius:8px; padding:9px 13px; }
    .actions { display:flex; gap:8px; margin-top:20px; flex-wrap:wrap; } label { display:block; font-weight:600; margin:16px 0 6px; }
    select,textarea { width:100%; border:1px solid #bbb; border-radius:8px; padding:10px; background:#fff; color:#202020; } textarea { min-height:180px; resize:vertical; }
    .notice { min-height:24px; color:#555; font-size:12px; } .context { font-size:12px; color:#666; overflow-wrap:anywhere; }
    @media print { :host { display:none !important; } }
  `;
  root.append(style);
  const make = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const launcher = make('button', 'CSU guidance', 'launcher');
  launcher.type = 'button';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'csu-guidance-panel');
  const panel = make('aside', '', 'panel');
  panel.id = 'csu-guidance-panel';
  panel.setAttribute('aria-label', 'CSU recommendations');
  panel.hidden = true;
  const header = make('header');
  const close = make('button', '×', 'close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close CSU guidance');
  header.append(make('strong', 'CSU workspace guidance'), close);
  panel.append(header);
  if (asset) {
    const img = make('img', '', 'brand');
    img.src = asset;
    img.alt = 'The California State University';
    panel.append(img);
  }
  const main = make('main');
  const context = make('p', '', 'context');
  const title = make('h2', 'Select a permission');
  title.tabIndex = -1;
  const view = make('div');
  const status = make('span', '', 'status');
  const categoryText = make('span', '', 'category');
  const copy = make('p', '', 'copy');
  const note = make('p', '', 'muted');
  const edit = make('button', 'Add recommendation', 'secondary');
  edit.type = 'button';
  view.append(status, categoryText, copy, note, edit);
  const form = make('form');
  form.hidden = true;
  const decisionLabel = make('label', 'Recommended setting');
  decisionLabel.htmlFor = 'csu-decision';
  const decision = make('select');
  decision.id = 'csu-decision';
  for (const [value, label] of [['', 'Not specified'], ['enable', 'Enabled'], ['disable', 'Disabled'], ['limited', 'Limited Access']]) {
    const option = make('option', label); option.value = value; decision.append(option);
  }
  const categoryLabel = make('label', 'Category');
  categoryLabel.htmlFor = 'csu-category';
  const category = make('select');
  category.id = 'csu-category';
  for (const value of ['', ...categories]) {
    const option = make('option', value || 'Not yet categorized'); option.value = value; category.append(option);
  }
  const textLabel = make('label', 'Recommendation and rationale');
  textLabel.htmlFor = 'csu-rationale';
  const rationale = make('textarea');
  rationale.id = 'csu-rationale';
  rationale.maxLength = 20000;
  rationale.placeholder = 'Explain the CSU recommendation for this permission…';
  const save = make('button', 'Save recommendation', 'primary');
  save.type = 'submit';
  const cancel = make('button', 'Cancel', 'secondary');
  cancel.type = 'button';
  const actions = make('div', '', 'actions');
  actions.append(save, cancel);
  form.append(decisionLabel, decision, categoryLabel, category, textLabel, rationale, actions);
  const syncInfo = make('p', '', 'muted');
  syncInfo.setAttribute('role', 'status');
  const refreshButton = make('button', 'Refresh from GitHub', 'secondary');
  refreshButton.type = 'button';
  refreshButton.addEventListener('click', () => requestBaseline(true));
  const notice = make('p', '', 'notice');
  notice.setAttribute('role', 'status');
  main.append(make('p', 'Permission recommendation', 'eyebrow'), context, title, view, form, notice, syncInfo, refreshButton, make('p', 'CSU pill colors: Green = Enabled · Red = Disabled · Yellow = Limited Access · Gray = Not yet reviewed', 'legend'));
  panel.append(main);
  const tooltip = make('div', '', 'tooltip');
  tooltip.id = 'csu-permission-tooltip'; tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true;
  root.append(launcher, panel, tooltip);
  let tooltipItem = null;
  let tipTimer;
  function hideTooltip() { clearTimeout(tipTimer); tooltip.hidden = true; tooltipItem = null; }
  function tooltipDescription(item) {
    const r = recordFor(item);
    return `${item.label} (${item.context})\n${decisions[r?.decision] || 'Not yet reviewed'} · ${r?.category || 'Category pending'}\n${r?.rationale || 'No description added yet.'}\nClick CSU to open guidance.`;
  }
  function showTooltip(item) {
    clearTimeout(tipTimer); tooltipItem = item; tooltip.textContent = tooltipDescription(item); tooltip.hidden = false;
    const rect = item.button.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${Math.max(8, rect.bottom + tooltip.offsetHeight + 8 > window.innerHeight ? rect.top - tooltip.offsetHeight - 8 : rect.bottom + 8)}px`;
  }
  function delayHideTooltip() { tipTimer = setTimeout(hideTooltip, 120); }
  tooltip.addEventListener('mouseenter', () => clearTimeout(tipTimer));
  tooltip.addEventListener('mouseleave', delayHideTooltip);
  window.addEventListener('scroll', hideTooltip, true);
  window.addEventListener('resize', hideTooltip);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); }, true);
  function updatePills() {
    for (const item of pills.values()) {
      const r = recordFor(item);
      item.button.dataset.decision = decisions[r?.decision] ? r.decision : '';
      const text = `CSU recommendation for ${item.label} (${item.context}): ${decisions[r?.decision] || 'Not yet reviewed'}; ${r?.category || 'Category pending'}`;
      item.button.setAttribute('aria-label', text);
      item.button.setAttribute('aria-description', tooltipDescription(item));
      item.button.setAttribute('aria-pressed', String(!panel.hidden && item.key === selected?.key));
    }
    if (tooltipItem) tooltip.textContent = tooltipDescription(tooltipItem);
  }

  function canLeave() {
    if (save.disabled) return false;
    return !dirty || window.confirm('Discard the unsaved CSU recommendation?');
  }
  function renderSync() {
    refreshButton.disabled = syncing;
    refreshButton.textContent = syncing ? 'Checking GitHub…' : 'Refresh from GitHub';
    const version = baselineMeta ? `GitHub baseline ${baselineMeta.version} · Published ${new Date(baselineMeta.publishedAt).toLocaleDateString()}` : 'Using packaged baseline';
    syncInfo.textContent = `${version}${syncState.checkedAt ? ` · Checked ${new Date(syncState.checkedAt).toLocaleString()}` : ''}${syncState.error ? ` · ${syncState.error}` : ''}`;
  }
  async function requestBaseline(force = false) {
    if (syncing) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      syncState = { error:'GitHub sync is available in the installed extension.' }; renderSync(); return;
    }
    syncing = true; renderSync();
    try {
      const result = await chrome.runtime.sendMessage({ type:'CSU_GET_BASELINE', force });
      if (result?.baseline) { baseline = result.baseline.recommendations; baselineMeta = result.baseline; }
      syncState = result?.state || { error:'Could not reach the extension sync service.' };
      if (!editing) render(); else updatePills();
    } catch { syncState = { error:'Could not reach the extension sync service. Using available guidance.' }; }
    finally { syncing = false; renderSync(); }
  }
  function render() {
    renderSync();
    context.textContent = selected ? selected.context : '';
    title.textContent = selected?.label || 'Select a permission';
    form.hidden = !editing;
    view.hidden = editing;
    const record = recordFor(selected);
    status.textContent = decisions[record?.decision] || 'Not yet reviewed';
    status.dataset.decision = record?.decision || '';
    categoryText.textContent = selected ? `Category: ${record?.category || 'Pending review'}` : '';
    copy.textContent = selected ? (record?.rationale || 'Add CSU guidance for this permission using the button below.') : 'Click a CSU pill beside a permission’s information icon to see its guidance here.';
    note.textContent = `${record?.source || 'Local draft'}. Edits are saved in this Chrome profile across workspaces. Local drafts override the shared GitHub baseline.`;
    edit.hidden = !selected;
    edit.textContent = record ? 'Edit recommendation' : 'Add recommendation';
    if (editing) { decision.value = record?.decision || ''; rationale.value = record?.rationale || ''; category.value = record?.category || ''; }
    updatePills();
  }
  function open(item, source) {
    if (!canLeave()) return;
    hideTooltip();
    selected = item || selected;
    opener = source || launcher;
    editing = false; dirty = false; notice.textContent = '';
    panel.hidden = false; launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    render(); title.focus();
    void requestBaseline();
  }
  function hide(restore = true) {
    if (!canLeave()) return;
    panel.hidden = true; launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    editing = false; dirty = false; render();
    if (restore) (opener?.isConnected ? opener : launcher).focus();
  }
  launcher.addEventListener('click', () => open(null, launcher));
  close.addEventListener('click', () => hide());
  root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); hide(); } });
  edit.addEventListener('click', () => {
    editing = true; notice.textContent = ''; render(); decision.focus();
  });
  form.addEventListener('input', () => { dirty = true; });
  cancel.addEventListener('click', () => {
    if (!canLeave()) return;
    editing = false; dirty = false; render(); edit.focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selected || save.disabled) return;
    if (!storage) { notice.textContent = 'Saving is available in the installed Chrome extension.'; return; }
    save.disabled = true;
    const next = { ...recommendations };
    const record = { decision: decision.value, category: category.value, source: 'Local draft', rationale: rationale.value.trim(), label: selected.label, context: selected.context, updatedAt: new Date().toISOString() };
    if (!record.decision && !record.category && !record.rationale) delete next[selected.key];
    else next[selected.key] = record;
    try {
      await storage.set({ [storageKey]: next });
      recommendations = next; editing = false; dirty = false;
      render(); notice.textContent = 'Saved in this Chrome profile.'; edit.focus();
    } catch { notice.textContent = 'Could not save. Your draft is still here; try again.'; }
    finally { save.disabled = false; }
  });

  function descriptor(info) {
    const label = info.getAttribute('aria-label').slice('More information about '.length);
    const row = info.closest('[id^="workspace-permission-"]');
    const section = info.closest('section');
    const context = section?.querySelector('h2')?.textContent?.trim() || 'Permissions';
    // Stable row IDs distinguish repeated display names such as local computer access.
    return { key: row?.id || `label:${context}:${label}`, label, context };
  }
  function sync() {
    const workspace = /^\/workspace\/[^/]+(?:\/|$)/.test(location.pathname);
    const permissions = /^\/workspace\/[^/]+\/permissions\/?$/.test(location.pathname);
    host.hidden = !workspace;
    if (!host.isConnected) document.documentElement.append(host);
    if (activeRoute !== location.pathname) {
      activeRoute = location.pathname;
      // Preserve an unsaved editor through navigation; otherwise clear stale context.
      if (!dirty) { selected = null; editing = false; notice.textContent = ''; render(); }
    }
    for (const [info, item] of pills) {
      if (!permissions || !info.isConnected || info.nextElementSibling !== item.host) {
        item.host.remove(); pills.delete(info);
      }
    }
    if (!permissions) return;
    for (const info of document.querySelectorAll('button[aria-label^="More information about "]')) {
      if (pills.has(info)) continue;
      const item = descriptor(info);
      const pillHost = make('span');
      pillHost.dataset.csuPill = '';
      const shadow = pillHost.attachShadow({mode:'open'});
      const css = make('style');
      css.textContent = `:host{display:inline-flex;vertical-align:middle;margin-inline-start:7px}button{all:initial;box-sizing:border-box;cursor:pointer;font:700 10px/1 system-ui,sans-serif;letter-spacing:.03em;padding:5px 8px;border:1px solid #d1d5db;border-radius:999px;color:#374151;background:#f3f4f6}button[data-decision=enable]{background:#dcfce7;color:#14532d;border-color:#86b99a}button[data-decision=disable]{background:#fee2e2;color:#991b1b;border-color:#e8a0a0}button[data-decision=limited]{background:#fef08a;color:#713f12;border-color:#c7a33b}button:hover{filter:brightness(.94)}button[aria-pressed=true]{box-shadow:0 0 0 2px #fff,0 0 0 3px currentColor}button:focus-visible{outline:3px solid #2563eb;outline-offset:3px}@media print{:host{display:none}}`;
      const button = make('button', 'CSU');
      button.type = 'button';
      button.setAttribute('aria-label', `CSU recommendation for ${item.label} (${item.context})`);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); open(item, button); });
      const tipItem = { ...item, button };
      button.addEventListener('mouseenter', () => showTooltip(tipItem));
      button.addEventListener('mouseleave', delayHideTooltip);
      button.addEventListener('focus', () => showTooltip(tipItem));
      button.addEventListener('blur', hideTooltip);
      shadow.append(css, button);
      info.after(pillHost);
      pills.set(info, { ...item, host: pillHost, button });
    }
    updatePills();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sync(); });
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['aria-label'] });
  window.addEventListener('popstate', schedule);
  // Covers URL changes with no DOM update, including History API navigation.
  setInterval(() => { if (activeRoute !== location.pathname) schedule(); }, 1000);
  if (storage) storage.get(storageKey).then(data => {
    recommendations = data[storageKey] || {};
    for (const r of Object.values(recommendations)) {
      if (r.decision === 'conditional') { r.decision = ''; r.category ||= 'Campus Decision'; }
    }
    if (!editing) render();
  }).catch(() => { notice.textContent = 'Stored recommendations could not be loaded.'; });
  if (storage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.csuPublishedBaselineV1?.newValue) {
        baselineMeta = changes.csuPublishedBaselineV1.newValue; baseline = baselineMeta.recommendations;
      }
      if (changes.csuSyncStateV1) syncState = changes.csuSyncStateV1.newValue || {};
      if (!editing) render(); else { updatePills(); renderSync(); }
    });
  }
  render(); sync();
  void requestBaseline();
})();
