import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import { getTeacherSessionByHash, requireTeacherSession } from "../src/auth";
import type { Env } from "../src/types";

const origin = "http://127.0.0.1";
const settings = { ...env, ENVIRONMENT:"development", GOOGLE_CLIENT_ID:"id", GOOGLE_CLIENT_SECRET:"secret", AUTH_ORIGIN:origin, TEACHER_SIGNUP_MODE:"open", ADMIN_EMAILS:"admin@example.com" } as Env;
const adminHeaders = { origin, "x-dev-teacher-email":"admin@example.com" };

beforeEach(async () => {
  await env.REPORTS.exec("DELETE FROM teacher_moderation_audit; DELETE FROM teacher_moderation; DELETE FROM teacher_session_rooms; DELETE FROM teacher_sessions; DELETE FROM teacher_identities;");
  const now=Date.now();
  await env.REPORTS.prepare("INSERT INTO teacher_identities (google_sub,email,created_at,updated_at) VALUES (?,?,?,?)").bind("teacher-sub","teacher@example.com",now,now).run();
});

describe("teacher moderation admin API", () => {
  it("rejects anonymous and ordinary teachers while an explicitly configured admin can list", async () => {
    expect((await worker.fetch(new Request(`${origin}/api/admin/teachers`),settings)).status).toBe(401);
    expect((await worker.fetch(new Request(`${origin}/api/admin/teachers`,{headers:{origin,"x-dev-teacher-email":"teacher@example.com"}}),settings)).status).toBe(403);
    const response=await worker.fetch(new Request(`${origin}/api/admin/teachers?status=active&search=teacher` ,{headers:adminHeaders}),settings);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({teachers:[{id:"teacher-sub",email:"teacher@example.com",role:"teacher",banned:false}],hasMore:false});
    const localOnly={...settings,GOOGLE_CLIENT_ID:undefined,GOOGLE_CLIENT_SECRET:undefined,AUTH_ORIGIN:undefined} as Env;
    expect((await worker.fetch(new Request(`${origin}/api/admin/teachers`,{headers:adminHeaders}),localOnly)).status).toBe(200);
    const now=Date.now();
    await env.REPORTS.prepare("INSERT INTO teacher_identities (google_sub,email,created_at,updated_at) VALUES (?,?,?,?)").bind("underscore-sub","name_tag@example.com",now,now+1).run();
    const exact=await worker.fetch(new Request(`${origin}/api/admin/teachers?search=name_tag`,{headers:adminHeaders}),settings);
    expect((await exact.json<any>()).teachers.map((teacher:any)=>teacher.email)).toEqual(["name_tag@example.com"]);
  });

  it("bans by stable subject, revokes old sessions, audits, and unban does not revive them", async () => {
    const raw="existing-session"; const hash=await digest(raw); const csrf=await digest(`csrf:${raw}`);
    await env.REPORTS.prepare("INSERT INTO teacher_sessions (session_hash,google_sub,email,csrf_hash,created_at,expires_at,revoked_at) VALUES (?,?,?,?,?,?,NULL)").bind(hash,"teacher-sub","teacher@example.com",await digest(csrf),Date.now(),Date.now()+60_000).run();
    const ban=await worker.fetch(new Request(`${origin}/api/admin/teachers/ban`,{method:"POST",headers:{...adminHeaders,"content-type":"application/json"},body:JSON.stringify({teacherId:"teacher-sub",reason:"수업 계정 아님"})}),settings);
    expect(ban.status).toBe(200);
    expect(await getTeacherSessionByHash(settings,hash)).toBeNull();
    await expect(requireTeacherSession(new Request(`${origin}/api/teacher/rooms`,{headers:{cookie:`mg_teacher=${raw}`}}),settings)).rejects.toMatchObject({code:"TEACHER_LOGIN_REQUIRED"});
    expect(await env.REPORTS.prepare("SELECT action,actor_email,reason FROM teacher_moderation_audit").first()).toMatchObject({action:"ban",actor_email:"admin@example.com",reason:"수업 계정 아님"});
    const unban=await worker.fetch(new Request(`${origin}/api/admin/teachers/unban`,{method:"POST",headers:{...adminHeaders,"content-type":"application/json"},body:JSON.stringify({teacherId:"teacher-sub"})}),settings);
    expect(unban.status).toBe(200);
    expect(await getTeacherSessionByHash(settings,hash)).toBeNull();
    const freshHash=await digest("fresh-session");
    await env.REPORTS.prepare("INSERT INTO teacher_sessions (session_hash,google_sub,email,csrf_hash,created_at,expires_at,revoked_at) VALUES (?,?,?,?,?,?,NULL)").bind(freshHash,"teacher-sub","teacher@example.com","unused",Date.now(),Date.now()+60_000).run();
    expect(await getTeacherSessionByHash(settings,freshHash)).toMatchObject({email:"teacher@example.com",role:"teacher"});
  });

  it("guards admin targets, self, malformed ids, reasons, status, and offset", async () => {
    const now=Date.now();
    await env.REPORTS.prepare("INSERT INTO teacher_identities (google_sub,email,created_at,updated_at) VALUES (?,?,?,?)").bind("admin-sub","admin@example.com",now,now).run();
    const post=(path:string,body:unknown)=>worker.fetch(new Request(`${origin}${path}`,{method:"POST",headers:{...adminHeaders,"content-type":"application/json"},body:JSON.stringify(body)}),settings);
    expect((await post("/api/admin/teachers/ban",{teacherId:"admin-sub"})).status).toBe(400);
    expect((await post("/api/admin/teachers/ban",{teacherId:"bad id"})).status).toBe(400);
    expect((await post("/api/admin/teachers/ban",{teacherId:"teacher-sub",reason:"x".repeat(301)})).status).toBe(400);
    expect((await worker.fetch(new Request(`${origin}/api/admin/teachers?status=nope`,{headers:adminHeaders}),settings)).status).toBe(400);
    expect((await worker.fetch(new Request(`${origin}/api/admin/teachers?offset=-1`,{headers:adminHeaders}),settings)).status).toBe(400);
  });

  it("keeps the ban but retries every classroom revocation after a transport failure", async () => {
    const hash=await digest("room-session"); const now=Date.now();
    await env.REPORTS.prepare("INSERT INTO teacher_sessions (session_hash,google_sub,email,csrf_hash,created_at,expires_at,revoked_at) VALUES (?,?,?,?,?,?,NULL)").bind(hash,"teacher-sub","teacher@example.com","unused",now,now+60_000).run();
    await env.REPORTS.prepare("INSERT INTO teacher_session_rooms (session_hash,room_code) VALUES (?,?)").bind(hash,"123456").run();
    let calls=0;
    const retrySettings={...settings,ROOMS:{getByName:()=>({fetch:async()=>new Response(null,{status:++calls===1?503:204})})}} as unknown as Env;
    const request=()=>new Request(`${origin}/api/admin/teachers/ban`,{method:"POST",headers:{...adminHeaders,"content-type":"application/json"},body:JSON.stringify({teacherId:"teacher-sub"})});
    const failed=await worker.fetch(request(),retrySettings);
    expect(failed.status).toBe(503); expect(await failed.json()).toMatchObject({error:"BAN_SESSION_REVOCATION_FAILED"});
    expect(await env.REPORTS.prepare("SELECT banned FROM teacher_moderation WHERE google_sub=?").bind("teacher-sub").first()).toMatchObject({banned:1});
    expect((await worker.fetch(request(),retrySettings)).status).toBe(200);
    expect(calls).toBe(2);
  });

  it("redirects root to the multiplayer base and serves its index with working relative assets", async () => {
    const seen:string[]=[];
    const assetSettings={...settings,ASSETS:{fetch:async(request:Request)=>{seen.push(request.url); return new Response("app",{status:200});}}} as unknown as Env;
    const root=await worker.fetch(new Request(`${origin}/?teacher=1`),assetSettings);
    expect(root.status).toBe(308); expect(root.headers.get("location")).toBe(`${origin}/multiplayer/?teacher=1`);
    const page=await worker.fetch(new Request(`${origin}/multiplayer/?room=123456`),assetSettings);
    expect(page.status).toBe(200);
    await worker.fetch(new Request(`${origin}/multiplayer/app.js`),assetSettings);
    await worker.fetch(new Request(`${origin}/multiplayer/styles.css`),assetSettings);
    expect(seen.map((value)=>new URL(value).pathname)).toEqual(["/index.html","/app.js","/styles.css"]);
    expect(new URL(seen[0]).search).toBe("?room=123456");
  });
});

async function digest(value:string) { const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)); return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
