import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../multiplayer/app.js',import.meta.url),'utf8');
const roomHelpers=[
  source.slice(source.indexOf('function parseRoom(payload)'),source.indexOf('\nconst TREASURE_EVENT_LABELS')),
  source.slice(source.indexOf('function setRoomFromPayload'),source.indexOf('\nfunction roomStatus')),
].join('\n');
const restore=source.slice(source.indexOf('async function restoreStudentSession()'),source.indexOf('\nasync function restoreTeacherIntent()'));
const records=new Map([['id','student-a'],['token','local-token'],['room','111111']]);
let requests=0;
const snapshotSyncs=[];
const state={roomCode:'222222'};
const ctx=vm.createContext({state,SESSION_ROOM_CODE:'room',SESSION_PLAYER_ID:'id',SESSION_RESUME_TOKEN:'token',sessionStorage:{getItem:k=>records.get(k)},render(){},setStatus(){},roomApi:{async getRoomState(){requests++;return {status:'playing'}}},syncTreasureSnapshot(room,options){snapshotSyncs.push({room,options})},roomStatus:r=>r.status,connectLiveRoom(){},clearStudentCredentials(){throw Error('must not erase old room identity')},friendlyError:String});
vm.runInContext(`${roomHelpers}\n${restore}`,ctx);
assert.equal(await vm.runInContext('restoreStudentSession()',ctx),false);
assert.equal(requests,0,'new room must not receive credentials from the old room');
assert.equal(records.get('id'),'student-a','visiting another room should not erase original identity');
state.roomCode='111111';
assert.equal(await vm.runInContext('restoreStudentSession()',ctx),true);
assert.equal(requests,1);
assert.equal(state.playerId,'student-a');
assert.equal(snapshotSyncs.length,1,'same-room restore should use setRoomFromPayload');
assert.equal(snapshotSyncs[0].room,state.room);
console.log('PASS: room-scoped reconnect and original-room resume');
