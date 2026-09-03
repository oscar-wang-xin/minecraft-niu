// ============================================================
// main.js — 游戏入口与主循环
// ============================================================

import * as THREE from 'three';
import { World, WORLD_HEIGHT, SEA_LEVEL, CHUNK_SIZE } from './world.js';
import { buildChunkGeometry } from './mesher.js';
import { Player, EYE_HEIGHT, raycastVoxel } from './player.js';
import { BLOCK, BLOCKS, HOTBAR_BLOCKS, buildAtlas, TILE_PX, ATLAS_COLS, ATLAS_ROWS } from './blocks.js';
import { HUD } from './hud.js';
import { Sfx } from './audio.js';
import { CowEvent } from './cow.js';
import { makeDungIcon, makeTorchIcon, makeFireworkIcon } from './items.js';
import * as storage from './storage.js';

// ---------- 基础 ----------
const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui');

const atlas = buildAtlas();
const atlasTex = new THREE.CanvasTexture(atlas);
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;
atlasTex.colorSpace = THREE.SRGBColorSpace;

const renderer = (() => {
  try {
    return new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  } catch (e) {
    if (window.__mcFatal) window.__mcFatal('你的浏览器无法创建 WebGL 上下文,游戏无法运行。\n\n' +
      '请尝试:\n  · 更新浏览器版本(Edge/Chrome/Firefox 均可)\n  · 检查浏览器硬件加速设置是否开启\n\n错误信息:' + e.message);
    throw e;
  }
})();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 400);
camera.rotation.order = 'YXZ';

const RENDER_DIST = 6;                       // 视距(区块)
const SKY = new THREE.Color(0x8ec9ef);
scene.background = SKY.clone(); // 独立引用,避免水下 setHex 污染常量
scene.fog = new THREE.Fog(SKY.clone(), (RENDER_DIST - 2.4) * CHUNK_SIZE, RENDER_DIST * CHUNK_SIZE + 6);

const matOpaque = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 });
const matWater = new THREE.MeshBasicMaterial({
  map: atlasTex, vertexColors: true, transparent: true, opacity: 0.72,
  depthWrite: false, side: THREE.DoubleSide,
});

const hud = new HUD(uiRoot, atlas);
hud.randomSplash();
const sfx = new Sfx();

// "牛来"事件
const cowEvent = new CowEvent({ scene, hud, sfx });
cowEvent.onShake = (amp, dur) => { shakeAmp = amp; shakeDur = dur; shakeT = dur; };
cowEvent.onPelt = (n) => { peltCount = n; hud.updatePelts(n); hud.refreshCraft(net()); };
cowEvent.onDung = (n) => { dungCount = n; hud.updateDung(n); hud.refreshCraft(net()); };
cowEvent.onLeopardKill = (n) => { fireworkCount = n; hud.updateFireworks(n); };
cowEvent.onCowLand = (x, y, z) => spawnBreakParticles(x - 0.5, y - 1, z - 0.5, BLOCK.DIRT);
const COW_SKY = new THREE.Color(0x5a1510); // 事件时天空的暗红

// ---------- 方块颜色(粒子用):取 tile 平均色 ----------
function tileAverageColor(tile) {
  const ctx = atlas.getContext('2d');
  const tx = (tile % ATLAS_COLS) * TILE_PX, ty = Math.floor(tile / ATLAS_COLS) * TILE_PX;
  const d = ctx.getImageData(tx, ty, TILE_PX, TILE_PX).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  n = n || 1;
  return new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
}
const tileColors = new Map();

// ---------- 游戏状态 ----------
let state = 'menu';            // menu | playing | paused
let world = null;
let player = null;
let hotbarIndex = 0;
let dungCount = 0;  // 牛粪收集数
let peltCount = 0;  // 豹皮数
let torchCount = 0;  // 火把数
let fireworkCount = 0;  // 烟花数
let saveDirty = false;
let craftOpen = false;   // 合成面板是否打开
let currentHit = null;

