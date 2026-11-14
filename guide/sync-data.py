"""Regenerate browser data after editing recommendations.json."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent
data = json.loads((root / 'recommendations.json').read_text())
(root / 'data.js').write_text('window.CSU_GUIDE = ' + json.dumps(data, ensure_ascii=False) + ';\n')
print('Updated data.js')
