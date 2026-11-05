// Tady je Přeškovo! – menu je přímo v HTML (Drupal, tabulky .view-weekly-menu).
import * as cheerio from 'cheerio';
import { fetchText, parseCzDate, parsePrice } from '../lib.mjs';

export function parse(html) {
  const $ = cheerio.load(html);
  const days = {};
  $('.view-weekly-menu > .view-header').each((_, hdr) => {
    const date = parseCzDate($(hdr).text());
    if (!date) return;
    const items = [];
    $(hdr).next('.view').find('tbody tr').each((i, tr) => {
      const $tr = $(tr);
      const $title = $tr.find('td.views-field-title');
      let name = $title.find('strong').first().text().replace(/\s+/g, ' ').trim();
      const sup = $title.find('sup').first().text().replace(/\s+/g, ' ').trim();
      const price = parsePrice($tr.find('.uc-price').text());
      if (!name) return;
      let type = 'main';
      if (/^CELÝ TÝDEN\s*:/i.test(name)) {
        type = 'weekly';
        name = name.replace(/^CELÝ TÝDEN\s*:\s*/i, '');
      } else if (items.length === 0 && price !== null && price < 100) {
        type = 'soup';
      }
      const parts = sup.split(',').map((s) => s.trim()).filter(Boolean);
      const allergens = parts.filter((p) => /^\d+$/.test(p));
      const tags = parts.filter((p) => !/^\d+$/.test(p));
      items.push({ type, name, price, allergens, tags });
    });
    if (items.length) days[date] = { items };
  });
  return { days };
}

export async function scrape(source) {
  const html = await fetchText(source.url);
  const out = parse(html);
  if (!Object.keys(out.days).length) throw new Error('Na stránce jsem nenašel žádné polední menu (změnila se struktura?).');
  return out;
}
