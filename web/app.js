const TZ = 'Europe/Prague';
const DOW = ['Po', 'Út', 'St', 'Čt', 'Pá'];
const DOW_LONG = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek'];
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};

// ---- datum (vždy pražský čas) ----
const iso = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
const addDays = (isoStr, n) => { const d = new Date(isoStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (isoStr) => (new Date(isoStr + 'T12:00:00Z').getUTCDay() + 6) % 7; // 0 = pondělí
const fmtShort = (s) => { const [, m, d] = s.split('-'); return `${+d}. ${+m}.`; };
const fmtTime = (t) => new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(t));
function fmtWhen(t) {
  const d = iso(new Date(t)), today = iso(new Date());
  const day = d === today ? 'dnes' : d === addDays(today, -1) ? 'včera' : fmtShort(d);
  return `${day} v ${fmtTime(t)}`;
}

// ---- stav ----
const today = iso(new Date());
const todayIdx = weekday(today);
const monday = addDays(today, todayIdx >= 5 ? 7 - todayIdx : -todayIdx); // o víkendu ukaž příští týden
const weekDates = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
let selected = weekDates.includes(today) ? today : weekDates[0];
let config, data;

const favs = (() => { try { return new Set(JSON.parse(localStorage.getItem('favs') || '[]')); } catch { return new Set(); } })();
const saveFavs = () => { try { localStorage.setItem('favs', JSON.stringify([...favs])); } catch {} };

// ---- UI ----
function renderTabs() {
  const nav = $('#days'); nav.replaceChildren();
  weekDates.forEach((d, i) => nav.append(el('button', {
    class: 'day', role: 'tab', 'aria-selected': String(d === selected), 'aria-current': d === today ? 'date' : null,
    onclick: () => select(d),
  }, el('b', {}, DOW[i]), el('small', {}, fmtShort(d)))));
}

function select(d) {
  selected = d; renderTabs(); renderList();
  $('#days .day[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  $('#sub').textContent = (d === today ? 'Dnes, ' : '') + DOW_LONG[weekday(d)] + ' ' + fmtShort(d);
}

const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const mapUrl = (a) => isIOS ? `https://maps.apple.com/?q=${encodeURIComponent(a)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const price = (p) => (p == null ? '' : `${p} Kč`);

function itemRow(it) {
  return el('div', { class: 'item' }, el('div', { class: 'n' }, it.name), el('div', { class: 'p' }, price(it.price)));
}

function section(title, items) {
  return items.length ? [el('div', { class: 'sec' }, title), ...items.map(itemRow)] : [];
}

const initials = (name) => name.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

function card(r) {
  const m = data.restaurants.find((x) => x.id === r.id) || {};
  const day = m.days?.[selected];
  const body = [];
  if (day?.items?.length) {
    const it = day.items;
    body.push(...section('Polévka', it.filter((i) => i.type === 'soup')),
      ...section('Hlavní jídla', it.filter((i) => i.type === 'main')),
      ...section('Nabídka na celý týden', it.filter((i) => i.type === 'weekly')));
  } else if (r.closedWeekdays?.includes(weekday(selected)) && m.status === 'ok') {
    body.push(el('p', { class: 'empty' }, 'V tento den zavřeno.'));
  } else {
    const msg = day?.imageOnly ? 'Menu je zveřejněné jen jako obrázek.'
      : m.status === 'unsupported' ? 'Automatické stahování zatím není nastavené.'
      : m.status === 'error' ? 'Menu se nepodařilo načíst.' : 'Menu zatím nezveřejněno.';
    body.push(el('p', { class: 'note' }, msg + ' ', el('a', { href: r.source.url, target: '_blank', rel: 'noopener' }, 'Otevřít zdroj')));
  }

  const stale = m.fetchedAt && Date.now() - new Date(m.fetchedAt) > 26 * 3600e3;
  const metaTxt = m.status === 'unsupported' ? `Zdroj: ${host(r.source.url)}`
    : m.fetchedAt ? `Zdroj: ${host(r.source.url)} · staženo ${fmtWhen(m.fetchedAt)}` + (m.status === 'error' && m.lastOkAt ? ` · poslední úspěšně ${fmtWhen(m.lastOkAt)}` : '') : '';

  return el('article', { class: 'card', style: `--c:${r.color || '#555'}` },
    el('header', { class: 'rh' },
      el('span', { class: 'badge', 'aria-hidden': 'true' }, r.badge || initials(r.name)),
      el('div', { class: 'rt' }, el('h2', {}, r.name), el('p', { class: 'addr' }, r.address || '')),
      el('button', { class: 'fav', 'aria-pressed': String(favs.has(r.id)), 'aria-label': 'Oblíbená', title: 'Oblíbená',
        onclick: () => { favs.has(r.id) ? favs.delete(r.id) : favs.add(r.id); saveFavs(); renderList(); } }, favs.has(r.id) ? '★' : '☆')),
    el('div', { class: 'cb' }, ...body,
      el('div', { class: 'actions' },
        el('a', { class: 'btn primary', href: r.fullMenuUrl, target: '_blank', rel: 'noopener' }, 'Celý jídelní lístek'),
        r.address ? el('a', { class: 'btn', href: mapUrl(r.address + ', Česko'), target: '_blank', rel: 'noopener' }, 'Mapa') : null,
        r.phone ? el('a', { class: 'btn', href: 'tel:' + r.phone }, 'Zavolat') : null),
      metaTxt ? el('p', { class: 'meta' + (stale || m.status === 'error' ? ' stale' : '') }, metaTxt) : null));
}

function renderList() {
  const list = [...config.restaurants].sort((a, b) => (favs.has(b.id) - favs.has(a.id)));
  $('#list').replaceChildren(...list.map(card));
}

// ---- swipe mezi dny ----
let sx = 0, sy = 0;
$('#list').addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
$('#list').addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const i = weekDates.indexOf(selected) + (dx < 0 ? 1 : -1);
  if (weekDates[i]) select(weekDates[i]);
}, { passive: true });

// ---- start ----
async function load() {
  const j = (u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  [config, data] = await Promise.all([j('data/restaurants.json'), j('data/menus.json')]);
  select(selected);
  $('#updated').textContent = data.generatedAt ? `Data aktualizována ${fmtWhen(data.generatedAt)}` : '';
}
load().catch(() => { $('#list').replaceChildren(el('p', { class: 'empty' }, 'Nepodařilo se načíst data. Zkuste to později.')); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) load().catch(() => {}); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
