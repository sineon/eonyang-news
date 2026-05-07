#!/usr/bin/env python3
"""
언양 소식지 자동 업데이트 스크립트
매주 월요일 09:00 KST GitHub Actions에서 자동 실행
출처: ucf.or.kr (울주문화재단)
"""

import re
import sys
import datetime
import urllib.request
import ssl
import os

# ── SSL 설정 (ucf.or.kr 인증서 문제 우회) ──
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

UCF_BASE = "https://www.ucf.or.kr"

# ── 기관 정보 ──
ORGS = [
    {"name": "울주문화예술회관", "icon": "🏛", "url": f"{UCF_BASE}/uljuart/",    "key": "uljuart"},
    {"name": "서울주문화센터",   "icon": "🎭", "url": f"{UCF_BASE}/wucc/",       "key": "wucc"},
    {"name": "온양문화복지센터", "icon": "🎪", "url": f"{UCF_BASE}/onyang/",     "key": "onyang"},
    {"name": "오영수문학관",     "icon": "📚", "url": f"{UCF_BASE}/oys/",        "key": "oys"},
    {"name": "울주생활문화센터", "icon": "🏘", "url": f"{UCF_BASE}/uljulife/",   "key": "uljulife"},
]

ORG_KEYS = {o["name"]: o for o in ORGS}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=20) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  [fetch 실패] {url} → {e}", file=sys.stderr)
        return ""


