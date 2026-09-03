// ============================================================
// world.js — 世界数据、地形生成、区块管理
// 无限世界:按需生成 16x80x16 区块;编辑增量记录用于存档
// ============================================================

import { createNoise2D, createNoise3D } from 'simplex-noise';
import { BLOCK } from './blocks.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 80;
export const SEA_LEVEL = 30;

// —— 种子 PRNG(alea 变体) ——
function alea(seedStr) {
  let s = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    s = Math.imul(s ^ seedStr.charCodeAt(i), 3432918353);
    s = (s << 13) | (s >>> 19);
  }
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 整数坐标确定性 hash → [0,1)
export function hash2D(x, z, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^= h >>> 16) >>> 0) / 4294967296;
}

export class World {
  constructor(seedStr) {
    this.seedStr = String(seedStr);
    let seedNum = 0;
    for (let i = 0; i < this.seedStr.length; i++) seedNum = (seedNum * 31 + this.seedStr.charCodeAt(i)) | 0;
    this.seedNum = seedNum;

    const rand = alea(this.seedStr);
    this.nContinent = createNoise2D(rand);
    this.nHills = createNoise2D(rand);
    this.nDetail = createNoise2D(rand);
    this.nMountain = createNoise2D(rand);
    this.nRidge = createNoise2D(rand);
    this.nTemp = createNoise2D(rand);
    this.nCave = createNoise3D(rand);

    this.chunks = new Map();   // "cx,cz" -> Uint8Array
    this.edits = new Map();    // "cx,cz" -> Map(localIdx -> blockId) 玩家修改
  }

  key(cx, cz) { return cx + ',' + cz; }
  static idx(x, y, z) { return (y << 8) | (z << 4) | x; }

  // ---------- 纯函数地形(与区块无关,可用于跨区块树冠) ----------
  heightAt(x, z) {
    const c = this.nContinent(x / 220, z / 220);          // 大陆起伏
    const h0 = SEA_LEVEL + 2 + c * 13;
    let h = h0 + this.nHills(x / 55, z / 55) * 5.5 + this.nDetail(x / 17, z / 17) * 2.2;
    const m = this.nMountain(x / 160, z / 160);
    if (m > 0.18) {
      const t = (m - 0.18) / 0.82;                        // 山地系数
      const ridge = 1 - Math.abs(this.nRidge(x / 90, z / 90));
      h += t * t * 34 * (0.55 + 0.45 * ridge);
    }
    return Math.max(2, Math.min(WORLD_HEIGHT - 10, Math.floor(h)));
  }

  biomeAt(x, z, h) {
    const temp = this.nTemp(x / 260, z / 260);
    if (h >= 52 + hash2D(x, z, 77) * 3) return 'snow';
    if (h >= 46) return 'stone';
    if (temp > 0.42 && h < 40) return 'desert';
    return 'grass';
  }

  isTree(x, z) {
    const h = this.heightAt(x, z);
    if (h <= SEA_LEVEL || h > 50) return 0;
    if (this.biomeAt(x, z, h) !== 'grass') return 0;
    if (hash2D(x, z, this.seedNum ^ 0x51AB) > 0.0065) return 0;
    return h + 1; // 树干底部 y
  }

  // ---------- 区块 ----------
  getChunkData(cx, cz) {
    const k = this.key(cx, cz);
    let data = this.chunks.get(k);
    if (!data) { data = this.generateChunk(cx, cz); this.chunks.set(k, data); }
    return data;
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    const bx = cx * CHUNK_SIZE, bz = cz * CHUNK_SIZE;

    // 1) 地形柱
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = bx + lx, wz = bz + lz;
        const h = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz, h);
        const underwater = h < SEA_LEVEL;

        let top, under, underDepth;
        if (biome === 'desert' || underwater) { top = BLOCK.SAND; under = BLOCK.SAND; underDepth = 3; }
        else if (biome === 'snow') { top = BLOCK.SNOW; under = BLOCK.STONE; underDepth = 2; }
        else if (biome === 'stone') { top = BLOCK.STONE; under = BLOCK.STONE; underDepth = 1; }
        else { top = BLOCK.GRASS; under = BLOCK.DIRT; underDepth = 3; }

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = BLOCK.BEDROCK;
          else if (y <= 2 && hash2D(wx * 3 + y, wz * 7 - y, this.seedNum) < 0.5) id = BLOCK.BEDROCK;
          else if (y === h) id = top;
          else if (y >= h - underDepth) id = under;
          else id = BLOCK.STONE;

