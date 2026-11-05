// Cukrárna v Háječku (Webnode) – polední menu je jeden obrázek na týden, zveřejňovaný začátkem týdne.
// Obrázek přiřadíme všem pracovním dnům aktuálního týdne. Aby se po změně týdne neukazovalo staré menu,
// pamatujeme si, kdy jsme URL obrázku poprvé viděli (cache.seen); je-li starší než pondělí tohoto týdne,
// menu pro tento týden ještě nebylo zveřejněno.
import * as cheerio from 'cheerio';
import { fetchText, pragueDate, transcribeImage, normItems } from '../lib.mjs';

const PROMPT = 'Toto je týdenní polední menu restaurace. Přepiš ho do JSON objektu (bez dalšího textu) s klíči "Po","Út","St","Čt","Pá" (jen dny, které na obrázku jsou): {"Út":[{"type":"soup"|"main","name":"...","price":číslo v Kč nebo null}]}. Polévka = soup, ostatní = main. Je-li něco platné pro celý týden nebo víc dnů, uveď to u každého z těchto dnů. Přepisuj věrně, nic nevymýšlej, žádné alergeny.';
const DAYKEY = { Po: 0, 'Út': 1, St: 2, 'Čt': 3, 'Pá': 4, So: 5 };

export function parse(html, baseUrl) {
  const $ = cheerio.load(html);
  const img = $('.b-img-w img').first();
  const src = img.attr('src') || img.attr('data-src');
  return { image: src ? new URL(src, baseUrl).href : null };
}

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (iso) => addDays(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7));

export function build({ image }, { today = pragueDate(), cache = {}, transcript = null } = {}) {
  const seen = { ...(cache.seen || {}) };
  const out = { days: {}, cache: { ...cache, seen } };
  if (!image) return out;
  if (!seen[image]) seen[image] = today;
  const monday = mondayOf(today);
  if (seen[image] < monday) return out; // obrázek z minulého týdne
  // otevřeno ÚT–SO; appka zobrazuje Po–Pá, takže Út–Pá
  const byDay = transcript || cache.text?.[image] || null;
  for (let i = 1; i <= 4; i++) {
    const key = Object.keys(DAYKEY).find((k) => DAYKEY[k] === i);
    const items = byDay ? normItems(byDay[key]) : [];
    out.days[addDays(monday, i)] = items.length ? { items } : { items: [], images: [image], imageOnly: true };
  }
  return out;
}

export async function scrape(source, { cache } = {}) {
  const html = await fetchText(source.url);
  const parsed = parse(html, source.url);
  if (!parsed.image) throw new Error('Na stránce Háječku jsem nenašel obrázek s menu (změnila se struktura?).');
  let transcript = null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && !cache?.text?.[parsed.image]) {
    try { transcript = await transcribeImage(parsed.image, PROMPT, { apiKey }); }
    catch (e) { console.warn(`  přepis menu Háječku selhal: ${e.message}`); }
  }
  const out = build(parsed, { cache, transcript });
  if (transcript) out.cache.text = { ...(cache?.text || {}), [parsed.image]: transcript };
  return out;
}