// 合成面板资源快照(main 与 cowEvent 回调共用)
function net() {
  return { 
    dung: Number(dungCount) || 0, 
    pelt: Number(peltCount) || 0, 
    torch: Number(torchCount) || 0, 
    firework: Number(fireworkCount) || 0 
  };
}

const chunkMeshes = new Map(); // key -> { solid, water }
const dirtyChunks = new Set();

// ---------- 区块网格 ----------
function makeMesh(d, material) {
  if (!d.positions.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(d.colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uvs, 2));
  g.setIndex(d.indices);
  g.computeBoundingSphere();
  return new THREE.Mesh(g, material);
}

function buildChunk(cx, cz) {
  const key = cx + ',' + cz;
  if (chunkMeshes.has(key)) return;
  const geo = buildChunkGeometry(world, cx, cz);
  const solid = makeMesh(geo.opaque, matOpaque);
  const water = makeMesh(geo.water, matWater);
  if (solid) scene.add(solid);
  if (water) scene.add(water);
  chunkMeshes.set(key, { solid, water });
}

function disposeChunk(key) {
  const c = chunkMeshes.get(key);
  if (!c) return;
  if (c.solid) { scene.remove(c.solid); c.solid.geometry.dispose(); }
  if (c.water) { scene.remove(c.water); c.water.geometry.dispose(); }
  chunkMeshes.delete(key);
}

// 预计算视距内偏移,按距离排序
const ringOffsets = [];
for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++)
  for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++)
    if (dx * dx + dz * dz <= RENDER_DIST * RENDER_DIST + 1) ringOffsets.push([dx, dz]);
ringOffsets.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));

function updateChunks(budget = 2) {
  const pcx = Math.floor(player.pos.x / CHUNK_SIZE), pcz = Math.floor(player.pos.z / CHUNK_SIZE);
  let built = 0;
  for (const [dx, dz] of ringOffsets) {
    if (built >= budget) break;
    const cx = pcx + dx, cz = pcz + dz;
    if (!chunkMeshes.has(cx + ',' + cz)) { buildChunk(cx, cz); built++; }
  }
  // 脏区块重建
  for (const key of dirtyChunks) {
    if (!chunkMeshes.has(key)) continue;
    const [cx, cz] = key.split(',').map(Number);
    disposeChunk(key);
    buildChunk(cx, cz);
  }
  dirtyChunks.clear();
  // 卸载远处
  for (const key of [...chunkMeshes.keys()]) {
    const [cx, cz] = key.split(',').map(Number);
    if (Math.abs(cx - pcx) > RENDER_DIST + 1 || Math.abs(cz - pcz) > RENDER_DIST + 1) disposeChunk(key);
  }
}

// ---------- 选中方块框 ----------
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001)),
  new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 })
);
highlight.visible = false;
scene.add(highlight);

// ---------- 粒子 ----------
const particleGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
const particles = [];
function spawnBreakParticles(x, y, z, blockId) {
  const def = BLOCKS[blockId];
  const tile = def.tiles[0];
  let col = tileColors.get(tile);
  if (!col) { col = tileAverageColor(tile); tileColors.set(tile, col); }
  const mat = new THREE.MeshBasicMaterial({ color: col });
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(particleGeo, mat);
    m.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
    scene.add(m);
    particles.push({
      m,
      vx: (Math.random() - 0.5) * 3.2, vy: Math.random() * 4 + 1.5, vz: (Math.random() - 0.5) * 3.2,
      life: 0.5 + Math.random() * 0.25,
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose?.(); particles.splice(i, 1); continue; }
    p.vy -= 18 * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    const s = Math.max(0.2, p.life * 2);
    p.m.scale.setScalar(s);
  }
}

// ---------- 云与方形太阳 ----------
const cloudGroup = new THREE.Group();
{
  const cmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, fog: false });
  const cgeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 26; i++) {
    const w = 10 + Math.random() * 24, d = 8 + Math.random() * 18;
    const m = new THREE.Mesh(cgeo, cmat);
    m.scale.set(w, 3, d);
    m.position.set((Math.random() - 0.5) * 500, 72 + Math.random() * 4, (Math.random() - 0.5) * 500);
    cloudGroup.add(m);
  }
}
scene.add(cloudGroup);

