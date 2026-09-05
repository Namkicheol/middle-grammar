const STORAGE_KEY = "mg.multiplayer.creatorDraft";
const SET_KEY = "mg.multiplayer.localSet";
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 30;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DATA_LENGTH = 350_000;
const MAX_SHEET_BYTES = 8 * 1024 * 1024;
const MAX_XLSX_ENTRIES = 200;
const MAX_XLSX_UNCOMPRESSED = 20 * 1024 * 1024;
const $ = (selector) => document.querySelector(selector);
const state = { questions: [], image: "" };

function clean(value) { return String(value ?? "").trim(); }
function announce(message, tone = "") { const el = $("#notice"); el.textContent = message; el.dataset.tone = tone; el.hidden = !message; }
function id() { return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function saveDraft() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ title: $("#set-title").value, questions: state.questions })); } catch { announce("자동저장 공간이 부족해요. 이미지를 줄이거나 JSON으로 내보내 보관하세요.", "error"); } }
function isSafeImageData(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_IMAGE_DATA_LENGTH) return false;
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/]+={0,2}$/i.test(value)) return false;
  try { return atob(value.slice(value.indexOf(",") + 1)).length > 0; } catch { return false; }
}
function normalizeQuestion(raw, index = 0) {
  if (!raw || typeof raw !== "object") return { error: `${index + 1}번 행은 문제 형식이 아니에요.` };
  const prompt = clean(raw.prompt || raw.question);
  const answer = clean(raw.answer);
  if (!prompt || !answer) return { error: `${index + 1}번 행은 문제와 정답이 모두 필요해요.` };
  if (prompt.length > 500) return { error: `${index + 1}번 행의 문제는 500자 이하로 입력해 주세요.` };
  if (answer.length > 200) return { error: `${index + 1}번 행의 정답은 200자 이하로 입력해 주세요.` };
  const rawChoices = Array.isArray(raw.choices) ? raw.choices : [];
  const choices = [...new Set(rawChoices.map(clean).filter(Boolean))].slice(0, 4);
  const image = raw.image ? String(raw.image) : "";
  if (image && !isSafeImageData(image)) return { error: `${index + 1}번 행의 이미지는 PNG, JPEG, WebP data 이미지(350KB 이하)만 사용할 수 있어요.` };
  return { question: { id: id(), prompt, answer, choices, image }, truncatedChoices: rawChoices.length > choices.length };
}
function importRows(rows, source = "문항") {
  const result = { added: 0, skipped: [], truncated: 0 };
  const room = MAX_QUESTIONS - state.questions.length;
  rows.forEach((row, index) => {
    if (result.added >= room) { result.skipped.push(`${index + 1}번 행: 최대 ${MAX_QUESTIONS}문항까지만 가져올 수 있어요.`); return; }
    const normalized = normalizeQuestion({ prompt: row?.[0], answer: row?.[1], choices: row?.slice(2) }, index);
    if (normalized.error) result.skipped.push(normalized.error);
    else if (imageTotal(state.questions) + imageLength(normalized.question.image) > 2_500_000) result.skipped.push(`${index + 1}번 행: 이미지 전체 용량이 2.5MB를 넘어요.`);
    else { state.questions.push(normalized.question); result.added += 1; if (normalized.truncatedChoices) result.truncated += 1; }
  });
  update();
  const detail = [result.added ? `${result.added}개 문항을 가져왔어요.` : `${source}에서 추가할 문항이 없어요.`];
  if (result.truncated) detail.push(`${result.truncated}개 행의 선택지는 4개로 줄였어요.`);
  if (result.skipped.length) detail.push(`${result.skipped.length}개 행은 건너뛰었어요. ${result.skipped.slice(0, 2).join(" ")}`);
  announce(detail.join(" "), result.added ? "success" : "error");
  return result;
}
function imageLength(image) { return isSafeImageData(image) ? image.length : 0; }
function imageTotal(questions) { return questions.reduce((total, question) => total + imageLength(question.image), 0); }
function renderQuestionList() {
  const list = $("#question-list");
  list.replaceChildren();
  if (!state.questions.length) { const empty = document.createElement("div"); empty.className = "empty"; empty.textContent = "아직 문항이 없어요. 위에서 첫 문항을 추가해 보세요."; list.append(empty); return; }
  state.questions.forEach((q, i) => {
    const card = document.createElement("article"); card.className = "question-card";
    const number = document.createElement("div"); number.className = "question-number"; number.textContent = i + 1;
    card.append(number);
    if (isSafeImageData(q.image)) { const image = document.createElement("img"); image.src = q.image; image.alt = "문항 이미지"; card.append(image); }
    const copy = document.createElement("div"); copy.className = "question-copy";
    const prompt = document.createElement("strong"); prompt.textContent = q.prompt; copy.append(prompt);
    const answer = document.createElement("span"); answer.textContent = `정답: ${q.answer}`; copy.append(answer);
    if (q.choices?.length) { const choices = document.createElement("small"); choices.textContent = `선택지: ${q.choices.join(", ")}`; copy.append(choices); }
    card.append(copy);
    const remove = document.createElement("button"); remove.className = "icon-button"; remove.type = "button"; remove.dataset.remove = q.id; remove.setAttribute("aria-label", `${i + 1}번 문항 삭제`); remove.textContent = "삭제"; card.append(remove);
    list.append(card);
  });
}
function update() {
  $("#question-count").textContent = `${state.questions.length}문항`;
  $("#validation-message").textContent = state.questions.length >= MIN_QUESTIONS ? "게임을 시작할 준비가 됐어요." : `게임을 만들려면 문항을 ${MIN_QUESTIONS - state.questions.length}개 더 추가하세요.`;
  $("#create-room").disabled = state.questions.length < MIN_QUESTIONS;
  renderQuestionList();
  saveDraft();
}
function addQuestion(prompt, answer, choices = [], image = "") {
  if (state.questions.length >= MAX_QUESTIONS) { announce(`최대 ${MAX_QUESTIONS}문항까지 만들 수 있어요.`, "error"); return false; }
  const normalized = normalizeQuestion({ prompt, answer, choices, image }, state.questions.length);
  if (normalized.error) { announce(normalized.error, "error"); return false; }
  if (imageTotal(state.questions) + imageLength(normalized.question.image) > 2_500_000) { announce("문항 이미지 전체 용량은 2.5MB 이하로 맞춰 주세요.", "error"); return false; }
  state.questions.push(normalized.question); update(); return true;
}
function parseDelimited(text, delimiter) {
  const source = text.replace(/^\uFEFF/, "");
  delimiter ||= source.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",";
  const rows = []; let cells = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === delimiter) { cells.push(clean(cell)); cell = ""; }
    else if (!quoted && char === "\n") { cells.push(clean(cell)); if (cells.some(Boolean)) rows.push(cells); cells = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  cells.push(clean(cell)); if (cells.some(Boolean)) rows.push(cells);
  return stripHeader(rows);
}
function parseBulkRows(text) {
  if (text.includes("\t") || text.includes(",")) return parseDelimited(text);
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const rows = [];
  for (let i = 0; i < lines.length; i += 2) rows.push([lines[i], lines[i + 1] || ""]);
  return rows;
}
function stripHeader(rows) {
  if (!rows.length) return rows;
  const first = rows[0].map((value) => clean(value).toLowerCase());
  const questionHeaders = new Set(["문제", "질문", "question", "term"]);
  const answerHeaders = new Set(["정답", "답", "answer", "definition"]);
  return questionHeaders.has(first[0]) && answerHeaders.has(first[1]) ? rows.slice(1) : rows;
}
function columnIndex(reference) {
  const letters = String(reference || "").match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "A";
  return [...letters].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1;
}
async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") throw new Error("이 브라우저에서는 .xlsx 압축을 읽을 수 없어요. CSV UTF-8로 저장해 주세요.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzipEntries(buffer, wanted = []) {
  const bytes = new Uint8Array(buffer); const view = new DataView(buffer); let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("올바른 .xlsx 파일이 아니에요.");
  const total = view.getUint16(eocd + 10, true);
  if (total > MAX_XLSX_ENTRIES) throw new Error(`Excel 파일의 압축 항목이 너무 많아요(${MAX_XLSX_ENTRIES}개 이하).`);
  let offset = view.getUint32(eocd + 16, true); const entries = new Map(); const wantedSet = new Set(wanted); let totalSize = 0;
  for (let index = 0; index < total; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Excel 파일 목록을 읽지 못했어요.");
    const method = view.getUint16(offset + 10, true); const compressedSize = view.getUint32(offset + 20, true); const uncompressedSize = view.getUint32(offset + 24, true);
    totalSize += uncompressedSize;
    if (totalSize > MAX_XLSX_UNCOMPRESSED) throw new Error("Excel 파일의 압축을 푼 크기가 너무 커요.");
    const nameLength = view.getUint16(offset + 28, true); const extraLength = view.getUint16(offset + 30, true); const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true); const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (wantedSet.has(name)) {
      if (localOffset + 30 > bytes.length) throw new Error("Excel 파일 항목 위치가 올바르지 않아요.");
      const localNameLength = view.getUint16(localOffset + 26, true); const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      if (start < 0 || start + compressedSize > bytes.length) throw new Error("Excel 파일 항목 크기가 올바르지 않아요.");
      const compressed = bytes.slice(start, start + compressedSize);
      const data = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
      if (!data || data.length > MAX_XLSX_UNCOMPRESSED || (uncompressedSize && data.length !== uncompressedSize)) throw new Error("지원하지 않거나 손상된 Excel 압축이에요.");
      entries.set(name, data);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
async function parseXlsx(file) {
  if (file.size > MAX_SHEET_BYTES) throw new Error("Excel 파일은 8MB 이하만 올릴 수 있어요.");
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder(); const parser = new DOMParser();
  const core = await unzipEntries(buffer, ["xl/workbook.xml", "xl/_rels/workbook.xml.rels"]);
  const xmlCore = (name) => core.get(name) ? parser.parseFromString(decoder.decode(core.get(name)), "application/xml") : null;
  const workbook = xmlCore("xl/workbook.xml"); const rels = xmlCore("xl/_rels/workbook.xml.rels");
  const relationId = workbook?.querySelector("sheet")?.getAttribute("r:id");
  const target = [...(rels?.querySelectorAll("Relationship") || [])].find((node) => node.getAttribute("Id") === relationId)?.getAttribute("Target");
  const sheetPath = target ? `xl/${target.replace(/^\/?(?:xl\/)?/, "")}` : "xl/worksheets/sheet1.xml";
  const entries = await unzipEntries(buffer, ["xl/sharedStrings.xml", sheetPath, "xl/worksheets/sheet1.xml"]);
  const xml = (name) => entries.get(name) ? parser.parseFromString(decoder.decode(entries.get(name)), "application/xml") : null;
  const shared = [...(xml("xl/sharedStrings.xml")?.querySelectorAll("si") || [])].map((node) => node.textContent || "");
  const sheet = xml(sheetPath) || xml("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("첫 번째 Excel 시트를 찾지 못했어요.");
  const rows = [...sheet.querySelectorAll("sheetData row")].map((row) => {
    const cells = [];
    row.querySelectorAll("c").forEach((cell) => {
      const type = cell.getAttribute("t"); const raw = cell.querySelector("v")?.textContent || "";
      const value = type === "s" ? shared[Number(raw)] || "" : type === "inlineStr" ? cell.querySelector("is")?.textContent || "" : raw;
      cells[columnIndex(cell.getAttribute("r"))] = clean(value);
    });
    return cells;
  }).filter((row) => row.some(Boolean));
  return stripHeader(rows);
}
function readImage(file) {
  return new Promise((resolve, reject) => { if (!file) return resolve(""); if (!file.type.startsWith("image/")) return reject(new Error("이미지 파일만 첨부할 수 있어요.")); if (file.size > 12 * 1024 * 1024) return reject(new Error("원본 이미지는 12MB 이하만 올릴 수 있어요.")); const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { let scale = Math.min(1, 960 / image.width, 960 / image.height, Math.sqrt(MAX_IMAGE_BYTES / Math.max(file.size, 1))); let data = ""; for (let attempt = 0; attempt < 6; attempt += 1) { const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); data = canvas.toDataURL("image/jpeg", Math.max(.58, .84 - attempt * .05)); if (data.length <= MAX_IMAGE_DATA_LENGTH) break; scale *= .78; } if (data.length > MAX_IMAGE_DATA_LENGTH) return reject(new Error("이미지를 충분히 줄이지 못했어요. 더 작은 사진을 선택해 주세요.")); resolve(data); }; image.onerror = () => reject(new Error("이미지를 읽지 못했어요.")); image.src = reader.result; }; reader.onerror = () => reject(new Error("이미지를 읽지 못했어요.")); reader.readAsDataURL(file); });
}
function download(filename, content) { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "application/json" })); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }

$("#question-form").addEventListener("submit", async (event) => { event.preventDefault(); const ok = addQuestion($("#question-text").value, $("#answer-text").value, clean($("#choices-text").value).split(","), state.image); if (!ok) return; event.target.reset(); state.image = ""; $("#image-preview").hidden = true; announce("문항을 추가했어요.", "success"); $("#question-text").focus(); });
$("#image-file").addEventListener("change", async (event) => { try { state.image = await readImage(event.target.files[0]); const preview = $("#image-preview"); preview.replaceChildren(); if (state.image) { const image = document.createElement("img"); image.src = state.image; image.alt = "첨부한 문항 이미지 미리보기"; const clear = document.createElement("button"); clear.type = "button"; clear.id = "clear-image"; clear.textContent = "이미지 제거"; preview.append(image, clear); } preview.hidden = !state.image; $("#clear-image")?.addEventListener("click", () => { state.image = ""; event.target.value = ""; preview.replaceChildren(); preview.hidden = true; }); } catch (error) { event.target.value = ""; announce(error.message, "error"); } });
$("#bulk-add").addEventListener("click", () => { const rows = parseBulkRows($("#bulk-text").value); if (!rows.length) { announce("문제와 정답을 탭, 쉼표 또는 두 줄씩 구분해 주세요.", "error"); return; } importRows(rows, "붙여넣은 내용"); $("#bulk-text").value = ""; });
$("#csv-file").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { const rows = /\.xlsx$/i.test(file.name) ? await parseXlsx(file) : parseDelimited(await file.text()); if (!rows.length) throw new Error("파일에서 문제와 정답을 찾지 못했어요."); importRows(rows, file.name); } catch (error) { announce(`파일을 읽지 못했어요: ${error.message}`, "error"); } event.target.value = ""; });
$("#question-list").addEventListener("click", (event) => { const button = event.target.closest("[data-remove]"); if (!button) return; state.questions = state.questions.filter((q) => q.id !== button.dataset.remove); update(); announce("문항을 삭제했어요."); });
$("#export-json").addEventListener("click", () => download(`${clean($("#set-title").value) || "quiz-set"}.json`, JSON.stringify({ version: 1, title: clean($("#set-title").value) || "내 퀴즈 세트", questions: state.questions }, null, 2)));
$("#import-json").addEventListener("click", () => $("#json-file").click());
$("#json-file").addEventListener("change", async (event) => { try { const data = JSON.parse(await event.target.files[0].text()); if (!Array.isArray(data.questions)) throw new Error("가져올 문항이 없어요."); const room = MAX_QUESTIONS - state.questions.length; const result = { added: 0, skipped: [], truncated: 0 }; if (data.questions.length > room) result.skipped.push(`${data.questions.length - room}개 행: 최대 ${MAX_QUESTIONS}문항까지만 가져올 수 있어요.`); data.questions.slice(0, room).forEach((q, index) => { const normalized = normalizeQuestion(q, index); if (normalized.error) result.skipped.push(normalized.error); else if (imageTotal(state.questions) + imageLength(normalized.question.image) > 2_500_000) result.skipped.push(`${index + 1}번 행: 이미지 전체 용량이 2.5MB를 넘어요.`); else { state.questions.push(normalized.question); result.added += 1; if (normalized.truncatedChoices) result.truncated += 1; } }); if (!result.added) throw new Error(result.skipped[0] || "가져올 문항이 없어요."); $("#set-title").value = clean(data.title) || $("#set-title").value; update(); const details = [`${result.added}개 문항을 가져왔어요.`]; if (result.truncated) details.push(`${result.truncated}개 행의 선택지는 4개로 줄였어요.`); if (result.skipped.length) details.push(`${result.skipped.length}개 행은 건너뛰었어요. ${result.skipped.slice(0, 2).join(" ")}`); announce(details.join(" "), "success"); } catch (error) { announce(`JSON을 가져오지 못했어요: ${error.message}`, "error"); } event.target.value = ""; });
$("#create-room").addEventListener("click", () => { if (state.questions.length < MIN_QUESTIONS) return; const set = { version: 1, id: "local", title: clean($("#set-title").value) || "내 퀴즈 세트", questions: state.questions, createdAt: new Date().toISOString() }; try { localStorage.setItem(SET_KEY, JSON.stringify(set)); localStorage.removeItem(STORAGE_KEY); location.href = "./?set=local"; } catch { announce("세트를 저장할 공간이 부족해요. 이미지 수를 줄이거나 JSON으로 내보내 보관하세요.", "error"); } });
$("#set-title").addEventListener("input", saveDraft);
try { const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); if (draft) { $("#set-title").value = clean(draft.title); const loaded = Array.isArray(draft.questions) ? draft.questions : []; let imageBytes = 0; state.questions = loaded.slice(0, MAX_QUESTIONS).map((question, index) => { const normalized = normalizeQuestion(question, index); if (normalized.error || imageBytes + imageLength(normalized.question.image) > 2_500_000) return null; imageBytes += imageLength(normalized.question.image); return normalized.question; }).filter(Boolean); update(); } } catch { localStorage.removeItem(STORAGE_KEY); }
