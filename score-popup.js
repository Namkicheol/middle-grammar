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
      '#sp-review{background:#fff7ed;color:#c2410c;border:2px solid #fed7aa;border-radius:14px;',
      'padding:13px 40px;font-size:1.05rem;font-weight:800;cursor:pointer;transition:all .15s;}',
      '#sp-review:hover{background:#ffedd5;border-color:#fb923c;}',
      '#sp-next{background:#fff;color:#0ea5e9;border:2px solid #0ea5e9;border-radius:14px;',
      'padding:13px 40px;font-size:1.05rem;font-weight:700;cursor:pointer;transition:all .15s;}',
      '#sp-next:hover{background:#e0f2fe;}',
      '#sp-card.reviewing{max-width:760px;max-height:88vh;overflow:auto;text-align:left;padding:30px 34px;}',
      '#sp-card.reviewing #sp-emoji,#sp-card.reviewing #sp-clap{display:none;}',
      '#sp-card.reviewing #sp-title,#sp-card.reviewing #sp-score,#sp-card.reviewing #sp-sub{text-align:center;}',
      '#sp-review-panel{display:none;margin-top:18px;padding-top:18px;border-top:1px solid #e2e8f0;}',
      '#sp-review-head{font-size:1.05rem;font-weight:900;color:#1e293b;margin-bottom:12px;}',
      '.sp-wrong-item{background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:14px 16px;margin-bottom:12px;',
      'font-size:.9rem;line-height:1.65;color:#334155;}',
      '.sp-wrong-q{font-weight:800;color:#1e293b;margin-bottom:7px;}',
      '.sp-wrong-meta{font-size:.86rem;margin-bottom:7px;}',
      '.sp-my{color:#dc2626;font-weight:800;text-decoration:line-through;}',
      '.sp-right{color:#059669;font-weight:900;}',
      '.sp-wrong-hint{background:#fef9c3;border-radius:10px;padding:10px 12px;color:#854d0e;font-weight:650;}',
      '@media(max-width:560px){#sp-card{padding:34px 24px;}#sp-card.reviewing{padding:24px 18px;width:94%;}',
      '#sp-review,#sp-next,#sp-retry{padding-left:18px;padding-right:18px;font-size:1rem;}}',
      '#sp-canvas{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1000000;}',
      '#sp-badge{position:fixed;top:14px;right:14px;z-index:500;background:rgba(255,255,255,.92);',
      'backdrop-filter:blur(8px);border:1.5px solid #e2e8f0;border-radius:12px;padding:7px 14px;',
      'font-size:.82rem;color:#475569;font-weight:600;box-shadow:0 2px 12px rgba(0,0,0,.08);',
      'pointer-events:none;}'
    ].join('');
    document.head.appendChild(style);
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function getText(node) {
    return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function getCardId(card) {
    if (!card || !card.id) return '';
    return card.id.replace(/^qc-/, '');
  }

  function getAnsweredValue(id, key) {
    var a = window.answered;
    if (!a || !id || !a[id] || typeof a[id] !== 'object') return '';
    return a[id][key] || '';
  }

  function getRightAnswer(card, id) {
    var fromAnswered = getAnsweredValue(id, 'right');
    if (fromAnswered) return fromAnswered;
    var ansNode = card.querySelector('[data-ans]');
    if (ansNode && ansNode.dataset && ansNode.dataset.ans) return ansNode.dataset.ans;
    var revealed = card.querySelector('.choice.reveal,.choice-btn.reveal');
    if (revealed) return getText(revealed);
    var hintStrong = card.querySelector('.answer-hint strong,.hint-box strong');
    return getText(hintStrong);
  }

  function getMyAnswer(card, id) {
    var fromAnswered = getAnsweredValue(id, 'my');
    if (fromAnswered) return fromAnswered;
    var wrongChoice = card.querySelector('.choice.ng,.choice-btn.ans-x');
    if (wrongChoice) return getText(wrongChoice);
    var wrongInput = card.querySelector('input.ng,.q-input.ans-x');
    if (wrongInput) return wrongInput.value;
    var chips = card.querySelectorAll('.ng-chip');
    if (chips.length) {
      return Array.prototype.map.call(chips, function (chip) { return getText(chip); }).join(' ');
    }
    return '';
  }

  function getQuestionText(card) {
    var num = getText(card.querySelector('.q-num'));
    var type = getText(card.querySelector('.q-type'));
    var parts = [];
    ['.q-sub', '.q-eng', '.q-text', '.q-kor'].forEach(function (sel) {
      var txt = getText(card.querySelector(sel));
      if (txt) parts.push(txt);
    });
    var prefix = num ? '문항 ' + num + (type ? ' · ' + type : '') + ': ' : '';
    return prefix + (parts.join(' / ') || getText(card));
  }

  function getHintHtml(card, id) {
    var hint = card.querySelector('.answer-hint,.hint-box') || document.getElementById('ah-' + id);
    if (!hint) return '';
    return hint.innerHTML;
  }

  function getWrongCards(opts) {
    var selector = '.question-card.ng,.q-card.solved-x';
    if (opts && opts.nextText) {
      var currentSection = document.querySelector('.sec.show,.sec.active');
      if (currentSection) return currentSection.querySelectorAll(selector);
    }
    return document.querySelectorAll(selector);
  }

  function collectWrongItems(opts) {
    if (opts && Array.isArray(opts.wrongItems)) return opts.wrongItems;
    var items = [];
    var seen = {};
    var cards = getWrongCards(opts);

    Array.prototype.forEach.call(cards, function (card) {
      var id = getCardId(card);
      var key = id || getQuestionText(card);
      if (seen[key]) return;
      seen[key] = true;
      items.push({
        question: getQuestionText(card),
        my: getMyAnswer(card, id),
        right: getRightAnswer(card, id),
        hintHtml: getHintHtml(card, id)
      });
    });

    if (!items.length && Array.isArray(window.wrongs)) {
      window.wrongs.forEach(function (w) {
        items.push({
          question: w.q || '',
          my: w.ma || '',
          right: w.ca || '',
          hintHtml: ''
        });
      });
    }

    return items;
  }

  function renderWrongItems(items) {
    if (!items.length) return '';
    return '<div id="sp-review-panel">' +
      '<div id="sp-review-head">틀린 문항 ' + items.length + '개</div>' +
      items.map(function (item) {
        return '<div class="sp-wrong-item">' +
          '<div class="sp-wrong-q">' + escapeHtml(item.question || '문항') + '</div>' +
          '<div class="sp-wrong-meta">내 답: <span class="sp-my">' + escapeHtml(item.my || '(없음)') +
          '</span> → 정답: <span class="sp-right">' + escapeHtml(item.right || '') + '</span></div>' +
          (item.hintHtml ? '<div class="sp-wrong-hint">' + item.hintHtml + '</div>' : '') +
        '</div>';
      }).join('') +
    '</div>';
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
    var wrongItems = collectWrongItems(opts);

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
          (wrongItems.length ? '<button id="sp-review">틀린 문항 확인</button>' : '') +
          '<button id="sp-retry">🔄 다시풀기</button>' +
        '</div>' +
        renderWrongItems(wrongItems) +
      '</div>';
    document.body.appendChild(overlay);
    if (opts.nextText) {
      document.getElementById('sp-next').onclick = opts.onNextClick || function () {};
    }
    if (wrongItems.length) {
      document.getElementById('sp-review').onclick = function () {
        var card = document.getElementById('sp-card');
        var panel = document.getElementById('sp-review-panel');
        card.classList.add('reviewing');
        panel.style.display = 'block';
        this.style.display = 'none';
      };
    }
    document.getElementById('sp-retry').onclick = function () { location.reload(); };

    if (sc >= 50) launchConfetti(sc >= 70 ? 4000 : 2500);
  };
})();