const sun = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshBasicMaterial({ color: 0xfff7c9, fog: false })
);
sun.position.set(180, 220, -320);
sun.lookAt(0, 0, 0);
scene.add(sun);

// ---------- 输入 ----------
const keys = new Set();
let lastW = 0;
const input = { forward: 0, back: 0, left: 0, right: 0, jump: false, sneak: false, sprint: false };

window.addEventListener('keydown', (e) => {
  if (state === 'menu') return;
  if (e.code === 'F3') { e.preventDefault(); hud.setDebugVisible(!hud.debugVisible); return; }
  if (e.code === 'KeyF' && state === 'playing') {
    player.flying = !player.flying;
    hud.showTip(player.flying ? '飞行模式:开' : '飞行模式:关');
    return;
  }
  if (e.code === 'KeyG' && state === 'playing') {
    cowEvent.tryStart();
    return;
  }
  if (e.code === 'KeyY' && state === 'playing') {
    cowEvent.tryStartRain();
    return;
  }
  if (e.code === 'KeyC' && state === 'playing') {
    if (!craftOpen) {
      craftOpen = true;
      hud.toggleCraft();          // 打开
      refreshCraft();
      // 释放鼠标才能点击合成按钮
      if (document.pointerLockElement === canvas) { try { document.exitPointerLock(); } catch { /* */ } }
    } else {
      craftOpen = false;
      hud.toggleCraft();          // 关闭
      lockPointer();
    }
    return;
  }
  if (e.code === 'Escape' && state === 'playing') {
    if (craftOpen) {
      craftOpen = false;
      hud.toggleCraft();          // 关闭面板
      lockPointer();
    } else {
      pauseGame();
    }
    return;
  }
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) { hotbarIndex = n - 1; updateHotbar(); }
    return;
  }
  if (e.code === 'KeyW') {
    const now = performance.now();
    if (now - lastW < 280) input.sprint = true;
    lastW = now;
  }
  if (e.ctrlKey && e.code === 'KeyW') { input.sprint = true; e.preventDefault(); }
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyW') input.sprint = false;
});
window.addEventListener('blur', () => keys.clear());

