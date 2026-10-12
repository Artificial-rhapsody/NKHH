import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSite } from '../content-validation.js';
test('site schema accepts source and rejects unsafe links', async () => {
 const site=JSON.parse(await readFile(new URL('../site.json',import.meta.url),'utf8'));
 assert.doesNotThrow(()=>validateSite(site));
 site.sections.hero.action.href='javascript:alert(1)';
 assert.throws(()=>validateSite(site),/链接/);
});
