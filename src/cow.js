// ============================================================
// cow.js — "牛来!" 创意事件
// 程序化像素牛头贴图 + 牛群冲锋事件(刷怪/碰撞击飞/终场怼脸)
// ============================================================

import * as THREE from 'three';
import { SEA_LEVEL } from './world.js';

// ---------- 像素牛头贴图(16x16 逻辑网格 × 8px) ----------
// 配色取自"牛来"剧照:金褐毛色 + 白斑 + 浅色角
export function makeCowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const P = 8;
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x * P, y * P, P, P); };
  const rect = (x0, y0, x1, y1, col) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, col);
  };

  const FUR = '#d89a32';      // 金褐毛色
  const FUR_D = '#b87a20';    // 深金斑
  const FUR_L = '#f2c25a';    // 亮毛高光
  const WHITE = '#f7f3e7';    // 白斑
  const HORN = '#e6d9b8';     // 角
  const HORN_D = '#b0a078';   // 角尖
  const OUT = '#3a2a12';      // 轮廓深棕
  const EYE = '#171c26';      // 眼(深蓝黑)
  const SNOUT = '#e5a79a';    // 口鼻粉
  const SNOUT_D = '#b06a5e';  // 鼻孔

  // 角(左右,向上外)
  px(2, 0, HORN); px(1, 1, HORN); px(2, 1, HORN); px(1, 2, HORN_D);
  px(13, 0, HORN); px(14, 1, HORN); px(13, 1, HORN); px(14, 2, HORN_D);

  // 头主体(圆角方块 3..12 × 2..14)
  rect(3, 2, 12, 14, FUR);
  // 圆角削角(透明)
  ctx.clearRect(3 * P, 2 * P, P, P); ctx.clearRect(12 * P, 2 * P, P, P);
  ctx.clearRect(3 * P, 14 * P, P, P); ctx.clearRect(12 * P, 14 * P, P, P);
  px(3, 2, FUR); px(12, 2, FUR); px(3, 14, FUR); px(12, 14, FUR);

  // 毛色细节:深金斑 + 高光
  rect(4, 3, 5, 4, FUR_D);
  rect(10, 4, 11, 5, FUR_D);
  rect(3, 10, 4, 12, FUR_D);
  px(6, 4, FUR_L); px(7, 4, FUR_L); px(5, 5, FUR_L);
  px(11, 11, FUR_L); px(12, 12, FUR_L);

  // 白斑:额头 + 左颊
  rect(7, 2, 9, 3, WHITE);
  rect(6, 3, 8, 3, WHITE);
  rect(3, 6, 4, 8, WHITE);

  // 呆滞大小眼(左小右大,魔性核心)
  px(5, 6, EYE);
  rect(10, 6, 11, 7, EYE);
  px(11, 6, '#4a5568'); // 右眼反光

  // 口鼻区(粉,圆角)
  rect(4, 9, 11, 13, SNOUT);
  ctx.clearRect(4 * P, 9 * P, P, P); ctx.clearRect(11 * P, 9 * P, P, P);
  ctx.clearRect(4 * P, 13 * P, P, P); ctx.clearRect(11 * P, 13 * P, P, P);
  px(5, 9, SNOUT); px(10, 9, SNOUT); px(5, 13, SNOUT); px(10, 13, SNOUT);
  px(4, 10, SNOUT); px(11, 10, SNOUT); px(4, 13, SNOUT); px(11, 13, SNOUT);
  // 鼻孔
  rect(6, 10, 6, 11, SNOUT_D);
  rect(9, 10, 9, 11, SNOUT_D);
  // 歪嘴(左端上翘)
  px(5, 11, OUT);
  px(6, 12, OUT); px(7, 12, OUT); px(8, 12, OUT); px(9, 12, OUT); px(10, 12, OUT);

  // 轮廓描边
  for (let x = 3; x <= 12; x++) { px(x, 2, OUT); px(x, 14, OUT); }
  for (let y = 2; y <= 14; y++) { px(3, y, OUT); px(12, y, OUT); }
  // 描边上的圆角缺(恢复角与口鼻)
  px(3, 2, OUT); px(12, 2, OUT);

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { canvas: c };
  return tex;
}

// 水平翻转 canvas → 新 canvas(花豹"面朝玩家"用)
function flipCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { canvas };
  return tex;
}

// ---------- 像素豹皮掉落物 ----------
export function makePeltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const P = 8;
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x * P, y * P, P, P); };
  const FUR = '#c7a844', SPOT = '#4a4318', EDGE = '#e8e0c8';
  // 一张摊开的皮毛(带锯齿边缘)
  for (let y = 1; y < 7; y++)
    for (let x = 1; x < 7; x++)
      if (!((x === 1 || x === 6) && (y === 1 || y === 6))) px(x, y, FUR);
  // 四肢缺口(皮上的腿)
  px(2, 7, FUR); px(5, 7, FUR);
  px(2, 0, FUR); px(5, 0, FUR);
  // 斑点
  px(2, 2, SPOT); px(4, 3, SPOT); px(3, 5, SPOT); px(5, 5, SPOT); px(4, 1, SPOT);
  // 边缘高光
  px(3, 1, EDGE); px(1, 3, EDGE); px(6, 4, EDGE);
  return canvasTexture(c);
}

