import type { PlayStyle, Question, RoomMode, RoomState, TeacherRoomView } from "./room-engine";

export interface QuestionBank {
  generatedAt: string;
  source: string;
  units: Record<string, Question[]>;
}

export interface Env {
  ROOMS: DurableObjectNamespace;
  REPORTS: D1Database;
  ASSETS?: Fetcher;
  ENVIRONMENT: "production" | "development" | "test";
  QUESTION_BANK_JSON?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH_ORIGIN?: string;
  TEACHER_EMAILS?: string;
  ADMIN_EMAILS?: string;
}

export interface RoomRecord {
  roomId: string;
  grade: "g1" | "g2" | "custom";
  unitKey: string;
  setTitle?: string;
  state: RoomState;
  reportStored: boolean;
  socketTickets: Record<string, { playerId: string; expiresAt: number }>;
  disconnectedAt: Record<string, number>;
}

export interface RoomInitBody {
  roomId: string;
  code: string;
  teacherEmail: string;
  grade: "g1" | "g2" | "custom";
  unitKey: string;
  setTitle?: string;
  durationSeconds: number;
  allowLateJoin: boolean;
  shuffleQuestions: boolean;
  mode?: RoomMode;
  playStyle?: PlayStyle;
  teamCount?: number;
  questions: Question[];
  createdAt: number;
}

export interface SocketAttachment {
  role: "teacher" | "student";
  playerId?: string;
  resumeTokenHash?: string;
  teacherSessionHash?: string;
  teacherSessionExpiresAt?: number;
}

export interface FinalizedReport {
  grade: "g1" | "g2" | "custom";
  unitKey: string;
  state: TeacherRoomView;
  teacherEmail: string;
  createdAt: number;
}

declare global {
  namespace Cloudflare {
    interface Env {
      ROOMS: DurableObjectNamespace;
      REPORTS: D1Database;
      ASSETS?: Fetcher;
      ENVIRONMENT: "production" | "development" | "test";
      QUESTION_BANK_JSON?: string;
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      AUTH_ORIGIN?: string;
      TEACHER_EMAILS?: string;
      ADMIN_EMAILS?: string;
      TEST_MIGRATIONS: Array<{ name: string; queries: string[] }>;
    }
  }
}
