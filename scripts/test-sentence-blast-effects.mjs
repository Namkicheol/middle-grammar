import fs from 'node:fs';

const html = fs.readFileSync('sentence-blast/index.html', 'utf8');
const css = fs.readFileSync('sentence-blast/play.css', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(html.includes('id="toast" role="status" aria-live="polite"'), 'effect announcements need a live status region');
assert(html.includes('class="effect-status" id="effect-status"') && html.includes('function setEffectStatus'), 'last effect summary must persist in the mission strip');
assert(html.includes("classList.toggle('super'"), 'SUPER BLAST needs a distinct persistent status state');
assert(html.includes("setTimeout(()=>t.className='toast',2100)"), 'effect announcements should remain readable for about two seconds');
assert(html.includes('라인 클리어') && html.includes('문법 폭발') && html.includes('SUPER BLAST'), 'effect announcements need explicit effect names');
assert(html.includes('가로·세로 1줄씩') && html.includes('가로·세로 2줄씩') && html.includes('칸 · +') && html.includes('+800 · 즉시'), 'announcements must describe the existing clear consequence');
assert(html.includes('line(comboN,count)') && html.includes('if(comboN>1)gameTone'), 'combo clear sound layer is missing');
assert(html.includes('blast(superBlast=false)') && html.includes('gameSfx.blast(superBlast)'), 'ordinary and super blast sounds must remain distinct');
assert(html.includes("boardEl.classList.add(strong?'line-clear':'bonk')"), 'line clear visual pulse trigger is missing');
assert(css.includes('.board.line-clear') && css.includes('@keyframes board-line-clear'), 'line clear pulse style is missing');
assert(css.includes('font-size:13px') && css.includes('.effect-status.super'), 'persistent effect label must remain readable and distinct');
assert(css.includes('blast-polish 1.3s') && css.includes('blast-sweep 1.3s'), 'blast visual should remain legible beyond a brief flash');
assert(css.includes('.blast-flash.on::after') && css.includes('animation:none!important'), 'blast sweep must respect reduced motion');
assert(css.includes('max-width:calc(100vw - 28px)') && css.includes('white-space:normal'), 'mobile announcements must wrap without horizontal overflow');
assert(html.includes('PLAY_PHASE_SECONDS=15') && html.includes('CHALLENGE_SECONDS=10'), 'challenge timing contract changed');
assert(html.includes('usedSentenceIds.clear()'), 'stale sentence-id cleanup must remain intact');
assert(html.includes("if(grammarTotal<2)") && html.includes('choiceQuestions'), 'challenge pool warm-up/filter contract changed');

console.log('PASS: Sentence Blast effect announcement, sound, visual, and timing contracts');
