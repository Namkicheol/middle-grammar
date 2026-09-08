import { describe, expect, it } from "vitest";
import { createEscapeRooms, expectedEscapeCode, publicEscapeRoom, revealEscapeHotspot } from "../src/escape-game";

describe("escape game puzzles", () => {
  it("creates three distinct apparatus rooms with a server-only answer", () => {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const rooms = createEscapeRooms(() => digits.shift()!);
    expect(rooms.map((room) => room.title)).toEqual(["전력실", "자료실", "현관"]);
    expect(rooms.map(expectedEscapeCode)).toEqual(["213", "546", "879"]);
    expect(publicEscapeRoom(rooms[0]).hotspots.every((spot) => !("clue" in spot))).toBe(true);
  });

  it("reveals one remembered clue without mutating the previous room", () => {
    const room = createEscapeRooms(() => "7")[0];
    const revealed = revealEscapeHotspot(room, "board");
    expect(revealed.changed).toBe(true);
    expect(room.hotspots[1].discovered).toBe(false);
    expect(publicEscapeRoom(revealed.room).hotspots[1]).toMatchObject({ id: "board", clue: "7" });
    expect(revealEscapeHotspot(revealed.room, "board")).toEqual({ room: revealed.room, changed: false });
  });

  it("does not reveal or change state for an unknown hotspot", () => {
    const room = createEscapeRooms(() => "4")[0];
    expect(revealEscapeHotspot(room, "unknown")).toEqual({ room, changed: false });
  });
});
