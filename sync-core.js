/* JSON is data only. Never interpret remote values as code or HTML. */
const CSU_SYNC = (() => {
  const URL = 'https://raw.githubusercontent.com/mattjhughes/csu-chatgpt-workspace-guide/main/recommendations.json';
  const CACHE_KEY = 'csuPublishedBaselineV1';
  const STATE_KEY = 'csuSyncStateV1';
  const MAX_BYTES = 1024 * 1024;
  function validate(input) {
    if (!input || input.schemaVersion !== 1 || typeof input.version !== 'string' || !input.version.trim() || input.version.length > 100 || typeof input.publishedAt !== 'string' || !Number.isFinite(Date.parse(input.publishedAt))) throw new Error('Invalid baseline metadata');
    const entries = input.recommendations;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries) || Object.keys(entries).length > 2000) throw new Error('Invalid recommendations');
    const recommendations = Object.create(null);
    for (const [key, record] of Object.entries(entries)) {
      if (!key || key.length > 500 || ['__proto__', 'constructor', 'prototype'].includes(key) || !record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid recommendation entry');
      if (!['', 'enable', 'disable', 'limited'].includes(record.decision) || !['', 'Baseline', 'Recommended', 'Campus Decision'].includes(record.category)) throw new Error('Unsupported recommendation value');
      if (typeof record.rationale !== 'string' || record.rationale.length > 20000 || typeof record.source !== 'string' || record.source.length > 500) throw new Error('Invalid recommendation text');
      recommendations[key] = { decision:record.decision, category:record.category, rationale:record.rationale, source:record.source };
    }
    return { schemaVersion:1, version:input.version, publishedAt:input.publishedAt, recommendations };
  }
  return { URL, CACHE_KEY, STATE_KEY, MAX_BYTES, validate };
})();
