// 2026년 11월부터 아래 순서대로 한 달에 한 편씩 소개한다.
// 새 소재는 목록 끝에 추가하고, 설명과 방문 안내의 출처를 함께 남긴다.
const firstMonth = 2026 * 12 + 10;
const encyclopedia = 'https://encykorea.aks.ac.kr/Article/';
const eonyangFortress = 'https://digital.khs.go.kr/heri/heriDetail.do?ctptNo=1332601530000&ctptUid=13898859674910300774';
const chisanAcademy = `${encyclopedia}E0077094`;
const seosaengFortress = 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?VdkVgwKey=31%2C00080000%2C26&pageNo=1_1_1_1';

const features = [
  {
    place: '언양읍',
    title: '울주 언양읍성 — 평지에 세운 네모난 성',
    cards: [
      {
        icon: '🏯', tag: '조선의 읍성', title: '흙으로 쌓은 성을 돌로 고쳐 쌓다',
        intro: '경주·울산·밀양·양산을 잇는 길목에 있던 언양의 옛 성입니다. 처음에는 흙으로 둘렀지만, 1500년에 현감 이담룡이 성을 넓혀 돌로 다시 쌓았습니다.',
        url: eonyangFortress, source: '국가유산청 · 울주 언양읍성',
      },
      {
        icon: '🔎', tag: '현장에서 볼 것', title: '큰 돌 사이의 작은 돌 찾기',
        intro: '산등성이를 따라가는 산성과 달리 언양읍성은 평지에 네모꼴로 놓였습니다. 남은 성벽을 보며 큰 돌 사이의 빈틈을 잔돌로 채운 자리를 찾아보세요.',
        url: eonyangFortress, source: '국가유산청 · 성벽과 축성 방식',
      },
    ],
    person: {
      icon: '✍️', name: '오영수 (吳永壽)', title: '언양에서 태어난 단편소설가 — 오영수', era: '1909–1979 · 호 난계',
      tags: ['단편소설가', '「갯마을」', '언양 출생'],
      intro: '지금의 울주군 언양읍에서 태어난 오영수는 「갯마을」과 「메아리」 같은 단편에 마을 사람들의 삶과 정을 담았습니다. 1955년에는 문예지 『현대문학』 창간에도 참여했습니다.',
      tip: '오영수문학관은 언양읍 헌양길 280-12에 있습니다.',
      url: `${encyclopedia}E0038421`, source: '한국민족문화대백과사전 · 오영수',
      visit: 'https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=1891225', visitLabel: '울주군 오영수문학관 조례 · 위치',
    },
  },
  {
    place: '두동면',
    title: '치산서원 — 신라 사람을 기린 조선의 서원',
    cards: [
      {
        icon: '🏛️', tag: '울주군 두동면', title: '만화리에 남은 박제상 이야기',
        intro: '치산서원은 울주군 두동면 만화리에 있습니다. 조선 후기에 세워진 이 서원은 신라의 관리 박제상과 그의 가족을 기리는 공간이었습니다.',
        url: chisanAcademy, source: '한국민족문화대백과사전 · 치산서원',
      },
      {
        icon: '🪨', tag: '기록과 전설', title: '망부석에 얽힌 기다림',
        intro: '박제상 유적에는 치산서원과 함께 망부석도 포함됩니다. 박제상을 기다리던 아내가 돌이 되었다는 이야기는 지역에 전해 오는 전설입니다.',
        url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=d9fb4f36-3bab-4b82-8627-6c9cbcc38875', source: '한국관광공사 · 박제상유적지',
      },
    ],
    person: {
      icon: '📜', name: '박제상 (朴堤上)', title: '두 왕자의 귀환을 도운 신라 관리 — 박제상', era: '5세기 · 신라 눌지왕 때 활동',
      tags: ['신라 관리', '고구려·왜', '울주 두동면 유적'],
      intro: '『삼국사기』에 따르면 박제상은 눌지왕의 부탁을 받고 고구려에 가서 복호를 데려왔습니다. 뒤이어 왜에 건너가 미사흔의 탈출을 도왔지만, 자신은 붙잡혀 돌아오지 못했습니다.',
      tip: '박제상의 이야기가 조선 시대 서원과 지역 전설에 각각 어떻게 남았는지 비교해 보세요.',
      url: `${encyclopedia}E0021143`, source: '한국민족문화대백과사전 · 박제상',
    },
  },
  {
    place: '서생면',
    title: '서생포왜성 — 포구를 내려다보는 성',
    cards: [
      {
        icon: '🏯', tag: '울주군 서생면', title: '왜 포구 가까이에 성을 쌓았을까?',
        intro: '임진왜란 때 일본 장수 가토 기요마사가 서생리에 쌓은 성입니다. 회야강과 포구가 가까워 사람과 물자를 옮기기 쉬웠고, 전쟁 중 일본군의 거점으로 쓰였습니다.',
        url: `${encyclopedia}E0027861`, source: '한국민족문화대백과사전 · 서생포왜성',
      },
      {
        icon: '🔎', tag: '현장에서 볼 것', title: '언덕의 성벽과 포구 쪽 지형',
        intro: '서생포왜성은 울산광역시 문화유산자료입니다. 성벽이 놓인 언덕과 회야강 쪽의 높이 차를 보며, 성이 통행과 물자 운송을 살피기에 어떤 자리였는지 생각해 보세요.',
        url: seosaengFortress, source: '국가유산청 · 서생포왜성',
      },
    ],
    person: {
      icon: '📜', name: '유정 (惟政)', title: '서생포에서 교섭에 나선 승려 — 사명대사', era: '1544–1610 · 법명 유정',
      tags: ['사명대사', '임진왜란', '서생포 교섭'],
      intro: '임진왜란 때 의승군을 이끈 유정은 조정의 뜻을 전하러 서생포에 가서 가토 기요마사와 회담했습니다. 전쟁이 끝난 뒤에는 일본에 건너가 조선인 포로가 돌아오는 데 힘썼습니다.',
      tip: '서생포왜성은 전쟁의 거점이자 대화가 오간 장소이기도 했습니다.',
      url: 'https://contents.history.go.kr/mobile/kc/view.do?levelId=kc_n307900', source: '국사편찬위원회 우리역사넷 · 사명대사',
    },
  },
];

const esc = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// update.mjs가 넘기는 날짜는 한국 달력 날짜를 UTC 자정으로 표기한다.
export function heritageSections(issueDate) {
  const month = issueDate.getUTCMonth();
  const offset = Math.max(0, issueDate.getUTCFullYear() * 12 + month - firstMonth);
  const { place, title, cards, person } = features[offset % features.length];
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
    HERITAGE_TITLE: `    <h2 class="sec-title">${esc(title)}</h2>
    <p style="font-size:12px;color:var(--text-secondary, #526169);margin-top:4px;">${month + 1}월 울주 이야기 · ${esc(place)}</p>`,
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
