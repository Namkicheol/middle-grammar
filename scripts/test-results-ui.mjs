import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = await readFile(path.join(root, "multiplayer/app.js"), "utf8");
const css = await readFile(path.join(root, "multiplayer/results.css"), "utf8");
const presentation = await readFile(path.join(root, "multiplayer/results.js"), "utf8");

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} 함수가 있어야 합니다.`);
  const next = app.indexOf("\nfunction ", start + 10);
  return app.slice(start, next === -1 ? app.length : next);
}

const podium = functionBody("resultPodiumHtml");
const rankedEntries = functionBody("serverRankedEntries");
assert.match(podium, /Number\(entry\.rank\) <= 3/, "podium은 서버 rank 1~3만 보여야 합니다.");
assert.match(rankedEntries, /filter\(\(entry\) => Number\(entry\?\.rank\) > 0\)/, "rank가 없는 참가자의 순위를 만들면 안 됩니다.");
assert.doesNotMatch(podium, /playerAccuracy|playerCorrect|answeredCount|playerAnswered/, "공개 podium에 다른 학생의 학습 지표를 노출하면 안 됩니다.");
assert.match(podium, /ranked\.filter\(\(entry\) => Number\(entry\.rank\) === rank\)/, "동점자는 같은 rank 단상 안에 함께 표시해야 합니다.");
assert.match(podium, /results-podium-people/, "동점자의 이름과 기록을 겹치지 않는 목록으로 표시해야 합니다.");
assert.match(podium, /results-podium-crown|const crown/, "1위에 자체 제작 왕관 그래픽이 있어야 합니다.");

for (const name of ["studentResultView", "studentEscapeResultView"]) {
  const body = functionBody(name);
  assert.match(body, /playerAccuracy\(me\)/, `${name}에 내 정답률이 있어야 합니다.`);
  assert.match(body, /playerCorrect\(me\)/, `${name}에 내 정답 수가 있어야 합니다.`);
  assert.match(body, /resultStageHtml/, `${name}에 podium이 있어야 합니다.`);
}

for (const name of ["teacherReportView", "teacherEscapeReportView"]) {
  const body = functionBody(name);
  assert.match(body, /report-table/, `${name}의 교사 전용 전체 표를 유지해야 합니다.`);
  assert.match(body, /playerAccuracy\(player\)/, `${name} 교사 표에 학생별 정답률이 있어야 합니다.`);
}

assert.match(app, /isTeamMode\(\) \? teamLeaderboard\(\) : roomPlayers\(\)/, "학생 팀전은 팀 podium을 사용해야 합니다.");
assert.match(css, /grid-template-areas:\s*"second first third"/, "실제 1·2·3 단상 배치가 있어야 합니다.");
assert.match(css, /@media \(max-width: 430px\)/, "390px 모바일 대응 규칙이 있어야 합니다.");
assert.match(css, /text-overflow:\s*ellipsis/, "긴 닉네임이 레이아웃을 넘치면 안 됩니다.");
assert.match(css, /prefers-reduced-motion:\s*reduce/, "reduced motion을 지원해야 합니다.");
assert.match(css, /results-confetti/, "결과 화면의 일회성 축하 연출이 있어야 합니다.");
assert.match(presentation, /sessionStorage\.getItem\(key\)/, "재렌더·재접속 시 팡파르 중복 재생을 막아야 합니다.");
assert.match(presentation, /data-results-fanfare/, "자동 재생 실패 시 수동 재생 버튼을 지원해야 합니다.");
assert.doesNotMatch(presentation, /resumeToken|accessToken|authToken/i, "결과 연출 모듈은 인증 토큰을 저장하면 안 됩니다.");

console.log("results UI checks passed");
