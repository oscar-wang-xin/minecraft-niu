// ============================================================
// storage.js — localStorage 存档:种子、方块编辑、玩家状态
// ============================================================

const KEY = 'minecraft-web-clone-save-v1';

export function saveGame(world, player, hotbarIndex) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      seed: world.seedStr,
      edits: world.serializeEdits(),
      player: {
        x: player.pos.x, y: player.pos.y, z: player.pos.z,
        yaw: player.yaw, pitch: player.pitch, flying: player.flying,
      },
      hotbarIndex,
      ts: Date.now(),
    }));
  } catch (e) { /* 存储满等异常时静默 */ }
}

export function loadGame() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
