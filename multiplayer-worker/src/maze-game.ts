export type MazeDirection = "up" | "down" | "left" | "right";
export type MazeMoveEvent = "move" | "treasure" | "bank" | "steal";

export interface MazeArena {
  layout: string[];
  treasures: Record<string, number>;
  respawns?: Record<string, number>;
  pairCooldowns?: Record<string, number>;
}

export interface MazePlayer {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  moveCredits: number;
  nextMoveSeq: number;
  carriedLoot: number;
  bankedLoot: number;
}

export interface MazeRival extends MazePlayer { id: string; nickname: string; teamId?: string }
export interface MazeMoveOptions { serverNow: number; playerId: string; teamId?: string; allowSteal?: boolean }
export const TREASURE_RESPAWN_MS = 8_000;
export const STEAL_COOLDOWN_MS = 5_000;
function refreshTreasures(arena: MazeArena, now: number): MazeArena {
  const next = { ...arena, treasures: { ...arena.treasures }, respawns: { ...arena.respawns }, pairCooldowns: { ...arena.pairCooldowns } };
  for (const [cell, at] of Object.entries(next.respawns)) if (at <= now) { next.treasures[cell] = 12; delete next.respawns[cell]; }
  return next;
}

export interface MazeMoveResult {
  arena: MazeArena;
  player: MazePlayer;
  rivals: MazeRival[];
  event: MazeMoveEvent;
  amount: number;
  targetNickname?: string;
}

export const MAZE_LAYOUT = [
  "#############",
  "#H....#....T#",
  "#.###.#.###.#",
  "#...#...#...#",
  "###.#.#.#.###",
  "#T..#...#..T#",
  "#.#####.###.#",
  "#....T.....H#",
  "#############",
] as const;

const DELTAS: Record<MazeDirection, readonly [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};

const key = (x: number, y: number) => `${x},${y}`;

export function createMazeArena(): MazeArena {
  const treasures: Record<string, number> = {};
  MAZE_LAYOUT.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile === "T") treasures[key(x, y)] = 12;
  }));
  return { layout: [...MAZE_LAYOUT], treasures };
}

export function createMazePlayer(slot = 0): MazePlayer {
  const home = slot % 2 === 0 ? [1, 1] : [11, 7];
  return { x: home[0], y: home[1], homeX: home[0], homeY: home[1], moveCredits: 0, nextMoveSeq: 0, carriedLoot: 0, bankedLoot: 0 };
}

export function updateMazeAfterAnswer(player: MazePlayer, correct: boolean, responseTimeMs: number, streak: number): MazePlayer {
  if (!correct) return { ...player };
  const earned = 2 + (responseTimeMs <= 4_000 ? 1 : 0) + (streak > 0 && streak % 3 === 0 ? 1 : 0);
  return { ...player, moveCredits: Math.min(12, player.moveCredits + earned) };
}

export function mazeTile(arena: MazeArena, x: number, y: number): string | undefined {
  return arena.layout[y]?.[x];
}

export function availableMoves(arena: MazeArena, player: MazePlayer): MazeDirection[] {
  return (Object.keys(DELTAS) as MazeDirection[]).filter(direction => {
    const [dx, dy] = DELTAS[direction];
    const tile = mazeTile(arena, player.x + dx, player.y + dy);
    return tile !== undefined && tile !== "#";
  });
}

export function moveMazePlayer(arena: MazeArena, player: MazePlayer, rivals: MazeRival[], direction: MazeDirection, seq: number, options?: MazeMoveOptions): MazeMoveResult {
  if (seq !== player.nextMoveSeq) throw new Error(seq < player.nextMoveSeq ? "DUPLICATE_MAZE_MOVE" : "MAZE_MOVE_OUT_OF_ORDER");
  if (player.moveCredits <= 0) throw new Error("MAZE_NO_MOVES");
  const [dx, dy] = DELTAS[direction] ?? [];
  if (dx === undefined) throw new Error("INVALID_MAZE_MOVE");
  const x = player.x + dx, y = player.y + dy;
  if (mazeTile(arena, x, y) === "#" || mazeTile(arena, x, y) === undefined) throw new Error("MAZE_MOVE_BLOCKED");

  let next = { ...player, x, y, moveCredits: player.moveCredits - 1, nextMoveSeq: player.nextMoveSeq + 1 };
  const nextArena = refreshTreasures(arena, options?.serverNow ?? 0);
  let nextRivals = rivals.map(rival => ({ ...rival }));
  let event: MazeMoveEvent = "move", amount = 0, targetNickname: string | undefined;
  const treasure = nextArena.treasures[key(x, y)] ?? 0;
  if (treasure > 0) {
    amount = treasure;event = "treasure";next.carriedLoot += treasure;delete nextArena.treasures[key(x, y)];
    nextArena.respawns![key(x, y)] = (options?.serverNow ?? 0) + TREASURE_RESPAWN_MS;
  }
  const rivalIndex = nextRivals.findIndex(rival => {
    const pair = [options?.playerId ?? "self", rival.id].sort().join(":");
    return options?.allowSteal !== false && rival.id !== options?.playerId
      && !(options?.teamId && rival.teamId === options.teamId)
      && mazeTile(arena, x, y) !== "H"
      && (nextArena.pairCooldowns?.[pair] ?? -1) <= (options?.serverNow ?? 0)
      && rival.x === x && rival.y === y && rival.carriedLoot > 0;
  });
  if (rivalIndex >= 0) {
    amount = Math.min(8, nextRivals[rivalIndex].carriedLoot);event = "steal";targetNickname = nextRivals[rivalIndex].nickname;
    next.carriedLoot += amount;nextRivals[rivalIndex].carriedLoot -= amount;
    nextArena.pairCooldowns![[options?.playerId ?? "self", nextRivals[rivalIndex].id].sort().join(":")] = (options?.serverNow ?? 0) + STEAL_COOLDOWN_MS;
  }
  if (x === next.homeX && y === next.homeY && next.carriedLoot > 0) {
    amount = next.carriedLoot;event = "bank";next.bankedLoot += amount;next.carriedLoot = 0;
  }
  return { arena: nextArena, player: next, rivals: nextRivals, event, amount, targetNickname };
}

export function mazePublicView(arena: MazeArena, player: MazePlayer, rivals: MazeRival[], serverNow = 0) {
  arena = refreshTreasures(arena, serverNow);
  return {
    respawns: arena.respawns,
    width: arena.layout[0].length, height: arena.layout.length, layout: arena.layout,
    treasures: Object.keys(arena.treasures), remainingTreasures: Object.keys(arena.treasures).length,
    ...player,
    rivals: rivals.map(({ id, nickname, x, y, carriedLoot, bankedLoot }) => ({ id, nickname, x, y, carriedLoot, bankedLoot })),
  };
}
