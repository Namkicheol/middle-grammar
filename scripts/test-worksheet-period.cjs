const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const files = [
  "be-verb/v2.html",
  "exclaim-something-basic/index.html",
  "exclaim-something-hard/index.html",
  "g2-causative-asas-basic/index.html",
  "g2-causative-asas-hard/index.html",
  "g2-give-relclause-basic/index.html",
  "g2-give-relclause-hard/index.html",
  "g2-itto-whatto-basic/index.html",
  "g2-itto-whatto-hard/index.html",
  "g2-passive-practice/index.html",
  "g2-perceive-indirectq-basic/index.html",
  "g2-perceive-indirectq-hard/index.html",
  "g2-perfect-compare-basic/index.html",
  "g2-perfect-compare-hard/index.html",
  "g2-sothat-passive-basic/index.html",
  "g2-sothat-passive-hard/index.html",
  "g2-to-if-basic/index.html",
  "g2-to-if-hard/index.html",
  "g2-want-relclause-basic/index.html",
  "g2-want-relclause-hard/index.html",
  "general-verb-hard/index.html",
  "gerund-basic/index.html",
  "gerund-basic/index2.html",
  "gerund-hard/index.html",
  "look-because-basic/index.html",
  "look-because-hard/index.html",
  "make-that-basic/index.html",
  "make-that-hard/index.html",
  "past-be/index.html",
  "past-be-hard/index.html",
  "reflexive-to-basic/index.html",
  "reflexive-to-hard/index.html",
  "to-will-basic/index.html",
  "to-will-hard/index.html"
];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/function\s+(norm|normAns)\s*\(\s*s\s*\)\s*\{([\s\S]*?)\n\}/);
  assert(match, `${file}: normalizer missing`);
  const norm = vm.runInNewContext(`(${match[0]})`);
  const equal = (a, b) => norm(a) === norm(b);
  assert(equal('She made us happy.', 'She made us happy'), `${file}: final period`);
  assert(equal('The value is 3.14.', 'The value is 3.14'), `${file}: decimal sentence`);
  assert(!equal('The value is 3.14', 'The value is 314'), `${file}: decimal changed`);
  assert(!equal('She made us sad.', 'She made us happy'), `${file}: wrong sentence`);
  assert(!equal('a-b', 'ab'), `${file}: internal punctuation`);
  assert(equal('happy.', 'happy'), `${file}: single answer`);
  {
    assert(!equal('Inc.', 'Inc'), `${file}: company abbreviation`);
    assert(!equal('3.', '3'), `${file}: integer dot`);
    assert(!equal('Dr.', 'Dr'), `${file}: standalone abbreviation`);
    assert(!equal('Meet Dr.', 'Meet Dr'), `${file}: abbreviation`);
    assert(!equal('I live in the U.S.', 'I live in the U.S'), `${file}: acronym`);
  }
}
console.log(`${files.length} worksheet normalizers passed`);
