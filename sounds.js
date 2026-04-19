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

  // 첫 클릭(캡처 단계)에서 AudioContext 미리 생성 — 정답 확인 버튼보다 먼저 실행됨
  function prewarm() {
    document.removeEventListener('click', prewarm, true);
    ac();
  }
  document.addEventListener('click', prewarm, true);

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

  function watchResult(elId, scoreElId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var obs = new MutationObserver(function () {
      var d = el.style.display;
      if (d && d !== 'none') {
        obs.disconnect();
        var sEl = document.getElementById(scoreElId);
        var sc = sEl ? (parseInt(sEl.textContent) || 50) : 50;
        setTimeout(function () { playResult(sc); }, 350);
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ['style'] });
  }

  // sounds.js는 </body> 직전에 로드되므로 모든 함수가 이미 정의된 상태 — 즉시 래핑
  var _ot = window.toast;
  if (typeof _ot === 'function') {
    window.toast = function (msg, type) {
      _ot(msg, type);
      if (type === 'ok') playOk();
      else if (type === 'ng' && msg && msg.indexOf('틀렸') !== -1) playNg();
    };
  }

  // egmToast (gerund-basic/index.html — type: 'o'/'x')
  var _et = window.egmToast;
  if (typeof _et === 'function') {
    window.egmToast = function (msg, type) {
      _et(msg, type);
      if (type === 'o') playOk();
      else if (type === 'x' && msg && msg.indexOf('틀렸') !== -1) playNg();
    };
  }

  // 섹션 완료 팝업 사운드
  var _osp = window.showScorePopup;
  if (typeof _osp === 'function') {
    window.showScorePopup = function (correct, total, opts) {
      _osp(correct, total, opts);
      var sc = Math.round(correct / total * 100);
      setTimeout(function () { playResult(sc); }, 200);
    };
  }

  // 최종 결과화면 사운드
  watchResult('result', 'rs');          // 대부분의 워크시트
  watchResult('egm-result', 'r-score'); // gerund-basic/index.html

})();
