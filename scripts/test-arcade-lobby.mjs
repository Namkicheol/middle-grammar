import fs from 'node:fs';

const html = fs.readFileSync('game/index.html', 'utf8');
const css = fs.readFileSync('game/arcade-lobby.css', 'utf8');
const multiplayerIndex = fs.readFileSync('multiplayer/index.html', 'utf8');
const multiplayerApp = fs.readFileSync('multiplayer/app.js', 'utf8');
const soloEscape = fs.readFileSync('escape/index.html', 'utf8');
const creatorHtml = fs.readFileSync('multiplayer/creator.html', 'utf8');
const creatorCss = fs.readFileSync('multiplayer/creator.css', 'utf8');
const modes = ['boss', 'speed', 'whack', 'bubble', 'tower', 'rangers', 'sentence'];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(html.includes('<section class="game-select mode-library"'), 'mode library is not the lobby first step');
assert(html.includes('id="lobby-config" hidden'), 'grade configuration must start hidden');
assert(html.includes('id="unit-section"') && html.includes('id="unit-section" aria-labelledby="unit-heading" hidden'), 'topic configuration must start hidden');
assert(!html.includes('id="mode-summary"'), 'old mode summary must not remain in the art-first lobby');
assert(!html.includes('콤보와 필살기로 보스 격파'), 'mode descriptions should not return as card bodies');
assert(html.includes('lobbyConfig.hidden = false') && html.includes('unitSection.hidden = false'), 'mode selection must reveal configuration');
assert(html.includes("function soloLaunchQuery(unitKey)"), 'solo launch query helper missing');
assert(html.includes("query.set('autostart', '1')") && html.includes("query.set('unit', unitKey || 'all')") && html.includes("query.set('seconds', String(seconds))"), 'solo launch query must preserve unit, autostart, and seconds');
assert(html.includes("location.href = '../game2/' + soloLaunchQuery(unitKey)"), 'boss route contract missing');
assert(html.includes("location.href = '../whack-grammar/' + soloLaunchQuery(unitKey)"), 'whack route contract missing');
assert(html.includes("location.href = '../tower/' + soloLaunchQuery(unitKey)"), 'tower route contract missing');
assert(html.includes("location.href = '../grammar-rangers/' + soloLaunchQuery(unitKey)"), 'rangers route contract missing');
assert(html.includes("new URLSearchParams(location.search).get('mode')") && html.includes('requestedModeButton.click()'), 'hub mode deep-link must preselect the requested game');
assert(html.includes("location.href = '../sentence-blast/' + soloLaunchQuery(unitKey)"), 'sentence route contract missing');
assert(!html.includes('data-mode="escape"'), 'retired solo escape mode must not remain selectable');
assert(!html.includes("location.href = '../escape/'"), 'retired solo escape route must not remain');
assert(html.includes('mode-coming-soon') && html.includes('NEW GAME COMING SOON'), 'retired solo escape must be a non-clickable coming-soon card');
assert(html.includes('id="multiplayer-join-cta"'), 'student multiplayer CTA must be present');
assert(html.includes('href="../multiplayer/?join=1"'), 'student CTA must target the supported student join parameter');
assert(html.includes('멀티 참여하기') && html.includes('학생 방 번호 입력') && html.includes('aria-label="멀티 참여하기, 학생 방 번호 입력, 베타 버전"'), 'student CTA must explain its direct room-entry purpose');
assert(html.includes("roomInputUrl.searchParams.set('join', '1')") && html.includes("roomInputUrl.searchParams.delete('room')"), 'student CTA must preserve the dynamic worker destination without a stale room code');
assert(!html.includes('야간학교 탈출') && html.includes('mode-coming-soon') && html.includes('NEW GAME COMING SOON'), 'retired solo escape must render only a neutral coming-soon card');
assert(multiplayerApp.includes('const RETIRED_GAME_MODES') && multiplayerApp.includes('game-cover-coming-soon') && multiplayerApp.includes('game-cover-placeholder') && multiplayerApp.includes('aria-label="NEW GAME COMING SOON"'), 'retired multiplayer modes must render only neutral coming-soon cards');
assert(!multiplayerApp.includes('data-action="select-game" data-game-mode="treasure_heist"'), 'retired treasure mode must not be selectable');
assert(multiplayerApp.includes('value: "space_raiders"') && multiplayerApp.includes('우주 약탈단'), 'space raiders must be selectable in the multiplayer picker');
assert(soloEscape.includes('NEW GAME COMING SOON') && soloEscape.includes('href="../game/"') && !soloEscape.includes('야간학교 탈출') && !soloEscape.includes('./game.js'), 'direct solo escape page must be a neutral static coming-soon page');
assert(css.includes('.multi-entry-cta') && css.includes('min-height:48px'), 'student CTA needs a touch-safe responsive rule');
assert(multiplayerIndex.includes('class="product-beta-badge"') && multiplayerIndex.includes('β BETA'), 'multiplayer header must expose its beta status');
assert(multiplayerApp.includes('initialParams.get("room")'), 'multiplayer must continue to support the room query parameter');
assert(multiplayerApp.includes('initialParams.get("join") === "1"') && multiplayerApp.includes('restoreStudentIntent()'), 'multiplayer must support a direct student join entry');
assert(multiplayerApp.includes('url.searchParams.delete("join")'), 'joining a room must clear the one-shot student intent');
const teacherBootstrap = multiplayerApp.indexOf('if (await restoreTeacherIntent()) return;');
const resumeBootstrap = multiplayerApp.indexOf('if (await restoreStudentSession()) return;');
const studentBootstrap = multiplayerApp.indexOf('if (restoreStudentIntent()) return;');
assert(teacherBootstrap >= 0 && resumeBootstrap > teacherBootstrap && studentBootstrap > resumeBootstrap, 'teacher and resume entry priorities must precede direct student join');
assert(multiplayerApp.includes('class="product-beta-badge"'), 'multiplayer entry UI must expose its beta status');
assert(creatorHtml.includes('class="product-beta-badge"'), 'multiplayer creator must carry the product beta label');
assert(creatorCss.includes('.product-beta-badge'), 'creator beta label must have scoped styling');
for (const mode of modes) {
  assert(html.includes(`data-mode="${mode}"`), `mode button missing: ${mode}`);
  assert(css.includes(`data-mode="${mode}"] .mode-thumb`), `cover art selector missing: ${mode}`);
}
assert(css.includes('.mode-thumb{position:absolute;') && css.includes('.mode-copy{position:absolute;'), 'cover art titles are not layered');

console.log('PASS: art-first arcade lobby and mode-selection contracts');