def strip_html(html):
    html = re.sub(r"<script.*?</script>", " ", html, flags=re.DOTALL)
    html = re.sub(r"<style.*?</style>", " ", html, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()


def parse_date(s):
    m = re.search(r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일", s)
    if m:
        return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def get_all_p_idx():
    html = fetch(f"{UCF_BASE}/culturearts/pe_list.html?pfmIng=1")
    return list(dict.fromkeys(re.findall(r"p_idx=(\d+)", html)))


def get_event(p_idx):
    url = f"{UCF_BASE}/culturearts/pe_detail.html?pfmIng=1&p_idx={p_idx}"
    html = fetch(url)
    if not html:
        return None

    text = strip_html(html)

    # 공연일자
    date_m = re.search(r"공연일자\s*(.*?)(?:공연시간|입장료|공연장소|장르)", text)
    if not date_m:
        return None
    date_str = date_m.group(1)
    all_dates = re.findall(r"\d{4}년\s*\d{1,2}월\s*\d{1,2}일", date_str)
    if not all_dates:
        return None
    start = parse_date(all_dates[0])
    end   = parse_date(all_dates[-1]) if len(all_dates) > 1 else start
    if not start:
        return None

    # 공연시간
    time_m = re.search(r"공연시간\s*(.{1,80}?)(?:공연장소|입장료|장르)", text)
    time_raw = time_m.group(1).strip() if time_m else ""
    time_clean = re.search(r"\d{1,2}:\d{2}", time_raw)
    time_str = time_clean.group(0) if time_clean else time_raw[:30].strip()

    # 공연장소
    venue_m = re.search(r"공연장소\s*(.{1,120}?)(?:지도보기|입장료|러닝타임|입장연령)", text)
    venue_str = venue_m.group(1).strip() if venue_m else ""

    # 입장료
    price_m = re.search(r"입장료\s*(.{1,150}?)(?:입장연령|러닝타임|문의|유의|예매하기|목록)", text)
    price_raw = price_m.group(1).strip() if price_m else ""
    is_free = "무료" in price_raw
    price_str = "무료" if is_free else "유료"

    # 제목 추출
    title = ""
    title_m = re.search(r"\[(?:기획공연|행사|강좌)\]\s*(.+?)\s*장르/테마", text)
    if title_m:
        title = title_m.group(1).strip()
    else:
        # fallback: 기관명 뒤 대괄호 이후
        t2 = re.search(r"\]\s*(.{5,80}?)\s*장르/테마", text)
        if t2:
            title = t2.group(1).strip()

    if not title:
        return None

    # 기관 판별
    org_name = ""
    for org in ORGS:
        if org["name"] in text[:600]:
            org_name = org["name"]
            break

    # 뱃지 색상
    genre_m = re.search(r"장르/테마\s*(\S+)", text)
    genre = genre_m.group(1) if genre_m else ""
    badge_color = "blue"
    if "전시" in genre or "미술" in genre:
        badge_color = "green"
    elif "영화" in genre:
        badge_color = "coral"
    elif "클래식" in genre or "음악" in genre:
        badge_color = "blue"

    badge_label = genre if genre else ("무료" if is_free else "공연")

    return {
        "p_idx": p_idx,
        "title": title,
        "start": start,
        "end": end,
        "time": time_str,
        "venue": venue_str,
        "price": price_str,
        "is_free": is_free,
        "org": org_name,
        "badge": badge_label,
        "badge_color": badge_color,
        "url": url,
    }


def week_range(monday):
    sunday = monday + datetime.timedelta(days=6)
    return monday, sunday


def event_overlaps(ev, mon, sun):
    return ev["start"] <= sun and ev["end"] >= mon


def date_label(d, is_end=False):
    dows = ["월", "화", "수", "목", "금", "토", "일"]
    return f"{d.month}/{d.day} {dows[d.weekday()]}"


def org_html(org_info, events_this_week):
    """기관 블록 HTML 생성"""
    evs = [e for e in events_this_week if e["org"] == org_info["name"]]
    html = f"""
    <div class="org-block">
      <div class="org-header">
        <span class="org-icon">{org_info['icon']}</span>
        <span class="org-name">{org_info['name']}</span>
        <a class="org-site-link" href="{org_info['url']}" target="_blank" rel="noopener">사이트 →</a>
      </div>"""
    if evs:
        html += '\n      <div class="org-events">'
        for e in evs:
            d_label = date_label(e["start"])
            if e["start"] != e["end"]:
                d_label += f"~{date_label(e['end'])}"
            time_part = f"<br>{e['time']}" if e["time"] else ""
            html += f"""
        <a class="org-ev" href="{e['url']}" target="_blank" rel="noopener">
          <div class="org-ev-left">
            <div class="org-ev-badge {e['badge_color']}">{e['badge']}</div>
            <div class="org-ev-date">{d_label}{time_part}</div>
          </div>
          <div class="org-ev-right">
            <div class="org-ev-title">{e['title']}</div>
            <div class="org-ev-meta">{e['venue'][:40] if e['venue'] else ''} · {e['price']}</div>
          </div>
        </a>"""
        html += "\n      </div>"
    else:
        html += '\n      <p class="org-empty">이번 주 별도 행사 없음</p>'
    html += "\n    </div>"
    return html


def nw_card_html(ev):
    d_label = date_label(ev["start"])
    if ev["start"] != ev["end"] and ev["end"] - ev["start"] <= datetime.timedelta(days=6):
        d_label += f" ~ {date_label(ev['end'])}"
    time_part = f" {ev['time']}" if ev["time"] else ""
    badge_cls = f"b-{ev['badge_color']}-o"
    return f"""    <a class="nw-card" href="{ev['url']}" target="_blank" rel="noopener">
      <div class="nw-badge {badge_cls}">{ev['badge']}</div>
      <div class="nw-date">{d_label}{time_part}</div>
      <div class="nw-title">{ev['title']}</div>
      <div class="nw-desc">📍 {ev['venue'][:50] if ev['venue'] else ev['org']} · {ev['price']}</div>
    </a>"""


def replace_section(html, marker, new_content):
    pattern = rf"<!--\s*{marker}_START\s*-->.*?<!--\s*{marker}_END\s*-->"
    replacement = f"<!-- {marker}_START -->\n{new_content}\n<!-- {marker}_END -->"
    result, n = re.subn(pattern, replacement, html, flags=re.DOTALL)
    if n == 0:
        print(f"  [경고] {marker} 마커를 찾지 못했습니다", file=sys.stderr)
    return result


def main():
    # ── 날짜 계산 ──
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())
    sunday = monday + datetime.timedelta(days=6)
    nxt_mon = monday + datetime.timedelta(days=7)
    nxt_sun = monday + datetime.timedelta(days=13)

    print(f"이번 주: {monday} ~ {sunday}")
    print(f"다음 주: {nxt_mon} ~ {nxt_sun}")

    # ── 이벤트 수집 ──
    print("ucf.or.kr 행사 목록 수집 중...")
    ids = get_all_p_idx()
    print(f"  p_idx {len(ids)}개 발견: {ids[:10]}...")

    all_events = []
    for pid in ids:
        ev = get_event(pid)
        if ev:
            print(f"  ✓ [{pid}] {ev['title'][:30]} | {ev['start']}~{ev['end']} | {ev['org']}")
            all_events.append(ev)
        else:
            print(f"  - [{pid}] 파싱 실패", file=sys.stderr)

    this_week = [e for e in all_events if event_overlaps(e, monday, sunday)]
    next_week = [e for e in all_events if event_overlaps(e, nxt_mon, nxt_sun)]

    print(f"\n이번 주 행사 {len(this_week)}개, 다음 주 행사 {len(next_week)}개")

    # ── index.html 읽기 ──
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()

    # ── 이번 주 호수 계산 ──
    # 창간: 2026-04-27 = 제1호
    launch = datetime.date(2026, 4, 27)
    issue_num = ((monday - launch).days // 7) + 1
    pub_date = f"{monday.year}년 {monday.month}월 {monday.day}일 (월)"
    week_label = f"{monday.month}월 {monday.day}일(월) ~ {sunday.month}월 {sunday.day}일(일)"
    nxt_label  = f"{nxt_mon.month}월 {nxt_mon.day}일(월) ~ {nxt_sun.month}월 {nxt_sun.day}일(일)"

    # ── 섹션 교체 ──

    # 1. 헤더 날짜/호수
    issue_html = f'    <div class="header-date">{pub_date}</div>\n    <span class="header-issue">제{issue_num}호</span>'
    html = replace_section(html, "ISSUE", issue_html)

    # 2. 티커
    ticker_events = [e["title"][:20] for e in this_week[:4]]
    ticker_txt = " &nbsp;·&nbsp; ".join(ticker_events) if ticker_events else f"이번 주 행사 {week_label}"
    html = replace_section(html, "TICKER", f"  {ticker_txt}")

    # 3. 히어로 (대표 행사 — 이번 주 첫 번째 무료 행사 또는 첫 행사)
    hero_ev = next((e for e in this_week if e["is_free"]), this_week[0] if this_week else None)
    if hero_ev:
        hero_html = f"""    <span class="hero-badge">⭐ 이번 주 주목</span>
    <div class="hero-title">{hero_ev['title']}</div>
    <div class="hero-meta">
      <span>📅 {date_label(hero_ev['start'])}</span>
      <span>📍 {hero_ev['venue'][:40] if hero_ev['venue'] else hero_ev['org']}</span>
      <span>🎟 {hero_ev['price']}</span>
    </div>"""
        html = replace_section(html, "HERO", hero_html)

    # 4. 이번 주 제목
    heading_html = f'    <h2 class="sec-title">{week_label} — 기관별 행사</h2>'
    html = replace_section(html, "EVENTS_HEADING", heading_html)

    # 5. Featured 이벤트
    featured = hero_ev
    if featured:
        feat_html = f"""  <a class="ev-feat" href="{featured['url']}" target="_blank" rel="noopener" style="background:linear-gradient(135deg,#071624 0%,#0d2a40 45%,#0a1e14 100%);">
    <div class="ev-feat-overlay"></div>
    <div class="ev-feat-body">
      <span class="ev-badge b-coral">⭐ 이번 주 주목 행사</span>
      <div class="ev-feat-title">{featured['title']}</div>
      <div class="ev-feat-meta">
        <span>📅 {date_label(featured['start'])}{' ~ ' + date_label(featured['end']) if featured['start'] != featured['end'] else ''}</span>
        <span>📍 {featured['venue'][:40] if featured['venue'] else featured['org']}</span>
        <span>🆓 {featured['price']}</span>
      </div>
    </div>
  </a>"""
        html = replace_section(html, "FEATURED", feat_html)

    # 6. 기관별 행사 목록
    org_blocks = "\n".join(org_html(o, this_week) for o in ORGS)
    # 울주종합체육센터: ucf.or.kr 스크래핑 대상이 아니므로 정적 블록 추가
    uljusc_block = """
    <div class="org-block">
      <div class="org-header">
        <span class="org-icon">🏊</span>
        <span class="org-name">울주종합체육센터</span>
        <a class="org-site-link" href="https://www.uljusiseol.or.kr/uljusc/index_main" target="_blank" rel="noopener">사이트 →</a>
      </div>
      <p class="org-empty">수영·볼링·스쿼시·배드민턴·탁구 강좌 상시 운영 — <a href="https://crs.uljusiseol.or.kr/index" target="_blank" style="color:#0b7a70;">CRS 예약 시스템</a>에서 신청 (☎ 052-229-9500)</p>
    </div>"""
    org_list_html = f'  <div class="org-list">\n{org_blocks}\n{uljusc_block}\n  </div>'
    html = replace_section(html, "ORG_LIST", org_list_html)

    # 7. 다음 주 예고 제목
    nw_heading = f'    <h2 class="sec-title" style="color:var(--gray-700);">{nxt_label} 주요 일정</h2>'
    html = replace_section(html, "NEXTWEEK_HEADING", nw_heading)

    # 8. 다음 주 카드
    nw_cards = "\n".join(nw_card_html(e) for e in next_week[:4]) if next_week else \
        '    <p style="color:var(--gray-400); padding:12px;">다음 주 일정을 ucf.or.kr에서 확인 중입니다.</p>'
    nw_html = f'  <div class="nw-grid">\n{nw_cards}\n  </div>'
    html = replace_section(html, "NEXTWEEK_CARDS", nw_html)

    # 9. 아카이브 (현재 호 + 이전 호 한 개)
    prev_num = issue_num - 1
    prev_mon = monday - datetime.timedelta(days=7)
    prev_slug = prev_mon.strftime("%Y-%m-%d")
    archive_html = f"""  <div class="archive-list">
    <a class="archive-item" href="#" style="pointer-events:none; opacity:.55;">
      <span class="archive-badge current">제{issue_num}호</span>
      <div class="archive-info">
        <div class="archive-info-date">{monday.year}년 {monday.month}월 {monday.day}일 (제{issue_num}호)</div>
        <div class="archive-info-title">현재 보고 계신 페이지입니다</div>
      </div>
      <span class="archive-arrow">◀ 현재호</span>
    </a>
    <a class="archive-item" href="https://sineon.github.io/eonyang-news/archive/{prev_slug}.html" target="_blank" rel="noopener" style="opacity:.75;">
      <span class="archive-badge" style="background:#e0e0e0;color:#555;">제{prev_num}호</span>
      <div class="archive-info">
        <div class="archive-info-date">{prev_mon.year}년 {prev_mon.month}월 {prev_mon.d