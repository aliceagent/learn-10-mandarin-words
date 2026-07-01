from pathlib import Path
import json

def sentence_templates(word_cn: str, word_en: str, item_index: int):
    if item_index % 3 == 0:
        return [
            {'cn': f'我喜欢{word_cn}，因为它很有意思。', 'en': f'I like learning the word {word_en} because it is useful.'},
            {'cn': f'这个{word_cn}在生活中很常见。', 'en': f'This word, {word_en}, is common in daily life.'},
        ]
    if item_index % 3 == 1:
        return [
            {'cn': f'今天我们学习{word_cn}这个词。', 'en': f'Today we are learning the word {word_en}.'},
            {'cn': f'很多人都知道{word_cn}。', 'en': f'Many people know the word {word_en}.'},
        ]
    return [
        {'cn': f'请你看一看这个{word_cn}。', 'en': f'Please look at this word: {word_en}.'},
        {'cn': f'我想用中文说{word_cn}。', 'en': f'I want to say {word_en} in Chinese.'},
    ]

path = Path('/home/nvidia/learn-10-mandarin-words/src/data/topics.json')
data = json.loads(path.read_text(encoding='utf-8'))
for topic in data['topics']:
    for idx, item in enumerate(topic['items']):
        item['sentences'] = sentence_templates(item['hanzi'], item['english'], idx)
path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
print({'topics': len(data['topics']), 'categories': len(data['categories'])})
