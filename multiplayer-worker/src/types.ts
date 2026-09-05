import type { Question, RoomState, TeacherRoomView } from "./room-engine";

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
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

export interface RoomRecord {
  roomId: string;
  grade: "g1" | "g2";
  unitKey: string;
  state: RoomState;
  reportStored: boolean;
  socketTickets: Record<string, { playerId: string; expiresAt: number }>;
  disconnectedAt: Record<string, number>;
}

export interface RoomInitBody {
  roomId: string;
  code: string;
  teacherEmail: string;
  grade: "g1" | "g2";
  unitKey: string;
  durationSeconds: number;
  allowLateJoin: boolean;
  shuffleQuestions: boolean;
  questions: Question[];
  createdAt: number;
}

export interface SocketAttachment {
  role: "teacher" | "student";
  playerId?: string;
  resumeTokenHash?: string;
}

export interface FinalizedReport {
  grade: "g1" | "g2";
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
      ACCESS_TEAM_DOMAIN?: string;
      ACCESS_AUD?: string;
      TEST_MIGRATIONS: Array<{ name: string; queries: string[] }>;
    }
  }
}
