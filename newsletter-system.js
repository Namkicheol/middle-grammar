(function () {
  'use strict';

  var config = window.NEWSLETTER_SYSTEM || {};
  var endpoint = String(config.endpoint || '').trim();
  var siteKey = String(config.siteKey || '').trim();
  var siteName = String(config.siteName || document.title || '학습자료');
  var ownerEmail = String(config.ownerEmail || 'obangti@gmail.com');

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function currentItemId() {
    var id = new URLSearchParams(location.search).get('id');
    return id || document.body.getAttribute('data-card-id') || '화면 전체';
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '.ns-modal[hidden]{display:none!important}',
      '.ns-modal{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.58)}',
      '.ns-panel{width:min(520px,100%);max-height:min(720px,92vh);overflow:auto;background:#fff;color:#172033;border-radius:22px;box-shadow:0 28px 80px rgba(15,23,42,.35);padding:24px}',
      '.ns-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}',
      '.ns-title{margin:0;font-size:1.35rem;line-height:1.3}',
      '.ns-sub{margin:6px 0 0;color:#64748b;font-size:.92rem;line-height:1.55}',
      '.ns-close{border:0;background:#eef2f7;color:#334155;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;flex:0 0 auto}',
      '.ns-form{display:grid;gap:14px}',
      '.ns-field{display:grid;gap:6px;font-size:.88rem;font-weight:700;color:#334155}',
      '.ns-field input,.ns-field select,.ns-field textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:12px 13px;background:#fff;color:#0f172a;font:inherit;font-weight:500}',
      '.ns-field textarea{min-height:130px;resize:vertical}',
      '.ns-consent{display:flex;gap:9px;align-items:flex-start;color:#475569;font-size:.82rem;line-height:1.55}',
      '.ns-consent input{margin-top:4px;flex:0 0 auto}',
      '.ns-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:2px}',
      '.ns-btn{border:0;border-radius:12px;padding:11px 16px;font:inherit;font-weight:800;cursor:pointer}',
      '.ns-btn.primary{background:linear-gradient(135deg,#1565c0,#00897b);color:#fff}',
      '.ns-btn.secondary{background:#eef2f7;color:#334155}',
      '.ns-status{min-height:22px;margin:0;color:#166534;font-size:.88rem;font-weight:700}',
      '.ns-hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}',
      '@media(max-width:520px){.ns-panel{padding:20px;border-radius:18px}.ns-actions{flex-direction:column-reverse}.ns-btn{width:100%}}'
    ].join('');
    document.head.appendChild(style);
  }

  function modalTemplate() {
    return '<div class="ns-panel" role="dialog" aria-modal="true" aria-labelledby="ns-title">' +
      '<div class="ns-head"><div><h2 class="ns-title" id="ns-title"></h2><p class="ns-sub" id="ns-sub"></p></div>' +
      '<button class="ns-close" type="button" aria-label="닫기">×</button></div>' +
      '<div id="ns-body"></div></div>';
  }

  function subscribeForm() {
    return '<form class="ns-form" data-ns-form="subscribe">' +
      '<input type="hidden" name="action" value="subscribe"><input type="hidden" name="site" value="' + escapeHtml(siteKey) + '">' +
      '<label class="ns-field">이메일 주소<input type="email" name="email" autocomplete="email" required placeholder="name@example.com"></label>' +
      '<label class="ns-consent"><input type="checkbox" name="consent" value="yes" required><span>업데이트 안내를 위해 이메일 주소를 수집·이용하는 데 동의합니다. 수집 항목은 이메일 주소이며, 구독 취소 또는 서비스 종료 시까지 보관합니다. 동의를 거부할 수 있으나 업데이트 알림은 받을 수 없습니다.</span></label>' +
      '<label class="ns-hp" aria-hidden="true">웹사이트<input type="text" name="website" tabindex="-1" autocomplete="off"></label>' +
      '<p class="ns-status" aria-live="polite"></p>' +
      '<div class="ns-actions"><button class="ns-btn secondary" type="button" data-ns-close>취소</button><button class="ns-btn primary" type="submit">확인 메일 받기</button></div>' +
      '</form>';
  }

  function reportForm() {
    return '<form class="ns-form" data-ns-form="report">' +
      '<input type="hidden" name="action" value="report"><input type="hidden" name="site" value="' + escapeHtml(siteKey) + '">' +
      '<input type="hidden" name="page_url" value="' + escapeHtml(location.href) + '"><input type="hidden" name="item_id" value="' + escapeHtml(currentItemId()) + '">' +
      '<label class="ns-field">오류 종류<select name="category" required><option value="정답">정답</option><option value="해설">해설</option><option value="문제 본문">문제 본문</option><option value="화면">화면</option><option value="기타">기타</option></select></label>' +
      '<label class="ns-field">오류 내용<textarea name="description" minlength="10" maxlength="2000" required placeholder="어느 부분이 어떻게 잘못되었는지 적어 주세요."></textarea></label>' +
      '<label class="ns-field">회신받을 이메일 (선택)<input type="email" name="reporter_email" autocomplete="email" placeholder="name@example.com"></label>' +
      '<label class="ns-hp" aria-hidden="true">웹사이트<input type="text" name="website" tabindex="-1" autocomplete="off"></label>' +
      '<p class="ns-status" aria-live="polite"></p>' +
      '<div class="ns-actions"><button class="ns-btn secondary" type="button" data-ns-close>취소</button><button class="ns-btn primary" type="submit">오류 신고 보내기</button></div>' +
      '</form>';
  }

  function mailtoFallback(action, values) {
    var subject = action === 'subscribe'
      ? '[' + siteName + '] 업데이트 알림 신청'
      : '[' + siteName + ' 오류 신고] ' + currentItemId();
    var body = action === 'subscribe'
      ? '업데이트 알림을 신청합니다.\n\n이메일: ' + (values.email || '') + '\n개인정보 수집·이용: 동의함'
      : '페이지: ' + location.href + '\n종류: ' + (values.category || '') + '\n\n' + (values.description || '');
    location.href = 'mailto:' + ownerEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  async function submitForm(form) {
    var status = form.querySelector('.ns-status');
    var submit = form.querySelector('[type="submit"]');
    var values = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    status.textContent = '전송 중…';

    if (!endpoint) {
      mailtoFallback(values.action, values);
      status.textContent = '메일 작성 창을 열었습니다.';
      submit.disabled = false;
      return;
    }

    try {
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
        body: new URLSearchParams(values).toString()
      });
      status.textContent = values.action === 'subscribe'
        ? '확인 메일을 보냈습니다. 메일의 확인 버튼을 눌러 주세요.'
        : '오류 신고를 접수했습니다. 감사합니다.';
      form.reset();
    } catch (error) {
      status.textContent = '자동 전송에 실패해 메일 작성 창을 엽니다.';
      mailtoFallback(values.action, values);
    } finally {
      submit.disabled = false;
    }
  }

  function init() {
    if (!siteKey) return;
    injectStyles();

    var modal = document.createElement('div');
    modal.className = 'ns-modal';
    modal.hidden = true;
    modal.innerHTML = modalTemplate();
    document.body.appendChild(modal);

    var title = modal.querySelector('#ns-title');
    var sub = modal.querySelector('#ns-sub');
    var body = modal.querySelector('#ns-body');
    var lastFocus = null;

    function close() {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    }

    function open(type, trigger) {
      lastFocus = trigger || document.activeElement;
      if (type === 'subscribe') {
        title.textContent = '업데이트 알림 받기';
        sub.textContent = siteName + '의 새 자료와 중요한 수정 소식을 이메일로 알려드립니다.';
        body.innerHTML = subscribeForm();
      } else {
        title.textContent = '오류 신고';
        sub.textContent = '현재 페이지 주소가 자동으로 함께 전달됩니다.';
        body.innerHTML = reportForm();
      }
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      var firstInput = body.querySelector('input:not([type="hidden"]),select,textarea');
      if (firstInput) firstInput.focus();
    }

    document.querySelectorAll('[data-newsletter-open]').forEach(function (trigger) {
      trigger.addEventListener('click', function (event) { event.preventDefault(); open('subscribe', trigger); });
    });
    document.querySelectorAll('[data-error-report-open]').forEach(function (trigger) {
      trigger.addEventListener('click', function (event) { event.preventDefault(); open('report', trigger); });
    });
    modal.addEventListener('click', function (event) {
      if (event.target === modal || event.target.closest('.ns-close,[data-ns-close]')) close();
    });
    modal.addEventListener('submit', function (event) {
      event.preventDefault();
      submitForm(event.target);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.hidden) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
