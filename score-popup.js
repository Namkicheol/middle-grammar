(function () {
  var _injected = false;

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

  function injectCSS() {
    if (_injected) return;
    _injected = true;
    var style = document.createElement('style');
    style.textContent = [
      '#sp-overlay{position:fixed!important;top:0!important;left:0!important;width:100%!important;height:100%!important;z-index:2147483647!important;',
      'background:rgba(0,0,0,.6);backdrop-filter:blur(6px);',
      'display:flex!important;align-items:center!important;justify-content:center!important;}',
      '#sp-card{background:#fff;border-radius:28px;padding:44px 52px;text-align:center;max-width:400px;width:92%;',
      'box-shadow:0 24px 64px rgba(0,0,0,.32);animation:sp-si .45s cubic-bezier(.34,1.56,.64,1);}',
      '@keyframes sp-si{from{transform:scale(.65);opacity:0}to{transform:scale(1);opacity:1}}',
      '#sp-emoji{font-size:4.2rem;margin-bottom:6px;animation:sp-bounce 1s ease infinite alternate;}',
      '@keyframes sp-bounce{from{transform:translateY(0)}to{transform:translateY(-8px)}}',
      '#sp-clap{font-size:2rem;letter-spacing:4px;margin-bottom:8px;animation:sp-clap .6s ease infinite alternate;}',
      '@keyframes sp-clap{from{transform:scale(1)}to{transform:scale(1.25)}}',
      '#sp-title{font-size:1.55rem;font-weight:800;color:#1e293b;margin-bottom:6px;}',
      '#sp-score{font-size:3.8rem;font-weight:900;background:linear-gradient(135deg,#0ea5e9,#6366f1);',
      '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:6px 0;}',
      '#sp-sub{color:#64748b;font-size:1rem;margin-bottom:10px;}',
      '#sp-record{font-size:.85rem;font-weight:700;padding:4px 14px;border-radius:20px;margin-bottom:22px;display:inline-block;}',
      '#sp-record.new{background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;}',
      '#sp-record.prev{background:#f1f5f9;color:#64748b;}',
      '#sp-btns{display:flex;flex-direction:column;gap:10px;}',
      '#sp-retry{background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;border:none;border-radius:14px;',
      'padding:15px 40px;font-size:1.1rem;font-weight:700;cursor:pointer;',
      'box-shadow:0 6px 20px rgba(99,102,241,.4);transition:transform .15s,box-shadow .15s;}',
      '#sp-retry:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(99,102,241,.5);}',
      '#sp-retry:active{transform:translateY(0);}',
      '#sp-next{background:#fff;color:#0ea5e9;border:2px solid #0ea5e9;border-radius:14px;',
      'padding:13px 40px;font-size:1.05rem;font-weight:700;cursor:pointer;transition:all .15s;}',
      '#sp-next:hover{background:#e0f2fe;}',
      '#sp-canvas{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1000000;}',
      '#sp-badge{position:fixed;top:14px;right:14px;z-index:500;background:rgba(255,255,255,.92);',
      'backdrop-filter:blur(8px);border:1.5px solid #e2e8f0;border-radius:12px;padding:7px 14px;',
      'font-size:.82rem;color:#475569;font-weight:600;box-shadow:0 2px 12px rgba(0,0,0,.08);',
      'pointer-events:none;}'
    ].join('');
    document.head.appendChild(style);
  }

  function launchConfetti(duration) {
    var canvas = document.createElement('canvas');
    canvas.id = 'sp-canvas';
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
      var alpha = remaining < 600 ? remaining / 600 : 1;
      ctx.globalAlpha = alpha;
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
    injectCSS();
    var badge = document.createElement('div');
    badge.id = 'sp-badge';
    badge.textContent = '🏅 최고 ' + prev.sc + '점 (' + prev.correct + '/' + prev.total + ')';
    document.body.appendChild(badge);
  });

  window.showScorePopup = function (correct, total, opts) {
    injectCSS();
    opts = opts || {};
    var prev = getBest();
    var sc = Math.round(correct / total * 100);
    var isNew = saveBest(sc, correct, total);

    var emoji, title;
    if (sc >= 90) { emoji = '🏆'; title = '완벽해요!'; }
    else if (sc >= 70) { emoji = '🎉'; title = '잘 했어요!'; }
    else if (sc >= 50) { emoji = '💪'; title = '절반 이상 맞았어요!'; }
    else { emoji = '😊'; title = '수고했어요!'; }

    var recordHtml;
    if (isNew && !prev) {
      recordHtml = '<div id="sp-record" class="new">🎯 첫 번째 도전 완료!</div>';
    } else if (isNew) {
      recordHtml = '<div id="sp-record" class="new">🏅 신기록 달성! (이전 ' + prev.sc + '점)</div>';
    } else if (prev) {
      recordHtml = '<div id="sp-record" class="prev">최고 기록 ' + prev.sc + '점 (' + prev.date + ')</div>';
    } else {
      recordHtml = '<div id="sp-record" class="new">🎯 첫 번째 도전 완료!</div>';
    }

    try { window.scrollTo(0, 0); } catch(e) {}

    var old = document.getElementById('sp-overlay');
    if (old) old.parentNode.removeChild(old);

    var overlay = document.createElement('div');
    overlay.id = 'sp-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.zIndex = '2147483647';
    overlay.style.background = 'rgba(0,0,0,.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.opacity = '1';
    overlay.innerHTML =
      '<div id="sp-card">' +
        '<div id="sp-emoji">' + emoji + '</div>' +
        '<div id="sp-clap">👏 👏 👏</div>' +
        '<div id="sp-title">' + title + '</div>' +
        '<div id="sp-score">' + sc + '점</div>' +
        '<div id="sp-sub">' + correct + ' / ' + total + ' 문제 정답</div>' +
        recordHtml +
        '<div id="sp-btns">' +
          (opts.nextText ? '<button id="sp-next">' + opts.nextText + '</button>' : '') +
          '<button id="sp-retry">🔄 다시풀기</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    if (opts.nextText) {
      document.getElementById('sp-next').onclick = opts.onNextClick || function () {};
    }
    document.getElementById('sp-retry').onclick = function () { location.reload(); };

    if (sc >= 50) launchConfetti(sc >= 70 ? 4000 : 2500);
  };
})();
