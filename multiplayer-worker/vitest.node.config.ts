import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/question-bank.test.ts", "test/maze-game.test.ts", "test/escape-game.test.ts"],
  },
});