canvas.addEventListener('mousedown', (e) => {
  if (state !== 'playing') return;
  if (document.pointerLockElement !== canvas) { lockPointer(); return; }
  if (e.button === 0) {
    // 先检查是否点击了烟花实体
    if (window.__mcFireworkClick) {
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      // 简单检测：烟花在玩家前方 5 格内
      const fw = scene.children.find(c => c.userData && c.userData.isFirework);
      if (fw && fw.userData.onClick) {
        const dist = fw.position.distanceTo(camera.position);
        if (dist < 5) {
          fw.userData.onClick();
          window.__mcFireworkClick = null;
          return;
        }
      }
    }
    // 事件进行中先尝试打牛(射线-球检测),打空才挖方块
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const hitCow = cowEvent.tryHit(camera.position.x, camera.position.y, camera.position.z, dir.x, dir.y, dir.z);
    if (!hitCow) tryBreak();
    breakHeld = true; breakTimer = 0.28;
  } else if (e.button === 2) tryPlace();
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) breakHeld = false; });
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('wheel', (e) => {
  if (state !== 'playing') return;
  hotbarIndex = (hotbarIndex + (e.deltaY > 0 ? 1 : -1) + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
  updateHotbar();
});

document.addEventListener('mousemove', (e) => {
  if (state !== 'playing' || document.pointerLockElement !== canvas) return;
  const s = 0.0023;
  player.yaw -= e.movementX * s;
  player.pitch -= e.movementY * s;
  const lim = Math.PI / 2 - 0.001;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
});

function lockPointer() {
  try { canvas.requestPointerLock(); } catch { /* 忽略 */ }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state === 'playing' && !craftOpen) pauseGame();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 交互 ----------
let breakHeld = false, breakTimer = 0, stepAccum = 0, wasInWater = false;
let shakeT = 0, shakeDur = 1, shakeAmp = 0; // 相机震动(牛来事件)

function eyePos() {
  return { x: player.pos.x, y: player.pos.y + EYE_HEIGHT, z: player.pos.z };
}

function computeHit() {
  const e = eyePos();
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  currentHit = raycastVoxel(world, e.x, e.y, e.z, dir.x, dir.y, dir.z, 5);
  if (currentHit) {
    highlight.visible = true;
    highlight.position.set(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5);
  } else highlight.visible = false;
}

function tryBreak() {
  if (!currentHit) return;
  const { x, y, z } = currentHit;
  const id = world.getBlock(x, y, z);
  if (id === BLOCK.AIR || id === BLOCK.WATER) return;
  if (id === BLOCK.BEDROCK) { hud.showTip('基岩无法破坏'); return; }
  for (const k of world.setBlock(x, y, z, BLOCK.AIR)) dirtyChunks.add(k);
  spawnBreakParticles(x, y, z, id);
  sfx.dig(id);
  saveDirty = true;
  computeHit();
  // 挖石头有概率触发炸弹
  if (id === BLOCK.STONE || id === BLOCK.COBBLE) {
    if (Math.random() < 0.15) {  // 15% 概率
      // 生成黑色炸弹实体，1 秒后爆炸
      const bombGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
      const bombMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const bomb = new THREE.Mesh(bombGeo, bombMat);
      bomb.position.set(x + 0.5, y + 0.5, z + 0.5);
      scene.add(bomb);
      // 1 秒后爆炸
      setTimeout(() => {
        scene.remove(bomb);
        bombGeo.dispose();
        bombMat.dispose();
        // 爆炸效果
        player.vel.y = 15;  // 向上炸飞
        player.vel.x = (Math.random() - 0.5) * 12;
        player.vel.z = (Math.random() - 0.5) * 12;
        hud.showTip('轰！石头里有炸弹!');
        cowEvent.onShake && cowEvent.onShake(0.6, 0.5);
        sfx.dig(BLOCK.STONE);
        // 爆炸粒子
        for (let pi = 0; pi < 30; pi++) {
          const pm = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.12, 0.12),
            new THREE.MeshBasicMaterial({ color: 0xff6600 })
          );
          pm.position.set(x + 0.5, y + 0.5, z + 0.5);
          scene.add(pm);
          const pvx = (Math.random() - 0.5) * 15;
          let pvy = Math.random() * 15 + 5;
          const pvz = (Math.random() - 0.5) * 15;
          let t = 0;
          (function anim() {
            pm.position.x += pvx * 0.02;
            pm.position.y += pvy * 0.02;
            pm.position.z += pvz * 0.02;
            pvy -= 0.4;
            t++;
            if (t < 60 && pm.position.y > 0) requestAnimationFrame(anim);
            else { scene.remove(pm); pm.geometry.dispose(); pm.material.dispose(); }
          })();
        }
      }, 1000);
    }
  }
  // 草方块:35% 出蛇(引花豹),另外 10% 掉落牛粪实体(需走过去捡)
  if (id === BLOCK.GRASS) {
    cowEvent.onStoneBroken(x, y, z);
    if (Math.random() < 0.10) cowEvent.spawnPickup(x, y, z, 'dung');
  }
}

function intersectsPlayer(x, y, z) {
  const p = player.pos, hw = 0.3;
  return x + 1 > p.x - hw && x < p.x + hw &&
         y + 1 > p.y && y < p.y + 1.8 &&
         z + 1 > p.z - hw && z < p.z + hw;
}

function tryPlace() {
  if (!currentHit) return;
  const x = currentHit.x + currentHit.nx, y = currentHit.y + currentHit.ny, z = currentHit.z + currentHit.nz;
  if (y < 0 || y >= WORLD_HEIGHT) return;
  const cur = world.getBlock(x, y, z);
  if (cur !== BLOCK.AIR && cur !== BLOCK.WATER) return;
  if (intersectsPlayer(x, y, z)) return;
  const id = HOTBAR_BLOCKS[hotbarIndex];
  for (const k of world.setBlock(x, y, z, id)) dirtyChunks.add(k);
  sfx.place(id);
  saveDirty = true;
  computeHit();
}

