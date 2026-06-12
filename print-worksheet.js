/* =========================================================
   print-worksheet.js — 워크시트 → 진짜 학습지(텍스트) 인쇄/PDF
   - 화려한 카드를 그대로 인쇄하면 페이지 분할이 깨져 빈 페이지가 생김.
   - 그래서 인쇄 시 문항 데이터를 추출해 plain 텍스트 학습지로 새로 조판한다.
     (일반 블록 흐름 → 페이지가 깔끔히 넘어가고 빈 페이지가 없음)
   - 교사 전용: 화면엔 버튼 없음. 허브에서 ?print=1(문제만) / ?print=1&ans=1(해설) 로 진입.
   ========================================================= */
(function () {
  if (window.__egmPrintReady) return;
  window.__egmPrintReady = true;

  var CIRC = '①②③④⑤⑥⑦⑧';

  var css = '' +
    '#egm-print-sheet { display: none; }' +
    '@media print {' +
    '  @page { margin: 12mm 11mm; }' +
    '  html, body { background: #fff !important; }' +
    '  body > *:not(#egm-print-sheet) { display: none !important; }' +
    '  #egm-print-sheet { display: block !important; color: #111;' +
    "    font-family: 'Pretendard','Noto Sans KR',-apple-system,sans-serif; }" +
    '  #egm-print-sheet .ps-title { font-size: 1.3rem; font-weight: 800; text-align: center; margin: 0; }' +
    '  #egm-print-sheet .ps-title .tag { font-size: .8rem; color: #047857; font-weight: 800; }' +
    '  #egm-print-sheet .ps-sub { text-align: center; font-size: .82rem; color: #555;' +
    '    margin: 2px 0 0; padding-bottom: 9px; border-bottom: 2px solid #111; }' +
    '  #egm-print-sheet .ps-meta { display: flex; justify-content: space-between; font-size: .8rem;' +
    '    color: #444; margin: 7px 0 10px; }' +
    '  #egm-print-sheet .ps-body { columns: 2; column-gap: 16px; }' +
    '  #egm-print-sheet .ps-h { -webkit-column-break-inside: avoid; break-inside: avoid; break-after: avoid;' +
    '    font-weight: 800; font-size: .92rem; color: #1e3a8a; margin: 11px 0 6px; padding-bottom: 3px;' +
    '    border-bottom: 1.5px solid #94a3b8; }' +
    '  #egm-print-sheet .ps-passage { -webkit-column-break-inside: avoid; break-inside: avoid;' +
    '    background: #f6f7f9; border: 1px solid #d8dee8; border-radius: 6px; padding: 8px 11px;' +
    '    font-size: .82rem; line-height: 1.75; margin: 0 0 8px; color: #1f2937; }' +
    '  #egm-print-sheet .ps-passage b { color: #b45309; }' +
    '  #egm-print-sheet .ps-q { -webkit-column-break-inside: avoid; break-inside: avoid;' +
    '    margin: 0 0 8px; font-size: .85rem; line-height: 1.5; }' +
    '  #egm-print-sheet .ps-n { font-weight: 800; margin-right: 2px; }' +
    '  #egm-print-sheet .ps-ex { color: #6b7280; font-size: .92em; }' +
    '  #egm-print-sheet .ps-kor { display: block; color: #6b7280; font-size: .78rem; margin: 1px 0; }' +
    '  #egm-print-sheet .ps-o { display: block; margin-top: 2px; }' +
    '  #egm-print-sheet .ps-o .opt { margin-right: 12px; white-space: nowrap; display: inline-block; }' +
    '  #egm-print-sheet .ps-bank { display: block; margin-top: 3px; color: #374151; font-size: .8rem;' +
    '    background: #f3f4f6; border-radius: 5px; padding: 3px 7px; }' +
    '  #egm-print-sheet .ps-a { display: inline-block; margin-top: 2px; color: #047857; font-weight: 800; font-size: .82rem; }' +
    '}';

  function injectStyle() {
    var s = document.createElement('style');
    s.id = 'egm-print-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function clean(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }

  // 섹션 내 패시지·문제 카드를 DOM 순서대로 수집 (중첩 래퍼 대응)
  function collectItems(sec) {
    var items = [];
    (function walk(el) {
      [].forEach.call(el.children, function (c) {
        if (!c.classList) return;
        if (c.classList.contains('passage')) items.push({ t: 'p', el: c });
        else if (c.classList.contains('question-card') || c.classList.contains('q-card')) items.push({ t: 'q', el: c });
        else walk(c);
      });
    })(sec);
    return items;
  }

  function getAnswer(card) {
    var inp = card.querySelector('input.blank[data-ans], .q-input[data-ans], input[data-ans]');
    if (inp) return inp.getAttribute('data-ans');
    var dz = card.querySelector('[data-ans]');
    if (dz) return dz.getAttribute('data-ans');
    var btn = card.querySelector('.choice-btn[onclick], .check-btn[onclick]');
    if (btn) {
      var m = (btn.getAttribute('onclick') || '').match(/h(?:MCQ|Inp)\(this,\s*'([^']*)'/);
      if (m) return m[1];
    }
    var st = card.querySelector('.answer-hint strong');
    if (st) return clean(st.textContent);
    return '';
  }

  function stemHtml(card) {
    var qt = card.querySelector('.q-text, .q-eng');
    if (!qt) return '';
    var clone = qt.cloneNode(true);
    // 입력칸 → 밑줄, 보기/힌트 버튼·단어목록 제거
    [].forEach.call(clone.querySelectorAll('input'), function (i) { i.replaceWith(document.createTextNode(' ________ ')); });
    [].forEach.call(clone.querySelectorAll('.vocab, .vocab-toggle, .hint-btn, .check-btn, button'), function (b) { b.remove(); });
    // (be), (eat, 부정형) 같은 힌트는 살린다 (.ex)
    return esc(clean(clone.textContent));
  }

  function passageHtml(el) {
    var clone = el.cloneNode(true);
    [].forEach.call(clone.querySelectorAll('.num'), function (n) {
      n.replaceWith(document.createTextNode(' (' + clean(n.textContent) + ') '));
    });
    var title = clone.querySelector('.ptitle');
    var tHtml = title ? '<b>' + esc(clean(title.textContent)) + '</b><br>' : '';
    if (title) title.remove();
    return '<div class="ps-passage">' + tHtml + esc(clean(clone.textContent)) + '</div>';
  }

  function qHtml(card, num, ans) {
    var stem = stemHtml(card);
    var opts = [].map.call(card.querySelectorAll('.choice, .choice-btn'), function (b) { return clean(b.textContent); });
    var pool = card.querySelector('.word-pool, .word-bank');
    var bank = pool ? [].map.call(pool.querySelectorAll('.chip, .pool-chip, button'), function (b) { return clean(b.textContent); }) : null;
    var korEl = card.querySelector('.q-kor');
    var kor = korEl ? clean(korEl.textContent) : '';

    var h = '<div class="ps-q"><span class="ps-n">' + num + '.</span> ' + stem;
    if (kor && kor !== stem) h += '<span class="ps-kor">' + esc(kor) + '</span>';
    if (opts.length) {
      h += '<span class="ps-o">' + opts.map(function (o, i) {
        return '<span class="opt">' + (CIRC[i] || (i + 1) + '.') + ' ' + esc(o) + '</span>';
      }).join('') + '</span>';
    }
    if (bank && bank.length) h += '<span class="ps-bank">[보기] ' + bank.map(esc).join(' &nbsp;/&nbsp; ') + '</span>';
    if (ans) {
      var a = getAnswer(card);
      if (a) h += '<span class="ps-a">✔ 정답: ' + esc(a) + '</span>';
    }
    h += '</div>';
    return h;
  }

  // 문항 데이터를 추출해 텍스트 학습지(#egm-print-sheet)를 만든다
  function buildSheet() {
    var old = document.getElementById('egm-print-sheet');
    if (old) old.remove();
    var ans = document.documentElement.classList.contains('egm-ans');

    var titleEl = document.querySelector('.header h1, #egm-app-root h1, h1, .sel-title');
    var title = clean(titleEl ? titleEl.textContent : document.title);
    var subEl = document.querySelector('.header p, .sel-sub, #egm-app-root .header p');
    var sub = clean(subEl ? subEl.textContent : '');

    var html = '<div class="ps-title">' + esc(title) + (ans ? ' <span class="tag">[정답·해설]</span>' : '') + '</div>';
    if (sub) html += '<div class="ps-sub">' + esc(sub) + '</div>';
    html += '<div class="ps-meta"><span>이름: ______________</span><span>점수: ______ / ______</span></div>';
    html += '<div class="ps-body">';

    var tabs = document.querySelectorAll('.tabs .tab-btn, .tabs button');
    var secs = document.querySelectorAll('.sec');
    var nrun = 0;
    if (!secs.length) return false;

    secs.forEach(function (sec, si) {
      var hd = '';
      var sh = sec.querySelector('.sec-hdr');
      if (sh) {
        var lbl = clean((sh.querySelector('.lbl') || {}).textContent);
        var h2 = clean((sh.querySelector('h2') || {}).textContent);
        hd = (lbl ? lbl + ' · ' : '') + h2;
      } else if (tabs[si]) hd = clean(tabs[si].textContent);
      if (hd) html += '<div class="ps-h">' + esc(hd) + '</div>';

      collectItems(sec).forEach(function (it) {
        if (it.t === 'p') html += passageHtml(it.el);
        else { nrun++; html += qHtml(it.el, nrun, ans); }
      });
    });
    html += '</div>';

    var sheet = document.createElement('div');
    sheet.id = 'egm-print-sheet';
    sheet.innerHTML = html;
    document.body.appendChild(sheet);
    return true;
  }

  function egmPrint() { buildSheet(); window.print(); }
  window.egmPrint = egmPrint;
  window.addEventListener('beforeprint', buildSheet);

  // 한글(HWPX)·워드용 .doc 다운로드 — 텍스트 학습지를 Word-openable HTML로 내보낸다.
  // (한컴오피스·MS Word 둘 다 .doc HTML을 열며, 거기서 .hwpx로 저장 가능)
  function downloadDoc() {
    if (!buildSheet()) return;
    var sheet = document.getElementById('egm-print-sheet');
    var ans = document.documentElement.classList.contains('egm-ans');
    var styles =
      'body{font-family:"Malgun Gothic","Noto Sans KR",sans-serif;color:#111;font-size:11pt;line-height:1.5;}' +
      '.ps-title{font-size:16pt;font-weight:bold;text-align:center;margin:0;}' +
      '.ps-title .tag{font-size:11pt;color:#047857;}' +
      '.ps-sub{text-align:center;font-size:10pt;color:#555;border-bottom:1.5pt solid #111;padding-bottom:6pt;margin-bottom:4pt;}' +
      '.ps-meta{margin:6pt 0 10pt;}.ps-meta span{margin-right:30pt;}' +
      '.ps-body{}' +
      '.ps-h{font-weight:bold;color:#1e3a8a;border-bottom:1pt solid #999;margin:13pt 0 6pt;padding-bottom:2pt;}' +
      '.ps-passage{background:#f5f6f8;border:1pt solid #ddd;padding:6pt 9pt;margin:0 0 7pt;font-size:10.5pt;}' +
      '.ps-passage b{color:#b45309;}' +
      '.ps-q{margin:0 0 8pt;}.ps-n{font-weight:bold;}' +
      '.ps-kor{display:block;color:#666;font-size:9pt;}' +
      '.ps-o{display:block;}.ps-o .opt{margin-right:16pt;}' +
      '.ps-bank{display:block;background:#f3f4f6;padding:2pt 6pt;font-size:10pt;}' +
      '.ps-a{display:inline-block;color:#047857;font-weight:bold;}';
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
      '<head><meta charset="utf-8"><title>worksheet</title><style>' + styles + '</style></head>' +
      '<body>' + sheet.innerHTML + '</body></html>';
    var blob = new Blob(['﻿', doc], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var nm = clean((document.querySelector('.header h1, h1, .sel-title') || {}).textContent || document.title);
    a.href = url;
    a.download = nm.replace(/[^\w가-힣]+/g, '_').replace(/^_+|_+$/g, '') + (ans ? '_해설' : '') + '.doc';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  window.egmDownloadDoc = downloadDoc;

  function maybeAutoPrint() {
    if (/[?&]ans=1\b/.test(location.search)) document.documentElement.classList.add('egm-ans');
    var doc = /[?&]doc=1\b/.test(location.search);
    if (!doc && !/[?&]print=1\b/.test(location.search)) return;
    var fire = function () { setTimeout(doc ? downloadDoc : egmPrint, 450); };
    if (document.readyState === 'complete') fire();
    else window.addEventListener('load', fire);
  }

  function init() { injectStyle(); maybeAutoPrint(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
