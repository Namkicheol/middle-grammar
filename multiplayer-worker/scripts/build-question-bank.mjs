import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, "../..");

export const DEFAULT_SOURCE_PATH = pathToFileURL(
  resolve(REPOSITORY_ROOT, "game/questions.js"),
);
export const DEFAULT_OUTPUT_PATH = pathToFileURL(
  resolve(REPOSITORY_ROOT, "multiplayer-worker/src/generated/questions.json"),
);

const SOURCE_LABEL = "game/questions.js";
const EXPECTED_VISIBLE_UNIT_COUNT = 32;
const EXPECTED_QUESTION_COUNT = 921;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateGeneratedAt(generatedAt) {
  assert(typeof generatedAt === "string", "generatedAt must be a string");
  const parsed = new Date(generatedAt);
  assert(
    Number.isFinite(parsed.valueOf()) && parsed.toISOString() === generatedAt,
    "generatedAt must be an ISO timestamp",
  );
}

function extractQuestion(question, unitKey) {
  assert(question && typeof question === "object", `${unitKey}: invalid question`);
  assert(typeof question.id === "string" && question.id, `${unitKey}: missing question id`);
  assert(typeof question.kor === "string", `${question.id}: kor must be a string`);
  assert(typeof question.eng === "string", `${question.id}: eng must be a string`);
  assert(typeof question.ans === "string", `${question.id}: ans must be a string`);
  assert(
    Array.isArray(question.opts) && question.opts.every((option) => typeof option === "string"),
    `${question.id}: opts must be a string array`,
  );
  assert(question.opts.includes(question.ans), `${question.id}: ans is not in opts`);
  assert(
    typeof question.level === "number" || typeof question.level === "string",
    `${question.id}: level must be a number or string`,
  );
  assert(
    question.type === undefined || typeof question.type === "string",
    `${question.id}: type must be a string when present`,
  );

  const extracted = {
    id: question.id,
    kor: question.kor,
    eng: question.eng,
    ans: question.ans,
    opts: [...question.opts],
    level: question.level,
  };
  if (question.type !== undefined) extracted.type = question.type;
  return extracted;
}

function evaluateSource(source) {
  const sandbox = Object.create(null);
  const context = vm.createContext(sandbox, {
    name: "multiplayer-question-bank",
    codeGeneration: { strings: false, wasm: false },
  });

  vm.runInContext(
    `${source}\n;globalThis.__MULTIPLAYER_GAME_QUESTIONS__ = GAME_QUESTIONS;`,
    context,
    { displayErrors: true, timeout: 2_000 },
  );

  const evaluated = sandbox.__MULTIPLAYER_GAME_QUESTIONS__;
  assert(evaluated && typeof evaluated === "object", "GAME_QUESTIONS was not created");
  return JSON.parse(JSON.stringify(evaluated));
}

export async function buildQuestionBank({
  sourcePath = DEFAULT_SOURCE_PATH,
  generatedAt = new Date().toISOString(),
} = {}) {
  validateGeneratedAt(generatedAt);
  const source = await readFile(sourcePath, "utf8");
  const evaluated = evaluateSource(source);
  const units = {};
  const questionIds = new Set();
  let questionCount = 0;

  const visibleUnits = Object.entries(evaluated)
    .filter(([unitKey, unit]) => unitKey !== "all" && unit.hidden !== true)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

  for (const [unitKey, unit] of visibleUnits) {
    assert(/^g[12]-l\d+-/.test(unitKey), `Unexpected visible unit: ${unitKey}`);
    assert(Array.isArray(unit.questions), `${unitKey}: questions must be an array`);

    units[unitKey] = unit.questions
      .map((question) => extractQuestion(question, unitKey))
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

    for (const question of units[unitKey]) {
      assert(!questionIds.has(question.id), `Duplicate question id: ${question.id}`);
      questionIds.add(question.id);
      questionCount += 1;
    }
  }

  assert(
    Object.keys(units).length === EXPECTED_VISIBLE_UNIT_COUNT,
    `Expected ${EXPECTED_VISIBLE_UNIT_COUNT} visible units, found ${Object.keys(units).length}`,
  );
  assert(
    questionCount === EXPECTED_QUESTION_COUNT,
    `Expected ${EXPECTED_QUESTION_COUNT} questions, found ${questionCount}`,
  );

  return { generatedAt, source: SOURCE_LABEL, units };
}

export async function writeQuestionBank({
  sourcePath = DEFAULT_SOURCE_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
  generatedAt = new Date().toISOString(),
} = {}) {
  const bank = await buildQuestionBank({ sourcePath, generatedAt });
  const outputFile = fileURLToPath(outputPath);
  const temporaryFile = `${outputFile}.tmp`;
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(temporaryFile, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  await rename(temporaryFile, outputFile);
  return bank;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  const bank = await writeQuestionBank();
  const questionCount = Object.values(bank.units).reduce(
    (total, questions) => total + questions.length,
    0,
  );
  console.log(
    `Generated ${Object.keys(bank.units).length} units and ${questionCount} questions at ${fileURLToPath(DEFAULT_OUTPUT_PATH)}`,
  );
}