function updateHotbar() { hud.setHotbar(HOTBAR_BLOCKS, hotbarIndex); }

// ---------- 流程 ----------
function findSpawn() {
  for (let r = 0; r < 200; r += 6)
    for (let a = 0; a < 12; a++) {
      const x = Math.floor(Math.cos(a) * r), z = Math.floor(Math.sin(a) * r);
      const h = world.heightAt(x, z);
      if (h > SEA_LEVEL + 1 && world.biomeAt(x, z, h) !== 'stone') return { x: x + 0.5, y: h + 1.02, z: z + 0.5 };
    }
  return { x: 0.5, y: world.heightAt(0, 0) + 1.02, z: 0.5 };
}

function startGame(seedStr, save) {
  world = new World(seedStr);
  if (save && save.edits) world.loadEdits(save.edits);
  player = new Player(world, 0, 60, 0);

  if (save && save.player) {
    player.pos.x = save.player.x; player.pos.y = save.player.y; player.pos.z = save.player.z;
    player.yaw = save.player.yaw; player.pitch = save.player.pitch;
    player.flying = !!save.player.flying;
  } else {
    const s = findSpawn();
    player.pos.x = s.x; player.pos.y = s.y; player.pos.z = s.z;
  }
  hotbarIndex = save ? save.hotbarIndex | 0 : 0;

  // 牛来事件复位 + 提供怼脸闪光用的牛头图
  cowEvent.reset();
  cowEvent.clearPickups();
  cowEvent.clearSnakes();
  cowEvent.clearRain();
  cowEvent.bindPlayer(player);
  cowEvent.bindWorld(world);
  cowEvent.ensureTex();
  hud.giveCowFace(cowEvent.tex.userData.canvas);
  hud.initPeltIcon(atlas, cowEvent.ensurePeltTex().userData.canvas);
  // 物品图标:牛粪/火把/烟花/豹皮 + 合成面板
  const iconDung = makeDungIcon();
  const iconTorch = makeTorchIcon();
  const iconFire = makeFireworkIcon();
  hud.setCounterIcon('dung-counter', iconDung);
  hud.setCounterIcon('torch-counter', iconTorch);
  hud.initFireworkIcon(iconFire);
  hud.initCraftIcons(iconDung, cowEvent.ensurePeltTex().userData.canvas, iconTorch);
  hud.updatePelts(0);
  hud.updateFireworks(0);
  hud.updateDung(0);
  hud.updateTorch(0);

  // 清空旧网格,同步预生成周围区块
  for (const k of [...chunkMeshes.keys()]) disposeChunk(k);
  const pcx = Math.floor(player.pos.x / CHUNK_SIZE), pcz = Math.floor(player.pos.z / CHUNK_SIZE);
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++) buildChunk(pcx + dx, pcz + dz);

  state = 'playing';
  hud.hideMenu();
  hud.hidePause();
  updateHotbar();
  lockPointer();
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  craftOpen = false;
  hud.hideCraft ? hud.hideCraft() : null;
  input.sprint = false;
  keys.clear();
  cowEvent.pause();
  hud.showPause();
  if (saveDirty) { storage.saveGame(world, player, hotbarIndex); saveDirty = false; }
}

function resumeGame() {
  state = 'playing';
  cowEvent.resume();
  hud.hidePause();
  lockPointer();
}

function quitToTitle() {
  if (world && player) storage.saveGame(world, player, hotbarIndex);
  state = 'menu';
  cowEvent.reset();
  cowEvent.clearPickups();
  cowEvent.clearSnakes();
  cowEvent.clearRain();
  for (const k of [...chunkMeshes.keys()]) disposeChunk(k);
  for (const p of particles) scene.remove(p.m);
  particles.length = 0;
  world = null; player = null;
  hud.showMenu(!!storage.loadGame());
  hud.randomSplash();
}