// ---------- 像素蛇(盘绕,草绿底 + 深纹 + 红信子) ----------
export function makeSnakeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const P = 8;
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x * P, y * P, P, P); };
  const rect = (x0, y0, x1, y1, col) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, col);
  };

  const BODY = '#7a8b3a';   // 草绿蛇身
  const DARK = '#3f4a1e';   // 深纹
  const BELLY = '#d8c878';  // 黄腹
  const EYE = '#d8b020';    // 金瞳

  // 盘绕身体:外环 + 内环
  rect(4, 6, 12, 12, BODY);
  rect(6, 8, 10, 10, BODY);
  // 环缝阴影(盘绕层次)
  rect(5, 7, 12, 7, DARK);
  rect(12, 8, 12, 12, DARK);
  rect(5, 12, 11, 12, DARK);
  rect(9, 9, 10, 9, DARK);
  // 内环高光
  rect(6, 9, 8, 9, BELLY);
  // 花纹
  px(7, 6, DARK); px(10, 6, DARK); px(6, 10, DARK); px(11, 10, DARK);
  px(8, 11, DARK); px(4, 9, DARK);
  // 蛇头(上方探头)
  rect(7, 3, 10, 5, BODY);
  rect(7, 5, 10, 5, DARK);
  px(8, 4, EYE); px(9, 4, EYE);
  px(6, 4, BODY);
  // 红信子
  px(5, 4, '#d03030'); px(4, 4, '#d03030');
  return canvasTexture(c);
}

// ---------- 像素花豹贴图(侧面全身,金褐底 + 深橄榄斑,配色取自剧照) ----------
export function makeLeopardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const P = 8;
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x * P, y * P, P, P); };
  const rect = (x0, y0, x1, y1, col) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, col);
  };

  const FUR = '#c7a844';     // 金褐毛色
  const FUR_L = '#dcc468';   // 亮部
  const SPOT = '#4a4318';    // 深橄榄斑
  const BELLY = '#e8e0c8';   // 白腹
  const OUT = '#2e2a10';     // 轮廓
  const EYE = '#1a1c10';

  // 尾巴(右上翘)
  px(13, 1, FUR); px(14, 1, SPOT); px(13, 2, FUR); px(12, 3, FUR); px(12, 4, SPOT);
  // 头(左侧)
  rect(2, 3, 6, 6, FUR);
  px(2, 2, FUR); px(5, 2, FUR);           // 耳
  px(2, 2, OUT);
  px(3, 4, EYE);                           // 眼
  px(1, 5, FUR); px(1, 5, FUR);            // 吻部
  rect(1, 5, 2, 6, BELLY);                 // 白吻
  px(1, 5, OUT);                           // 鼻
  // 身体
  rect(6, 4, 12, 9, FUR);
  rect(6, 9, 11, 9, BELLY);                // 白腹
  // 花豹玫瑰斑(深橄榄,简化实心斑)
  px(8, 4, SPOT); px(9, 4, SPOT);
  px(11, 5, SPOT);
  px(7, 6, SPOT); px(10, 6, SPOT); px(11, 6, SPOT);
  px(8, 7, SPOT); px(12, 7, SPOT);
  px(7, 8, SPOT);
  px(3, 5, SPOT); px(5, 3, SPOT);          // 头部小斑
  px(12, 4, SPOT); px(13, 0, SPOT);        // 尾斑
  // 四条腿
  rect(6, 10, 6, 12, FUR);
  rect(8, 10, 8, 12, FUR);
  rect(10, 10, 10, 12, FUR);
  rect(12, 10, 12, 12, FUR);
  // 轮廓点缀
  px(6, 4, OUT); px(12, 9, OUT);

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { canvas: c };
  return tex;
}

// ---------- "牛来"事件 ----------
const DURATION = 13;        // 事件总时长(s)
const SPAWN_UNTIL = 8.5;    // 停止刷牛时间点
const WAVE_EVERY = 0.5;     // 刷波间隔
const WAVE_COUNT = 7;       // 每波头数
const FINALE_AT = DURATION - 3.4; // 巨型牛出现时间点

