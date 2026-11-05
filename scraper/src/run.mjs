// Stáhne menu ze všech restaurací v config/restaurants.json a uloží web/data/menus.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = resolve(root, 'config/restaurants.json');
const outPath = resolve(root, process.env.MENUS_OUT || 'web/data/menus.json');

const config = JSON.parse(await readFile(configPath, 'utf8'));
let previous = { restaurants: [] };
try { previous = JSON.parse(await readFile(outPath, 'utf8')); } catch {}

const now = new Date().toISOString();
const results = [];
for (const r of config.restaurants) {
  const prev = previous.restaurants.find((p) => p.id === r.id);
  const base = { id: r.id, sourceUrl: r.source.url, fetchedAt: now };
  try {
    const adapter = await import(`./adapters/${r.source.adapter}.mjs`);
    const out = await adapter.scrape(r.source, { cache: prev?.cache || {} });
    // ruční přepisy (config/manual/<id>.json) mají přednost před staženými daty pro dané dny
    try {
      const manual = JSON.parse(await readFile(resolve(root, `config/manual/${r.id}.json`), 'utf8'));
      for (const [date, day] of Object.entries(manual.days || {})) out.days[date] = { items: day.items };
      if (out.unsupported && Object.keys(manual.days || {}).length) out.unsupported = false;
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
    results.push({ ...base, status: out.unsupported ? 'unsupported' : 'ok', lastOkAt: out.unsupported ? null : now, days: out.days, cache: out.cache });
    console.log(`✔ ${r.id}: ${Object.keys(out.days).length} dnů`);
  } catch (e) {
    console.error(`✘ ${r.id}: ${e.message}`);
    // zachováme poslední známá data, jen označíme chybu
    results.push({ ...base, status: 'error', error: e.message, lastOkAt: prev?.lastOkAt || null, days: prev?.days || {}, cache: prev?.cache });
  }
}
for (const x of results) if (!x.cache) delete x.cache;

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify({ generatedAt: now, restaurants: results }, null, 1) + '\n');
await writeFile(resolve(dirname(outPath), 'restaurants.json'), JSON.stringify(config, null, 1) + '\n'); // appka čte stejný config
console.log(`Uloženo: ${outPath}`);
// Chyba jen pokud selhaly všechny skutečné zdroje.
const real = results.filter((x) => x.status !== 'unsupported');
if (real.length && real.every((x) => x.status === 'error')) process.exit(1);
