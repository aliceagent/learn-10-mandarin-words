from pathlib import Path
import json
import re
import sys

sys.path.insert(0, '/home/nvidia/mandarin-drill-builder/tools')
from parse_shizhong_source import slugify, fix_title_cn, sentence_templates

src = Path('/home/nvidia/.hermes/cache/documents/doc_64afb146d401_100-shizhong-final-list.md')
lines = src.read_text(encoding='utf-8').splitlines()

cats = []
cur_cat = None
cur_topic = None
topics = []
heading_cat = re.compile(r'^##\s+(.+?)\s*$')
heading_topic = re.compile(r'^###\s+(.+?)\s+—\s+(.+?)\s*$')
item_re = re.compile(r'^\d+\.\s+(.+?)\s+—\s+(.+?)\s+—\s+(.+?)\s*$')

for raw in lines:
    line = raw.strip()
    if line == '---':
        continue
    mc = heading_cat.match(line)
    if mc and not line.startswith('###'):
        name = mc.group(1).strip()
        if not name.startswith('十种') and 'Final Topic' not in name:
            cur_cat = {'name': name, 'slug': slugify(name), 'topics': []}
            cats.append(cur_cat)
        continue
    mt = heading_topic.match(line)
    if mt:
        if cur_topic and len(cur_topic['items']) == 10:
            topics.append(cur_topic)
        cn, en = mt.group(1).strip(), mt.group(2).strip()
        slug = slugify(en)
        cur_topic = {
            'slug': slug,
            'titleCn': fix_title_cn(cn),
            'titleEn': en,
            'category': cur_cat['name'] if cur_cat else 'General',
            'categorySlug': cur_cat['slug'] if cur_cat else 'general',
            'videoPath': f'/videos/{slug}.mp4',
            'items': [],
        }
        continue
    mi = item_re.match(line)
    if mi and cur_topic:
        cn, py, en = [x.strip() for x in mi.groups()]
        idx = len(cur_topic['items'])
        cur_topic['items'].append({
            'hanzi': cn,
            'pinyin': py,
            'english': en,
            'sentences': sentence_templates(cn, en, idx),
        })

if cur_topic and len(cur_topic['items']) == 10:
    topics.append(cur_topic)

seen = {}
for t in topics:
    base = t['slug']
    seen[base] = seen.get(base, 0) + 1
    if seen[base] > 1:
        t['slug'] = f'{base}-{seen[base]}'
        t['videoPath'] = f"/videos/{t['slug']}.mp4"

for c in cats:
    c['topics'] = [t['slug'] for t in topics if t['categorySlug'] == c['slug']]

out = Path('/home/nvidia/learn-10-mandarin-words/src/data')
out.mkdir(parents=True, exist_ok=True)
(out / 'topics.json').write_text(json.dumps({'categories': cats, 'topics': topics}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'categories': len(cats), 'topics': len(topics), 'out': str(out / 'topics.json')}, indent=2))