hud.bind({
  onContinue: () => { const s = storage.loadGame(); if (s) startGame(s.seed, s); },
  onStart: (seed) => {
    storage.clearSave();
    startGame(seed || String(Math.floor(Math.random() * 1e9)), null);
  },
  onResume: resumeGame,
  onQuit: quitToTitle,
});
hud.showMenu(!!storage.loadGame());

// ---------- 合成系统 ----------
function refreshCraft() { hud.refreshCraft(net()); }

function craftTorch() {
  if (dungCount >= 2) { dungCount -= 2; torchCount++; hud.updateDung(dungCount); hud.updateTorch(torchCount); sfx.pickupDing(); }
  refreshCraft();
}
function craftFirework() {
  if (peltCount >= 2) { peltCount -= 2; fireworkCount++; hud.updatePelts(peltCount); hud.updateFireworks(fireworkCount); sfx.pickupDing(); }
  refreshCraft();
}
function craftLaunch() {
  if (torchCount >= 1 && fireworkCount >= 1) {
    torchCount--; fireworkCount--;
    hud.updateTorch(torchCount); hud.updateFireworks(fireworkCount);
    hud.showTip('烟花已放置！点击发射！');
    // 在玩家眼前生成烟花实体（可点击）
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const spawnX = player.pos.x + dir.x * 3;
    const spawnY = player.pos.y + 1.5;
    const spawnZ = player.pos.z + dir.z * 3;
    // 烟花贴图：用烟花图标或豹皮（没有牛时用豹子）
    const fireworkTex = makeFireworkIcon();
    const mat = new THREE.SpriteMaterial({ map: fireworkTex, transparent: true });
    const fireworkSprite = new THREE.Sprite(mat);
    fireworkSprite.scale.setScalar(1.2);
    fireworkSprite.position.set(spawnX, spawnY, spawnZ);
    fireworkSprite.userData = { isFirework: true, spawnX, spawnY, spawnZ };
    scene.add(fireworkSprite);
    // 点击烟花发射
    fireworkSprite.userData.onClick = () => {
      scene.remove(fireworkSprite);
      fireworkSprite.material.dispose();
      launchFireworks(spawnX, spawnY, spawnZ);
    };
    // 添加点击检测（在 main.js 的 mousedown 里处理）
    window.__mcFireworkClick = fireworkSprite.userData.onClick;
  }
  refreshCraft();
}

function launchFireworks(sx, sy, sz) {
  sfx.moo(1.2);
  hud.showTip('牛来烟花发射！');
  // 发射 10 个牛头（或豹子）
  const tex = cowEvent.tex || cowEvent.ensurePeltTex();
  for (let fi = 0; fi < 10; fi++) {
    setTimeout(() => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 8;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(1.5);
      sprite.position.set(sx + Math.cos(ang)*dist, sy + 5, sz + Math.sin(ang)*dist);
      scene.add(sprite);
      let vy = -8, t = 0;
      (function animFW() {
        sprite.position.y += vy * 0.05;
        sprite.material.rotation += 0.2;
        t++;
        if (t < 100 && sprite.position.y > player.pos.y + 2) requestAnimationFrame(animFW);
        else { scene.remove(sprite); sprite.material.dispose(); }
      })();
    }, fi * 150);
  }
}

hud.bindCraft({ onTorch: craftTorch, onFirework: craftFirework, onLaunch: craftLaunch, onClose: () => hud.hideCraft() });

// ---------- 主循环 ----------
let last = performance.now();
let fps = 60, fpsSmooth = 60;
let saveTimer = 0;

