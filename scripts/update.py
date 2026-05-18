#!/usr/bin/env python3
# -*- coding: utf-8 -*-
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


ULJUSC_BASE = "https://www.uljusiseol.or.kr/uljusc"
ULJUSC_NOTICE = f"{ULJUSC_BASE}/community/notice"


def get_uljusc_sports_notice(monday):
    """울주종합체육센터 공지사항에서 이번 달 프로그램 모집 공고 파싱"""
    month_str_ko = f"{monday.year}년 {monday.month}월"
    month_str    = f"{monday.year}년 {monday.month}"
    html = fetch(ULJUSC_NOTICE)
    if not html:
        return None

    # 공지 목록에서 이번 달 회원모집 공고 찾기
    notice_pat = re.compile(
        r'href="(/uljusc/community/notice\?prc=view&n=(\d+)[^"]*)"[^>]*>\s*\[?울주종합체육센터\]?\s*'
        r'(' + re.escape(month_str) + r'[^<]*회원모집[^<]*)<',
        re.DOTALL
    )
    m = notice_pat.search(html)
    if not m:
        # 숫자 기반 fallback: 목록에서 가장 최근 회원모집 찾기
        items = re.findall(
            r'href="(/uljusc/community/notice\?prc=view&n=(\d+)[^"]*)"[^>]*>\s*\[?울주종합체육센터\]?\s*(\d{4}년 \d+월 프로그램 회원모집[^<]*)',
            html, re.DOTALL
        )
        if not items:
            print("  [울주종합체육센터] 이번 달 모집 공고를 찾지 못했습니다", file=sys.stderr)
            return None
        # 가장 최근 것 선택
        m_path, m_n, m_title = items[0]
    else:
        m_path, m_n, m_title = m.group(1), m.group(2), m.group(3)

    # 공고 상세 페이지 파싱
    detail_url = f"https://www.uljusiseol.or.kr{m_path}"
    detail = fetch(detail_url)
    if not detail:
        return None

    detail_text = strip_html(detail)

    result = {
        "title": m_title.strip(),
        "url": detail_url,
        "period": "",
        "closed_days": "",
        "special": [],
        "extra_reg": "",
    }

    # 이용기간
    per = re.search(r'이용기간\s*[:：]?\s*(\d{4}\.\s*\d+\.\s*\d+[^\n]{0,40})', detail_text)
    if per:
        result["period"] = per.group(1).strip()

    # 휴관일
    closed = re.search(r'휴관일\s*[:：]?\s*([^\n]{5,60})', detail_text)
    if closed:
        result["closed_days"] = closed.group(1).strip()

    # 특이사항 (공휴일/휴강 관련)
    for pat in [r'공휴일\s*[:：]?\s*([^\n]{10,120})', r'※\s*([\d/]+\([^)]+\)[^。\n]{5,100})']:
        for sp in re.findall(pat, detail_text):
            sp = sp.strip()
            if sp and len(sp) > 10:
                result["special"].append(sp)

    # 추가신청 기간
    extra = re.search(r'추가신청\s*[:：]?\s*([^\n]{10,80})', detail_text)
    if extra:
        result["extra_reg"] = extra.group(1).strip()

    print(f"  [울주종합체육센터] 공고 파싱 완료: {result['title']}", file=sys.stderr)
    return result


def sports_section_html(uljusc_info, monday):
    """체육 소식 섹션 HTML 생성"""
    this_month = f"{monday.month}월"
    this_year  = monday.year

    items = []

    # 울주종합체육센터 — 이번 달 공고 기반
    if uljusc_info:
        period_txt  = f"이용기간: {uljusc_info['period']}" if uljusc_info["period"] else ""
        closed_txt  = f"휴관일: {uljusc_info['closed_days']}" if uljusc_info["closed_days"] else ""
        special_txt = ""
        if uljusc_info["special"]:
            special_txt = " / ".join(uljusc_info["special"][:2])
        extra_txt   = f"추가신청: {uljusc_info['extra_reg']}" if uljusc_info["extra_reg"] else ""

        desc_parts = [p for p in [period_txt, closed_txt, special_txt, extra_txt] if p]
        desc = " · ".join(desc_parts) if desc_parts else "홈페이지에서 강좌별 일정을 확인하세요."

        items.append(f"""    <li class="ni">
      <span class="ni-cat b-blue-o">체육</span>
      <div>
        <h4>울주종합체육센터 {this_year}년 {this_month} 프로그램 안내</h4>
        <p>{desc}<br>수영강습·아쿠아로빅·배드민턴·탁구·볼링·스쿼시 등 강좌 운영 중. ☎ 신청 052-229-9506~7 / 강좌 052-229-9511~14</p>
        <a class="ni-link" href="https://crs.uljusiseol.or.kr/index" target="_blank" rel="noopener">CRS 온라인 신청 →</a>
      </div>
    </li>""")
    else:
        items.append(f"""    <li class="ni">
      <span class="ni-cat b-blue-o">체육</span>
      <div>
        <h4>울주종합체육센터 {this_year}년 {this_month} 강좌 운영</h4>
        <p>수영강습·아쿠아로빅·배드민턴·탁구·볼링·스쿼시 등 강좌를 운영합니다. ☎ 052-229-9500<br>강좌 신청은 울주군시설관리공단 CRS 온라인 시스템에서 가능합니다.</p>
        <a class="ni-link" href="https://crs.uljusiseol.or.kr/index" target="_blank" rel="noopener">CRS 온라인 신청 →</a>
      </div>
    </li>""")

    # 울주군국민체육센터 고정 항목
    items.append(f"""    <li class="ni">
      <span class="ni-cat b-blue-o">체육</span>
      <div>
        <h4>울주군국민체육센터 {this_year}년 {this_month} 강좌</h4>
        <p>수영·헬스·에어로빅·요가 등 강좌를 운영합니다. 언양읍 주민 할인 혜택 적용. ☎ 052-229-9000</p>
        <a class="ni-link" href="https://crs.uljusiseol.or.kr/index" target="_blank" rel="noopener">강좌 등록 (CRS)</a>
      </div>
    </li>""")

    # 소식 제보 고정 항목
    items.append("""    <li class="ni">
      <span class="ni-cat b-teal-o">안내</span>
      <div>
        <h4>언양 지역 동호회·체육 소식을 제보해 주세요</h4>
        <p>언양읍 내 축구·배드민턴·탁구·수영·등산 등 동호회나 생활체육 행사 정보를 아래 신청서를 통해 보내주시면 다음 호에 소개해 드립니다.</p>
        <a class="ni-link" href="https://forms.gle/XQPUVqfKiuCUV3dT9" target="_blank" rel="noopener">체육 소식 제보하기</a>
      </div>
    </li>""")

    return "\n".join(items)


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

    # ── 울주종합체육센터 공지 수집 ──
    print("울주종합체육센터 공지 수집 중...")
    uljusc_info = get_uljusc_sports_notice(monday)

    # ── 이벤�
