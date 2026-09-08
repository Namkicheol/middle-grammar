import http from "node:http";
import net from "node:net";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const repo = new URL("../", import.meta.url).pathname;
const appSource = await readFile(new URL("../multiplayer/app.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing app.js function: ${name}`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  if (next < 0) throw new Error(`Cannot locate end of app.js function: ${name}`);
  return appSource.slice(start, next).trim();
}

const actualFunctions = ["escapeRecord", "escapeTimeLabel", "serverRankedEntries", "resultPodiumHtml", "resultStageHtml", "studentResultView"].map(extractFunction).join("\n");
const people = [
  { id:"p1", nickname:"민준", rank:1, score:2480, correctCount:18, answeredCount:20, avgResponseMs:3140, isSelf:true },
  { id:"p2", nickname:"서윤", rank:2, score:2210, correctCount:17, answeredCount:20, avgResponseMs:3510 },
  { id:"p3", nickname:"도윤", rank:3, score:1960, correctCount:15, answeredCount:20, avgResponseMs:4020 },
];
const teams = [
  { teamNumber:1, rank:1, score:5200 }, { teamNumber:2, rank:2, score:4810 }, { teamNumber:3, rank:3, score:4460 },
];

function renderActual(kind, count, team, fixtureCase = "") {
  let players = people.slice(0, count);
  if (fixtureCase === "tie") players = people.map((player, index) => ({ ...player, rank:index < 2 ? 1 : 3, score:index < 2 ? 2480 : 1960 }));
  if (fixtureCase === "long") players = people.map((player, index) => ({ ...player, nickname:`아주긴학생닉네임테스트${index + 1}호`, score:987654321-index*11111111 }));
  if (fixtureCase === "escape") players = people.map((player, index) => ({ ...player, escape:{ roomsCleared:3-index, escapedAt:index < 2 ? 1_700_000_060_000+index*20_000 : undefined } }));
  if (players.length) players[0] = { ...players[0], isSelf:true };
  const state = { room:{ leaderboard:players, self:players[0] || { nickname:"참가자", rank:0, score:0 }, playStyle:team ? "team" : "individual", teamLeaderboard:team ? teams : [], startedAt:1_700_000_000_000 } };
  const context = {
    state,
    roomMode:()=>"score_race", currentPlayer:()=>state.room.self, isTeamMode:()=>team,
    teamLeaderboard:()=>teams, roomPlayers:()=>players, playerName:(p)=>p?.nickname || "학생",
    playerScore:(p)=>Number(p?.score || 0), playerCorrect:(p)=>Number(p?.correctCount || 0),
    playerAnswered:(p)=>Number(p?.answeredCount || 0), playerAverageMs:(p)=>Number(p?.avgResponseMs || 0),
    playerAccuracy:(p)=>p?.answeredCount ? Math.round(p.correctCount / p.answeredCount * 100) : 0,
    escapeHtml:(v)=>String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"),
    soloGameUrl:()=>"http://localhost:8791/game/", studentEscapeResultView:()=>"", formatTime:(seconds)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")}`,
  };
  vm.createContext(context);
  const options = `{team:${team},escape:${fixtureCase === "escape"}}`;
  vm.runInContext(`${actualFunctions}; globalThis.output = ${kind === "student" && fixtureCase !== "escape" ? "studentResultView()" : `resultStageHtml(${team ? "teamLeaderboard()" : "roomPlayers()"}, ${options})`};`, context);
  if (kind === "student") return context.output;
  return `<section class="screen room-shell"><article class="panel"><p class="eyebrow">LOCAL TEACHER FIXTURE</p><h1 id="result-title">교사 결과 리포트</h1><p class="muted">실제 계정 및 게임방 데이터가 아닙니다.</p></article><article class="panel result-screen">${context.output}</article></section>`;
}

function page(url) {
  const kind = url.pathname.includes("teacher") ? "teacher" : "student";
  const count = Math.max(0, Math.min(3, Number(url.searchParams.get("players") ?? 3)));
  const team = url.searchParams.get("team") === "1" || kind === "teacher" && url.searchParams.get("case") === "team";
  const fixtureCase = url.searchParams.get("case") || "";
  const content = renderActual(kind, count, team, fixtureCase);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>LOCAL 결과 QA</title><link rel="stylesheet" href="http://localhost:8791/multiplayer/styles.css"><link rel="stylesheet" href="http://localhost:8791/multiplayer/results.css"><style>body{padding:16px;background:#eef3f1}.fixture-banner{position:relative;z-index:9;margin:0 auto 12px;max-width:1180px;padding:9px 12px;border:2px solid #b42318;border-radius:8px;color:#7a271a;background:#fef3f2;font-weight:900}#app{padding-top:8px}.fixture-nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.fixture-nav a{font-size:12px}</style></head><body><div class="fixture-banner">LOCAL FIXTURE · 실제 계정/게임방 데이터 없음<div class="fixture-nav"><a href="/student?players=0">학생 0명</a><a href="/student?players=1">학생 1명</a><a href="/student?players=2">학생 2명</a><a href="/student?players=3">학생 3명</a><a href="/student?players=3&case=tie">공동 순위</a><a href="/student?players=3&case=long">긴 이름</a><a href="/student?players=3&case=escape">탈출</a><a href="/teacher?case=team">팀전</a><a href="/mobile">390px</a></div></div><main id="app">${content}</main><script type="module">import{initResultPresentation,updateResultPresentation}from'/live-results.js';initResultPresentation();updateResultPresentation(document.querySelector('#app'),'local-fixture-${kind}-${count}-${team}-${fixtureCase}');</script></body></html>`;
}

function mobilePage() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>390px LOCAL 결과 QA</title><style>body{margin:0;background:#183f3c;color:white;font:14px system-ui;text-align:center}iframe{display:block;width:390px;max-width:100%;height:844px;margin:12px auto;border:2px solid #e7c66c;background:white}</style></head><body><strong>LOCAL FIXTURE · 390 × 844</strong><iframe title="390px 학생 결과" src="/student?players=3"></iframe></body></html>`;
}

async function portFree(port) {
  return new Promise((resolve) => { const socket = net.createConnection({ port, host:"127.0.0.1" }); socket.once("connect",()=>{socket.destroy();resolve(false)}); socket.once("error",()=>resolve(true)); });
}

let staticServer = null;
if (await portFree(8791)) {
  staticServer = spawn("python3", ["-m", "http.server", "8791", "--bind", "127.0.0.1", "--directory", repo], { stdio:"ignore" });
  console.log(`static http://localhost:8791 pid=${staticServer.pid}`);
} else console.log("static http://localhost:8791 already running");

if (!(await portFree(8792))) throw new Error("localhost:8792 is already in use");
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost:8792");
  if (url.pathname === "/live-results.js") {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(await readFile(new URL("../multiplayer/results.js", import.meta.url), "utf8"));
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(url.pathname === "/mobile" ? mobilePage() : page(url));
});
server.listen(8792, "127.0.0.1", () => console.log(`preview http://localhost:8792 pid=${process.pid}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { staticServer?.kill(); server.close(()=>process.exit(0)); });
