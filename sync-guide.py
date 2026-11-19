"""Export the reviewed guide to the centrally synced extension baseline."""
import json
from pathlib import Path
from urllib.parse import urljoin

GUIDE_URL = 'https://csu-workspace-recommendations-review.calstateuniversity.chatgpt.site/'
root=Path(__file__).resolve().parent/'guide'
ext=Path(__file__).resolve().parent
d=json.loads((root/'recommendations.json').read_text())
(root/'data.js').write_text('window.CSU_GUIDE = '+json.dumps(d,ensure_ascii=False)+';\n')
# Export schema 1 for compatibility with earlier installations, with full rich guidance for v0.6.
out={'schemaVersion':1,'version':d['version'],'publishedAt':'2026-11-14T01:00:00Z','recommendations':{}}
# Use actual current timestamp for publication metadata.
from datetime import datetime,timezone
out['publishedAt']=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
for s in d['sections']:
 for r in s['rows']:
  decision={'Enabled':'enable','Disabled':'disable','Limited Access':'limited'}.get(r['access'],'')
  cat='' if r['category']=='Pending' else r['category']
  detail=json.loads(json.dumps(r));detail['pageTitle']=s['title']
  if 'resources' in detail:
   detail['resources'] = [
    {**resource, 'url': urljoin(GUIDE_URL, resource['url'])}
    for resource in detail['resources']
   ]
  out['recommendations'][r['id']]={'decision':decision,'category':cat,'rationale':r['rationale'],'source':'CSU review · '+r['status'],'guidance':detail}
# Label aliases only when globally unique. Duplicate labels always use stable IDs.
from collections import Counter
counts=Counter(r['label'] for s in d['sections'] for r in s['rows'])
for s in d['sections']:
 for r in s['rows']:
  if counts[r['label']]==1:out['recommendations'][r['label']]=out['recommendations'][r['id']]
(ext/'recommendations.json').write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
(ext/'baseline.js').write_text('const CSU_PACKAGED = '+json.dumps(out,ensure_ascii=False)+';\n')

print('Updated extension recommendations.json, baseline.js and guide/data.js')
