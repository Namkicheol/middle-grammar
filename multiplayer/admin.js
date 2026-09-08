import { roomApi } from "./api.js";

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
let teachers = [];
let offset = 0;
let hasMore = false;
let loading = false;
let requestVersion = 0;
let selected = null;
let saving = false;
let filterSearch = "";
let filterStatus = "all";

function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").dataset.tone = error ? "error" : "success";
  $("notice").hidden = !message;
}

function messageFor(error) {
  if (error.code === "BAN_SESSION_REVOCATION_FAILED") return "계정은 차단됐지만 진행 중 연결을 모두 종료하지 못했어요. 차단하기를 다시 눌러 마무리해 주세요.";
  if (["ADMIN_SELF_MODERATION", "ADMIN_TARGET_PROTECTED"].includes(error.code)) return "관리자 계정은 이 화면에서 차단하거나 해제할 수 없어요.";
  if (error.code === "INVALID_BAN_REASON") return "차단 사유는 300자 이내로 입력해 주세요.";
  if (error.status === 401) return "로그인 시간이 끝났어요. 다시 로그인해 주세요.";
  if (error.status === 403) return error.code === "CSRF_INVALID" ? "로그인 상태를 다시 확인한 뒤 시도해 주세요." : "관리자 권한이 필요하거나 보호된 계정이에요.";
  if (error.status === 404) return "교사 계정을 찾지 못했어요. 목록을 새로 확인해 주세요.";
  return "처리하지 못했어요. 연결을 확인하고 다시 시도해 주세요.";
}

async function api(path, body) {
  const headers = new Headers();
  if (body) {
    const session = await roomApi.getTeacherSession();
    if (!session.authenticated || session.teacher?.role !== "admin") throw {status: session.authenticated ? 403 : 401};
    headers.set("Content-Type", "application/json");
    if (session.csrfToken) headers.set("X-CSRF-Token", session.csrfToken);
  }
  const response = await fetch(`/api/admin/teachers${path}`, {method:body ? "POST" : "GET",credentials:"same-origin",headers,...(body ? {body:JSON.stringify(body)} : {})});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw {status:response.status,code:payload.code || payload.error};
  return payload;
}

function dateLabel(value) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "기록 없음" : date.toLocaleDateString("ko-KR");
}

function renderList() {
  $("teacher-list").innerHTML = teachers.length ? teachers.map((teacher, index) => `<article class="teacher-row"><div><p class="teacher-email">${escapeHtml(teacher.email)}</p><div class="teacher-meta"><span class="badge ${teacher.banned ? "banned" : teacher.role === "admin" ? "admin" : ""}">${teacher.banned ? "차단됨" : teacher.role === "admin" ? "관리자" : "이용 중"}</span><span>가입 ${dateLabel(teacher.createdAt)}</span><span>최근 로그인 ${dateLabel(teacher.lastLoginAt)}</span></div>${teacher.banned && teacher.banReason ? `<p class="ban-reason">${escapeHtml(teacher.banReason)}</p>` : ""}</div>${teacher.role === "admin" ? `<span class="protected">보호 계정</span>` : `<button type="button" class="${teacher.banned ? "unban-button" : "ban-button"}" data-teacher-index="${index}" aria-label="${escapeHtml(teacher.email)} ${teacher.banned ? "차단 해제" : "차단"}">${teacher.banned ? "차단 해제" : "차단"}</button>`}</article>`).join("") : `<p class="empty">${filterSearch || filterStatus !== "all" ? "조건에 맞는 교사가 없어요." : "아직 가입한 교사가 없어요."}</p>`;
  $("page-info").textContent = teachers.length ? `${offset + 1}–${offset + teachers.length}` : "";
  $("previous").disabled = loading || offset === 0;
  $("next").disabled = loading || !hasMore;
}