export class CowEvent {
  constructor({ scene, hud, sfx }) {
    this.scene = scene;
    this.hud = hud;
    this.sfx = sfx;
    this.player = null;
    this.onShake = null;       // (amp, dur) => void,由 main 注入
    this.active = false;
    this.t = 0;
    this.cows = [];
    this.tex = null;           // 惰性创建(需 DOM)
    this.spawnTimer = 0;
    this.hitCooldown = 0;
    this.finale = null;
    this.finaleDone = false;
    this.stats = { hit: 0, leopards: 0 };
    this.spawnLeopards();
    this.world = null;
    this.leopards = [];
    this.leoTex = null;
    this.leoTexFlip = null;
    this.pickups = [];
    this.peltTex = null;
    this.peltCount = 0;
    this.onPelt = null;        // (count) => void,拾取豹皮时回调
    this.onLeopardKill = null;  // (count) => void,杀死花豹时回调
    this.snakes = [];
    this.snakeTex = null;
    this.snakeCd = 0;          // 挖石出蛇冷却
    this.rain = null;          // 牛雨:{ active, t, duration, spawnTimer, cows[] }
    this.rainCd = 0;           // 牛雨冷却(手动/自动共用)
  }

  bindWorld(world) { this.world = world; }

  ensurePeltTex() {
    if (!this.peltTex) this.peltTex = makePeltTexture();
    return this.peltTex;
  }

  ensureTex() { if (!this.tex) this.tex = makeCowTexture(); }

  bindPlayer(player) { this.player = player; }

  tryStart() {
    if (this.active) { this.hud.showTip('牛已经在来的路上了!'); return; }
    if (!this.player) return;
    this.ensureTex();
    this.active = true;
    this.t = 0;
    this.spawnTimer = 0.2;
    this.hitCooldown = 0;
    this.finale = null;
    this.finaleDone = false;
    this.stats = { hit: 0 };
    this.sfx.startBgm();
    this.hud.showCowBanner(true);
    this.sfx.moo(1);
  }

  // 蛇 / 花豹 / 豹皮:与牛来事件无关,始终更新
  updateCreatures(dt) {
    this.updateSnakes(dt);
    this.updateLeopards(dt);
    this.updatePickups(dt);
  }

  reset() {                       // 退回标题/新开局时调用
    if (!this.active && this.cows.length === 0) return;
    this.active = false;
    this.clearCows();
    this.clearLeopards();
    this.sfx.stopBgm();
    this.hud.showCowBanner(false);
    this.hud.setCowVignette(0);
  }

  clearLeopards() {
    for (const l of this.leopards) { this.scene.remove(l.sprite); l.sprite.material.dispose(); }
    this.leopards.length = 0;
  }

  pause() { if (this.active) this.sfx.stopBgm(); }
  resume() { if (this.active) this.sfx.startBgm(); }

  clearCows() {
    for (const c of this.cows) { this.scene.remove(c.sprite); c.sprite.material.dispose(); }
    this.cows.length = 0;
    if (this.finale) { this.scene.remove(this.finale.sprite); this.finale.sprite.material.dispose(); this.finale = null; }
  }

