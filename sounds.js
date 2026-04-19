(function () {
  var _ctx = null;
  var _lastResult = 0;

  function ac() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (_ctx.state === 'suspended') _ctx.resume().catch(function () {});
    return _ctx;
  }

  // iOS Safari 포함 모바일 오디오 잠금 해제 — 첫 터치/클릭 시 실행
  function unlock() {
    document.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('click', unlock, true);
    var c = ac(); if (!c) return;
    // 무음 버퍼 재생으로 iOS Safari 잠금 해제
    var buf = c.createBuffer(1, 1, 22050);
    var src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    if (c.state === 'suspended') c.resume().catch(function () {});
  }
  document.addEventListener('touchstart', unlock, true);
  document.addEventListener('click', unlock, true);

  function tone(freq, type, t0, dur, vol) {
    var c = ac(); if (!c) return;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function playOk() {
    var c = ac(); if (!c) return;
    var t = c.currentTime;
    tone(659.25, 'sine', t,        0.12, 0.30); // E5
    tone(783.99, 'sine', t + 0.09, 0.19, 0.26); // G5
  }

  function playNg() {
    var c = ac(); if (!c) return;
    var t = c.currentTime;
    tone(293.66, 'triangle', t,        0.15, 0.16); // D4
    tone(246.94, 'triangle', t + 0.12, 0.20, 0.12); // B3
  }

  function playResult(sc) {
    var now = Date.now();
    if (now - _lastResult < 1500) return;
    _lastResult = now;
    var c = ac(); if (!c) return;
    var t = c.currentTime;
    if (sc >= 70) {
      tone(523.25, 'sine', t,        0.13, 0.32); // C5
      tone(659.25, 'sine', t + 0.13, 0.13, 0.32); // E5
      tone(783.99, 'sine', t + 0.26, 0.13, 0.32); // G5
      tone(1046.5,  'sine', t + 0.39, 0.44, 0.38); // C6
    } else if (sc >= 50) {
      tone(523.25, 'sine', t,        0.13, 0.27);
      tone(659.25, 'sine', t + 0.13, 0.13, 0.27);
      tone(783.99, 'sine', t + 0.26, 0.36, 0.30);
    } else {
      tone(523.25, 'sine', t,        0.13, 0.22);
      tone(587.33, 'sine', t + 0.13, 0.32, 0.22); // D5
    }
  }

  // toast div 클래스 변화 감지 (함수 래핑 대신 MutationObserver 사용)
  function watchToast(elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    new MutationObserver(function () {
      if (!el.classList.contains('show')) return;
      var txt = el.textContent || el.innerText || '';
      if (el.classList.contains('ok') || el.classList.contains('o')) {
        playOk();
      } else if ((el.classList.contains('ng') || el.classList.contains('x')) && txt.indexOf('틀렸') !== -1) {
        playNg();
      }
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  // egm-toast는 background color로 정답/오답 구분
  function watchEgmToast(elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    new MutationObserver(function () {
      if (!el.classList.contains('show')) return;
      var bg = el.style.background || '';
      var txt = el.textContent || el.innerText || '';
      if (bg.indexOf('10b981') !== -1 || bg.indexOf('10, 185, 129') !== -1) {
        playOk();
      } else if (txt.indexOf('틀렸') !== -1) {
        playNg();
      }
    }).observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  // 결과화면 감지 (display 변화 → 600ms 후 점수 읽기)
  function watchResult(elId, scoreElId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var obs = new MutationObserver(function () {
      var d = el.style.display;
      if (d && d !== 'none') {
        obs.disconnect();
        setTimeout(function () {
          var sEl = document.getElementById(scoreElId);
          var sc = sEl ? (parseInt(sEl.textContent) || 50) : 50;
          playResult(sc);
        }, 600);
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ['style'] });
  }

  // 섹션 완료 팝업 사운드 (window에 직접 할당된 함수라 래핑 안전)
  var _osp = window.showScorePopup;
  if (typeof _osp === 'function') {
    window.showScorePopup = function (correct, total, opts) {
      _osp(correct, total, opts);
      var sc = Math.round(correct / total * 100);
      setTimeout(function () { playResult(sc); }, 200);
    };
  }

  watchToast('toast');
  watchEgmToast('egm-toast');
  watchResult('result', 'rs');
  watchResult('egm-result', 'r-score');

})();
