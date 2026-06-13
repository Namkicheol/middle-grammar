/* =========================================================
   print-worksheet.js — 워크시트 → 진짜 학습지 (PDF / DOCX)
   - 카드를 그대로 인쇄하면 페이지 분할이 깨져 빈 페이지가 생김.
     → 문항 데이터를 추출(extract)해 plain 학습지로 새로 조판.
   - PDF: 2단 텍스트 학습지 인쇄.  DOCX: 워드·한컴오피스(한글)에서 열리는 .docx 생성.
   - 교사 전용: 허브에서 ?print=1 / ?docx=1 (+&ans=1 해설) 로 진입.
   ========================================================= */
(function () {
  if (window.__egmPrintReady) return;
  window.__egmPrintReady = true;

  var CIRC = '①②③④⑤⑥⑦⑧';

  /* ---------- 공통 유틸 ---------- */
  function clean(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
  function escHtml(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escXml(t) { return escHtml(t).replace(/"/g, '&quot;'); }

  /* ---------- 문항 데이터 추출 (PDF·DOCX 공용) ---------- */
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
  function getAnswerText(card) {
    var hintEl = card.querySelector('.answer-hint');
    if (hintEl) { var t = clean(hintEl.textContent); if (t) return t; }
    var inp = card.querySelector('input.blank[data-ans], .q-input[data-ans], input[data-ans]');
    if (inp) return '정답: ' + inp.getAttribute('data-ans');
    var dz = card.querySelector('[data-ans]');
    if (dz) return '정답: ' + dz.getAttribute('data-ans');
    var btn = card.querySelector('.choice-btn[onclick], .check-btn[onclick]');
    if (btn) { var m = (btn.getAttribute('onclick') || '').match(/h(?:MCQ|Inp)\(this,\s*'([^']*)'/); if (m) return '정답: ' + m[1]; }
    return '';
  }
  function stemText(card) {
    var qt = card.querySelector('.q-text, .q-eng');
    if (!qt) return '';
    var clone = qt.cloneNode(true);
    [].forEach.call(clone.querySelectorAll('input'), function (i) { i.replaceWith(document.createTextNode(' ________ ')); });
    [].forEach.call(clone.querySelectorAll('.vocab, .vocab-toggle, .hint-btn, .check-btn, button, .q-kor'), function (b) { b.remove(); });
    return clean(clone.textContent);
  }
  function passageText(el) {
    var clone = el.cloneNode(true);
    [].forEach.call(clone.querySelectorAll('.num'), function (n) { n.replaceWith(document.createTextNode(' (' + clean(n.textContent) + ') ')); });
    var title = clean((clone.querySelector('.ptitle') || {}).textContent);
    var ptEl = clone.querySelector('.ptitle'); if (ptEl) ptEl.remove();
    return { title: title, body: clean(clone.textContent) };
  }
  function extract() {
    var ans = document.documentElement.classList.contains('egm-ans');
    var titleEl = document.querySelector('.header h1, #egm-app-root h1, h1, .sel-title');
    var subEl = document.querySelector('.header p, .sel-sub, #egm-app-root .header p');
    var data = { title: clean(titleEl ? titleEl.textContent : document.title), sub: clean(subEl ? subEl.textContent : ''), ans: ans, sections: [] };
    var tabs = document.querySelectorAll('.tabs .tab-btn, .tabs button');
    var secs = document.querySelectorAll('.sec');
    var n = 0;
    secs.forEach(function (sec, si) {
      var hd = '';
      var sh = sec.querySelector('.sec-hdr');
      if (sh) {
        var lbl = clean((sh.querySelector('.lbl') || {}).textContent);
        var h2 = clean((sh.querySelector('h2') || {}).textContent);
        hd = (lbl ? lbl + ' · ' : '') + h2;
      } else if (tabs[si]) hd = clean(tabs[si].textContent);
      var items = [];
      collectItems(sec).forEach(function (it) {
        if (it.t === 'p') { items.push({ t: 'p', p: passageText(it.el) }); return; }
        n++;
        var card = it.el;
        items.push({
          t: 'q', num: n,
          stem: stemText(card),
          kor: clean((card.querySelector('.q-kor') || {}).textContent),
          opts: [].map.call(card.querySelectorAll('.choice, .choice-btn'), function (b) { return clean(b.textContent); }),
          bank: (function () { var p = card.querySelector('.word-pool, .word-bank'); return p ? [].map.call(p.querySelectorAll('.chip, .pool-chip, button'), function (b) { return clean(b.textContent); }) : null; })(),
          ans: ans ? getAnswerText(card) : ''
        });
      });
      data.sections.push({ header: hd, items: items });
    });
    return data;
  }

  /* ---------- 학습지 레이아웃 (인쇄·미리보기 공용) ---------- */
  var SHEET = '' +
    "  #egm-print-sheet { color: #111; font-family: 'Pretendard','Noto Sans KR',-apple-system,sans-serif; }" +
    '  #egm-print-sheet .ps-title { font-size: 1.3rem; font-weight: 800; text-align: center; margin: 0; }' +
    '  #egm-print-sheet .ps-title .tag { font-size: .8rem; color: #047857; font-weight: 800; }' +
    '  #egm-print-sheet .ps-sub { text-align: center; font-size: .82rem; color: #555; margin: 2px 0 0;' +
    '    padding-bottom: 9px; border-bottom: 2px solid #111; }' +
    '  #egm-print-sheet .ps-meta { display: flex; justify-content: space-between; font-size: .8rem; color: #444; margin: 7px 0 10px; }' +
    '  #egm-print-sheet .ps-body { columns: 2; column-gap: 18px; }' +
    '  #egm-print-sheet .ps-h { break-inside: avoid; break-after: avoid; font-weight: 800; font-size: 1rem;' +
    '    color: #1e3a8a; margin: 14px 0 9px; padding-bottom: 4px; border-bottom: 1.5px solid #94a3b8; }' +
    '  #egm-print-sheet .ps-passage { break-inside: avoid; background: #f6f7f9; border: 1px solid #d8dee8;' +
    '    border-radius: 6px; padding: 9px 12px; font-size: .9rem; line-height: 1.85; margin: 0 0 12px; color: #1f2937; }' +
    '  #egm-print-sheet .ps-passage b { color: #b45309; }' +
    '  #egm-print-sheet .ps-q { break-inside: avoid; margin: 0 0 14px; font-size: .95rem; line-height: 1.65; }' +
    '  #egm-print-sheet .ps-n { font-weight: 800; margin-right: 2px; }' +
    '  #egm-print-sheet .ps-kor { color: #6b7280; font-size: .84rem; margin: 2px 0; }' +
    '  #egm-print-sheet .ps-o { margin-top: 4px; }' +
    '  #egm-print-sheet .ps-o .opt { margin-right: 16px; white-space: nowrap; }' +
    '  #egm-print-sheet .ps-bank { margin-top: 4px; color: #374151; font-size: .86rem; background: #f3f4f6; border-radius: 5px; padding: 4px 8px; }' +
    '  #egm-print-sheet .ps-a { margin-top: 4px; color: #047857; font-weight: 700; font-size: .84rem;' +
    '    background: #f0fdf4; border-left: 2px solid #22c55e; padding: 4px 8px; line-height: 1.5; }';
  var css = '#egm-print-sheet { display: none; }' + SHEET +
    '@media print {' +
    '  @page { margin: 12mm 11mm; }' +
    '  html, body { background: #fff !important; }' +
    '  body > *:not(#egm-print-sheet) { display: none !important; }' +
    '  #egm-print-sheet { display: block !important; }' +
    '}' +
    /* 미리보기: 화면에서 학습지만 표시 */
    '  html.egm-preview body > *:not(#egm-print-sheet) { display: none !important; }' +
    '  html.egm-preview #egm-print-sheet { display: block !important; max-width: 860px; margin: 0 auto;' +
    '    padding: 16px 20px 40px; background: #fff; }';
  function injectStyle() { var s = document.createElement('style'); s.id = 'egm-print-style'; s.textContent = css; document.head.appendChild(s); }

  function buildSheet() {
    var old = document.getElementById('egm-print-sheet'); if (old) old.remove();
    var d = extract();
    if (!d.sections.length) return false;
    var h = '<div class="ps-title">' + escHtml(d.title) + (d.ans ? ' <span class="tag">[정답·해설]</span>' : '') + '</div>';
    if (d.sub) h += '<div class="ps-sub">' + escHtml(d.sub) + '</div>';
    h += '<div class="ps-meta"><span>이름: ______________</span><span>점수: ______ / ______</span></div><div class="ps-body">';
    d.sections.forEach(function (sec) {
      if (sec.header) h += '<div class="ps-h">' + escHtml(sec.header) + '</div>';
      sec.items.forEach(function (it) {
        if (it.t === 'p') { h += '<div class="ps-passage">' + (it.p.title ? '<b>' + escHtml(it.p.title) + '</b><br>' : '') + escHtml(it.p.body) + '</div>'; return; }
        h += '<div class="ps-q"><span class="ps-n">' + it.num + '.</span> ' + escHtml(it.stem);
        if (it.kor && it.kor !== it.stem) h += '<div class="ps-kor">' + escHtml(it.kor) + '</div>';
        if (it.opts.length) h += '<div class="ps-o">' + it.opts.map(function (o, i) { return '<span class="opt">' + (CIRC[i] || (i + 1) + '.') + '&nbsp;' + escHtml(o) + '</span>'; }).join(' ') + '</div>';
        if (it.bank && it.bank.length) h += '<div class="ps-bank">[보기] ' + it.bank.map(escHtml).join(' &nbsp;/&nbsp; ') + '</div>';
        if (it.ans) h += '<div class="ps-a">' + escHtml(it.ans) + '</div>';
        h += '</div>';
      });
    });
    h += '</div>';
    var sheet = document.createElement('div'); sheet.id = 'egm-print-sheet'; sheet.innerHTML = h;
    document.body.appendChild(sheet);
    return true;
  }
  function egmPrint() { buildSheet(); window.print(); }
  window.egmPrint = egmPrint;
  window.addEventListener('beforeprint', buildSheet);

  /* ---------- DOCX 생성 (라이브러리 없이 ZIP 직접 작성) ---------- */
  function crc32(buf) {
    var t = crc32.t; if (!t) { t = crc32.t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF; for (var i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function u8(s) { return new TextEncoder().encode(s); }
  function zipStore(files) {
    var parts = [], central = [], offset = 0;
    var u16 = function (n) { return [n & 255, (n >> 8) & 255]; };
    var u32 = function (n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; };
    files.forEach(function (f) {
      var name = u8(f.name), data = f.data, crc = crc32(data);
      var lh = [0x50, 0x4b, 0x03, 0x04].concat(u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(lh), name, data);
      var ch = [0x50, 0x4b, 0x01, 0x02].concat(u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset));
      central.push(new Uint8Array(ch), name);
      offset += lh.length + name.length + data.length;
    });
    var cdSize = central.reduce(function (a, c) { return a + c.length; }, 0);
    central.forEach(function (c) { parts.push(c); });
    parts.push(new Uint8Array([0x50, 0x4b, 0x05, 0x06].concat(u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0))));
    var total = parts.reduce(function (a, c) { return a + c.length; }, 0), out = new Uint8Array(total), p = 0;
    parts.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }
  function wRun(text, o) {
    o = o || {};
    var rpr = '<w:rPr>' + (o.b ? '<w:b/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') +
      (o.sz ? '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>' : '') + '</w:rPr>';
    return '<w:r>' + rpr + '<w:t xml:space="preserve">' + escXml(text) + '</w:t></w:r>';
  }
  function wPara(runs, o) {
    o = o || {};
    var ppr = '<w:pPr>' + (o.jc ? '<w:jc w:val="' + o.jc + '"/>' : '') +
      (o.border ? '<w:pBdr><w:bottom w:val="single" w:sz="' + (o.border) + '" w:space="2" w:color="' + (o.bc || '999999') + '"/></w:pBdr>' : '') +
      (o.shd ? '<w:shd w:val="clear" w:fill="' + o.shd + '"/>' : '') +
      '<w:spacing w:after="' + (o.after != null ? o.after : 60) + '" w:line="240" w:lineRule="auto"/></w:pPr>';
    return '<w:p>' + ppr + (runs || '') + '</w:p>';
  }
  function buildDocxXml(d) {
    var body = '';
    body += wPara(wRun(d.title + (d.ans ? '  [정답·해설]' : ''), { b: true, sz: 32 }), { jc: 'center', after: 40 });
    if (d.sub) body += wPara(wRun(d.sub, { sz: 18, color: '666666' }), { jc: 'center', after: 40, border: 12, bc: '111111' });
    body += wPara(wRun('이름: ______________          점수: ______ / ______', { sz: 18, color: '444444' }), { after: 160 });
    d.sections.forEach(function (sec) {
      if (sec.header) body += wPara(wRun(sec.header, { b: true, sz: 22, color: '1E3A8A' }), { after: 80, border: 8, bc: '94A3B8' });
      sec.items.forEach(function (it) {
        if (it.t === 'p') {
          if (it.p.title) body += wPara(wRun(it.p.title, { b: true, sz: 19, color: 'B45309' }), { after: 0, shd: 'F6F7F9' });
          body += wPara(wRun(it.p.body, { sz: 19 }), { after: 100, shd: 'F6F7F9' });
          return;
        }
        var runs = wRun(it.num + '. ', { b: true }) + wRun(it.stem, {});
        body += wPara(runs, { after: it.kor || it.opts.length ? 0 : 100 });
        if (it.kor && it.kor !== it.stem) body += wPara(wRun(it.kor, { sz: 16, color: '6B7280' }), { after: 0 });
        if (it.opts.length) {
          var ot = it.opts.map(function (o, i) { return (CIRC[i] || (i + 1) + '.') + ' ' + o; }).join('      ');
          body += wPara(wRun(ot, {}), { after: 0 });
        }
        if (it.bank && it.bank.length) body += wPara(wRun('[보기] ' + it.bank.join('  /  '), { sz: 18, color: '374151' }), { after: 0, shd: 'F3F4F6' });
        if (it.ans) body += wPara(wRun(it.ans, { sz: 17, color: '047857', b: true }), { after: 0, shd: 'F0FDF4' });
        body += wPara('', { after: 100 });
      });
    });
    var sectPr = '<w:sectPr><w:cols w:num="2" w:space="432"/><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="680" w:right="620" w:bottom="680" w:left="620" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + body + sectPr + '</w:body></w:document>';
  }
  function downloadDocx() {
    var d = extract(); if (!d.sections.length) return;
    var CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>';
    var RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';
    var zip = zipStore([
      { name: '[Content_Types].xml', data: u8(CT) },
      { name: '_rels/.rels', data: u8(RELS) },
      { name: 'word/document.xml', data: u8(buildDocxXml(d)) }
    ]);
    var blob = new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = d.title.replace(/[^\w가-힣]+/g, '_').replace(/^_+|_+$/g, '') + (d.ans ? '_해설' : '_문제') + '.docx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  window.egmDownloadDocx = downloadDocx;

  /* ---------- HWPX 생성 (한글/한컴오피스, 베타) ---------- */
  var HWPX_VER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="0" micro="5" buildNumber="0" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="9, 1, 1, 5656 WIN32LEWindows_Unknown_Version"/>';
  var HWPX_CONTAINER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>';
  var HWPX_MANIFEST = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" version="1.2"><odf:file-entry odf:full-path="/" odf:media-type="application/hwp+zip"/><odf:file-entry odf:full-path="Contents/header.xml" odf:media-type="application/xml"/><odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml"/></odf:manifest>';
  var HWPX_HPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" version="1.4" unique-identifier="" id=""><opf:metadata><opf:title>worksheet</opf:title><opf:language>ko</opf:language></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml" isEmbeded="0"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml" isEmbeded="0"/><opf:item id="settings" href="settings.xml" media-type="application/xml" isEmbeded="0"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>';
  var HWPX_SETTINGS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>';
  function hwpxFontface(lang) { return '<hh:fontface lang="' + lang + '" fontCnt="1"><hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font></hh:fontface>'; }
  function hwpxCharPr(id, height, color, bold) {
    return '<hh:charPr id="' + id + '" height="' + height + '" textColor="' + color + '" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2">' +
      '<hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>' +
      '<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>' +
      '<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>' + (bold ? '<hh:bold/>' : '') + '</hh:charPr>';
  }
  function hwpxBorderFill(id) { return '<hh:borderFill id="' + id + '" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/><hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/><hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/><hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/></hh:borderFill>'; }
  var HWPX_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" version="1.4" secCnt="1">' +
    '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList>' +
    '<hh:fontfaces itemCnt="7">' + ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'].map(hwpxFontface).join('') + '</hh:fontfaces>' +
    '<hh:borderFills itemCnt="2">' + hwpxBorderFill(1) + hwpxBorderFill(2) + '</hh:borderFills>' +
    '<hh:charProperties itemCnt="3">' + hwpxCharPr(0, 1000, '#000000', false) + hwpxCharPr(1, 1600, '#000000', true) + hwpxCharPr(2, 1000, '#1E3A8A', true) + '</hh:charProperties>' +
    '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>' +
    '<hh:numberings itemCnt="1"><hh:numbering id="1" start="0"><hh:paraHead start="1" level="1" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="DIGIT" charPrIDRef="0" checkable="0">^1.</hh:paraHead></hh:numbering></hh:numberings>' +
    '<hh:paraProperties itemCnt="1"><hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0"><hh:align horizontal="JUSTIFY" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/><hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr></hh:paraProperties>' +
    '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>' +
    '</hh:refList></hh:head>';
  function hwpxSecPr() {
    return '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">' +
      '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0" strtnum="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>' +
      '<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>' +
      '<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>' +
      '<hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="5669" right="5669" top="5669" bottom="4252"/></hp:pagePr>' +
      '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="850" belowLine="567" aboveLine="567"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>' +
      '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>' +
      '<hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>' +
      '<hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>' +
      '<hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr>';
  }
  var _hpid = 0;
  function hwpxPara(text, charId, withSecPr) {
    var runs = (withSecPr ? '<hp:run charPrIDRef="0">' + hwpxSecPr() + '<hp:ctrl/></hp:run>' : '') +
      '<hp:run charPrIDRef="' + (charId || 0) + '"><hp:t>' + escXml(text) + '</hp:t></hp:run>';
    return '<hp:p id="' + (_hpid++) + '" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">' + runs +
      '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray></hp:p>';
  }
  function buildHwpxSection(d) {
    _hpid = 0;
    var body = hwpxPara(d.title + (d.ans ? '  [정답·해설]' : ''), 1, true);
    if (d.sub) body += hwpxPara(d.sub, 0);
    body += hwpxPara('이름: ______________     점수: ______ / ______', 0);
    d.sections.forEach(function (sec) {
      if (sec.header) body += hwpxPara(sec.header, 2);
      sec.items.forEach(function (it) {
        if (it.t === 'p') { if (it.p.title) body += hwpxPara(it.p.title, 2); body += hwpxPara(it.p.body, 0); return; }
        body += hwpxPara(it.num + '. ' + it.stem, 0);
        if (it.kor && it.kor !== it.stem) body += hwpxPara(it.kor, 0);
        if (it.opts && it.opts.length) body += hwpxPara(it.opts.map(function (o, i) { return (CIRC[i] || (i + 1) + '.') + ' ' + o; }).join('   '), 0);
        if (it.bank && it.bank.length) body += hwpxPara('[보기] ' + it.bank.join('  /  '), 0);
        if (it.ans) body += hwpxPara(it.ans, 0);
      });
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head">' + body + '</hs:sec>';
  }
  function downloadHwpx() {
    var d = extract(); if (!d.sections.length) return;
    var zip = zipStore([
      { name: 'mimetype', data: u8('application/hwp+zip') },
      { name: 'version.xml', data: u8(HWPX_VER) },
      { name: 'Contents/header.xml', data: u8(HWPX_HEADER) },
      { name: 'Contents/section0.xml', data: u8(buildHwpxSection(d)) },
      { name: 'Contents/content.hpf', data: u8(HWPX_HPF) },
      { name: 'settings.xml', data: u8(HWPX_SETTINGS) },
      { name: 'META-INF/container.xml', data: u8(HWPX_CONTAINER) },
      { name: 'META-INF/manifest.xml', data: u8(HWPX_MANIFEST) }
    ]);
    var blob = new Blob([zip], { type: 'application/hwp+zip' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = d.title.replace(/[^\w가-힣]+/g, '_').replace(/^_+|_+$/g, '') + (d.ans ? '_해설' : '_문제') + '.hwpx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  window.egmDownloadHwpx = downloadHwpx;

  /* ---------- 진입 처리 ---------- */
  function showPreview() { buildSheet(); document.documentElement.classList.add('egm-preview'); }
  function maybeAuto() {
    if (/[?&]ans=1\b/.test(location.search)) document.documentElement.classList.add('egm-ans');
    var preview = /[?&]preview=1\b/.test(location.search);
    var docx = /[?&]docx=1\b/.test(location.search);
    var hwpx = /[?&]hwpx=1\b/.test(location.search);
    var print = /[?&]print=1\b/.test(location.search);
    if (!preview && !docx && !hwpx && !print) return;
    var fn = preview ? showPreview : (hwpx ? downloadHwpx : (docx ? downloadDocx : egmPrint));
    var fire = function () { setTimeout(fn, preview ? 250 : 450); };
    if (document.readyState === 'complete') fire();
    else window.addEventListener('load', fire);
  }
  function init() { injectStyle(); maybeAuto(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