  spawnWave() {
    const p = this.player.pos;
    for (let i = 0; i < WAVE_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 24 + Math.random() * 16;
      const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true });
      const sprite = new THREE.Sprite(mat);
      const size = 1.1 + Math.random() * 0.6;
      sprite.scale.setScalar(size);
      sprite.position.set(
        p.x + Math.cos(ang) * dist,
        Math.min(76, p.y + 1.5 + Math.random() * 6),
        p.z + Math.sin(ang) * dist
      );
      this.scene.add(sprite);
      // 生成时锁定冲向玩家当前位置的直线方向
      const tx = p.x - sprite.position.x, ty = (p.y + 1) - sprite.position.y, tz = p.z - sprite.position.z;
      const len = Math.hypot(tx, ty, tz) || 1;
      const speed = 15 + Math.random() * 10;
      this.cows.push({
        sprite,
        vx: (tx / len) * speed, vy: (ty / len) * speed, vz: (tz / len) * speed,
        speed, life: (len / speed) * 1.8,
        wob: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 3,
      });
    }
  }

  spawnFinale() {
    const p = this.player.pos;
    const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(9);
    sprite.position.set(p.x - 26, p.y + 7, p.z - 10);
    this.scene.add(sprite);
    const tx = p.x - sprite.position.x, ty = (p.y + 1) - sprite.position.y, tz = p.z - sprite.position.z;
    const len = Math.hypot(tx, ty, tz) || 1;
    const speed = 22;
    this.finale = {
      sprite,
      vx: (tx / len) * speed, vy: (ty / len) * speed, vz: (tz / len) * speed,
    };
  }

  knockback(from) {
    const p = this.player.pos;
    const dx = p.x - from.x, dy = 0, dz = p.z - from.z;
    const l = Math.hypot(dx, dz) || 1;
    this.player.vel.x = (dx / l) * 13;
    this.player.vel.z = (dz / l) * 13;
    this.player.vel.y = 8.5;
  }

  // ---------- 花豹:潜伏在树林里,听到"妈妈"就吓飞上天 ----------

  spawnLeopards() {
    if (!this.world || !this.player) return;
    if (!this.leoTex) {
      this.leoTex = makeLeopardTexture();
      this.leoTexFlip = canvasTexture(flipCanvas(this.leoTex.userData.canvas));
    }
    const p = this.player.pos;
    // 在玩家周围找真实的树(潜伏在树荫下)
    const trees = [];
    const R = 40;
    for (let x = Math.floor(p.x - R); x <= p.x + R; x += 2)
      for (let z = Math.floor(p.z - R); z <= p.z + R; z += 2)
        if (this.world.isTree(x, z)) trees.push([x, z]);
    // 没树的区域(沙漠/海边)则随机落位
    const spots = [];
    const want = 4;
    if (trees.length >= want) {
      for (let i = 0; i < want; i++)
        spots.push(trees[Math.floor(Math.random() * trees.length)]);
    } else {
      spots.push(...trees);
      while (spots.length < want) {
        const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 18;
        spots.push([Math.floor(p.x + Math.cos(a) * d), Math.floor(p.z + Math.sin(a) * d)]);
      }
    }
    for (const [tx, tz] of spots) {
      const gh = Math.max(SEA_LEVEL + 1, this.world.heightAt(tx, tz)); // 不落在水下
      const mat = new THREE.SpriteMaterial({ map: this.leoTex, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.5, 1.1, 1);
      sprite.position.set(tx + 0.5, gh + 1.15, tz + 0.5);
      this.scene.add(sprite);
      this.leopards.push({
        sprite, baseY: gh + 1.15, flying: false, vy: 0, wob: Math.random() * 6.28,
        drift: (Math.random() - 0.5) * 4,
      });
    }
  }

  // 一声"妈妈"响起:随机惊飞一只花豹
  onMama() {
    const waiting = this.leopards.filter(l => !l.flying && l.alive !== false);
    if (waiting.length === 0) return;
    this.flyLeopard(waiting[Math.floor(Math.random() * waiting.length)]);
  }

  flyLeopard(l) {
    if (l.flying) return;
    l.flying = true;
    l.vy = 9;
    this.stats.leopards++;
    if (this.onLeopardKill) this.onLeopardKill(this.stats.leopards);
    this.sfx.screech();
    this.spawnPelt(l.sprite.position.x, l.sprite.position.y, l.sprite.position.z);
  }

  updateLeopards(dt) {
    const p = this.player ? this.player.pos : null;
    for (let i = this.leopards.length - 1; i >= 0; i--) {
      const l = this.leopards[i];
      l.wob += dt * (l.flying ? 14 : l.kind === 'hunter' && l.state === 'hunting' ? 9 : 2);

      if (l.flying) {
        l.vy = Math.min(38, l.vy + 34 * dt);   // 火箭式升空
        l.sprite.position.y += l.vy * dt;
        l.sprite.position.x += l.drift * dt;
        l.sprite.material.rotation += 4.5 * dt;
        if (l.sprite.position.y > 94) {
          this.scene.remove(l.sprite); l.sprite.material.dispose();
          this.leopards.splice(i, 1);
        }
        continue;
      }

      if (l.kind === 'hunter') {
        // —— 狩猎花豹:扑向蛇 → 进食 → 离开 ——
        if (l.state === 'hunting') {
          const t = l.target;
          if (!t || t.state === 'eaten' || this.snakes.indexOf(t) < 0) {
            l.state = 'leaving'; l.leaveTimer = 0; continue;   // 蛇没了,悻悻离开
          }
          const sp = t.sprite.position;
          const dx = sp.x - l.sprite.position.x, dz = sp.z - l.sprite.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.9) {
            // 扑到:吃掉蛇
            const si = this.snakes.indexOf(t);
            if (si >= 0) {
              this.scene.remove(t.sprite); t.sprite.material.dispose();
              this.snakes.splice(si, 1);
            }
            l.state = 'feasting'; l.leaveTimer = 12;
            this.hud.showTip('花豹一口吞掉了蛇!');
            continue;
          }
          const vx = (dx / d) * l.speed, vz = (dz / d) * l.speed;
          l.sprite.position.x += vx * dt;
          l.sprite.position.z += vz * dt;
          l.sprite.position.y = l.baseY + Math.abs(Math.sin(l.wob)) * 0.25; // 奔跑颠簸
          const facingWest = vx < 0;
          const want = facingWest ? this.leoTex : this.leoTexFlip;
          if (l.sprite.material.map !== want) { l.sprite.material.map = want; l.sprite.material.needsUpdate = true; }
        } else if (l.state === 'feasting') {
          l.sprite.position.y = l.baseY + Math.sin(l.wob * 2) * 0.05;  // 满足地蹭地
          l.leaveTimer -= dt;
          if (l.leaveTimer <= 0) { l.state = 'leaving'; l.leaveTimer = 0; }
        } else if (l.state === 'leaving') {
          l.leaveTimer += dt;
          l.sprite.position.x += Math.cos(l.wob) * 3 * dt;
          l.sprite.position.z += Math.sin(l.wob) * 3 * dt;
          l.sprite.position.y = l.baseY + Math.abs(Math.sin(l.wob * 1.5)) * 0.15;
          if (l.leaveTimer > 3.5 || !this.player ||
              Math.hypot(l.sprite.position.x - this.player.pos.x, l.sprite.position.z - this.player.pos.z) > 60) {
            this.scene.remove(l.sprite); l.sprite.material.dispose();
            this.leopards.splice(i, 1);
          }
        }
        // 玩家靠近 5 格内:狩猎/进食的花豹也会受惊(策略:先放弃猎物)
        if (p && (l.state === 'feasting')) {
          const dx = p.x - l.sprite.position.x, dz = p.z - l.sprite.position.z;
          if (dx * dx + dz * dz < 25) this.flyLeopard(l);
        }
        continue;
      }

      // —— 伏击花豹(牛来事件):呼吸 + 面向玩家 + 受惊距离 ——
      l.sprite.position.y = l.baseY + Math.sin(l.wob) * 0.06;
      if (p) {
        const facingWest = p.x < l.sprite.position.x; // 贴图头在左 = 面朝西
        const want = facingWest ? this.leoTex : this.leoTexFlip;
        if (l.sprite.material.map !== want) {
          l.sprite.material.map = want;
          l.sprite.material.needsUpdate = true;
        }
      }
      if (p && this.active) {
        const dx = p.x - l.sprite.position.x, dz = p.z - l.sprite.position.z;
        if (dx * dx + dz * dz < 25) this.flyLeopard(l);
      }
    }
  }

  hitLeopard(l) {
    l.flying = true; l.vy = 11;
    this.stats.leopards++;
    this.sfx.mama(1.35);                     // 花豹喊妈妈(音调更高)
    if (this.onShake) this.onShake(0.12, 0.15);
    this.spawnPelt(l.sprite.position.x, l.sprite.position.y, l.sprite.position.z);
  }

  // ---------- 豹皮掉落物:落地漂浮,靠近自动拾取 ----------

  spawnPelt(x, y, z) {
    if (!this.world || !this.player) return;
    const peltTex = this.ensurePeltTex();
    const mat = new THREE.SpriteMaterial({ map: peltTex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(0.55);
    const groundY = Math.max(SEA_LEVEL + 1, this.world.heightAt(Math.floor(x), Math.floor(z))) + 1.35;
    sprite.position.set(x, Math.max(y, groundY), z);
    this.scene.add(sprite);
    this.pickups.push({
      sprite, vy: 2.5, grounded: false,
      groundY, age: 0,
    });
  }

  // 事件结束后也持续更新(掉落物常驻直到被拾取或超时)
  updatePickups(dt) {
    const p = this.player ? this.player.pos : null;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      u.age += dt;
      if (u.age > 120) { this.removePelt(i); continue; }     // 2 分钟后消失
      if (!u.grounded) {
        u.vy -= 18 * dt;
        u.sprite.position.y += u.vy * dt;
        if (u.sprite.position.y <= u.groundY) { u.grounded = true; u.sprite.position.y = u.groundY; }
      } else {
        u.sprite.material.rotation += dt * 1.2;              // 漂浮旋转
        u.sprite.position.y = u.groundY + Math.sin(u.age * 3) * 0.06;
      }
      // 靠近自动拾取
      if (p) {
        const dx = p.x - u.sprite.position.x, dy = (p.y + 0.9) - u.sprite.position.y, dz = p.z - u.sprite.position.z;
        if (dx * dx + dz * dz < 1.9 && Math.abs(dy) < 2.2) {
          this.removePelt(i);
          this.peltCount++;
          this.sfx.pickupDing();
          if (this.onPelt) this.onPelt(this.peltCount);
        }
      }
    }
  }

  removePelt(i) {
    const u = this.pickups[i];
    this.scene.remove(u.sprite); u.sprite.material.dispose();
    this.pickups.splice(i, 1);
  }

  clearPickups() {
    for (const u of this.pickups) { this.scene.remove(u.sprite); u.sprite.material.dispose(); }
    this.pickups.length = 0;
    this.peltCount = 0;
  }

  // ---------- 蛇:挖石头有概率钻出,引来花豹捕食 ----------

  ensureSnakeTex() {
    if (!this.snakeTex) this.snakeTex = makeSnakeTexture();
    return this.snakeTex;
  }

  // 挖掉石头时调用(概率触发,带冷却,仅地表)
  onStoneBroken(x, y, z) {
    if (!this.world || this.snakeCd > 0) return;
    const surface = this.world.heightAt(Math.floor(x), Math.floor(z));
    if (y > surface + 1 || y < surface - 2) return;  // 只有地表附近才出蛇
    if (Math.random() > 0.35) return;
    this.snakeCd = 10;                                  // 冷却 10s
    this.spawnSnake(x + 0.5, y + 0.62, z + 0.5);
  }

  spawnSnake(x, y, z) {
    const mat = new THREE.SpriteMaterial({ map: this.ensureSnakeTex(), transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.95, 0.95, 1);
    const idleY = Math.max(y, SEA_LEVEL + 1.5);
    sprite.position.set(x, idleY - 0.9, z);            // 从地下钻出
    this.scene.add(sprite);
    this.snakes.push({
      sprite, idleY, state: 'emerging', t: 0,
      baseRot: (Math.random() - 0.5) * 1.2,
      leopardTimer: 1.5,                                // 1.5s 后花豹赶来
      leopardCalled: false,
    });
    this.sfx.snakeHiss();
    if (this.hud) this.hud.showTip('嘶嘶嘶——石头里钻出一条蛇!');
  }

  updateSnakes(dt) {
    for (let i = this.snakes.length - 1; i >= 0; i--) {
      const s = this.snakes[i];
      s.t += dt;

      if (s.state === 'emerging') {                      // 钻出动画
        const k = Math.min(1, s.t / 0.6);
        s.sprite.position.y = s.idleY - 0.9 * (1 - k);
        if (k >= 1) { s.state = 'idle'; s.t = 0; }
      } else if (s.state === 'idle') {                   // 扭动
        s.sprite.position.y = s.idleY + Math.sin(s.t * 5) * 0.04;
        s.sprite.material.rotation = s.baseRot + Math.sin(s.t * 3) * 0.12;
        // 呼叫花豹(一次)
        if (!s.leopardCalled) {
          s.leopardTimer -= dt;
          if (s.leopardTimer <= 0) { s.leopardCalled = true; this.spawnHuntingLeopard(s); }
        }
        // 存活 9s 后钻回地下
        if (s.t > 9) { s.state = 'diving'; s.t = 0; }
      } else if (s.state === 'diving') {                 // 钻地消失
        s.sprite.position.y = s.idleY - 0.9 * Math.min(1, s.t / 0.5);
        if (s.t >= 0.5) {
          this.scene.remove(s.sprite); s.sprite.material.dispose();
          this.snakes.splice(i, 1);
        }
      }
      // state === 'eaten' 由花豹移除
    }
    if (this.snakeCd > 0) this.snakeCd -= dt;
  }

  killSnake(s) {
    const i = this.snakes.indexOf(s);
    if (i < 0) return;
    this.sfx.snakeHiss();
    this.scene.remove(s.sprite); s.sprite.material.dispose();
    this.snakes.splice(i, 1);
  }

  clearSnakes() {
    for (const s of this.snakes) { this.scene.remove(s.sprite); s.sprite.material.dispose(); }
    this.snakes.length = 0;
  }

  // 狩猎花豹:从远处贴地扑向蛇
  spawnHuntingLeopard(snake) {
    if (!this.player) return;
    if (!this.leoTex) {
      this.leoTex = makeLeopardTexture();
      this.leoTexFlip = canvasTexture(flipCanvas(this.leoTex.userData.canvas));
    }
    const sp = snake.sprite.position;
    const ang = Math.random() * Math.PI * 2;
    const sx = sp.x + Math.cos(ang) * 11;
    const sz = sp.z + Math.sin(ang) * 11;
    const gy = Math.max(SEA_LEVEL + 1, this.world.heightAt(Math.floor(sx), Math.floor(sz))) + 1.15;
    const mat = new THREE.SpriteMaterial({ map: this.leoTex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 1.1, 1);
    sprite.position.set(sx, gy, sz);
    this.scene.add(sprite);
    this.leopards.push({
      sprite, kind: 'hunter', state: 'hunting', target: snake,
      speed: 8.5, baseY: gy, flying: false, vy: 0, wob: 0, drift: 0,
      leaveTimer: 0, baseRot: 0,
    });
    this.hud.showTip('花豹来了!');
  }

  // ---------- 牛雨:天上掉牛,落地冲击波,结束大合唱 ----------

  tryStartRain() {
    if (this.rain && this.rain.active) { this.hud.showTip('牛雨已经在下了!'); return; }
    if (this.rainCd > 0) { this.hud.showTip(`牛雨冷却中(${Math.ceil(this.rainCd)}s)`); return; }
    this.startRain();
  }

  startRain() {
    if (!this.player) return;
    this.ensureTex();
    this.rainCd = 90;
    this.rain = { active: true, t: 0, duration: 20, spawnTimer: 0.2, cows: [], chorus: 0 };
    this.sfx.moo(0.55);
    this.hud.showCowBanner(true, '牛雨!!!');
    this.hud.showTip('天上在下牛,快找掩体!');
  }

  // 每帧调用(main 的 playing 分支);自动触发:每 90s 掷 8% 概率
  updateRain(dt) {
    if (this.rainCd > 0) this.rainCd -= dt;
    if (!this.rain || !this.rain.active) {
      // 自动触发掷骰(需要 world 存在,即处于对局中)
      if (this.world && this.rainCd <= 0 && Math.random() < 0.08 * dt) this.startRain();
      return;
    }
    const rain = this.rain;
    rain.t += dt;

    // 持续生成坠牛(玩家周围 ±22 格高空)
    rain.spawnTimer -= dt;
    if (rain.spawnTimer <= 0 && rain.t < rain.duration - 3) {
      rain.spawnTimer = 0.38;
      const p = this.player.pos;
      const ang = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * 18;
      const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true });
      const sprite = new THREE.Sprite(mat);
      const size = 1.1 + Math.random() * 0.5;
      sprite.scale.setScalar(size);
      const x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist;
      sprite.position.set(x, 88, z);
      this.scene.add(sprite);
      rain.cows.push({
        sprite, vy: 0, grounded: false, groundTimer: 0,
        rotV: (Math.random() - 0.5) * 6,
        groundY: Math.max(SEA_LEVEL + 1, this.world.heightAt(Math.floor(x), Math.floor(z))) + 0.55 * size,
      });
    }

    // 坠牛:重力下落 → 落地冲击 → 短暂停留 → 消失
    for (let i = rain.cows.length - 1; i >= 0; i--) {
      const c = rain.cows[i];
      if (!c.grounded) {
        c.vy = Math.min(46, c.vy + 30 * dt);
        c.sprite.position.y -= c.vy * dt;
        c.sprite.material.rotation += c.rotV * dt;
        if (c.sprite.position.y <= c.groundY) {
          c.grounded = true;
          c.sprite.position.y = c.groundY;
          c.sprite.material.rotation = 0;
          // 落地冲击:尘土(回调) + 低哞 + 震动 + 击飞附近玩家
          if (this.onCowLand) this.onCowLand(c.sprite.position.x, c.groundY, c.sprite.position.z);
          this.sfx.moo(0.55 + Math.random() * 0.2);
          if (this.onShake) this.onShake(0.3, 0.3);
          const p = this.player.pos;
          const dx = p.x - c.sprite.position.x, dz = p.z - c.sprite.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 3.2) {
            const l = d || 1;
            this.player.vel.x = (dx / l) * 12;
            this.player.vel.z = (dz / l) * 12;
            this.player.vel.y = 9;
            this.sfx.moo(1.1);
          }
        }
      } else {
        c.groundTimer += dt;
        if (c.groundTimer > 1.4) {
          this.scene.remove(c.sprite); c.sprite.material.dispose();
          rain.cows.splice(i, 1);
        }
      }
    }

    // 结束:大合唱(5 声妈妈排队)
    if (rain.t >= rain.duration) {
      rain.active = false;
      this.hud.showCowBanner(false);
      this.hud.showTip('牛雨结束了!它们开始喊妈妈了……');
      for (let i = 0; i < 5; i++) {
        setTimeout(() => this.sfx.mama(0.8 + Math.random() * 0.5, true), i * 280);
      }
    }
  }

  clearRain() {
    if (this.rain) {
      for (const c of this.rain.cows) { this.scene.remove(c.sprite); c.sprite.material.dispose(); }
      this.rain = null;
    }
    this.hud.showCowBanner(false);
  }

  // ---------- 玩家攻击:左键打到牛 ----------

  // 射线-球检测:命中返回 true 并触发反应;没命中返回 false(玩家继续挖方块)
  // 蛇/狩猎花豹在事件外也存在,因此不要求事件激活
  tryHit(ox, oy, oz, dx, dy, dz) {
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return false;
    dx /= len; dy /= len; dz /= len;

    const MAX_DIST = 5.5;
    let bestT = MAX_DIST;
    let best = null;

    const check = (pos, radius, kind, index) => {
      const cx = pos.x - ox, cy = pos.y - oy, cz = pos.z - oz;
      const t = cx * dx + cy * dy + cz * dz;   // 球心在射线上的投影距离
      if (t < 0 || t > bestT) return;
      const px = cx - dx * t, py = cy - dy * t, pz = cz - dz * t;
      if (px * px + py * py + pz * pz > radius * radius) return;
      bestT = t;
      best = { kind, index, x: pos.x, z: pos.z };
    };

    for (let i = 0; i < this.cows.length; i++) {
      const s = this.cows[i].sprite;
      check(s.position, 0.85 * (s.scale.x || 1), 'cow', i);
    }
    for (let i = 0; i < this.leopards.length; i++) {
      if (this.leopards[i].flying) continue;
      const s = this.leopards[i].sprite;
      check(s.position, 0.9, 'leopard', i);
    }
    for (let i = 0; i < this.snakes.length; i++) {
      if (this.snakes[i].state === 'eaten') continue;
      check(this.snakes[i].sprite.position, 0.7, 'snake', i);
    }
    if (this.finale) check(this.finale.sprite.position, 4.6, 'finale', -1);

    if (!best) return false;
    if (best.kind === 'cow') this.knockCow(best.index);
    else if (best.kind === 'leopard') this.hitLeopard(this.leopards[best.index]);
    else if (best.kind === 'snake') this.killSnake(this.snakes[best.index]);
    else this.hitFinale();
    return true;
  }

  knockCow(i) {
    const c = this.cows[i];
    if (!c) return;
    c.vx *= -1.3; c.vz *= -1.3;      // 被打得倒飞出去
    c.vy = 7;
    c.rotV *= 3.5;                    // 旋转加速,更加魔性
    c.life = Math.min(c.life, 1.2);
    this.stats.hit++;
    this.sfx.mama(1 + Math.random() * 0.25);
    if (this.onShake) this.onShake(0.12, 0.15);
    this.onMama();                            // 牛喊妈妈,吓飞一只花豹
  }

  hitFinale() {
    if (!this.finale) return;
    this.stats.hit++;
    this.sfx.mama(0.65);              // 巨型牛:低沉的"妈妈"
    if (this.onShake) this.onShake(0.35, 0.4);
    this.onMama();                    // 巨牛喊妈妈,同样吓飞花豹
    this.scene.remove(this.finale.sprite);
    this.finale.sprite.material.dispose();
    this.finale = null;               // 巨牛被打跑,终场提前结束
  }

  // 返回事件强度 0..1(红晕/天空变色用)
  update(dt) {
    if (!this.active) return 0;
    this.t += dt;
    const p = this.player.pos;

    if (this.t < SPAWN_UNTIL) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnTimer = WAVE_EVERY; this.spawnWave(); }
    }

    // 牛群移动与碰撞
    for (let i = this.cows.length - 1; i >= 0; i--) {
      const c = this.cows[i];
      c.life -= dt;
      c.wob += dt * 9;
      const s = c.sprite;
      s.position.x += c.vx * dt;
      s.position.y += c.vy * dt + Math.sin(c.wob) * 0.8 * dt;
      s.position.z += c.vz * dt;
      s.material.rotation += c.rotV * dt;

      if (this.hitCooldown <= 0) {
        const dx = p.x - s.position.x, dy = (p.y + 0.9) - s.position.y, dz = p.z - s.position.z;
        if (Math.abs(dy) < 2.2 && Math.hypot(dx, dz) < 1.7) {
          this.hitCooldown = 0.6;
          this.knockback(s.position);
          this.sfx.moo(1.2 + Math.random() * 0.5);
          if (this.onShake) this.onShake(0.4, 0.5);
        }
      }

      if (c.life <= 0) {
        this.scene.remove(s); s.material.dispose();
        this.cows.splice(i, 1);
      }
    }
    if (this.hitCooldown > 0) this.hitCooldown -= dt;

    // 终场:巨型牛头怼脸
    if (!this.finaleDone && this.t > FINALE_AT) {
      this.finaleDone = true;
      this.spawnFinale();
      this.sfx.moo(0.6);
    }
    if (this.finale) {
      const f = this.finale;
      f.sprite.position.x += f.vx * dt;
      f.sprite.position.y += f.vy * dt;
      f.sprite.position.z += f.vz * dt;
      f.sprite.material.rotation -= dt * 2;
      const d = Math.hypot(p.x - f.sprite.position.x, p.y + 1 - f.sprite.position.y, p.z - f.sprite.position.z);
      if (d < 3.2) {
        // 怼脸时刻:闪光 + 大震动 + 超强击飞
        this.hud.flashCow();
        this.knockback({ x: f.sprite.position.x, z: f.sprite.position.z });
        this.player.vel.y = 14;
        this.sfx.moo(0.5);
        if (this.onShake) this.onShake(1.0, 0.9);
        this.scene.remove(f.sprite); f.sprite.material.dispose();
        this.finale = null;
      } else if (d > 60) {
        this.scene.remove(f.sprite); f.sprite.material.dispose();
        this.finale = null;
      }
    }

    // 结束
    if (this.t >= DURATION) {
      this.reset();
      const leo = this.stats.leopards > 0 ? `,吓飞 ${this.stats.leopards} 只花豹` : '';
      if (this.stats.hit > 0 || leo) this.hud.showTip(`牛来结束!打飞 ${this.stats.hit} 头牛${leo}`);
      return 0;
    }
    // 强度:首 1s 渐入,末 1.2s 渐出
    return Math.min(1, this.t / 1) * Math.min(1, (DURATION - this.t) / 1.2);
  }
}