          // 洞穴(不破坏地表与水底)
          if (id !== BLOCK.BEDROCK && y > 2 && y < h - 5 && y < 42) {
            if (this.nCave(wx / 26, y / 17, wz / 26) > 0.58) id = BLOCK.AIR;
          }
          data[World.idx(lx, y, lz)] = id;
        }

        // 水
        if (underwater) {
          for (let y = h + 1; y <= SEA_LEVEL; y++) data[World.idx(lx, y, lz)] = BLOCK.WATER;
        }
      }
    }

    // 2) 树(扫描外扩 2 格,树冠可跨区块)
    for (let lz = -2; lz < CHUNK_SIZE + 2; lz++) {
      for (let lx = -2; lx < CHUNK_SIZE + 2; lx++) {
        const wx = bx + lx, wz = bz + lz;
        const baseY = this.isTree(wx, wz);
        if (!baseY) continue;
        const th = 4 + Math.floor(hash2D(wx, wz, this.seedNum ^ 0xBEEF) * 3); // 树干高 4~6
        const put = (ox, oy, oz, id, keepSolid) => {
          const x = lx + ox, z = lz + oz, y = oy;
          if (x < 0 || x > 15 || z < 0 || z > 15 || y < 0 || y >= WORLD_HEIGHT) return;
          const i = World.idx(x, y, z);
          if (keepSolid && data[i] !== BLOCK.AIR && data[i] !== BLOCK.WATER) return;
          data[i] = id;
        };
        // 树干
        for (let dy = 0; dy < th; dy++) put(0, baseY + dy, 0, BLOCK.LOG, false);
        // 树叶:两层 5x5(随机去角) → 3x3 → 顶十字
        for (let dy = th - 2; dy <= th - 1; dy++)
          for (let ox = -2; ox <= 2; ox++)
            for (let oz = -2; oz <= 2; oz++) {
              if (Math.abs(ox) === 2 && Math.abs(oz) === 2 &&
                  hash2D(wx + ox, wz + oz, this.seedNum ^ dy) < 0.6) continue;
              put(ox, baseY + dy, oz, BLOCK.LEAVES, true);
            }
        for (let ox = -1; ox <= 1; ox++)
          for (let oz = -1; oz <= 1; oz++)
            put(ox, baseY + th, oz, BLOCK.LEAVES, true);
        put(0, baseY + th + 1, 0, BLOCK.LEAVES, true);
        put(1, baseY + th + 1, 0, BLOCK.LEAVES, true);
        put(-1, baseY + th + 1, 0, BLOCK.LEAVES, true);
        put(0, baseY + th + 1, 1, BLOCK.LEAVES, true);
        put(0, baseY + th + 1, -1, BLOCK.LEAVES, true);
      }
    }

    // 3) 应用玩家编辑
    const ed = this.edits.get(this.key(cx, cz));
    if (ed) for (const [i, id] of ed) data[i] = id;

    return data;
  }

  // ---------- 方块读写 ----------
  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const data = this.getChunkData(cx, cz);
    return data[World.idx(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
  }

  // 返回需要重建网格的区块 key 列表
  setBlock(x, y, z, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return [];
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
    this.getChunkData(cx, cz)[World.idx(lx, y, lz)] = id;

    // 记录编辑(用于存档;若与程序生成结果一致可删除记录,这里简单保留)
    const k = this.key(cx, cz);
    let ed = this.edits.get(k);
    if (!ed) { ed = new Map(); this.edits.set(k, ed); }
    ed.set(World.idx(lx, y, lz), id);

    const dirty = [k];
    // 边界方块影响邻区块的剔除
    if (lx === 0) dirty.push(this.key(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) dirty.push(this.key(cx + 1, cz));
    if (lz === 0) dirty.push(this.key(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) dirty.push(this.key(cx, cz + 1));
    return dirty;
  }

  // ---------- 存档 ----------
  serializeEdits() {
    const out = {};
    for (const [k, ed] of this.edits) {
      const o = {};
      for (const [i, id] of ed) o[i] = id;
      out[k] = o;
    }
    return out;
  }

  loadEdits(obj) {
    this.edits.clear();
    this.chunks.clear(); // 编辑改变生成结果,清空缓存重新生成
    if (!obj) return;
    for (const k of Object.keys(obj)) {
      const ed = new Map();
      for (const i of Object.keys(obj[k])) ed.set(Number(i), obj[k][i]);
      this.edits.set(k, ed);
    }
  }
}