async function load() {
  const version = ++requestVersion;
  loading = true;
  $("teacher-list").setAttribute("aria-busy", "true");
  $("previous").disabled = $("next").disabled = true;
  try {
    const result = await api(`?${new URLSearchParams({search:filterSearch,status:filterStatus,offset:String(offset)})}`);
    if (version !== requestVersion) return;
    teachers = Array.isArray(result.teachers) ? result.teachers : [];
    hasMore = Boolean(result.hasMore);
  } catch (error) {
    if (version !== requestVersion) return;
    teachers = []; hasMore = false;
    notice(messageFor(error), true);
  } finally {
    if (version === requestVersion) {
      loading = false;
      $("teacher-list").setAttribute("aria-busy", "false");
      renderList();
    }
  }
}

$("filters").addEventListener("submit", (event) => {
  event.preventDefault();
  filterSearch = $("search").value.trim(); filterStatus = $("status").value; offset = 0;
  notice(""); load();
});
$("previous").addEventListener("click", () => { if (!loading) { offset = Math.max(0, offset - 50); load(); } });
$("next").addEventListener("click", () => { if (!loading && hasMore) { offset += 50; load(); } });
$("teacher-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-teacher-index]");
  if (!button || loading) return;
  selected = teachers[Number(button.dataset.teacherIndex)];
  if (!selected || selected.role === "admin") return;
  $("dialog-title").textContent = selected.banned ? "차단을 해제할까요?" : "이 교사를 차단할까요?";
  $("target-email").textContent = selected.email;
  $("dialog-description").textContent = selected.banned ? "해제한 교사는 Google로 다시 로그인한 뒤 이용할 수 있어요." : "기존 로그인이 무효화되고 게임방 운영과 새 로그인이 제한됩니다.";
  $("reason-field").hidden = selected.banned;
  $("reason").value = "";
  $("dialog-error").hidden = true;
  $("confirm-action").textContent = selected.banned ? "차단 해제" : "차단하기";
  $("confirm-action").className = selected.banned ? "primary" : "danger";
  $("moderation-dialog").showModal();
});
$("cancel-action").addEventListener("click", () => { if (!saving) $("moderation-dialog").close(); });
$("moderation-dialog").addEventListener("cancel", (event) => { if (saving) event.preventDefault(); });
$("moderation-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saving || !selected) return;
  saving = true;
  $("confirm-action").disabled = $("cancel-action").disabled = true;
  $("dialog-error").hidden = true;
  try {
    await api(selected.banned ? "/unban" : "/ban", {teacherId:selected.id,...(!selected.banned ? {reason:$("reason").value.trim()} : {})});
    notice(selected.banned ? "차단을 해제했습니다. 다시 로그인하면 이용할 수 있어요." : "교사 계정을 차단했습니다.");
    $("moderation-dialog").close();
    await load();
  } catch (error) {
    $("dialog-error").textContent = messageFor(error);
    $("dialog-error").hidden = false;
  } finally {
    saving = false;
    $("confirm-action").disabled = $("cancel-action").disabled = false;
  }
});

async function start() {
  try {
    const session = await roomApi.getTeacherSession();
    if (!session.authenticated) {
      $("gate").innerHTML = `<h2>관리자 로그인이 필요해요</h2><p>지정된 관리자 Google 계정으로 로그인해 주세요.</p><a class="login-link" href="${escapeHtml(roomApi.loginUrl('/multiplayer/admin.html'))}">Google로 로그인</a>`;
      return;
    }
    if (session.teacher?.role !== "admin") {
      $("gate").innerHTML = `<h2>관리자 전용 화면입니다</h2><p>교사 계정에서는 이 기능을 이용할 수 없어요.</p><a href="./?teacher=1">교사 화면으로 돌아가기</a>`;
      return;
    }
    $("gate").hidden = true; $("management").hidden = false;
    $("admin-email").textContent = session.teacher.email;
    await load();
  } catch {
    $("gate").innerHTML = `<h2>연결을 확인하지 못했어요</h2><p>잠시 뒤 다시 시도해 주세요.</p><button id="retry" type="button">다시 확인</button>`;
    $("retry").addEventListener("click", start, {once:true});
  }
}
start();
