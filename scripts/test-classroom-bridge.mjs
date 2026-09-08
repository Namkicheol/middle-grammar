import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { ClassroomHost, safeQuestion } from "../multiplayer/classroom-host.js";

const bridgeSource = await readFile(new URL("../game/classroom-bridge.js", import.meta.url), "utf8");
const hostSource = await readFile(new URL("../multiplayer/classroom-host.js", import.meta.url), "utf8");
const parentOrigin = "https://grammar-match.example.workers.dev";
const posted = [];
const listeners = new Map();
const parent = { postMessage(message, origin) { posted.push({ message, origin }); } };
const window = {
  parent,
  location: { search: `?classroom=1&parentOrigin=${encodeURIComponent(parentOrigin)}` },
  addEventListener(type, callback) { listeners.set(type, callback); },
};
const context = vm.createContext({ window, location: window.location, URL, URLSearchParams, Promise, Error, Date, String, Number, Set, Map });
vm.runInContext(bridgeSource, context);

assert.equal(window.ClassroomMatch.enabled, true);
assert.equal(posted[0].origin, parentOrigin);
assert.equal(posted[0].message.channel, "mg-classroom-v1");
assert.equal(posted[0].message.type, "ready");

listeners.get("message")({ source: {}, origin: parentOrigin, data: { channel: "mg-classroom-v1", type: "config", value: { mode: "boss_battle", deadlineAt: Date.now() + 60_000 } } });
assert.equal(posted.length, 1, "wrong source must be ignored");
listeners.get("message")({ source: parent, origin: "https://attacker.example", data: { channel: "mg-classroom-v1", type: "config", value: { mode: "bad" } } });
assert.equal(posted.length, 1, "wrong origin must be ignored");
listeners.get("message")({ source: parent, origin: parentOrigin, data: { channel: "mg-classroom-v1", type: "config", value: { mode: "boss_battle", deadlineAt: Date.now() + 60_000 } } });
const config = await window.ClassroomMatch.ready;
assert.equal(config.mode, "boss_battle");
assert.equal("playerId" in config || "resumeToken" in config || "token" in config, false);

const raw = { id: "q1", occurrenceIndex: 2, eng: "Choose.", kor: "고르세요.", opts: ["A", "B"], correctAnswer: "A", resumeToken: "secret" };
const safe = safeQuestion(raw);
assert.deepEqual(Object.keys(safe).sort(), ["eng", "id", "kor", "occurrenceIndex", "opts"].sort());
assert.equal(JSON.stringify(safe).includes("secret"), false);

const answerPromise = window.ClassroomMatch.answer(safe, null);
const outgoing = posted.at(-1).message;
assert.equal(outgoing.type, "answer");
assert.equal(outgoing.answer, null, "child uses null timeout sentinel; parent converts it to an empty server answer");
await assert.rejects(() => window.ClassroomMatch.answer(safe, "A"), /DUPLICATE_ANSWER/);
listeners.get("message")({ source: parent, origin: parentOrigin, data: { channel: "mg-classroom-v1", type: "response", requestId: outgoing.requestId, ok: true, value: { correct: false, correctAnswer: "A", score: 0 } } });
assert.equal((await answerPromise).correct, false);

assert.match(bridgeSource, /event\.source !== window\.parent/);
assert.match(bridgeSource, /event\.origin !== expectedParentOrigin/);
assert.match(hostSource, /event\.source !== this\.iframe\?\.contentWindow/);
assert.match(hostSource, /event\.origin !== this\.childOrigin/);
assert.match(hostSource, /message\.answer === null \? ""/);
assert.doesNotMatch(hostSource, /resumeToken|playerId|socket-ticket/i);

function parentHarness() {
  const values={ score:{}, rank:{}, time:{}, ranks:{ innerHTML:"" } };
  const host=Object.assign(Object.create(ClassroomHost.prototype), {
    mode:"boss_battle", active:true, config:{}, question:null, questionKey:"", pending:null,
    completedKeys:new Set(), uncertainKeys:new Set(), waitingQuestions:[], responses:[],
    submissions:[], submitAnswer(question,answer,options) { this.submissions.push({question,answer,options}); },
    mount:{ querySelector(selector) { return selector.includes("score") ? values.score : selector.includes("rank]") ? values.rank : selector.includes("time") ? values.time : values.ranks; } },
    respond(requestId,ok,value) { this.responses.push({ requestId,ok,value }); },
  });
  return host;
}
const q1={ id:"q1", occurrenceIndex:0, eng:"One", kor:"하나", opts:["A","B"] };
const q2={ id:"q2", occurrenceIndex:1, eng:"Two", kor:"둘", opts:["A","B"] };
const last1={ questionId:"q1", occurrenceIndex:0, correct:true, correctAnswer:"A", score:100 };

// answer_result then room_state must keep the completed old question consumed.
{
  const host=parentHarness();
  host.question=safeQuestion(q1); host.questionKey="0:q1"; host.pending={ requestId:"a", key:"0:q1" };
  host.answerResult(last1);
  host.update({ question:q1, deadlineAt:Date.now()+1000, leaderboard:[], connected:true });
  assert.equal(host.question,null);
  host.update({ question:q2, deadlineAt:Date.now()+1000, leaderboard:[], connected:true });
  assert.equal(host.question.id,"q2");
}

// room_state carrying lastAnswer before a late answer_result must not erase its new question.
{
  const host=parentHarness();
  host.question=safeQuestion(q1); host.questionKey="0:q1"; host.pending={ requestId:"b", key:"0:q1" };
  host.update({ question:q2, lastAnswer:last1, deadlineAt:Date.now()+1000, leaderboard:[], connected:true });
  assert.equal(host.question.id,"q2");
  host.answerResult(last1);
  assert.equal(host.question.id,"q2");
}

// An accepted answer with a lost response stays quarantined until lastAnswer/next question proves state.
{
  const host=parentHarness();
  host.question=safeQuestion(q1); host.questionKey="0:q1"; host.pending={ requestId:"c", key:"0:q1" };
  host.update({ question:q1, deadlineAt:Date.now()+1000, leaderboard:[], connected:false });
  assert.equal(host.question,null);
  assert.equal(host.uncertainKeys.has("0:q1"),true);
  host.update({ question:q1, lastAnswer:last1, deadlineAt:Date.now()+1000, leaderboard:[], connected:true });
  assert.equal(host.question,null);
  assert.equal(host.completedKeys.has("0:q1"),true);
}

// Network loss before server acceptance resends the exact same attempt once after authoritative same-question state.
{
  const host=parentHarness();
  host.question=safeQuestion(q1); host.questionKey="0:q1";
  host.pending={ requestId:"d", key:"0:q1", question:safeQuestion(q1), answer:"A", needsReconcile:false };
  host.connectionChanged(false);
  host.update({ question:q1, deadlineAt:Date.now()+1000, leaderboard:[], connected:true });
  assert.equal(host.submissions.length,1);
  assert.equal(host.submissions[0].answer,"A");
  assert.equal(host.pending.needsReconcile,false);
  host.update({ question:q1, deadlineAt:Date.now()+1000, leaderboard:[], connected:true });
  assert.equal(host.submissions.length,1,"reconcile retry must happen only once");
}

// Network loss after acceptance resolves from lastAnswer; an advanced question without it rejects stale.
{
  const accepted=parentHarness();
  accepted.question=safeQuestion(q1); accepted.questionKey="0:q1";
  accepted.pending={ requestId:"e", key:"0:q1", question:safeQuestion(q1), answer:"A", needsReconcile:false };
  accepted.connectionChanged(false);
  accepted.update({ question:q1, lastAnswer:last1, deadlineAt:Date.now()+1000, leaderboard:[], connected:true });
  assert.equal(accepted.responses.at(-1).ok,true);
  assert.equal(accepted.submissions.length,0);

  const advanced=parentHarness();
  advanced.question=safeQuestion(q1); advanced.questionKey="0:q1";
  advanced.pending={ requestId:"f", key:"0:q1", question:safeQuestion(q1), answer:"A", needsReconcile:false };
  advanced.connectionChanged(false);
  advanced.update({ question:q2, deadlineAt:Date.now()+1000, leaderboard:[], connected:true });
  assert.deepEqual(advanced.responses.at(-1),{ requestId:"f", ok:false, value:"STALE_QUESTION" });
  assert.equal(advanced.question.id,"q2");
}
console.log("classroom bridge contract: ok");
