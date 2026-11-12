(() => {
  'use strict';
  const hostId = 'csu-workspace-overlay';
  if (document.getElementById(hostId)) return;
  const storage = typeof chrome !== 'undefined' && chrome.storage?.local;
  const asset = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('assets/csu-wordmark.png') : '';
  const host = document.createElement('div');
  host.id = hostId;
  const root = host.attachShadow({ mode: 'open' });
  let selected = null;
  let opener = null;
  let activeRoute = '';
  let scheduled = false;
  const pills = new Map();
  const decisions = { enable: 'Enabled', disable: 'Disabled', limited: 'Limited Access' };
  let baseline = typeof CSU_BASELINE === 'undefined' ? {} : CSU_BASELINE;
  let baselineMeta = null;
  let syncState = {};
  let syncing = false;
  function recordFor(item) { return item && (baseline[item.key] || baseline[item.label]); }
  const style = document.createElement('style');
  style.textContent = `
    :host { all:initial; color-scheme:light; font:14px/1.5 system-ui,sans-serif; color:#202020; }
    :host([hidden]), [hidden] { display:none !important; }
    * { box-sizing:border-box; }
    button { font:inherit; }
    button { cursor:pointer; }
    button:focus-visible { outline:3px solid #2563eb; outline-offset:3px; }
    .launcher { position:fixed; bottom:24px; right:24px; z-index:2147483646; border:1px solid #ddd; border-radius:999px; background:white; color:#a20f27; box-shadow:0 4px 20px #0002; padding:12px 18px; font-weight:650; }
    .panel { position:fixed; top:12px; bottom:12px; right:12px; width:min(380px,calc(100vw - 24px)); z-index:2147483647; background:#fff; border:1px solid #ddd; border-top:4px solid #c41230; border-radius:16px; box-shadow:0 8px 40px #0003; overflow:auto; }
    header { position:sticky; top:0; background:white; border-bottom:1px solid #eee; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
    header strong { font-size:15px; } .close { border:0; background:#f4f4f4; border-radius:8px; width:32px; height:32px; font-size:22px; line-height:1; }
    .brand { width:100%; max-height:130px; object-fit:contain; display:block; }
    main { padding:0 24px 24px; } .eyebrow { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#767676; margin:12px 0 8px; }
    h2 { font-size:23px; line-height:1.3; margin:8px 0 16px; overflow-wrap:anywhere; }
    p { margin:12px 0; } .muted { color:#666; font-size:13px; } .status { display:inline-block; color:#a20f27; background:#fff1f3; border-radius:999px; padding:5px 11px; font-size:13px; font-weight:650; }
    .status[data-decision=enable] { background:#dcfce7;color:#14532d; }
    .status[data-decision=disable] { background:#fee2e2;color:#991b1b; }
    .status[data-decision=limited] { background:#fef08a;color:#713f12; }
    .category { display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#475569;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:5px 10px; }
    .category[data-category=baseline] { color:#1e40af;background:#eff6ff;border-color:#bfdbfe; }
    .category[data-category=recommended] { color:#6b21a8;background:#faf5ff;border-color:#e9d5ff; }
    .category[data-category=campus] { color:#334155;background:#f1f5f9;border-color:#cbd5e1; }
    .badges { display:flex;gap:8px;flex-wrap:wrap;align-items:center; }
    .status { border:1px solid transparent; }
    .status::before { content:'';width:6px;height:6px;display:inline-block;border-radius:50%;background:currentColor;margin-right:6px;vertical-align:2px; }
    .status:not([data-decision]),.status[data-decision=''] { color:#475569;background:#f1f5f9; }
    .tooltip { position:fixed;z-index:2147483647;width:min(340px,calc(100vw - 24px));padding:0;border:1px solid #e2e8f0;border-radius:16px;background:#fff;color:#1e293b;box-shadow:0 12px 36px #0f172a26,0 2px 6px #0f172a0a;font-size:13px;overflow:hidden;overflow-wrap:anywhere; }
    .tip-top { padding:13px 16px 12px;background:linear-gradient(120deg,#fff1f3,#fff 80%);display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #f1e8ea; }
    .tip-brand { display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.015em;color:#9f1239; }
    .tip-mark { background:#b3102d;color:white;border-radius:6px;padding:4px 6px;font-size:10px;letter-spacing:.04em; }
    .tip-context { color:#64748b;font-size:11px;text-align:right; }
    .tip-body { padding:15px 16px 16px; }
    .tip-title { margin:0 0 12px;font-size:16px;line-height:1.35;font-weight:650;letter-spacing:-.02em; }
    .tip-copy { color:#475569;line-height:1.65;margin:12px 0 0;max-height:150px;overflow:auto;white-space:pre-wrap; }
    .tip-footer { padding:10px 16px;background:#f8fafc;border-top:1px solid #edf0f4;color:#64748b;font-size:11px;display:flex;align-items:center;justify-content:space-between;gap:8px; }
    .tip-action { color:#9f1239;font-weight:650; }
    .tip-source { font-size:10px;color:#64748b;margin-top:10px; }
    .legend { font-size:12px;color:#555;padding:12px 0;border-top:1px solid #eee; }
    .copy { white-space:pre-wrap; overflow-wrap:anywhere; }
    .secondary { color:#333; background:#fff; border:1px solid #ddd; border-radius:8px; padding:9px 13px; }
    .context { font-size:12px;color:#666;overflow-wrap:anywhere; }
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
  const badges = make('div', '', 'badges');
  badges.append(status, categoryText);
  view.append(badges, copy, note);
  const syncInfo = make('p', '', 'muted');
  syncInfo.setAttribute('role', 'status');
  const refreshButton = make('button', 'Refresh from GitHub', 'secondary');
  refreshButton.type = 'button';
  refreshButton.addEventListener('click', () => requestBaseline(true));
  main.append(make('p', 'Permission recommendation', 'eyebrow'), context, title, view, syncInfo, refreshButton, make('p', 'CSU pill colors: Green = Enabled · Red = Disabled · Yellow = Limited Access · Gray = Not yet reviewed', 'legend'));
  panel.append(main);
  const tooltip = make('div', '', 'tooltip');
  tooltip.id = 'csu-permission-tooltip'; tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true;
  const tipTop = make('div', '', 'tip-top');
  const tipBrand = make('div', '', 'tip-brand');
  tipBrand.append(make('span', 'CSU', 'tip-mark'), make('span', 'Workspace guidance'));
  const tipContext = make('span', '', 'tip-context');
  tipTop.append(tipBrand, tipContext);
  const tipBody = make('div', '', 'tip-body');
  const tipTitle = make('div', '', 'tip-title');
  const tipBadges = make('div', '', 'badges');
  const tipStatus = make('span', '', 'status');
  const tipCategory = make('span', '', 'category');
  tipBadges.append(tipStatus, tipCategory);
  const tipCopy = make('p', '', 'tip-copy');
  const tipSource = make('p', '', 'tip-source');
  tipBody.append(tipTitle, tipBadges, tipCopy, tipSource);
  const tipFooter = make('div', '', 'tip-footer');
  tipFooter.append(make('span', 'CSU recommendation'), make('span', 'Click CSU to view details →', 'tip-action'));
  tooltip.append(tipTop, tipBody, tipFooter);
  root.append(launcher, panel, tooltip);
  function categoryKey(value) { return ({ Baseline:'baseline', Recommended:'recommended', 'Campus Decision':'campus' })[value] || ''; }
  function renderTooltip(item) {
    const r = recordFor(item);
    tipContext.textContent = item.context;
    tipTitle.textContent = item.label;
    tipStatus.textContent = decisions[r?.decision] || 'Not yet reviewed';
    tipStatus.dataset.decision = r?.decision || '';
    tipCategory.textContent = r?.category || 'Category pending';
    tipCategory.dataset.category = categoryKey(r?.category);
    tipCopy.textContent = r?.rationale || 'Guidance for this permission is awaiting review.';
    tipSource.textContent = r?.source || 'CSU baseline';
  }
  let tooltipItem = null;
  let tipTimer;
  function hideTooltip() { clearTimeout(tipTimer); tooltip.hidden = true; tooltipItem = null; }
  function tooltipDescription(item) {
    const r = recordFor(item);
    return `${item.label} (${item.context})\n${decisions[r?.decision] || 'Not yet reviewed'} · ${r?.category || 'Category pending'}\n${r?.rationale || 'No description added yet.'}\nClick CSU to open guidance.`;
  }
  function showTooltip(item) {
    clearTimeout(tipTimer); tooltipItem = item; renderTooltip(item); tooltip.hidden = false;
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
    if (tooltipItem) renderTooltip(tooltipItem);
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
      render();
    } catch { syncState = { error:'Could not reach the extension sync service. Using available guidance.' }; }
    finally { syncing = false; renderSync(); }
  }
  function render() {
    renderSync();
    context.textContent = selected ? selected.context : '';
    title.textContent = selected?.label || 'Select a permission';
    const record = recordFor(selected);
    status.textContent = decisions[record?.decision] || 'Not yet reviewed';
    status.dataset.decision = record?.decision || '';
    categoryText.textContent = record?.category || 'Category pending';
    categoryText.dataset.category = categoryKey(record?.category);
    categoryText.hidden = !selected;
    copy.textContent = selected ? (record?.rationale || 'Guidance for this permission is awaiting review.') : 'Click a CSU pill beside a permission’s information icon to see its guidance here.';
    note.textContent = selected ? (record?.source || 'CSU baseline · Review pending') : 'Guidance is maintained centrally through GitHub.';
    updatePills();
  }
  function open(item, source) {
    hideTooltip();
    selected = item || selected;
    opener = source || launcher;
    panel.hidden = false; launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    render(); title.focus();
    void requestBaseline();
  }
  function hide(restore = true) {
    panel.hidden = true; launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    render();
    if (restore) (opener?.isConnected ? opener : launcher).focus();
  }
  launcher.addEventListener('click', () => open(null, launcher));
  close.addEventListener('click', () => hide());
  root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); hide(); } });
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
      hideTooltip(); selected = null; render();
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
  if (storage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.csuPublishedBaselineV1?.newValue) {
        baselineMeta = changes.csuPublishedBaselineV1.newValue; baseline = baselineMeta.recommendations;
      }
      if (changes.csuSyncStateV1) syncState = changes.csuSyncStateV1.newValue || {};
      render();
    });
  }
  render(); sync();
  void requestBaseline();
})();
