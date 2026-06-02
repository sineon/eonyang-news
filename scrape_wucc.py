#!/usr/bin/env python3
"""
서울주문화센터 행사 스크래퍼 + index.html 자동 업데이트
GitHub Actions에서 매주 월요일 자동 실행
"""
import urllib.request, ssl, re, json, base64, os, datetime

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = 'https://www.ucf.or.kr:478'
LIST_URL = f'{BASE_URL}/culturearts/pe_list.html'
GH_API   = 'https://api.github.com/repos/sineon/eonyang-news/contents/index.html'

BADGE_COLOR = {
    '공연': ('coral', '공연'), '전시': ('teal', '전시'),
    '영화': ('blue',  '영화'), '강좌': ('green', '강좌'),
}

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
        return r.read().decode('utf-8', errors='replace')

def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s).strip()

def scrape_wucc():
    html = fetch(LIST_URL)
    items = re.findall(r'<li>(.*?)</li>', html, re.DOTALL)
    events = []
    for item in items:
        if '서울주문화센터' not in item:
            continue
        title_m = re.search(r'<h5[^>]*>.*?<a[^>]*>(.*?)</a>', item, re.DOTALL)
        if not title_m:
            continue
        title = strip_tags(title_m.group(1)).replace('[기획공연] ', '').replace('[기획전시] ', '')
        if not title:
            continue
        dates  = re.findall(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일', item)
        time_m = re.search(r'(\d{1,2}:\d{2})', item)
        place_m = re.search(r'서울주문화센터[^\s<&]*(?:\s*(?:&nbsp;)?\s*\[[^\]]+\])?', item)
        href_m = re.search(r'href="(pe_detail\.html[^"]+)"', item)
        img_m  = re.search(r'src="(https://ucf\.moonhwain\.net[^"]+\.jpg)"', item)

        if len(dates) >= 2:
            d1, d2 = dates[0], dates[-1]
            date_str = f"{int(d1[1])}/{int(d1[2])}~{int(d2[1])}/{int(d2[2])}"
        elif dates:
            d = dates[0]
            date_str = f"{int(d[1])}/{int(d[2])}"
        else:
            continue

        # 배지
        badge_color, badge_label = 'coral', '공연'
        for kw, (c, l) in BADGE_COLOR.items():
            if kw in item:
                badge_color, badge_label = c, l
                break

        link = f'{BASE_URL}/culturearts/{href_m.group(1)}' if href_m else LIST_URL

        events.append({
            'title':  title[:45],
            'date':   date_str,
            'time':   time_m.group(1) if time_m else '',
            'place':  re.sub(r'&nbsp;|\s+', ' ', place_m.group(0)).strip() if place_m else '서울주문화센터',
            'badge':  badge_color,
            'blabel': badge_label,
            'link':   link,
            'img':    img_m.group(1) if img_m else '',
        })
    return events[:7]

def make_section(events):
    today = datetime.date.today().strftime('%Y년 %m월 %d일')
    if not events:
        cards_html = '<p style="color:var(--gray-400);text-align:center;padding:20px 0;">현재 등록된 행사가 없습니다.</p>'
    else:
        cards_html = ''
        for ev in events:
            time_part = f'<br>{ev["time"]}' if ev['time'] else ''
            cards_html += f'''
        <a class="org-ev" href="{ev['link']}" target="_blank" rel="noopener">
          <div class="org-ev-left">
            <div class="org-ev-badge {ev['badge']}">{ev['blabel']}</div>
            <div class="org-ev-date">{ev['date']}{time_part}</div>
          </div>
          <div class="org-ev-right">
            <div class="org-ev-title">{ev['title']}</div>
            <div class="org-ev-meta">📍 {ev['place']}</div>
          </div>
        </a>'''

    return f'''<!-- WUCC_START -->
<section class="sec" style="background:linear-gradient(135deg,#eaf6f8 0%,#f0fafa 100%);border-top:3px solid #2196a8;">
  <div class="sec-head">
    <div class="sec-row">
      <div>
        <div class="sec-label" style="background:#2196a8;color:#fff;">🏢 서울주문화센터</div>
        <h2 class="sec-title" style="color:#1a6b7a;">서울주문화센터 이달의 공연·전시</h2>
        <p style="font-size:12px;color:var(--gray-400);margin-top:2px;">자동 업데이트 · {today} 기준</p>
      </div>
      <a class="sec-more" href="{BASE_URL}/wucc/index.html" target="_blank" rel="noopener">전체보기 →</a>
    </div>
  </div>
  <div class="org-list">
    <div class="org-block" style="border-left:4px solid #2196a8;">
      <div class="org-header">
        <span class="org-icon">🎭</span>
        <span class="org-name">서울주문화센터</span>
        <a class="org-site-link" href="{BASE_URL}/wucc/index.html" target="_blank" rel="noopener">사이트 →</a>
      </div>
      <div class="org-events">{cards_html}
      </div>
    </div>
  </div>
</section>
<!-- WUCC_END -->'''

def gh_get(token):
    req = urllib.request.Request(GH_API,
        headers={'Authorization': f'token {token}', 'User-Agent': 'wucc-bot'})
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.load(r)
    return d['sha'], base64.b64decode(d['content']).decode('utf-8')

def gh_put(token, sha, content):
    today = datetime.date.today()
    data = json.dumps({
        'message': f'자동 업데이트: 서울주문화센터 행사 ({today})',
        'content': base64.b64encode(content.encode('utf-8')).decode('ascii'),
        'sha': sha
    }).encode('utf-8')
    req = urllib.request.Request(GH_API, data=data, method='PUT',
        headers={'Authorization': f'token {token}',
                 'Content-Type': 'application/json',
                 'User-Agent': 'wucc-bot'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)['content']['sha']

def patch_html(html, section):
    if '<!-- WUCC_START -->' in html:
        return re.sub(r'<!-- WUCC_START -->.*?<!-- WUCC_END -->', section, html, flags=re.DOTALL)
    marker = '<!-- ════ 섹션 1: 이번 주 행사 ════ -->'
    return html.replace(marker, section + '\n\n' + marker)

if __name__ == '__main__':
    token = os.environ['GH_TOKEN']
    print('🔍 스크래핑 중...')
    events = scrape_wucc()
    print(f'✅ {len(events)}개 행사:')
    for ev in events:
        print(f'   {ev["date"]} {ev["title"]}')
    section = make_section(events)
    print('📥 index.html 다운로드...')
    sha, html = gh_get(token)
    updated = patch_html(html, section)
    print('📤 업로드...')
    new_sha = gh_put(token, sha, updated)
    print(f'🚀 완료! SHA: {new_sha}')
