#!/usr/bin/env node
// 언양 문화·예술·체육 소식지 주간 발행 스크립트 (Node 18 이상, 외부 패키지 없음)
//
// 울주문화재단(ucf.or.kr) 공연·전시 목록을 읽어 index.html 의 표시 구간
//   ISSUE · TICKER · HERO · EVENTS_HEADING · FEATURED · ORG_LIST · NEXTWEEK_HEADING · NEXTWEEK_CARDS · ARCHIVE · WUCC
// 와 월별 캘린더, <title>, 꼬리말 호수를 새로 채운다. 손으로 쓰는 구간(울주문화재단 NOW·인물·문화유산 등)은 건드리지 않는다.
//
// ※ ucf.or.kr 는 해외(GitHub Actions 서버)에서 열리지 않아(2026. 6. 28.부터 서울주문화센터 칸이 비어 온 원인)
//    국내 PC에서 돌린다. 행사를 하나도 못 읽으면 index.html 을 건드리지 않고 끝낸다.
// ※ 호수는 '지난 호 + 1'(같은 주에 다시 돌리면 같은 호수로 내용만 새로 고침).
//
// usage: node scripts/update.mjs [--date 2026-09-28] [--dry] [--push]
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');
const UCF = 'https://www.ucf.or.kr';
const LIST_URL = `${UCF}/culturearts/pe_list.html?pfmIng=1`;
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined; };

// ── 기관 ─────────────────────────────────────────────
const ORGS = [
  { name: '울주문화예술회관', icon: '🏛', key: 'uljuart', url: `${UCF}/uljuart/` },
  { name: '서울주문화센터', icon: '🎭', key: 'wucc', url: `${UCF}/wucc/` },
  { name: '온양문화복지센터', icon: '🎶', key: 'onyang', url: `${UCF}/onyang/` },
  { name: '오영수문학관', icon: '📚', key: 'oys', url: `${UCF}/oys/` },
  { name: '울주생활문화센터', icon: '🏘', key: 'uljulife', url: `${UCF}/uljulife/` },
];
const STATIC_ORGS = ['울산암각화박물관', '외고산 옹기마을'];   // 연중·상시 운영 — 지금 페이지의 블록을 그대로 둔다
const HOLIDAYS = { '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날', '06-06': '현충일', '08-15': '광복절', '10-03': '개천절', '10-09': '한글날', '12-25': '성탄절' };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// ── 날짜(한국 시간) ───────────────────────────────────
const ymd = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
function todayKST() {
  if (opt('--date')) return new Date(opt('--date') + 'T00:00:00Z');
  const k = new Date(Date.now() + 9 * 3600000);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
}
const md = d => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
const mdDow = d => `${md(d)}(${DOW[d.getUTCDay()]})`;
const koDate = d => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${DOW[d.getUTCDay()]})`;

// ── 가져오기 ─────────────────────────────────────────
function fetchText(url, redirects = 3) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, rejectUnauthorized: false, timeout: 25000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(fetchText(new URL(res.headers.location, url).href, redirects - 1));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(res.statusCode === 200 ? Buffer.concat(chunks).toString('utf8') : ''));
    });
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.on('error', e => { console.error(`  [가져오기 실패] ${url} → ${e.message}`); resolve(''); });
  });
}
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const text = s => decode(s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseNotices(html) {
  const notices = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1];
    const titleCell = /<td\b[^>]*class=["'][^"']*\btit\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i.exec(row);
    const anchor = titleCell && /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(titleCell[1]);
    const dateCell = /<td\b[^>]*class=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i.exec(row);
    const categoryCell = /<td\b[^>]*class=["'][^"']*\bcategory\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i.exec(row);
    if (!anchor || !dateCell) continue;
    const title = text(anchor[2]);
    const published = text(dateCell[1]);
    let url;
    try {
      url = new URL(decode(anchor[1]), 'https://www.ucf.or.kr');
      if (url.protocol !== 'https:' || url.hostname !== 'www.ucf.or.kr' || url.pathname !== '/bd/view.html' || url.searchParams.get('b_code') !== 'notice' || !/^\d+$/.test(url.searchParams.get('b_idx') || '')) continue;
    } catch { continue; }
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(published)) continue;
    const category = categoryCell ? text(categoryCell[1]) : '';
    notices.push({ title, published, category, url: url.href });
  }
  return notices.sort((a, b) => b.published.localeCompare(a.published)).slice(0, 5);
}

function noticeSpotlight(notices, checkedDate) {
  const listUrl = 'https://www.ucf.or.kr/bd/list.html?b_code=notice';
  const cards = notices.length ? notices.map(n => `
    <a class="org-ev" href="${esc(n.url)}" target="_blank" rel="noopener">
      <div class="org-ev-left"><div class="org-ev-badge coral">공지</div><div class="org-ev-date">${esc(n.published)}</div></div>
      <div class="org-ev-right"><div class="org-ev-title">${esc(n.title)}</div><div class="org-ev-meta">${esc(n.category || '울주문화재단')} · 게시일 ${esc(n.published)}</div></div>
    </a>`).join('') : `
    <p style="padding:18px;color:var(--gray-500);">공지 목록을 불러오지 못했습니다. 아래 원문에서 최신 내용을 확인해 주세요.</p>`;
  const stamp = notices.length ? `목록 확인일 ${esc(checkedDate)}` : '목록 확인 실패';
  return `<section class="sec" style="background:linear-gradient(135deg,#fff7ed 0%,#fef3c7 100%);border-top:3px solid #ea580c;">
  <div class="sec-head"><div class="sec-row"><div>
    <div class="sec-label" style="background:#ea580c;color:#fff;">🎨 울주문화재단 NOW</div>
    <h2 class="sec-title" style="color:#9a3412;">울주문화재단 최신 공지</h2>
    <p style="font-size:12px;color:var(--gray-500);margin-top:2px;">출처: 울주문화재단 공지사항 · ${stamp}</p>
  </div><a class="sec-more" href="${listUrl}" target="_blank" rel="noopener" style="color:#ea580c;">전체 공지 →</a></div></div>
  <div class="org-list"><div class="org-block" style="border-left:4px solid #ea580c;background:#fff;"><div class="org-events">${cards}</div></div></div>
  <p style="font-size:12px;color:#9a3412;margin:12px 0 0;padding:10px 14px;background:#fef3c7;border-radius:8px;">게시일 순으로 표시합니다. 모집 여부와 마감일은 원문에서 확인해 주세요.</p>
