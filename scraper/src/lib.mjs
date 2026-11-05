// Společné pomůcky pro adaptéry.

export const UA = 'Mozilla/5.0 (compatible; ObedyPrestice/1.0; +https://github.com/)';

export async function fetchText(url, { timeoutMs = 30000 } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'cs' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} při stahování ${url}`);
  return res.text();
}

export async function fetchBuffer(url, { timeoutMs = 30000 } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} při stahování ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** "2.11.2026" / "2. 11. 2026" -> "2026-11-02" (nebo null) */
export function parseCzDate(s) {
  const m = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(20\d{2})/.exec(s || '');
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** "59 Kč" / "1 189,-" -> 59 */
export function parsePrice(s) {
  const m = /(\d[\d\s]*)\s*(?:Kč|,-|CZK)/i.exec(s || '');
  return m ? Number(m[1].replace(/\s/g, '')) : null;
}

export const SOUP_RE = /pol[ée]vk|v[ýy]var|kulajd|gulášovk|bramboračk|zabijačkov|česnečk|krém\b|vývar/i;

export function pragueDate(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(d); // YYYY-MM-DD
}

/** Přepis obrázku s menu do JSON přes Claude vision. Vrací naparsovaný JSON (pole nebo objekt). */
export async function transcribeImage(url, prompt, { apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.OCR_MODEL || 'claude-haiku-5-5', fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('chybí ANTHROPIC_API_KEY');
  const buf = await fetchBuffer(url);
  const lower = url.split('?')[0].toLowerCase();
  const media = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: media, data: buf.toString('base64') } },
      { type: 'text', text: prompt },
    ] }] }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const j = await res.json();
  return extractJson(j.content?.map((c) => c.text || '').join('') || '');
}

export function extractJson(txt) {
  const a = Math.min(...['[', '{'].map((c) => { const i = txt.indexOf(c); return i < 0 ? Infinity : i; }));
  const b = Math.max(txt.lastIndexOf(']'), txt.lastIndexOf('}'));
  if (!isFinite(a) || b < a) throw new Error('přepis neobsahuje JSON');
  return JSON.parse(txt.slice(a, b + 1));
}

export function normItems(arr) {
  return (Array.isArray(arr) ? arr : []).filter((x) => x && x.name).map((x) => ({
    type: x.type === 'soup' ? 'soup' : x.type === 'weekly' ? 'weekly' : 'main',
    name: String(x.name).replace(/\s+/g, ' ').trim(),
    price: Number.isFinite(+x.price) && x.price !== null ? +x.price : null,
  }));
}
