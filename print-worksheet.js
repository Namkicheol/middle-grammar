/* =========================================================
   print-worksheet.js — 워크시트 공통 인쇄/PDF 저장
   - "🖨️ 인쇄 / PDF 저장" 버튼을 우하단에 띄운다
   - 인쇄 시: 모든 섹션 펼침, 인터랙티브 UI 숨김, 잉크 절약 흑백 레이아웃
   - 두 계열 모두 대응: .sec.active+.tabs(egm) / .sec.show+.sec-hdr(일반)
   - 화면 표시에는 전혀 영향 없음(@media print 전용 + 버튼만 추가)
   ========================================================= */
(function () {
  if (window.__egmPrintReady) return;
  window.__egmPrintReady = true;

  var css = '' +
    '@media print {' +
    '  @page { margin: 11mm 10mm; }' +
    '  html, body { background: #fff !important; }' +
    '  /* 화면 전용 UI 숨김 */' +
    '  #egm-print-bar, .tabs, .dashboard, .scoreboard, #egm-result, #result, #toast,' +
    '  .check-btn, .hint-btn, .r-btn, .reset-btn, .grade-btn { display: none !important; }' +
    '  /* 헤더 잉크 절약 + 컴팩트 */' +
    '  .header { background: #fff !important; color: #0f172a !important; border-bottom: 2px solid #0f172a !important;' +
    '    border-radius: 0 !important; box-shadow: none !important; padding: 0 0 7px !important; margin-bottom: 10px !important; }' +
    '  .header h1 { color: #0f172a !important; font-size: 1.4rem !important; margin: 0 !important; }' +
    '  .header p { color: #475569 !important; font-size: .85rem !important; }' +
    '  .badge-top { background: none !important; color: #475569 !important; padding: 0 !important; font-size: .72rem !important; margin: 0 !important; }' +
    '  /* ▼ 2단 그리드 — 한 장에 더 많은 문제 (종이 절약). multicol의 빈 페이지 버그 회피 */' +
    '  .sec { display: grid !important; grid-template-columns: 1fr 1fr !important;' +
    '    gap: 7px 12px !important; align-items: start !important;' +
    '    max-width: 100% !important; padding: 0 !important; animation: none !important; }' +
    '  /* 섹션 제목은 2단 전체 너비로 */' +
    '  .sec-hdr, .egm-print-sec-title { grid-column: 1 / -1 !important; break-after: avoid; break-inside: avoid; }' +
    '  .egm-print-sec-title { display: block; font-size: 1rem; font-weight: 800; color: #0f172a;' +
    '    margin: 6px 0 4px; padding-bottom: 4px; border-bottom: 1.5px solid #cbd5e1; }' +
    '  /* 문제 블록: 페이지 경계에서 통째로 (클래스명 무관, 섹션 직계 자식) */' +
    '  .sec > * { break-inside: avoid; margin-bottom: 0 !important; }' +
    '  /* 문제 카드 컴팩트 (클래스명 변형 모두 커버) */' +
    '  .q-card, .question-card, .q-item, .qbox { break-inside: avoid; box-shadow: none !important;' +
    '    border: 1px solid #cbd5e1 !important; border-radius: 8px !important;' +
    '    padding: 7px 9px !important; margin: 0 0 7px !important; font-size: .82rem !important; }' +
    '  .q-card .vw { font-size: .68rem !important; }' +
    '  /* 객관식 보기 — 컴팩트 외곽선 */' +
    '  .choice, .choice-btn { background: #fff !important; color: #0f172a !important;' +
    '    border: 1px solid #94a3b8 !important; box-shadow: none !important;' +
    '    padding: 4px 7px !important; margin: 3px 0 !important; font-size: .8rem !important; min-height: 0 !important; }' +
    '  /* 주관식 입력칸 → 빈 밑줄 */' +
    '  .q-input { border: none !important; border-bottom: 1.2px solid #475569 !important;' +
    '    background: none !important; min-width: 90px; }' +
    '  .chip { font-size: .78rem !important; padding: 3px 7px !important; }' +
    '  /* 📝 해설 버전(ans=1): 정답·해석 노출 */' +
    '  .answer-hint { display: none; }' +
    '  html.egm-ans .answer-hint { display: block !important; margin-top: 5px !important;' +
    '    padding: 5px 8px !important; background: #f0fdf4 !important; border: 1px solid #86efac !important;' +
    '    border-radius: 6px !important; font-size: .72rem !important; line-height: 1.4 !important; color: #166534 !important; }' +
    '  html.egm-ans .answer-hint strong { color: #047857 !important; }' +
    '}';

  function injectStyle() {
    var s = document.createElement('style');
    s.id = 'egm-print-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // 인쇄는 교사 전용 — 워크시트 화면엔 버튼을 노출하지 않는다.
  // 1) 허브에서 ?print=1 로 열면 자동 인쇄  2) 그 외엔 교사가 Ctrl/Cmd+P 사용

  // 섹션 제목이 없는 계열(egm/탭형)엔 탭 라벨을 각 섹션 위에 헤딩으로 복사
  function preparePrint() {
    var secs = document.querySelectorAll('.sec');
    if (!secs.length) return;
    var tabs = document.querySelectorAll('.tabs .tab-btn, .tabs button');
    secs.forEach(function (sec, i) {
      if (sec.querySelector('.sec-hdr') || sec.querySelector('.egm-print-sec-title')) return;
      if (!tabs[i]) return;
      var h = document.createElement('div');
      h.className = 'egm-print-sec-title';
      h.textContent = tabs[i].textContent.trim();
      sec.insertBefore(h, sec.firstChild);
    });
  }

  function egmPrint() { preparePrint(); window.print(); }
  window.egmPrint = egmPrint;
  window.addEventListener('beforeprint', preparePrint);

  // 허브에서 ?print=1 로 진입하면 문항 렌더 후 자동으로 인쇄 대화상자를 띄운다
  // &ans=1 이면 해설(정답·해석) 포함 버전
  function maybeAutoPrint() {
    if (/[?&]ans=1\b/.test(location.search)) document.documentElement.classList.add('egm-ans');
    if (!/[?&]print=1\b/.test(location.search)) return;
    var fire = function () { setTimeout(egmPrint, 400); };  // 문항 빌드 여유
    if (document.readyState === 'complete') fire();
    else window.addEventListener('load', fire);
  }

  function init() { injectStyle(); maybeAutoPrint(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