</section>`;
}

function parseList(html) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    const it = m[1];
    const idx = /p_idx=(\d+)/.exec(it);
    const tm = /<h5[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/.exec(it);
    if (!idx || !tm || seen.has(idx[1])) continue;
    const dd = label => { const r = new RegExp(`<dt>\\s*${label}\\s*</dt>\\s*<dd>([\\s\\S]*?)</dd>`).exec(it); return r ? text(r[1]) : ''; };
    // 이름표 앞말: 공연일자·공연시간·공연장소 / 전시일자… / 행사일자…
    const kind = (/<dt>\s*(\S{1,4})일자\s*<\/dt>/.exec(it) || [])[1] || '공연';
    const dates = [...dd(`${kind}일자`).matchAll(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g)].map(x => new Date(Date.UTC(+x[1], +x[2] - 1, +x[3])));
    if (!dates.length) continue;
    seen.add(idx[1]);
    const title = text(tm[1]);
    const venue = dd(`${kind}장소`).replace(/\s*\[\s*\]\s*$/, '').trim();
    const rsv = /wRsvPfm\('(\w+)'/.exec(it);
    const org = ORGS.find(o => (rsv && rsv[1] === o.key) || venue.includes(o.name) || title.includes(o.name));
    const img = /<img[^>]+src="([^"]+)"/.exec(it);
    const time = dd(`${kind}시간`);
    out.push({
      idx: idx[1], title, start: dates[0], end: dates[dates.length - 1], time: /^\d{1,2}:\d{2}/.test(time) ? time.slice(0, 11) : '', venue, exhibit: kind === '전시', kind,
      org: org ? org.name : '', url: `${UCF}/culturearts/pe_detail.html?pfmIng=1&p_idx=${idx[1]}`, img: img ? img[1] : '',
    });
  }
  return out;
}
function kindOf(ev) {
  const s = `${ev.title} ${ev.genre || ''}`;
  if (ev.exhibit || /전시/.test(s)) return { label: '전시', color: 'green', cal: 'coral' };
  if (/영화|상영/.test(s)) return { label: '영화', color: 'coral', cal: 'blue' };
  if (/강좌|교실|아카데미|체험/.test(s)) return { label: ev.genre || '강좌', color: 'green', cal: 'blue' };
  if (ev.kind === '행사') return { label: ev.genre || '행사', color: 'coral', cal: 'blue' };
  return { label: ev.genre || '공연', color: 'blue', cal: 'blue' };
}
async function addDetail(ev) {
  const h = await fetchText(ev.url);
  if (!h) return;
  const t = text(h);
  const g = /장르\/테마\s*(\S+)/.exec(t);
  if (g) ev.genre = g[1];
  const p = /입장료\s*(.{1,160}?)(?:입장연령|러닝타임|문의|유의|예매하기|목록)/.exec(t);
  ev.price = p ? (/무료/.test(p[1]) ? '무료' : '유료') : '';
}
const cleanTitle = t => t.replace(/^\[(기획|대관)(공연|전시)\]\s*/, '').replace(/^\[[^\]]+\]\s*/, '');
const dateRange = ev => (ymd(ev.start) === ymd(ev.end) ? mdDow(ev.start) : `${mdDow(ev.start)}~${mdDow(ev.end)}`);
const overlaps = (ev, a, b) => ev.start <= b && ev.end >= a;

// ── 구간 바꾸기 ──────────────────────────────────────
function section(html, key) {
  const m = new RegExp(`<!--\\s*${key}_START\\s*-->([\\s\\S]*?)<!--\\s*${key}_END\\s*-->`).exec(html);
  return m ? m[1] : null;
}
function replaceSection(html, key, body) {
  const re = new RegExp(`(<!--\\s*${key}_START\\s*-->)[\\s\\S]*?(<!--\\s*${key}_END\\s*-->)`);
  if (!re.test(html)) { console.error(`  [경고] ${key} 표시를 못 찾음 — 건너뜀`); return html; }
  return html.replace(re, (a, s, e) => `${s}\n${body}\n${e}`);
}

// ── 만들기 ───────────────────────────────────────────
function orgEventHtml(ev) {
  const k = kindOf(ev);
  const when = ymd(ev.start) === ymd(ev.end) ? `${md(ev.start)}` : `${md(ev.start)}~<br>${md(ev.end)}`;
  const time = ev.time ? `<br>${esc(ev.time)}` : '';
  return `
        <a class="org-ev" href="${ev.url}" target="_blank" rel="noopener">
          <div class="org-ev-left">
            <div class="org-ev-badge ${k.color}">${esc(k.label)}</div>
            <div class="org-ev-date">${when}${ymd(ev.start) === ymd(ev.end) ? time : ''}</div>
          </div>
          <div class="org-ev-right">
            <div class="org-ev-title">${esc(cleanTitle(ev.title))}</div>
            <div class="org-ev-meta">📍 ${esc(ev.venue || ev.org)}${ev.price ? ' · ' + ev.price : ''}</div>
          </div>
        </a>`;
}
function orgBlock(icon, name, url, evs) {
  return `
    <!-- ${name} -->
    <div class="org-block">
      <div class="org-header">
        <span class="org-icon">${icon}</span>
        <span class="org-name">${esc(name)}</span>
        <a class="org-site-link" href="${url}" target="_blank" rel="noopener">사이트 →</a>
      </div>
      <div class="org-events">${evs.map(orgEventHtml).join('')}
      </div>
    </div>`;
}
function staticBlocks(oldOrgList) {
  if (!oldOrgList) return '';
  let out = '';
  for (const name of STATIC_ORGS) {
    const m = new RegExp(`\\n\\s*<!-- ${name} -->[\\s\\S]*?(?=\\n\\s*<!-- |\\n\\s*</div>\\s*$)`).exec(oldOrgList);
    if (m) out += m[0];
  }
  return out;
}
function nwCard(ev) {
  const k = kindOf(ev);
  return `    <a class="nw-card" href="${ev.url}" target="_blank" rel="noopener">
      <div class="nw-badge b-${k.color === 'green' ? 'green' : k.color === 'coral' ? 'coral' : 'blue'}-o">${esc(k.label)}</div>
      <div class="nw-date">${esc(dateRange(ev))}${ev.time && ymd(ev.start) === ymd(ev.end) ? ' ' + esc(ev.time) : ''}</div>
      <div class="nw-title">${esc(cleanTitle(ev.title))}</div>
      <div class="nw-desc">📍 ${esc(ev.venue || ev.org)}${ev.price ? ' · ' + ev.price : ''}</div>
    </a>`;
}
function calendarJs(events, months, defIdx, oldData) {
  const blocks = months.map(key => {
    const [y, m] = key.split('-').map(Number);
    const days = {};
    const add = (d, item) => { (days[d] = days[d] || []).push(item); };
    for (const ev of events) {
      const k = kindOf(ev);
      const t = cleanTitle(ev.title).slice(0, 22);
      const inMonth = d => d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m;
      if (inMonth(ev.start)) add(ev.start.getUTCDate(), { t: t + (ev.venue ? ` (${ev.venue.replace(/\s*\[.*$/, '').slice(0, 10)})` : ''), c: k.cal, u: ev.url });
      const span = (ev.end - ev.start) / 86400000;
      if (span >= 1 && span <= 60 && inMonth(ev.end)) add(ev.end.getUTCDate(), { t: `${t} 마지막`, c: 'green', u: ev.url });
    }
    for (const [mmdd, name] of Object.entries(HOLIDAYS)) if (+mmdd.slice(0, 2) === m) add(+mmdd.slice(3), { t: `${name} 🌟`, c: 'blue', u: '' });
    const body = Object.keys(days).map(Number).sort((a, b) => a - b)
      .map(d => `      ${d}: [${days[d].map(e => `{t:${JSON.stringify(e.t)}, c:'${e.c}', u:${JSON.stringify(e.u)}}`).join(',\n           ')}]`).join(',\n');
    return `  '${key}': {\n    label: '${y}년 ${m}월',\n    events: {\n${body}\n    }\n  }`;
  });
  return `// ── 캘린더 월 목록 ── (scripts/update.mjs 가 매주 새로 씀)
const CAL_MONTHS = ${JSON.stringify(months)};
let calIdx = ${defIdx};

// ── 행사 데이터 (날짜별, 울주문화재단 공연·전시 목록 기준) ──
const CAL_DATA = {
${blocks.join(',\n')}
};

`;
}

// ── 본 작업 ───────────────────────────────────────────
const today = todayKST();
const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
const sunday = addDays(monday, 6), nxtMon = addDays(monday, 7), nxtSun = addDays(monday, 13), thursday = addDays(monday, 3);
console.log(`이번 주 ${ymd(monday)} ~ ${ymd(sunday)} / 다음 주 ${ymd(nxtMon)} ~ ${ymd(nxtSun)}`);

const listHtml = await fetchText(LIST_URL);
const events = parseList(listHtml);
console.log(`울주문화재단 공연·전시 ${events.length}건 읽음`);
if (!events.length) {
  console.error('행사를 하나도 읽지 못했습니다(누리집 접속 차단·구조 변경?) — index.html 을 바꾸지 않고 끝냅니다.');
  process.exit(2);
}
// 이번 주에 새로 시작하는 행사를 앞에, 몇 달씩 이어지는 행사(시즌권·장기 전시)는 뒤에
const fresh = e => (e.start >= monday ? 0 : 1);
const thisWeek = events.filter(e => overlaps(e, monday, sunday)).sort((a, b) => fresh(a) - fresh(b) || a.start - b.start || (a.end - a.start) - (b.end - b.start));
const nextWeek = events.filter(e => overlaps(e, nxtMon, nxtSun) && !thisWeek.includes(e)).sort((a, b) => a.start - b.start);
for (const ev of [...thisWeek, ...nextWeek]) await addDetail(ev);
console.log(`이번 주 ${thisWeek.length}건, 다음 주 새 행사 ${nextWeek.length}건`);

let html = fs.readFileSync(INDEX, 'utf8');
const notices = parseNotices(await fetchText(`${UCF}/bd/list.html?b_code=notice`));
console.log(`울주문화재단 공지 ${notices.length}건 읽음`);
html = replaceSection(html, 'UCF_SPOTLIGHT', noticeSpotlight(notices, ymd(today)));
const oldIssue = section(html, 'ISSUE') || '';
const oldNum = +((/제(\d+)호/.exec(oldIssue) || [])[1] || 0);
const od = /(\d{4})년 (\d{1,2})월 (\d{1,2})일/.exec(oldIssue);
const oldMon = od ? ymd(new Date(Date.UTC(+od[1], +od[2] - 1, +od[3]))) : '';
const num = oldMon === ymd(monday) ? oldNum : oldNum + 1;
const pubKo = `${monday.getUTCFullYear()}년 ${monday.getUTCMonth() + 1}월 ${monday.getUTCDate()}일`;
console.log(`호수: 제${num}호 (${pubKo}) ${oldMon === ymd(monday) ? '— 같은 주 다시 발행' : `— 지난 호 제${oldNum}호(${oldMon})`}`);

// 1. 머리 호수·날짜, <title>, 꼬리말
html = replaceSection(html, 'ISSUE', `    <div class="header-date">${pubKo} (월)</div>\n    <span class="header-issue">제${num}호</span>`);
html = html.replace(/<title>[^<]*<\/title>/, `<title>언양 문화·예술·체육 소식지 — ${pubKo} 제${num}호</title>`);
html = html.replace(/현재 제\d+호 \(\d+년 \d+월 \d+일\)/, `현재 제${num}호 (${pubKo})`);

// 2. 흐르는 글(티커)
const tick = thisWeek.slice(0, 5).map(e => `${kindOf(e).label === '전시' ? '🖼' : '🎭'} ${esc(cleanTitle(e.title))} ${dateRange(e)} ${esc((e.venue || e.org).replace(/\s*\[.*$/, ''))}`);
tick.push('🪨 반구천 암각화박물관 연중 관람 (무료)', '🏺 외고산 옹기마을 상시 체험');
html = replaceSection(html, 'TICKER', `  ${tick.join(' &nbsp;·&nbsp; ')}`);

// 3. 이번 주 주목(맨 위)과 주목 행사 카드: 이번 주 무료 행사 → 이번 주 첫 행사 → 다음 주 첫 행사
const hero = thisWeek.find(e => fresh(e) === 0 && e.price === '무료') || thisWeek.find(e => fresh(e) === 0) || thisWeek.find(e => e.price === '무료') || thisWeek[0] || nextWeek[0];
if (hero) {
  const place = esc(hero.venue || hero.org);
  html = replaceSection(html, 'HERO', `    <span class="hero-badge">⭐ 이번 주 주목</span>
    <div class="hero-title">${esc(cleanTitle(hero.title))}</div>
    <div class="hero-meta">
      <span>📅 ${esc(dateRange(hero))}${hero.time && ymd(hero.start) === ymd(hero.end) ? ' ' + esc(hero.time) : ''}</span>
      <span>📍 ${place}</span>
      <span>🎟 ${hero.price || '예매·문의는 울주문화재단'}</span>
    </div>`);
  html = replaceSection(html, 'FEATURED', `  <!-- Featured: ${esc(cleanTitle(hero.title))} -->
  <a class="ev-feat" href="${hero.url}" target="_blank" rel="noopener" style="background:linear-gradient(135deg,#071624 0%,#0d2a40 45%,#0a1e14 100%);">
    <div class="ev-feat-overlay"></div>
    <div class="ev-feat-body">
      <span class="ev-badge b-coral">⭐ 이번 주 주목 행사</span>
      <div class="ev-feat-title">${esc(cleanTitle(hero.title))}</div>
      <div class="ev-feat-meta">
        <span>📅 ${esc(dateRange(hero))}</span>
        <span>📍 ${place}</span>
        <span>${hero.price === '무료' ? '🆓 무료' : '🎟 ' + (hero.price || '예매는 울주문화재단 누리집')}</span>
      </div>
    </div>
  </a>`);
}

// 4. 이번 주 기관별 행사
const weekLabel = `${koDate(monday).replace(/\(.\)$/, '(월)')} ~ ${koDate(sunday)}`;
html = replaceSection(html, 'EVENTS_HEADING', `    <h2 class="sec-title">${weekLabel} — 기관별 행사</h2>`);
let blocks = '';
for (const o of ORGS) { const evs = thisWeek.filter(e => e.org === o.name); if (evs.length) blocks += orgBlock(o.icon, o.name, o.url, evs); }
const others = thisWeek.filter(e => !e.org);
if (others.length) blocks += orgBlock('🎪', '그 밖의 울주 행사', `${UCF}/culturearts/pe_list.html`, others);
if (!thisWeek.length) blocks += '\n    <p style="color:var(--gray-400);padding:12px;">이번 주 울주문화재단 공연·전시가 없습니다. 아래 다음 주 예고를 확인하세요.</p>';
blocks += staticBlocks(section(html, 'ORG_LIST'));
html = replaceSection(html, 'ORG_LIST', `  <div class="org-list">\n${blocks}\n  </div>`);

// 5. 다음 주 예고
html = replaceSection(html, 'NEXTWEEK_HEADING', `    <h2 class="sec-title" style="color:var(--gray-700);">${nxtMon.getUTCMonth() + 1}월 ${nxtMon.getUTCDate()}일 ~ ${nxtSun.getUTCMonth() + 1}월 ${nxtSun.getUTCDate()}일 주요 일정</h2>`);
const nw = nextWeek.slice(0, 4).map(nwCard).join('\n') || '    <p style="color:var(--gray-400); padding:12px;">다음 주 일정은 울주문화재단 누리집(ucf.or.kr)에서 확인하세요.</p>';
html = replaceSection(html, 'NEXTWEEK_CARDS', `  <div class="nw-grid">\n${nw}\n  </div>`);

// 6. 지난 호 목록: 이번 호를 맨 위에 두고, 원래 '현재호'였던 줄은 지난 호로 바꾼다
{
  const old = section(html, 'ARCHIVE') || '';
  const items = [...old.matchAll(/<a class="archive-item"[\s\S]*?<\/a>/g)].map(m => m[0]);
  const past = items.map(it => it.includes('archive-badge current')
    ? it.replace('href="#" style="pointer-events:none; opacity:.55;"', 'href="#" style="opacity:.6;pointer-events:none;"')
      .replace('archive-badge current"', 'archive-badge" style="background:#e0e0e0;color:#555;"')
      .replace(/ — 현재 보고 계신 페이지/, '').replace('◀ 현재호', '발행 종료')
    : it);
  if (oldNum && oldMon && oldMon !== ymd(monday) && !past.some(it => it.includes(`제${oldNum}호`))) {
    const [y, m, d] = oldMon.split('-').map(Number);
    const oldHero = text(section(fs.readFileSync(INDEX, 'utf8'), 'HERO') || '').replace(/^⭐ 이번 주 주목\s*/, '').split(' 📅')[0];
    past.unshift(`<a class="archive-item" href="#" style="opacity:.6;pointer-events:none;">
      <span class="archive-badge" style="background:#e0e0e0;color:#555;">제${oldNum}호</span>
      <div class="archive-info">
        <div class="archive-info-date">${y}년 ${m}월 ${d}일 (제${oldNum}호)</div>
        <div class="archive-info-title">${esc(oldHero.slice(0, 60))}</div>
      </div>
      <span class="archive-arrow">발행 종료</span>
    </a>`);
  }
  const cur = `<a class="archive-item" href="#" style="pointer-events:none; opacity:.55;">
      <span class="archive-badge current">제${num}호</span>
      <div class="archive-info">
        <div class="archive-info-date">${pubKo} (제${num}호)</div>
        <div class="archive-info-title">${esc(thisWeek.slice(0, 3).map(e => cleanTitle(e.title)).join(' · ') || '이번 주 울주 문화·예술·체육 소식')} — 현재 보고 계신 페이지</div>
      </div>
      <span class="archive-arrow">◀ 현재호</span>
    </a>`;
  const list = oldMon === ymd(monday) ? [cur, ...past.filter(it => !it.includes(`제${num}호`))] : [cur, ...past];
  html = replaceSection(html, 'ARCHIVE', `  <div class="archive-list">\n    ${list.join('\n    ')}\n  </div>`);
}

// 7. 서울주문화센터 칸(예전 scrape_wucc.py 가 하던 일)
{
  const wucc = events.filter(e => e.org === '서울주문화센터' && e.end >= monday).sort((a, b) => a.start - b.start).slice(0, 7);
  const body = section(html, 'WUCC');
  if (body !== null) {
    const cards = wucc.length ? wucc.map(ev => orgEventHtml(ev)).join('') : '\n        <p style="color:var(--gray-400);text-align:center;padding:20px 0;">현재 등록된 행사가 없습니다.</p>';
    let nb = body.replace(/자동 업데이트 · \d{4}년 \d{2}월 \d{2}일 기준/, `자동 업데이트 · ${ymd(today).replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년 $2월 $3일')} 기준`);
    nb = nb.replace(/(<div class="org-events">)[\s\S]*?(\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*<\/section>)/, `$1${cards}$2`);
    html = html.replace(body, nb);
  }
}

// 8. 월별 캘린더(자바스크립트 데이터)
{
  const mk = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const mainMonth = mk(thursday);
  const nextM = mk(addDays(new Date(Date.UTC(thursday.getUTCFullYear(), thursday.getUTCMonth(), 1)), 32));
  const months = [...new Set([mk(monday), mainMonth, nextM])];
  const a = html.indexOf('// ── 캘린더 월 목록 ──');
  const b = html.indexOf('function renderCal(', a);
  if (a > 0 && b > a) {
    html = html.slice(0, a) + calendarJs(events, months, months.indexOf(mainMonth)) + html.slice(b);
    const [cy, cm] = mainMonth.split('-').map(Number);
    html = html.replace(/(<h2 class="sec-title" id="cal-title">)[^<]*(<\/h2>)/, `$1${cy}년 ${cm}월 행사 캘린더$2`);
  } else console.error('  [경고] 캘린더 스크립트를 못 찾음 — 건너뜀');
}

// 9. 체육 칸의 지난 달 강습 안내 문구
html = html.replace(/🗓 \d{4}년 \d{1,2}월 강습[^<]*/g, `🗓 ${today.getUTCFullYear()}년 ${today.getUTCMonth() + 1}월 강습 — CRS에서 모집·운영 일정 확인`);

if (opt('--dry')) { console.log('(--dry: 파일을 쓰지 않음)'); process.exit(0); }
fs.writeFileSync(INDEX, html, 'utf8');
console.log(`✅ index.html 발행 — 제${num}호 (${pubKo})`);

if (opt('--push')) {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: 'inherit' });
  git('add', 'index.html');
  try { execFileSync('git', ['diff', '--staged', '--quiet'], { cwd: ROOT }); console.log('바뀐 것 없음'); process.exit(0); } catch { /* 바뀐 것 있음 */ }
  git('commit', '-m', `소식지 자동 발행 — ${pubKo} (제${num}호)`);
  git('pull', '--rebase');
  git('push');
}
