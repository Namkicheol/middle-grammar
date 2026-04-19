(function () {

  function storageKey() {
    return 'mg_score_' + location.pathname;
  }

  function getBest() {
    try { var d = localStorage.getItem(storageKey()); return d ? JSON.parse(d) : null; }
    catch (e) { return null; }
  }

  function saveBest(sc, correct, total) {
    try {
      var prev = getBest();
      if (!prev || sc >= prev.sc) {
        localStorage.setItem(storageKey(), JSON.stringify({
          sc: sc, correct: correct, total: total,
          date: new Date().toLocaleDateString('ko-KR')
        }));
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  function launchConfetti(overlay, duration) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483646;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var colors = ['#0ea5e9','#6366f1','#f59e0b','#10b981','#ef4444','#f472b6','#a78bfa'];
    var pieces = [];
    for (var i = 0; i < 140; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 9 + 4,
        speed: Math.random() * 2.5 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        tiltAngle: Math.random() * Math.PI * 2,
        tiltInc: (Math.random() * .06 + .03) * (Math.random() < .5 ? 1 : -1),
        shape: Math.random() < .5 ? 'rect' : 'circle'
      });
    }
    var end = Date.now() + duration;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var now = Date.now();
      var remaining = Math.max(0, end - now);
      ctx.globalAlpha = remaining < 600 ? remaining / 600 : 1;
      pieces.forEach(function (p) {
        p.tiltAngle += p.tiltInc;
        p.y += p.speed;
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
        var tilt = Math.sin(p.tiltAngle) * 14;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.shape === 'circle') {
          ctx.arc(p.x + tilt, p.y, p.r / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(p.x + tilt, p.y, p.r, p.r * .5);
        }
      });
      if (now < end) requestAnimationFrame(draw);
      else canvas.remove();
    }
    draw();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var prev = getBest();
    if (!prev) return;
    var badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;top:14px;right:14px;z-index:500;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border:1.5px solid #e2e8f0;border-radius:12px;padding:7px 14px;font-size:.82rem;color:#475569;font-weight:600;box-shadow:0 2px 12px rgba(0,0,0,.08);pointer-events:none;';
    badge.textContent = '🏅 최고 ' + prev.sc + '점 (' + prev.correct + '/' + prev.total + ')';
    document.body.appendChild(badge);
  });

  window.showScorePopup = function (correct, total) {
    var prev = getBest();
    var sc = Math.round(correct / total * 100);
    var isNew = saveBest(sc, correct, total);

    var emoji, title;
    if (sc >= 90) { emoji = '🏆'; title = '완벽해요!'; }
    else if (sc >= 70) { emoji = '🎉'; title = '잘 했어요!'; }
    else if (sc >= 50) { emoji = '💪'; title = '절반 이상 맞았어요!'; }
    else { emoji = '😊'; title = '수고했어요!'; }

    var recordText;
    if (isNew && !prev) { recordText = '🎯 첫 번째 도전 완료!'; }
    else if (isNew) { recordText = '🏅 신기록 달성! (이전 ' + prev.sc + '점)'; }
    else { recordText = '최고 기록 ' + prev.sc + '점 (' + prev.date + ')'; }

    try { window.scrollTo(0, 0); } catch (e) {}

    var old = document.getElementById('sp-overlay');
    if (old) old.parentNode.removeChild(old);

    /* overlay */
    var overlay = document.createElement('div');
    overlay.id = 'sp-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;';

    /* card */
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:28px;padding:40px 48px;text-align:center;max-width:400px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,.3);';

    /* emoji */
    var emojiEl = document.createElement('div');
    emojiEl.style.cssText = 'font-size:4rem;margin-bottom:6px;';
    emojiEl.textContent = emoji;

    /* clap */
    var clap = document.createElement('div');
    clap.style.cssText = 'font-size:1.8rem;letter-spacing:4px;margin-bottom:8px;';
    clap.textContent = '👏 👏 👏';

    /* title */
    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:1.5rem;font-weight:800;color:#1e293b;margin-bottom:6px;';
    titleEl.textContent = title;

    /* score */
    var scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size:3.5rem;font-weight:900;color:#0ea5e9;margin:6px 0;';
    scoreEl.textContent = sc + '점';

    /* sub */
    var sub = document.createElement('div');
    sub.style.cssText = 'color:#64748b;font-size:1rem;margin-bottom:10px;';
    sub.textContent = correct + ' / ' + total + ' 문제 정답';

    /* record */
    var rec = document.createElement('div');
    rec.style.cssText = 'font-size:.85rem;font-weight:700;padding:4px 14px;border-radius:20px;margin-bottom:22px;display:inline-block;' + (isNew ? 'background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;' : 'background:#f1f5f9;color:#64748b;');
    rec.textContent = recordText;

    /* retry button */
    var btn = document.createElement('button');
    btn.style.cssText = 'background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;border:none;border-radius:14px;padding:15px 40px;font-size:1.1rem;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(99,102,241,.4);display:block;margin:0 auto;';
    btn.textContent = '🔄 다시풀기';
    btn.onclick = function () { location.reload(); };

    card.appendChild(emojiEl);
    card.appendChild(clap);
    card.appendChild(titleEl);
    card.appendChild(scoreEl);
    card.appendChild(sub);
    card.appendChild(rec);
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    if (sc >= 50) launchConfetti(overlay, sc >= 70 ? 4000 : 2500);
  };
})();
