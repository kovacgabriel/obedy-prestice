// Cukrárna v Háječku (Webnode) – polední menu je jeden obrázek na týden, zveřejňovaný začátkem týdne.
// Obrázek přiřadíme všem pracovním dnům aktuálního týdne. Aby se po změně týdne neukazovalo staré menu,
// pamatujeme si, kdy jsme URL obrázku poprvé viděli (cache.seen); je-li starší než pondělí tohoto týdne,
// menu pro tento týden ještě nebylo zveřejněno.
import * as cheerio from 'cheerio';
import { fetchText, pragueDate } from '../lib.mjs';

export function parse(html, baseUrl) {
  const $ = cheerio.load(html);
  const img = $('.b-img-w img').first();
  const src = img.attr('src') || img.attr('data-src');
  return { image: src ? new URL(src, baseUrl).href : null };
}

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (iso) => addDays(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7));

export function build({ image }, { today = pragueDate(), cache = {} } = {}) {
  const seen = { ...(cache.seen || {}) };
  const out = { days: {}, cache: { seen } };
  if (!image) return out;
  if (!seen[image]) seen[image] = today;
  const monday = mondayOf(today);
  if (seen[image] < monday) return out; // obrázek z minulého týdne
  // otevřeno ÚT–SO; appka zobrazuje Po–Pá, takže Út–Pá
  for (let i = 1; i <= 4; i++) out.days[addDays(monday, i)] = { items: [], images: [image] };
  return out;
}

export async function scrape(source, { cache } = {}) {
  const html = await fetchText(source.url);
  const parsed = parse(html, source.url);
  if (!parsed.image) throw new Error('Na stránce Háječku jsem nenašel obrázek s menu (změnila se struktura?).');
  return build(parsed, { cache });
}
