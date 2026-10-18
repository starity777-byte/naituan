"""Extract small first-frame WebPs without changing the animations' canvas or anchors."""
from pathlib import Path
import re
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = (root / 'game.js').read_text(encoding='utf-8').split('/*SPR:BEGIN*/')[1].split('/*SPR:END*/')[0]
output = root / 'assets' / 'posters'
output.mkdir(exist_ok=True)
for key, path in re.findall(r"(\w+):\s*'([^']+)'", source):
    if not path.startswith('assets/animated/'):
        continue
    with Image.open(root / path) as animation:
        assert animation.size == (503, 402), (path, animation.size)
        animation.seek(0)
        animation.convert('RGBA').save(output / (key + '.webp'), 'WEBP', quality=82, method=6)
print('Built', len(list(output.glob('*.webp'))), 'posters at 503 x 402')
