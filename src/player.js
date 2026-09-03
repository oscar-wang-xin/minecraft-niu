// ============================================================
// player.js — 玩家物理(AABB 碰撞/重力/跳跃/游泳/飞行) + 体素射线
// 纯逻辑模块,不依赖 THREE/DOM
// ============================================================

import { BLOCK, BLOCKS } from './blocks.js';
import { WORLD_HEIGHT } from './world.js';

export const PLAYER_W = 0.6;    // 碰撞箱宽
export const PLAYER_H = 1.8;    // 身高
export const EYE_HEIGHT = 1.62; // 眼睛高度

const G = 30;                   // 重力 (格/s^2)
const JUMP_V = 8.8;             // 起跳速度(≈1.29 格)
const WALK = 4.3, SPRINT = 5.8, SNEAK = 1.4, FLY = 11, SWIM = 3.2;
const EPS = 0.001;

function solidAt(world, x, y, z) {
  const def = BLOCKS[world.getBlock(x, y, z)];
  return def ? def.solid : false;
}

export class Player {
  constructor(world, x, y, z) {
    this.world = world;
    this.pos = { x, y, z };        // 脚底中心
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.flying = false;
    this.sprinting = false;
  }

  // 是否浸在水中(身体/眼睛两档)
  updateWaterState() {
    const b = this.world.getBlock(
      Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    this.inWater = b === BLOCK.WATER;
    const e = this.world.getBlock(
      Math.floor(this.pos.x), Math.floor(this.pos.y + EYE_HEIGHT), Math.floor(this.pos.z));
    this.eyeInWater = e === BLOCK.WATER;
  }

  update(dt, input) {
    this.updateWaterState();

    // —— 期望水平速度(相机系) ——
    let speed = this.flying ? FLY : this.inWater ? SWIM : input.sneak ? SNEAK : SPRINT;
    if (this.sprinting && !this.flying) speed = this.inWater ? SWIM * 1.3 : SPRINT;
    else if (this.sprinting && this.flying) speed = FLY * 1.8;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward 方向:(-sin, -cos)(yaw=0 面向 -z)
    let mx = (-sin * input.forward + sin * input.back) + (cos * input.right - cos * input.left);
    let mz = (-cos * input.forward + cos * input.back) + (-sin * input.right + sin * input.left);
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    let tx = mx * speed, tz = mz * speed;

    // 水平加速(空中/水中操控性降低)
    const accel = this.flying ? 10 : this.onGround ? 22 : this.inWater ? 6 : 5;
    const k = Math.min(1, accel * dt);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;

    // —— 垂直 ——
    if (this.flying) {
      const up = (input.jump ? 1 : 0) - (input.sneak ? 1 : 0);
      this.vel.y += (up * FLY - this.vel.y) * Math.min(1, 10 * dt);
    } else if (this.inWater) {
      this.vel.y -= G * 0.28 * dt;                      // 水中缓降
      if (input.jump) this.vel.y = Math.min(this.vel.y + 30 * dt, 3.6);
      this.vel.y = Math.max(this.vel.y, -3.4);
    } else {
      this.vel.y -= G * dt;
      if (input.jump && this.onGround) { this.vel.y = JUMP_V; this.onGround = false; }
      this.vel.y = Math.max(this.vel.y, -55);
    }

    // —— 逐轴移动与碰撞 ——
    const wasOnGround = this.onGround;
    this.onGround = false;
    const sneakGuard = input.sneak && wasOnGround && !this.flying && !this.inWater;
    const px = this.pos.x, pz = this.pos.z;

    this.moveAxis(0, this.vel.x * dt);
    if (sneakGuard && !this.hasSupport()) { this.pos.x = px; this.vel.x = 0; } // 潜行防坠边
    this.moveAxis(2, this.vel.z * dt);
    if (sneakGuard && !this.hasSupport()) { this.pos.z = pz; this.vel.z = 0; }
    this.moveAxis(1, this.vel.y * dt);

    // 掉出世界兜底
    if (this.pos.y < -20) { this.pos.y = 70; this.vel.y = 0; }
  }

  moveAxis(axis, d) {
    if (d === 0) return;
    const p = this.pos;
    if (axis === 0) p.x += d; else if (axis === 1) p.y += d; else p.z += d;

    const half = PLAYER_W / 2;
    const minX = Math.floor(p.x - half), maxX = Math.floor(p.x + half);
    const minY = Math.floor(p.y), maxY = Math.floor(p.y + PLAYER_H);
    const minZ = Math.floor(p.z - half), maxZ = Math.floor(p.z + half);

    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        for (let x = minX; x <= maxX; x++) {
          if (!solidAt(this.world, x, y, z)) continue;
          if (axis === 1) {
            if (d < 0) { p.y = y + 1 + EPS; this.onGround = true; }
            else p.y = y - PLAYER_H - EPS;
            this.vel.y = 0;
          } else if (axis === 0) {
            p.x = d > 0 ? x - half - EPS : x + 1 + half + EPS;
            this.vel.x = 0;
          } else {
            p.z = d > 0 ? z - half - EPS : z + 1 + half + EPS;
            this.vel.z = 0;
          }
          return;
        }
  }

  hasSupport() {
    const p = this.pos, half = PLAYER_W / 2 - EPS;
    const y = Math.floor(p.y - 0.06);
    for (let x of [Math.floor(p.x - half), Math.floor(p.x + half)])
      for (let z of [Math.floor(p.z - half), Math.floor(p.z + half)])
        if (solidAt(this.world, x, y, z)) return true;
    return false;
  }
}

// ============================================================
// 体素射线:Amanatides & Woo DDA
// 返回 { x, y, z, nx, ny, nz }(命中方块坐标 + 进入面法线)或 null
// ============================================================
export function raycastVoxel(world, ox, oy, oz, dx, dy, dz, maxDist, skipWater = true) {
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return null;
  dx /= len; dy /= len; dz /= len;

  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  // 分量为 0 的轴必须得到 +Infinity,否则 DDA 会跑飞
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * tDeltaY : Infinity;
  let tMaxZ = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ : Infinity;
  let nx = 0, ny = 0, nz = 0;
  let t = 0;

  const hit = (id) => {
    if (id === BLOCK.AIR) return false;
    if (skipWater && id === BLOCK.WATER) return false;
    return true;
  };

  // 起点所在方块也要检查
  if (hit(world.getBlock(x, y, z))) return { x, y, z, nx: 0, ny: 1, nz: 0, t: 0 };

  for (;;) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
    }
    if (t > maxDist) return null;
    if (y < 0 || y >= WORLD_HEIGHT) return null; // 已越过世界上下界(单调移动)
    if (hit(world.getBlock(x, y, z))) return { x, y, z, nx, ny, nz, t };
  }
}
