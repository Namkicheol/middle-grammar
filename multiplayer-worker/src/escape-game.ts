export type EscapeSymbol = "moon" | "star" | "sun";

export interface EscapeHotspotState {
  id: string;
  label: string;
  symbol: EscapeSymbol;
  digit: string;
  discovered: boolean;
}

export interface EscapeRoomState {
  title: string;
  story: string;
  lockOrder: EscapeSymbol[];
  hotspots: EscapeHotspotState[];
}

const ROOM_TEMPLATES: ReadonlyArray<Omit<EscapeRoomState, "hotspots"> & { hotspots: ReadonlyArray<Omit<EscapeHotspotState, "digit" | "discovered">> }> = [
  { title: "전력실", story: "비상 전력을 복구하면 교실 문이 열립니다.", lockOrder: ["star", "moon", "sun"], hotspots: [{ id: "desk", label: "교탁 서랍", symbol: "moon" }, { id: "board", label: "배전 안내판", symbol: "star" }, { id: "locker", label: "공구함", symbol: "sun" }] },
  { title: "자료실", story: "흩어진 자료 타일을 봉인 순서대로 정리하세요.", lockOrder: ["moon", "sun", "star"], hotspots: [{ id: "cabinet", label: "카드 보관함", symbol: "sun" }, { id: "shelf", label: "자료 선반", symbol: "moon" }, { id: "lamp", label: "낡은 스탠드", symbol: "star" }] },
  { title: "현관", story: "찾은 숫자로 출구의 회전식 잠금 장치를 푸세요.", lockOrder: ["sun", "star", "moon"], hotspots: [{ id: "umbrella", label: "우산꽂이", symbol: "star" }, { id: "notice", label: "야간 게시판", symbol: "sun" }, { id: "bench", label: "현관 벤치", symbol: "moon" }] },
];

export function createEscapeRooms(randomDigit: () => string): EscapeRoomState[] {
  return ROOM_TEMPLATES.map((room) => ({
    title: room.title,
    story: room.story,
    lockOrder: [...room.lockOrder],
    hotspots: room.hotspots.map((spot) => ({ ...spot, digit: randomDigit(), discovered: false })),
  }));
}

export function expectedEscapeCode(room: EscapeRoomState): string {
  return room.lockOrder.map((symbol) => room.hotspots.find((spot) => spot.symbol === symbol)?.digit ?? "").join("");
}

export function revealEscapeHotspot(room: EscapeRoomState, hotspotId: string): { room: EscapeRoomState; changed: boolean } {
  const hotspot = room.hotspots.find((spot) => spot.id === hotspotId);
  if (!hotspot || hotspot.discovered) return { room, changed: false };
  return { room: { ...room, hotspots: room.hotspots.map((spot) => spot.id === hotspotId ? { ...spot, discovered: true } : spot) }, changed: true };
}

export function publicEscapeRoom(room: EscapeRoomState) {
  return {
    title: room.title,
    story: room.story,
    lockOrder: [...room.lockOrder],
    hotspots: room.hotspots.map((spot) => ({ id: spot.id, label: spot.label, symbol: spot.symbol, ...(spot.discovered ? { clue: spot.digit } : {}) })),
  };
}
