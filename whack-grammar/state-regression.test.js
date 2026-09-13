#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(new URL('index.html', `file://${__dirname}/`), 'utf8');

assert.match(html, /const _validUnitParam = _unitParam === 'all'/, 'whack must accept the explicit all pool');
assert.match(html, /GAME_QUESTIONS\[_unitParam\] && !GAME_QUESTIONS\[_unitParam\]\.hidden/, 'whack must reject hidden and legacy unit keys');
assert.match(html, /location\.replace\('\.\.\/game\/\?mode=whack'\)/, 'invalid solo launch must return to whack mode picker');
assert.match(html, /html\[data-solo-launch\] #screen-start\{display:none!important;\}/, 'solo launch must hide the legacy start screen before paint');
assert.match(html, /if \(new URLSearchParams\(location\.search\)\.get\('classroom'\) !== '1'\)/, 'classroom launches must retain their ready gate');
assert.match(html, /} else if \(_validUnitParam\) \{\s*startGame\(\);/, 'only a valid solo unit may auto-start without a gate delay');
assert.doesNotMatch(html, /setTimeout\(startGame, 60\)/, 'solo whack launch must not wait for a gate-flash delay');

console.log('Whack Grammar launch regression checks passed.');
