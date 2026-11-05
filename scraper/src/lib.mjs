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