const FACING = ['南 S', '西 W', '北 N', '东 E'];

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsSmooth = fpsSmooth * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;

  if (state === 'playing' && player) {
    // 输入
    input.forward = keys.has('KeyW') ? 1 : 0;
    input.back = keys.has('KeyS') ? 1 : 0;
    input.left = keys.has('KeyA') ? 1 : 0;
    input.right = keys.has('KeyD') ? 1 : 0;
    input.jump = keys.has('Space');
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (!keys.has('KeyW')) input.sprint = false;

    player.sprinting = input.sprint && input.forward > 0;
    player.update(dt, input);

    // 相机
    camera.position.set(player.pos.x, player.pos.y + EYE_HEIGHT, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0);

    // 相机震动(不影响 player.pos,每帧重置不累积)
    if (shakeT > 0) {
      shakeT -= dt;
      const a = shakeAmp * Math.max(0, shakeT / shakeDur);
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
      camera.position.z += (Math.random() - 0.5) * a;
    }

    // 疾跑 FOV
    const targetFov = player.sprinting ? 82 : 75;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, 12 * dt);
      camera.updateProjectionMatrix();
    }

    // 水下氛围
    hud.setWaterOverlay(player.eyeInWater);
    if (player.eyeInWater) { scene.fog.color.setHex(0x1a4fa8); scene.fog.near = 2; scene.fog.far = 26; scene.background.setHex(0x1a4fa8); }
    else { scene.fog.color.copy(SKY); scene.fog.near = (RENDER_DIST - 2.4) * CHUNK_SIZE; scene.fog.far = RENDER_DIST * CHUNK_SIZE + 6; scene.background.copy(SKY); }
    if (player.inWater !== wasInWater) { if (player.inWater) sfx.splash(); wasInWater = player.inWater; }

    // "牛来"事件:牛群冲锋 + 红晕 + 天空变暗 + 花豹
    const cowIntensity = cowEvent.update(dt);
    cowEvent.updateCreatures(dt); // 蛇/花豹/豹皮(与事件无关,始终运行)
    cowEvent.updateRain(dt);      // 牛雨(含自动触发掷骰)
    hud.setCowVignette(cowIntensity);
    if (cowIntensity > 0) {
      scene.background.copy(SKY).lerp(COW_SKY, cowIntensity * 0.75);
      scene.fog.color.copy(scene.background);
    }

    // 连续挖掘
    computeHit();
    if (breakHeld) {
      breakTimer -= dt;
      if (breakTimer <= 0) { tryBreak(); breakTimer = 0.26; }
    }

    // 脚步声
    if (player.onGround && !player.flying) {
      const sp = Math.hypot(player.vel.x, player.vel.z);
      stepAccum += sp * dt;
      if (sp > 1.2 && stepAccum > 2.1) {
        stepAccum = 0;
        const under = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z));
        if (under) sfx.step(under);
      }
    }

    updateChunks(2);
    updateParticles(dt);

    // 太阳跟随玩家(保持在天上固定方位)
    sun.position.set(player.pos.x + 180, 220, player.pos.z - 320);

    // 云缓慢漂移(只向 +x,超出玩家东侧 260 格后回绕)
    for (const c of cloudGroup.children) {
      c.position.x += 0.9 * dt;
      if (c.position.x - player.pos.x > 260) c.position.x -= 520;
    }

    // 自动存档
    saveTimer += dt;
    if (saveTimer > 5) {
      saveTimer = 0;
      if (saveDirty) { storage.saveGame(world, player, hotbarIndex); saveDirty = false; }
    }

    // 调试信息
    if (hud.debugVisible) {
      const yawDeg = ((player.yaw * 180 / Math.PI) % 360 + 360) % 360;
      const facing = FACING[Math.round(yawDeg / 90) % 4];
      hud.updateDebug(
        `FPS: ${fpsSmooth.toFixed(0)}\n` +
        `XYZ: ${player.pos.x.toFixed(2)} / ${player.pos.y.toFixed(2)} / ${player.pos.z.toFixed(2)}\n` +
        `区块: ${Math.floor(player.pos.x / CHUNK_SIZE)}, ${Math.floor(player.pos.z / CHUNK_SIZE)}\n` +
        `朝向: ${facing}  视野区块数: ${chunkMeshes.size}\n` +
        `种子: ${world.seedStr}  模式: ${player.flying ? '飞行' : '步行'}\n` +
        `准星: ${currentHit ? `${BLOCKS[world.getBlock(currentHit.x, currentHit.y, currentHit.z)]?.name} (${currentHit.x}, ${currentHit.y}, ${currentHit.z})` : '—'}`
      );
    }
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

