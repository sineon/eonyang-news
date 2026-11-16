import fs from 'node:fs';

const dataFile = new URL('./heritage-issues.json', import.meta.url);
const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/;

const esc = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const monthKey = date => date.toISOString().slice(0, 7);
const monthLabel = key => `${key.slice(0, 4)}년 ${Number(key.slice(5, 7))}월`;
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;

function readFeatures() {
  const { previous, issues } = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const dated = Object.entries(issues);
  for (const [month] of dated) {
    if (!validMonth.test(month)) throw new Error(`잘못된 문화유산 발행월: ${month}`);
  }
  const check = (entries, kind) => {
    const seen = new Set();
    for (const id of entries) {
      if (!id || seen.has(id)) throw new Error(`${kind} 식별자가 없거나 중복됨: ${id}`);
      seen.add(id);
    }
  };
  check([...previous.heritage.map(x => x.id), ...dated.map(([,x]) => x.heritageId)], '문화유산');
  check([...previous.people.map(x => x.id), ...dated.map(([,x]) => x.personId)], '인물');
  return { previous, dated };
}

function renderArchive(previous, older) {
  const heritage = [...previous.heritage, ...older.map(([date, {title, cards}]) => ({date, title, cards}))];
  const people = [...previous.people, ...older.map(([date, {person}]) => ({date, ...person}))];
  const renderList = (entries, renderBody) => entries.sort((a,b) => b.date.localeCompare(a.date)).map(entry =>
    `      <details class="history-entry">
        <summary><span>${esc(entry.title)}</span><small>${esc(entry.label ?? monthLabel(entry.date))}</small></summary>
        <div class="history-entry-body">${renderBody(entry)}</div>
      </details>`).join('\n');
  const heritageBody = entry => entry.cards.map(card =>
    `<p><strong>${esc(card.title)}</strong><br>${esc(card.intro)}<br>${link(card.url, card.source)}</p>`).join('\n');
  const personBody = p => `<p><strong>${esc(p.era)}</strong><br>${esc(p.intro)} ${esc(p.tip)}<br>${link(p.url, p.source)}${p.visit ? `<br>${link(p.visit, p.visitLabel)}` : ''}</p>`;
  return `<section class="sec" id="heritage-archive" aria-labelledby="heritage-archive-title">
  <div class="sec-head">
    <div class="sec-kicker">지난 이야기</div>
    <h2 class="sec-title" id="heritage-archive-title">문화유산과 인물 다시 읽기</h2>
    <p class="arts-source">제목을 누르면 이 화면에서 지난 글을 읽을 수 있습니다.</p>
  </div>
  <div class="history-catalog">
    <div>
      <h3>지난 문화유산</h3>
${renderList(heritage, heritageBody)}
    </div>
    <div>
      <h3>지난 인물</h3>
${renderList(people, personBody)}
    </div>
  </div>
</section>`;
}

function heritageSections(issueDate) {
  const key = monthKey(issueDate);
  const { previous, dated } = readFeatures();
  const record = dated.find(([date]) => date === key);
  if (!record) return null;
  const [, { place, title, cards, person }] = record;
  const archive = renderArchive(previous, dated.filter(([date]) => date < key));
  const cardMarkup = cards.map((card, i) => `    <a class="hc${i % 2 ? ' rev' : ''}" href="${esc(card.url)}" target="_blank" rel="noopener">
      <div class="hc-img">
        <div class="hc-icon" aria-hidden="true">${esc(card.icon)}</div>
        <span class="hc-grade">${esc(card.tag)}</span>
      </div>
      <div class="hc-body">
        <div class="hc-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</div>
        <div class="hc-name">${esc(card.title)}</div>
        <div class="hc-desc">${esc(card.intro)}</div>
        <span class="hc-link">${esc(card.source)}</span>
      </div>
    </a>`).join('\n\n');
  const tagStyles = ['b-teal', 'b-blue-o', 'b-coral-o'];
  return {
    HERITAGE_ARCHIVE: archive,
    HERITAGE_TITLE: `    <h2 class="sec-title">${esc(title)}</h2>
    <p style="font-size:12px;color:var(--text-secondary, #526169);margin-top:4px;">${monthLabel(key)} 울주 이야기 · ${esc(place)}</p>`,
    HERITAGE_CARDS: `  <div class="hc-list">\n${cardMarkup}\n  </div>`,
    PERSON_TITLE: `      <h2 class="sec-title" style="font-size:19px;">${esc(person.title)}</h2>`,
    PERSON_CARD: `    <div class="person-card">
      <div class="person-left">
        <div class="person-emoji" aria-hidden="true">${esc(person.icon)}</div>
        <div class="person-name">${esc(person.name)}</div>
        <div class="person-era">${esc(person.era)}</div>
      </div>
      <div class="person-right">
        <div class="person-tags">
${person.tags.map((tag, i) => `          <span class="p-tag ${tagStyles[i]}">${esc(tag)}</span>`).join('\n')}
        </div>
        <div class="person-desc">${esc(person.intro)} <strong>${esc(person.tip)}</strong></div>
        <a class="person-more" href="${esc(person.url)}" target="_blank" rel="noopener">${esc(person.source)}</a>${person.visit ? `
        <br><a class="person-more" href="${esc(person.visit)}" target="_blank" rel="noopener">${esc(person.visitLabel)}</a>` : ''}
      </div>
    </div>`,
  };
}

// 원고가 없는 달에는 지난 글을 새 글처럼 다시 발행하지 않는다.
export function refreshHeritage(html, issueDate) {
  const sections = heritageSections(issueDate);
  if (!sections) return null;
  for (const [key, body] of Object.entries(sections)) {
    const marker = new RegExp(`(<!-- ${key}_START -->)[\\s\\S]*?(<!-- ${key}_END -->)`, 'g');
    if ([...html.matchAll(marker)].length !== 1) throw new Error(`문화유산 발행 구간을 하나만 남겨 주세요: ${key}`);
    html = html.replace(marker, (_, begin, end) => `${begin}\n${body}\n${end}`);
  }
  return html;
}
