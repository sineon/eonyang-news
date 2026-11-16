const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[c]);

export function issueArchivePath(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`잘못된 소식지 날짜: ${date}`);
  return `archive/${date}.html`;
}

export function issueListItem({ num, date, title, current = false }) {
  const [y, m, d] = date.split('-').map(Number);
  const badge = num === 1 ? '창간호' : `제${num}호`;
  const tag = current ? 'div' : 'a';
  const attributes = current ? ' aria-current="page"' : ` href="./${issueArchivePath(date)}"`;
  return `<${tag} class="archive-item"${attributes}>
      <span class="archive-badge${current ? ' current' : ''}">${badge}</span>
      <div class="archive-info">
        <div class="archive-info-date">${y}년 ${m}월 ${d}일 (${badge})</div>
        <div class="archive-info-title">${esc(title)}</div>
      </div>
      <span class="archive-arrow">${current ? '현재호' : '읽기 →'}</span>
    </${tag}>`;
}

export function snapshotIssue(html, date, num) {
  issueArchivePath(date);
  if (!/<body\b[^>]*>/i.test(html) || !/<\/html>/i.test(html)) throw new Error(`완전한 발행본이 아닙니다: ${date}`);
  const [y, m, d] = date.split('-').map(Number);
  const badge = num === 1 ? '창간호' : `제${num}호`;
  const banner = `<aside aria-label="발행본 보관 안내" style="background:#e4f4f2;color:#16483e;padding:12px 16px;text-align:center;line-height:1.6;overflow-wrap:anywhere">
  <strong>보관본 · ${y}년 ${m}월 ${d}일 ${badge}</strong> · 발행 당시의 글입니다. 행사나 접수는 끝났을 수 있습니다.<br>
  <a href="../#issue-archive" style="color:inherit;font-weight:700;text-decoration:underline">← 이전 소식지 목록</a> &nbsp; <a href="../" style="color:inherit;font-weight:700;text-decoration:underline">최신 소식지</a>
</aside>`;
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>언양 소식지 ${badge} 보관본 — ${y}년 ${m}월 ${d}일</title>`)
    .replace(/<body\b[^>]*>/i, tag => `${tag}\n${banner}`)
    .replace(/<script\b[^>]*src="\.\/assets\/js\/exhibition[^"\s]*\.js"[^>]*>\s*<\/script>\s*/gi, '')
    .replace(/<div class="exhibition-tools">[\s\S]*?<\/div>\s*/i, '')
    .replace(/((?:href|src)=["'])\.\/assets\//gi, '$1../assets/')
    .replace(/<!-- ARCHIVE_START -->[\s\S]*?<!-- ARCHIVE_END -->/, '<p><a href="../#issue-archive">다른 발행본 읽기 →</a></p>');
}
