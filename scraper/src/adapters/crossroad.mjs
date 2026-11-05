// Crossroad – denní menu je na webu jako obrázky (screenshoty) v záložkách po dnech.
// Adaptér najde obrázky pro každý den. Pokud je nastaven ANTHROPIC_API_KEY, přepíše je
// do textu (Claude vision, výsledek se cachuje podle URL obrázku). Bez klíče zůstane u dne jen odkaz (imageOnly).
import * as cheerio from 'cheerio';
import { fetchText, parseCzDate, transcribeImage, normItems } from '../lib.mjs';

const PROMPT = 'Toto je denní menu restaurace. Přepiš ho do JSON pole (bez dalšího textu): [{"type":"soup"|"main"|"weekly","name":"...","price":číslo v Kč}]. Sekce POLÉVKA = soup, NABÍDKA ŠÉFKUCHAŘE NA CELÝ TÝDEN = weekly, ostatní jídla = main. Přepisuj věrně, nic nevymýšlej, žádné alergeny.';

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

export async function scrape(source, { cache = {} } = {}) {
  const html = await fetchText(source.url);
  const out = parse(html, source.url);
  if (!Object.keys(out.days).length) throw new Error('Nenašel jsem žádné denní obrázky s menu (změnila se struktura?).');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  out.cache = { ...cache };
  if (!apiKey) for (const day of Object.values(out.days)) day.imageOnly = true;
  else {
    for (const day of Object.values(out.days)) {
      for (const img of day.images) {
        try {
          if (!out.cache[img]) out.cache[img] = normItems(await transcribeImage(img, PROMPT, { apiKey }));
          day.items.push(...out.cache[img]);
        } catch (e) {
          console.warn(`  přepis ${img} selhal: ${e.message}`);
          day.imageOnly = true;
        }
      }
    }
  }
  return out;
}
