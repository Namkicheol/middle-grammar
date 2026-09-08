import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            ENVIRONMENT: "test",
            STUDENT_RECORD_RETENTION: "legacy",
            GOOGLE_CLIENT_ID: "test-client-id",
            GOOGLE_CLIENT_SECRET: "test-client-secret",
            AUTH_ORIGIN: "https://test.local",
            TEACHER_EMAILS: "teacher@example.com",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
      include: ["test/room-engine.test.ts", "test/worker.test.ts", "test/auth.test.ts", "test/admin.test.ts", "test/teacher-socket.test.ts", "test/classroom-modes.test.ts", "test/session-retention.test.ts"],
    },
  };
});
