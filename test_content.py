"""Content separation acceptance test. Run: python3 test_content.py"""
import json
import unittest
from pathlib import Path
from bs4 import BeautifulSoup, Comment, Doctype

ROOT = Path(__file__).resolve().parent


def get_path(data, path):
    for part in path.split('.'):
        data = data[int(part)] if isinstance(data, list) else data[part]
    return data


class ContentSeparationTest(unittest.TestCase):
    def test_placeholder_api_does_not_use_invalid_image_ids(self):
        from urllib.parse import urlparse, parse_qs
        data = json.loads((ROOT / 'site.json').read_text())

        def check(value):
            if isinstance(value, dict):
                for item in value.values():
                    check(item)
            elif isinstance(value, list):
                for item in value:
                    check(item)
            elif isinstance(value, str) and value.startswith('https://picsum.photos/'):
                image_id = parse_qs(urlparse(value).query).get('image', [])
                self.assertTrue(not image_id or image_id[0].isdigit(),
                                'Picsum image parameter requires numeric ID: ' + value)
        check(data)

    def test_page_content_has_no_hardcoded_copy_or_photo_sources(self):
        self.assertTrue((ROOT / 'site.json').is_file(), 'site.json is missing')
        data = json.loads((ROOT / 'site.json').read_text())
        page = BeautifulSoup((ROOT / 'index.html').read_text(), 'html.parser')
        residual = [str(node).strip() for node in page.find_all(string=True)
                    if not isinstance(node, (Comment, Doctype)) and str(node).strip()
                    and node.parent.name not in ('script', 'style')]
        self.assertEqual(residual, [], 'HTML still contains content text')
        for node in page.select('[data-site-text], [data-site-lines]'):
            value = get_path(data, node.get('data-site-text') or node['data-site-lines'])
            self.assertIsInstance(value, (str, list))
        self.assertNotIn('images', data, 'Images must live inside their sections/cards')
        self.assertNotIn('accessibility', data, 'Labels must live with their sections')
        raw_json = json.dumps(data)
        for token in ('randomUrlTemplate', 'random', 'reuse', '/seed/', '{session}'):
            self.assertNotIn(token, raw_json)
        for image in page.select('img'):
            self.assertFalse(image.get('src'), 'Photo URL is still hardcoded')
            if image.find_parent('template'):
                continue
            self.assertIsInstance(get_path(data, image['data-site-image'])['src'], str)
        cards = data['sections']['videos']['cards']
        self.assertEqual(len(cards), 3)
        for card in cards:
            for key in ('image', 'title', 'description', 'number', 'duration', 'caption', 'openLabel', 'videoId', 'preview'):
                self.assertIn(key, card)
            self.assertIsInstance(card['image']['src'], str)
        self.assertEqual(page.select_one('[data-site-each]')['data-site-each'], 'sections.videos.cards')
        for node in page.select('[data-site-attrs]'):
            for path in json.loads(node['data-site-attrs']).values():
                self.assertIsInstance(get_path(data, path), str)
        self.assertNotIn('data:image/', (ROOT / 'style.css').read_text())
        self.assertEqual(len(data['sections']['thanks']['names']), 12)


if __name__ == '__main__':
    unittest.main()
