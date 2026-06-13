// HWPX(OWPML) 생성 포맷 실험 — kordoc로 검증 후 print-worksheet.js에 이식
// node tools/test-hwpx.js  →  .omc/test.hwpx 생성
const fs = require('fs');

/* ---- ZIP (STORE, 무압축) ---- */
function crc32(buf) {
  let c, t = crc32.t; if (!t) { t = crc32.t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } }
  let crc = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files) {
  const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  let parts = [], central = [], offset = 0;
  files.forEach(f => {
    const name = Buffer.from(f.name, 'utf8'), data = Buffer.from(f.data), crc = crc32(data);
    const lh = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    parts.push(lh, name, data);
    central.push(Buffer.from([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
    offset += lh.length + name.length + data.length;
  });
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  parts.push(...central);
  parts.push(Buffer.from([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]));
  return Buffer.concat(parts);
}

function xml(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ---- HWPX 파트들 ---- */
const HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
const HS = 'http://www.hancom.co.kr/hwpml/2011/section';
const HH = 'http://www.hancom.co.kr/hwpml/2011/head';
const HC = 'http://www.hancom.co.kr/hwpml/2011/core';

const mimetype = 'application/hwp+zip';

const versionXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="0" micro="5" buildNumber="0" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="9, 1, 1, 5656 WIN32LEWindows_Unknown_Version"/>';

const containerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">' +
  '<ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>';

const manifestXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" version="1.2">' +
  '<odf:file-entry odf:full-path="/" odf:media-type="application/hwp+zip"/>' +
  '<odf:file-entry odf:full-path="Contents/header.xml" odf:media-type="application/xml"/>' +
  '<odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml"/>' +
  '</odf:manifest>';

const contentHpf = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" version="1.4" unique-identifier="" id="">' +
  '<opf:metadata><opf:title>worksheet</opf:title><opf:language>ko</opf:language></opf:metadata>' +
  '<opf:manifest>' +
  '<opf:item id="header" href="Contents/header.xml" media-type="application/xml" isEmbeded="0"/>' +
  '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml" isEmbeded="0"/>' +
  '<opf:item id="settings" href="settings.xml" media-type="application/xml" isEmbeded="0"/>' +
  '</opf:manifest>' +
  '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine>' +
  '</opf:package>';

const settingsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>';

function fontface(lang) {
  return '<hh:fontface lang="' + lang + '" fontCnt="1"><hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0">' +
    '<hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font></hh:fontface>';
}
function charPr(id, height, color, bold) {
  return '<hh:charPr id="' + id + '" height="' + height + '" textColor="' + color + '" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2">' +
    '<hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>' +
    '<hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>' +
    '<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>' +
    '<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>' +
    '<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>' +
    (bold ? '<hh:bold/>' : '') + '</hh:charPr>';
}
function borderFill(id) {
  return '<hh:borderFill id="' + id + '" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">' +
    '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>' +
    '<hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/>' +
    '<hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/>' +
    '<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/></hh:borderFill>';
}
const headerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<hh:head xmlns:hh="' + HH + '" xmlns:hp="' + HP + '" xmlns:hc="' + HC + '" version="1.4" secCnt="1">' +
  '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>' +
  '<hh:refList>' +
  '<hh:fontfaces itemCnt="7">' + ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'].map(fontface).join('') + '</hh:fontfaces>' +
  '<hh:borderFills itemCnt="2">' + borderFill(1) + borderFill(2) + '</hh:borderFills>' +
  '<hh:charProperties itemCnt="3">' + charPr(0, 1000, '#000000', false) + charPr(1, 1600, '#000000', true) + charPr(2, 1000, '#1E3A8A', true) + '</hh:charProperties>' +
  '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>' +
  '<hh:numberings itemCnt="1"><hh:numbering id="1" start="0"><hh:paraHead start="1" level="1" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="DIGIT" charPrIDRef="0" checkable="0">^1.</hh:paraHead></hh:numbering></hh:numberings>' +
  '<hh:paraProperties itemCnt="1"><hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">' +
  '<hh:align horizontal="JUSTIFY" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>' +
  '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>' +
  '<hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin>' +
  '<hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>' +
  '<hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr></hh:paraProperties>' +
  '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>' +
  '</hh:refList></hh:head>';

function secPr() {
  return '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">' +
    '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0" strtnum="0"/>' +
    '<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>' +
    '<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>' +
    '<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>' +
    '<hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="5669" right="5669" top="5669" bottom="4252"/></hp:pagePr>' +
    '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="850" belowLine="567" aboveLine="567"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>' +
    '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>' +
    '<hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>' +
    '<hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>' +
    '<hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>' +
    '</hp:secPr>';
}
let _pid = 0;
function para(text, charId, withSecPr) {
  const runs = (withSecPr ? '<hp:run charPrIDRef="0">' + secPr() + '<hp:ctrl/></hp:run>' : '') +
    '<hp:run charPrIDRef="' + (charId || 0) + '"><hp:t>' + xml(text) + '</hp:t></hp:run>';
  return '<hp:p id="' + (_pid++) + '" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">' + runs +
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray></hp:p>';
}

function buildSection(d) {
  _pid = 0;
  let body = '';
  body += para(d.title + (d.ans ? '  [정답·해설]' : ''), 1, true);   // 첫 문단에 secPr
  if (d.sub) body += para(d.sub, 0);
  body += para('이름: ______________     점수: ______ / ______', 0);
  d.sections.forEach(sec => {
    if (sec.header) body += para(sec.header, 2);
    sec.items.forEach(it => {
      if (it.t === 'p') { if (it.p.title) body += para(it.p.title, 2); body += para(it.p.body, 0); return; }
      body += para(it.num + '. ' + it.stem, 0);
      if (it.kor && it.kor !== it.stem) body += para(it.kor, 0);
      if (it.opts && it.opts.length) body += para(it.opts.map((o, i) => (['①', '②', '③', '④', '⑤', '⑥'][i] || (i + 1) + '.') + ' ' + o).join('   '), 0);
      if (it.bank && it.bank.length) body += para('[보기] ' + it.bank.join('  /  '), 0);
      if (it.ans) body += para(it.ans, 0);
    });
  });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<hs:sec xmlns:hs="' + HS + '" xmlns:hp="' + HP + '" xmlns:hc="' + HC + '" xmlns:hh="' + HH + '">' + body + '</hs:sec>';
}

function buildHwpx(d) {
  const section = buildSection(d);
  return zipStore([
    { name: 'mimetype', data: mimetype },
    { name: 'version.xml', data: versionXml },
    { name: 'Contents/header.xml', data: headerXml },
    { name: 'Contents/section0.xml', data: section },
    { name: 'Contents/content.hpf', data: contentHpf },
    { name: 'settings.xml', data: settingsXml },
    { name: 'META-INF/container.xml', data: containerXml },
    { name: 'META-INF/manifest.xml', data: manifestXml }
  ]);
}

/* ---- 샘플 데이터로 테스트 ---- */
const sample = {
  title: 'be동사 & 일반동사 현재형', sub: '총 3문제 · 테스트', ans: true,
  sections: [{
    header: 'Point A · be동사', items: [
      { t: 'q', num: 1, stem: 'He ___ my teacher.', kor: '그는 나의 선생님이다.', opts: ['am', 'is', 'are', 'was'], bank: null, ans: '정답: is — 3인칭 단수 → is' },
      { t: 'p', p: { title: 'Passage A', body: 'I (1) lunch every day. We (2) at the same table.' } },
      { t: 'q', num: 2, stem: 'I ___ a book.', kor: '나는 책을 읽는다.', opts: [], bank: ['reading', 'am', 'a', 'book'], ans: '정답: am reading' }
    ]
  }]
};
fs.writeFileSync(__dirname + '/../.omc/test.hwpx', buildHwpx(sample));
console.log('wrote .omc/test.hwpx');
