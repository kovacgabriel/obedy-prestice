// Crossroad – denní menu je na webu jako obrázky (screenshoty) v záložkách po dnech.
// Adaptér najde obrázky pro každý den. Pokud je nastaven ANTHROPIC_API_KEY, přepíše je
// do textu (Claude vision, výsledek se cachuje podle URL obrázku); jinak appka zobrazí přímo obrázek.
import * as cheerio from 'cheerio';
import { fetchText, fetchBuffer, parseCzDate } from '../lib.mjs';

const MODEL = process.env.OCR_MODEL || 'claude-haiku-5-5';

export function parse(html, baseUrl = 'https://crossroadrestaurant.cz/') {
  const $ = cheerio.load(html);
  const days = {};
  // Obsah záložek: každý panel začíná nadpisem "Pondělí 2.11.2026" a obsahuje <img>.
  $('.tab-pane, .ui-tabs-panel, [id^="tab-"]').each((_, panel) => {
    const $p = $(panel);
    const text = $p.text();
    const m = /(Pondělí|Úterý|Středa|Čtvrtek|Pátek|Sobota|Neděle)\s*:?\s*(\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*20\d{2})/.exec(text);
    if (!m) return;
    const date = parseCzDate(m[2]);
    const images = [];
    $p.find('img').each((__, img) => {
      const src = $(img).attr('data-guid') || $(img).attr('data-src') || $(img).attr('src');
      if (src && /\/uploads\//.test(src)) images.push(new URL(src.replace(/-uai-\d+x\d+(?=\.)/, ''), baseUrl).href);
    });
    if (date && images.length && !days[date]) days[date] = { items: [], images: [...new Set(images)] };
  });
  return { days };
}

async function transcribe(url, apiKey) {
  const buf = await fetchBuffer(url);
  const media = url.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: media, data: buf.toString('base64') } },
        { type: 'text', text: 'Toto je denní menu restaurace. Přepiš ho do JSON pole (bez dalšího textu): [{"type":"soup"|"main","name":"...","price":číslo v Kč}]. Sekce POLÉVKA = soup, ostatní jídla = main. Text přepisuj věrně, nic nevymýšlej.' },
      ] }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const j = await res.json();
  const txt = j.content?.map((c) => c.text || '').join('') || '';
  const arr = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
  return arr.filter((x) => x && x.name).map((x) => ({
    type: x.type === 'soup' ? 'soup' : 'main', name: String(x.name).trim(), price: Number.isFinite(+x.price) ? +x.price : null, allergens: [], tags: [],
  }));
}

export async function scrape(source, { cache = {} } = {}) {
  const html = await fetchText(source.url);
  const out = parse(html, source.url);
  if (!Object.keys(out.days).length) throw new Error('Nenašel jsem žádné denní obrázky s menu (změnila se struktura?).');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  out.cache = { ...cache };
  if (apiKey) {
    for (const day of Object.values(out.days)) {
      for (const img of day.images) {
        try {
          if (!out.cache[img]) out.cache[img] = await transcribe(img, apiKey);
          day.items.push(...out.cache[img]);
        } catch (e) {
          console.warn(`  přepis ${img} selhal: ${e.message}`);
        }
      }
    }
  }
  return out;
}
