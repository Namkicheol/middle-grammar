// @ts-nocheck -- The generator is intentionally a plain Node ESM build script.
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildQuestionBank,
  DEFAULT_OUTPUT_PATH,
  DEFAULT_SOURCE_PATH,
  writeQuestionBank,
} from "../scripts/build-question-bank.mjs";

const FIXED_GENERATED_AT = "2026-09-05T00:00:00.000Z";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("multiplayer question bank generator", () => {
  it("extracts the 33 visible units in stable order", async () => {
    const bank = await buildQuestionBank({
      sourcePath: DEFAULT_SOURCE_PATH,
      generatedAt: FIXED_GENERATED_AT,
    });

    const unitKeys = Object.keys(bank.units);
    expect(Object.keys(bank)).toEqual(["generatedAt", "source", "units"]);
    expect(bank.generatedAt).toBe(FIXED_GENERATED_AT);
    expect(bank.source).toBe("game/questions.js");
    expect(unitKeys).toHaveLength(33);
    expect(unitKeys).toEqual([...unitKeys].sort());
    expect(bank.units).not.toHaveProperty("all");
    expect(bank.units).not.toHaveProperty("g1-l1");
    expect(bank.units).not.toHaveProperty("g2-l8");
    expect(bank.units).toHaveProperty("g1-l1-be-verb");
    expect(bank.units).toHaveProperty("g2-l8-wh-to-infinitive");
    const verbForms = bank.units["g1-verb-forms"];
    expect(verbForms).toHaveLength(100);
    expect(verbForms.filter(question => question.type === "input")).toHaveLength(30);
    for (const question of verbForms) {
      expect(question.eng.split(" → ")).toHaveLength(3);
      expect(question.eng.match(/___/g)).toHaveLength(1);
      expect(new Set(question.opts).size).toBe(4);
    }
    for (const questions of Object.values(bank.units)) {
      const ids = questions.map((question) => question.id);
      expect(ids).toEqual([...ids].sort());
    }
  });

  it("contains exactly 1021 unique, answerable questions", async () => {
    const bank = await buildQuestionBank({
      sourcePath: DEFAULT_SOURCE_PATH,
      generatedAt: FIXED_GENERATED_AT,
    });
    const questions = Object.values(bank.units).flat();
    const ids = questions.map((question) => question.id);

    expect(questions).toHaveLength(1021);
    expect(new Set(ids).size).toBe(questions.length);
    for (const question of questions) {
      expect(question.opts, question.id).toContain(question.ans);
    }
  });

  it("produces identical content when only generatedAt changes", async () => {
    const first = await buildQuestionBank({
      sourcePath: DEFAULT_SOURCE_PATH,
      generatedAt: "2026-09-05T00:00:00.000Z",
    });
    const second = await buildQuestionBank({
      sourcePath: DEFAULT_SOURCE_PATH,
      generatedAt: "2026-09-05T00:00:01.000Z",
    });

    expect({ ...first, generatedAt: second.generatedAt }).toEqual(second);
  });

  it("keeps the checked-in artifact synchronized with the source", async () => {
    const artifact = JSON.parse(await readFile(DEFAULT_OUTPUT_PATH, "utf8"));
    const expected = await buildQuestionBank({
      sourcePath: DEFAULT_SOURCE_PATH,
      generatedAt: artifact.generatedAt,
    });

    expect(artifact).toEqual(expected);
  });

  it("does not change source bytes or SHA-256 when writing a temporary artifact", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "middle-grammar-bank-"));
    const temporaryOutput = pathToFileURL(join(temporaryDirectory, "questions.json"));
    const before = await readFile(DEFAULT_SOURCE_PATH);

    try {
      await writeQuestionBank({
        sourcePath: DEFAULT_SOURCE_PATH,
        outputPath: temporaryOutput,
        generatedAt: FIXED_GENERATED_AT,
      });
      const after = await readFile(DEFAULT_SOURCE_PATH);

      expect(after.equals(before)).toBe(true);
      expect(sha256(after)).toBe(sha256(before));
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
