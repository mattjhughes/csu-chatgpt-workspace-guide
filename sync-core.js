/* JSON is data only. Never interpret remote values as code or HTML. */
const CSU_SYNC = (() => {
  const URL = 'https://raw.githubusercontent.com/mattjhughes/csu-chatgpt-workspace-guide/main/recommendations.json';
  const CACHE_KEY = 'csuPublishedBaselineV1';
  const STATE_KEY = 'csuSyncStateV1';
  const MAX_BYTES = 1024 * 1024;
  function validateGuidance(g) {
    if (!g || typeof g !== 'object' || Array.isArray(g)) throw new Error('Invalid guidance');
    const out = {};
    for (const k of ['id','label','page','pageTitle','section','subsection','access','category','security','effort','rationale','audience','status','reviewNote','reviewFlag','scoreNote','effortNote']) {
      if (g[k] !== undefined) {
        if (typeof g[k] !== 'string' || g[k].length > 20000) throw new Error('Invalid guidance text');
        out[k] = g[k];
      }
    }
    for (const k of ['id','label','page','access','category','security','effort','status']) if (!out[k]) throw new Error('Missing guidance field');
    if (g.showScores !== undefined && typeof g.showScores !== 'boolean') throw new Error('Invalid score visibility');
    if (g.showScores !== undefined) out.showScores = g.showScores;
    for (const k of ['callouts','sources','resources']) {
      const items = g[k] || [];
      if (!Array.isArray(items) || items.length > 50) throw new Error('Invalid guidance list');
      out[k] = items.map(item => {
        const fields = k === 'callouts' ? ['title','text','tone'] : ['title','url'];
        const v = {};
        for (const field of fields) {
          if (typeof item?.[field] !== 'string' || item[field].length > 20000) throw new Error('Invalid guidance item');
          v[field] = item[field];
        }
        if (k !== 'callouts' && !/^https:\/\//.test(v.url)) throw new Error('Unsafe reference URL');
        return v;
      });
    }
    return out;
  }
  function validate(input) {
    if (!input || input.schemaVersion !== 1 || typeof input.version !== 'string' || !input.version.trim() || input.version.length > 100 || typeof input.publishedAt !== 'string' || !Number.isFinite(Date.parse(input.publishedAt))) throw new Error('Invalid baseline metadata');
    const entries = input.recommendations;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries) || Object.keys(entries).length > 2000) throw new Error('Invalid recommendations');
    const recommendations = Object.create(null);
    for (const [key, record] of Object.entries(entries)) {
      if (!key || key.length > 500 || ['__proto__', 'constructor', 'prototype'].includes(key) || !record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid recommendation entry');
      if (!['', 'enable', 'disable', 'limited'].includes(record.decision) || !['', 'Baseline', 'Recommended', 'Campus Decision'].includes(record.category)) throw new Error('Unsupported recommendation value');
      if (typeof record.rationale !== 'string' || record.rationale.length > 20000 || typeof record.source !== 'string' || record.source.length > 500) throw new Error('Invalid recommendation text');
      recommendations[key] = { decision:record.decision, category:record.category, rationale:record.rationale, source:record.source, ...(record.guidance ? {guidance:validateGuidance(record.guidance)} : {}) };
    }
    return { schemaVersion:1, version:input.version, publishedAt:input.publishedAt, recommendations };
  }
  return { URL, CACHE_KEY, STATE_KEY, MAX_BYTES, validate };
})();
