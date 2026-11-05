import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse as preskovo } from '../src/adapters/preskovo.mjs';
import { parse as hajParse, build as hajBuild } from '../src/adapters/hajecek.mjs';
import { parse as crossroad } from '../src/adapters/crossroad.mjs';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('Přeškovo: dny, polévka, týdenní nabídka', () => {
  const { days } = preskovo(fx('preskovo.html'));
  assert.ok(Object.keys(days).length >= 5);
  const d = days['2026-11-05'];
  assert.equal(d.items[0].type, 'soup');
  assert.equal(d.items[0].price, 59);
  assert.ok(d.items.some((i) => i.type === 'weekly'));
  assert.ok(d.items.filter((i) => i.type === 'main').length >= 3);
});

test('Crossroad: obrázky po dnech', () => {
  const { days } = crossroad(fx('crossroad.html'));
  const d = days['2026-11-05'];
  assert.ok(d, 'čtvrtek chybí');
  assert.ok(d.images.length >= 1);
  assert.ok(d.images.every((u) => u.startsWith('https://')));
});

test('Háječek: jeden obrázek na týden, Út–Pá, ne starý týden', () => {
  const p = hajParse(fx('hajecek.html'), 'https://www.cukrarnavhajecku.cz/poledni-menu/');
  assert.match(p.image, /^https:\/\/.+\.png/);
  const cur = hajBuild(p, { today: '2026-11-05' });
  assert.deepEqual(Object.keys(cur.days), ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
  // stejný obrázek viděný už minulý týden => pro tento týden zatím nezveřejněno
  const stale = hajBuild(p, { today: '2026-11-10', cache: { seen: { [p.image]: '2026-11-05' } } });
  assert.deepEqual(stale.days, {});
});
