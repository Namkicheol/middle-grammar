import { describe, expect, it } from "vitest";
import { STEAL_COOLDOWN_MS, TREASURE_RESPAWN_MS, availableMoves, createMazeArena, createMazePlayer, mazePublicView, moveMazePlayer, updateMazeAfterAnswer, type MazeRival } from "../src/maze-game";

describe("maze arena loop", () => {
  it("rewards answers with useful but capped route choices", () => {
    let player = createMazePlayer();
    player = updateMazeAfterAnswer(player, true, 2_000, 3);
    expect(player.moveCredits).toBe(4);
    player = updateMazeAfterAnswer({ ...player, moveCredits: 11 }, true, 2_000, 3);
    expect(player.moveCredits).toBe(12);
    expect(availableMoves(createMazeArena(), player)).toEqual(["down", "right"]);
  });

  it("collects exposed loot, keeps it vulnerable, then banks it only at home", () => {
    const arena = createMazeArena();
    const hunter = { ...createMazePlayer(), x: 10, y: 1, moveCredits: 3 };
    const pickup = moveMazePlayer(arena, hunter, [], "right", 0);
    expect(pickup.event).toBe("treasure");
    expect(pickup.player.carriedLoot).toBe(12);
    expect(pickup.player.bankedLoot).toBe(0);
    expect(pickup.arena.treasures["11,1"]).toBeUndefined();

    const rival: MazeRival = { id: "rival", nickname: "민수", ...createMazePlayer(1), x: 10, y: 1, carriedLoot: 10 };
    const steal = moveMazePlayer(pickup.arena, { ...pickup.player, x: 9, y: 1, moveCredits: 2 }, [rival], "right", 1);
    expect(steal.event).toBe("steal");
    expect(steal.amount).toBe(8);
    expect(steal.player.carriedLoot).toBe(20);
    expect(steal.rivals[0].carriedLoot).toBe(2);

    const bank = moveMazePlayer(steal.arena, { ...steal.player, x: 1, y: 2, moveCredits: 1 }, steal.rivals, "up", 2);
    expect(bank.event).toBe("bank");
    expect(bank.player.carriedLoot).toBe(0);
    expect(bank.player.bankedLoot).toBe(20);
  });

  it("publishes the complete arena so players can plan routes", () => {
    const view = mazePublicView(createMazeArena(), createMazePlayer(), []);
    expect(view.layout).toHaveLength(view.height);
    expect(view.layout.every(row => row.length === view.width)).toBe(true);
    expect(view.remainingTreasures).toBe(4);
    expect(view.homeX).toBe(1);
  });

  it("rejects walls and replayed move sequences without spending credits", () => {
    const arena = createMazeArena(), player = { ...createMazePlayer(), moveCredits: 2 };
    expect(() => moveMazePlayer(arena, player, [], "up", 0)).toThrow("MAZE_MOVE_BLOCKED");
    expect(() => moveMazePlayer(arena, player, [], "right", -1)).toThrow("DUPLICATE_MAZE_MOVE");
  });

  it("respawns a collected treasure after exactly eight seconds", () => {
    const pickup = moveMazePlayer(
      createMazeArena(),
      { ...createMazePlayer(), x: 10, y: 1, moveCredits: 1 },
      [], "right", 0, { serverNow: 2_000, playerId: "hunter" },
    );
    expect(mazePublicView(pickup.arena, pickup.player, [], 2_000 + TREASURE_RESPAWN_MS - 1).treasures).not.toContain("11,1");
    expect(mazePublicView(pickup.arena, pickup.player, [], 2_000 + TREASURE_RESPAWN_MS).treasures).toContain("11,1");
  });

  it("keeps a pair from stealing twice during the cooldown", () => {
    const rival: MazeRival = { id: "rival", nickname: "수빈", ...createMazePlayer(1), x: 10, y: 1, carriedLoot: 20 };
    const first = moveMazePlayer(createMazeArena(), { ...createMazePlayer(), x: 9, y: 1, moveCredits: 2 }, [rival], "right", 0, { serverNow: 1_000, playerId: "me" });
    const second = moveMazePlayer(first.arena, { ...first.player, x: 9, y: 1 }, first.rivals, "right", 1, { serverNow: 1_000 + STEAL_COOLDOWN_MS - 1, playerId: "me" });
    expect(first.event).toBe("steal");
    expect(second.event).toBe("move");
    expect(second.rivals[0].carriedLoot).toBe(12);
  });

  it("banks safely at the mover's own home without stealing from an occupant", () => {
    const rival: MazeRival = { id: "rival", nickname: "지우", ...createMazePlayer(), x: 1, y: 1, carriedLoot: 10 };
    const result = moveMazePlayer(createMazeArena(), { ...createMazePlayer(), x: 1, y: 2, moveCredits: 1, carriedLoot: 7 }, [rival], "up", 0, { serverNow: 500, playerId: "me" });
    expect(result.event).toBe("bank");
    expect(result.player.bankedLoot).toBe(7);
    expect(result.player.carriedLoot).toBe(0);
    expect(result.rivals[0].carriedLoot).toBe(10);
  });

  it.each([
    ["same team", { playerId: "me", teamId: "blue", serverNow: 500 }, "blue"],
    ["stealing disabled", { playerId: "me", allowSteal: false, serverNow: 500 }, undefined],
  ])("does not steal when protected by %s", (_label, options, rivalTeam) => {
    const rival: MazeRival = { id: "rival", nickname: "하준", teamId: rivalTeam, ...createMazePlayer(1), x: 10, y: 1, carriedLoot: 10 };
    const result = moveMazePlayer(createMazeArena(), { ...createMazePlayer(), x: 9, y: 1, moveCredits: 1 }, [rival], "right", 0, options);
    expect(result.event).toBe("move");
    expect(result.player.carriedLoot).toBe(0);
    expect(result.rivals[0].carriedLoot).toBe(10);
  });

  it("conserves carried loot with duplicate occupants and rejected replay", () => {
    const rivals: MazeRival[] = [
      { id: "a", nickname: "A", ...createMazePlayer(1), x: 10, y: 1, carriedLoot: 9 },
      { id: "b", nickname: "B", ...createMazePlayer(1), x: 10, y: 1, carriedLoot: 6 },
    ];
    const before = rivals.reduce((sum, rival) => sum + rival.carriedLoot, 0);
    const result = moveMazePlayer(createMazeArena(), { ...createMazePlayer(), x: 9, y: 1, moveCredits: 2, carriedLoot: 3 }, rivals, "right", 0, { serverNow: 500, playerId: "me" });
    expect(result.player.carriedLoot + result.rivals.reduce((sum, rival) => sum + rival.carriedLoot, 0)).toBe(before + 3);
    const snapshot = structuredClone(result);
    expect(() => moveMazePlayer(result.arena, result.player, result.rivals, "left", 0, { serverNow: 501, playerId: "me" })).toThrow("DUPLICATE_MAZE_MOVE");
    expect(result).toEqual(snapshot);
  });
});
