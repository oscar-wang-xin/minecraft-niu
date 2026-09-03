// ============================================================
// hud.js — 全部 DOM UI:主菜单 / 暂停菜单 / HUD(准星、快捷栏、调试、提示)
// ============================================================

import { BLOCKS, TILE, extractTileCanvas } from './blocks.js';

const CSS = `
#ui { position: fixed; inset: 0; pointer-events: none; z-index: 10; }
#ui .clickable { pointer-events: auto; }

/* —— 通用 MC 按钮 —— */
.mc-btn {
  display: block; width: 260px; padding: 11px 0; margin: 7px auto;
  text-align: center; cursor: pointer;
  font-size: 15px; font-weight: bold; letter-spacing: 1px;
  color: #ececec; text-shadow: 2px 2px 0 #383838;
  background: linear-gradient(#9c9c9c, #7a7a7a 48%, #6d6d6d);
  border: 2px solid #000; border-radius: 2px;
  box-shadow: inset 2px 2px 0 rgba(255,255,255,.4), inset -2px -2px 0 rgba(0,0,0,.4);
}
.mc-btn:hover { color: #ffffa0; filter: brightness(1.12); box-shadow: inset 2px 2px 0 rgba(255,255,255,.5), inset -2px -2px 0 rgba(0,0,0,.4), 0 0 0 2px #fff; }
.mc-btn:active { transform: translateY(1px); }
.mc-btn.small { width: 124px; display: inline-block; }

/* —— 主菜单 —— */
#menu { position: absolute; inset: 0; pointer-events: auto;
  background-color: #3c3c3c; image-rendering: pixelated;
  display: flex; flex-direction: column; align-items: center; justify-content: center; }
#menu-title { font-size: 58px; font-weight: 900; letter-spacing: 6px; color: #fff;
  text-shadow: 4px 4px 0 #3a3a3a, 5px 5px 0 rgba(0,0,0,.45); margin-bottom: 4px; }
#menu-sub { color: #ccc; font-size: 14px; margin-bottom: 26px; text-shadow: 2px 2px 0 #222; }
#splash { position: relative; color: #ffff00; font-size: 16px; font-weight: bold;
  text-shadow: 2px 2px 0 #3f3f00; transform: rotate(-12deg);
  animation: splash-pulse 0.9s ease-in-out infinite; margin-top: -58px; margin-left: 300px; }
@keyframes splash-pulse { 0%,100% { transform: rotate(-12deg) scale(1);} 50% { transform: rotate(-12deg) scale(1.08);} }
#seed-row { margin: 4px 0 12px; color: #ddd; font-size: 13px; text-shadow: 1px 1px 0 #222; }
#seed-input { width: 180px; padding: 7px 9px; background: #000; border: 2px solid #a0a0a0;
  color: #fff; font: inherit; outline: none; text-align: center; }
#seed-input:focus { border-color: #fff; }
#menu-help { margin-top: 26px; color: #b7b7b7; font-size: 12px; line-height: 1.9; text-align: center; text-shadow: 1px 1px 0 #222; }
#menu-help b { color: #fff; }
#menu-version { position: absolute; left: 8px; bottom: 6px; color: #888; font-size: 12px; }

/* —— 暂停菜单 —— */
#pause { position: absolute; inset: 0; pointer-events: auto; background: rgba(0,0,0,.55);
  display: flex; flex-direction: column; align-items: center; justify-content: center; }
#pause h2 { color: #fff; font-size: 26px; margin-bottom: 18px; text-shadow: 2px 2px 0 #333; }
#pause-help { color: #bbb; font-size: 12px; line-height: 1.9; margin-top: 22px; text-align: center; text-shadow: 1px 1px 0 #222; }

/* —— HUD —— */
#hud { position: absolute; inset: 0; }
#crosshair { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px;
  transform: translate(-50%, -50%); mix-blend-mode: difference; }
#crosshair::before, #crosshair::after { content: ''; position: absolute; background: #ddd; }
#crosshair::before { left: 50%; top: 0; width: 2px; height: 100%; transform: translateX(-50%); }
#crosshair::after { top: 50%; left: 0; height: 2px; width: 100%; transform: translateY(-50%); }

#hotbar { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%);
  display: flex; padding: 3px; background: rgba(12,12,12,.55);
  border: 2px solid rgba(0,0,0,.7); border-radius: 3px; }
.hb-slot { width: 50px; height: 50px; margin: 1px; position: relative;
  background: rgba(70,70,70,.35); box-shadow: inset 1px 1px 0 rgba(0,0,0,.5), inset -1px -1px 0 rgba(255,255,255,.12); }
.hb-slot.sel { outline: 3px solid #eee; outline-offset: -1px; z-index: 1; }
.hb-slot canvas { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 42px; height: 42px; image-rendering: pixelated; }
#hb-name { position: absolute; left: 50%; bottom: 74px; transform: translateX(-50%);
  color: #fff; font-size: 15px; font-weight: bold; text-shadow: 2px 2px 0 #222;
  opacity: 0; transition: opacity .4s; }

#debug { position: absolute; left: 6px; top: 6px; color: #fff; font-size: 12px; line-height: 1.55;
  background: rgba(0,0,0,.35); padding: 6px 9px; white-space: pre; text-shadow: 1px 1px 0 #000; }
#tip { position: absolute; left: 50%; top: 18%; transform: translateX(-50%);
  color: #ff5; font-size: 15px; font-weight: bold; text-shadow: 2px 2px 0 #222;
  opacity: 0; transition: opacity .5s; }
#water-overlay { position: absolute; inset: 0; background: rgba(24, 68, 170, .32); opacity: 0; transition: opacity .15s; }
#version-hud { position: absolute; left: 8px; bottom: 6px; color: rgba(255,255,255,.45); font-size: 12px; text-shadow: 1px 1px 0 #000; }
#pelt-counter { position: absolute; left: 50%; bottom: 74px; transform: translateX(-260px);
  display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 4px;
  background: rgba(12,12,12,.55); border: 2px solid rgba(0,0,0,.7); border-radius: 3px; }
#pelt-counter canvas { width: 26px; height: 26px; image-rendering: pixelated; }
#pelt-counter span { color: #ffd21e; font-size: 15px; font-weight: bold; text-shadow: 2px 2px 0 #222; }
#firework-counter { position: absolute; left: 50%; bottom: 74px; transform: translateX(-120px);
  display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 4px;
  background: rgba(12,12,12,.55); border: 2px solid rgba(0,0,0,.7); border-radius: 3px; }
#firework-counter canvas { width: 26px; height: 26px; image-rendering: pixelated; }
#firework-counter span { color: #ff6600; font-size: 15px; font-weight: bold; text-shadow: 2px 2px 0 #222; }
#dung-counter, #torch-counter { position: absolute; left: 50%; bottom: 74px; transform: translateX(-260px);
  display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 4px;
  background: rgba(12,12,12,.55); border: 2px solid rgba(0,0,0,.7); border-radius: 3px; }
#torch-counter { transform: translateX(-400px); }
#dung-counter canvas, #torch-counter canvas { width: 26px; height: 26px; image-rendering: pixelated; }
#dung-counter span { color: #c9a95e; font-size: 15px; font-weight: bold; text-shadow: 2px 2px 0 #222; }
#torch-counter span { color: #ffb347; font-size: 15px; font-weight: bold; text-shadow: 2px 2px 0 #222; }

/* —— 合成面板 —— */
#craft-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  background: rgba(20,20,20,.92); border: 2px solid #5a5a5a; border-radius: 4px;
  padding: 18px 22px; pointer-events: auto; min-width: 340px; display: none; }
#craft-panel h3 { color: #fff; font-size: 18px; margin-bottom: 14px; text-align: center; text-shadow: 2px 2px 0 #333; }
#craft-panel .craft-row { display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; padding: 8px; border: 1px solid rgba(255,255,255,.12); border-radius: 3px; }
#craft-panel .craft-item { display: flex; align-items: center; gap: 8px; color: #ddd; font-size: 14px; }
#craft-panel .craft-item canvas { width: 30px; height: 30px; image-rendering: pixelated; }
#craft-panel button { font: inherit; font-size: 13px; font-weight: bold; padding: 6px 14px; cursor: pointer;
  color: #fff; background: linear-gradient(#8a8a8a,#6d6d6d); border: 2px solid #000; border-radius: 2px;
  text-shadow: 1px 1px 0 #333; }
#craft-panel button:hover { filter: brightness(1.15); }
#craft-panel button.disabled { opacity: .4; cursor: not-allowed; filter: none; }
#craft-panel .craft-close { position: absolute; top: 4px; right: 8px; cursor: pointer; color: #ccc; font-size: 18px; }
#craft-panel .craft-close:hover { color: #fff; }
#craft-panel .craft-hint { color: #888; font-size: 11px; margin-top: 6px; text-align: center; }

/* —— "牛来"事件 UI —— */
#cow-banner { position: absolute; left: 50%; top: 16%; transform: translate(-50%, -50%) rotate(-4deg);
  font-size: 92px; font-weight: 900; letter-spacing: 8px; color: #ffd21e;
  text-shadow: 4px 4px 0 #7a1010, -3px -3px 0 #7a1010, 3px -3px 0 #7a1010, -3px 3px 0 #7a1010, 0 8px 0 rgba(0,0,0,.45);
  animation: cow-shake .38s ease-in-out infinite; white-space: nowrap; }
#cow-banner small { display: block; font-size: 26px; letter-spacing: 24px; text-align: center; color: #ffef9e; margin-top: 6px; }
@keyframes cow-shake {
  0%, 100% { transform: translate(-50%, -50%) rotate(-5deg) scale(1); }
  25% { transform: translate(-51%, -51%) rotate(3deg) scale(1.06); }
  50% { transform: translate(-49%, -50%) rotate(-2deg) scale(0.97); }
  75% { transform: translate(-50%, -49%) rotate(5deg) scale(1.04); }
}
#cow-vignette { position: absolute; inset: 0; pointer-events: none;
  box-shadow: inset 0 0 140px 50px rgba(160, 20, 10, .85); opacity: 0; }
#cow-flash { position: absolute; inset: 0; background-color: #fff; background-size: cover;
  background-position: center; image-rendering: pixelated; opacity: 0; pointer-events: none; }
#cow-flash.on { opacity: 1; transition: none; }
#cow-flash.fade { opacity: 0; transition: opacity .45s ease-out; }

`;

export class HUD {
  constructor(root, atlasCanvas) {
    this.root = root;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root.innerHTML = `
      <div id="hud" class="hidden">
        <div id="water-overlay"></div>
        <div id="cow-vignette"></div>
        <div id="cow-flash"></div>
        <div id="cow-banner" class="hidden">牛来!!!<small>MOO COMING</small></div>
        <div id="pelt-counter" class="hidden"><canvas width="16" height="16"></canvas><span>× 0</span></div>
        <div id="firework-counter" class="hidden"><canvas width="16" height="16"></canvas><span>× 0</span></div>
        <div id="dung-counter" class="hidden"><canvas width="16" height="16"></canvas><span>× 0</span></div>
        <div id="torch-counter" class="hidden"><canvas width="16" height="16"></canvas><span>× 0</span></div>
        <div id="crosshair"></div>
        <div id="hotbar"></div>
        <div id="hb-name"></div>
        <div id="debug" class="hidden"></div>
        <div id="tip"></div>
        <div id="version-hud">MineCraft 牛来网页版 v1.1 — Three.js</div>
      </div>
      <div id="pause" class="hidden">
        <h2>游戏暂停</h2>
        <button class="mc-btn" id="btn-resume">回到游戏</button>
        <button class="mc-btn" id="btn-quit">保存并回到标题</button>
        <div id="pause-help">
          <b>WASD</b> 移动 · <b>空格</b> 跳跃/上浮 · <b>Shift</b> 潜行/下降 · <b>Ctrl 或双击 W</b> 疾跑<br>
          <b>左键</b> 挖掘 · <b>右键</b> 放置 · <b>1~9 / 滚轮</b> 切换方块 · <b>F</b> 飞行 · <b>G</b> 牛来!!! · <b>Y</b> 牛雨 · <b>F3</b> 调试信息
        </div>
      </div>
      <div id="menu">
        <div id="menu-title">MINECRAFT</div>
        <div id="menu-sub">牛 来 网 页 版</div>
        <div id="splash">100% 原汁原味!</div>
        <button class="mc-btn" id="btn-continue" style="display:none">继续游戏</button>
        <div id="seed-row">世界种子:<input id="seed-input" maxlength="24" placeholder="随机" /></div>
        <button class="mc-btn" id="btn-start">创建新的世界</button>
        <div id="menu-help">
          <b>WASD</b> 移动 · <b>空格</b> 跳跃 · <b>Shift</b> 潜行 · <b>F</b> 飞行 · <b>G</b> 牛来!!!<br>
          <b>左键</b> 挖掘 · <b>右键</b> 放置 · <b>滚轮</b> 选方块 · <b>F3</b> 调试 · <b>ESC</b> 暂停
        </div>
        <div id="menu-version">MineCraft 牛来网页版 v1.1 · Three.js + Vite · 无限世界 · 自动存档</div>
      </div>
      <div id="craft-panel">
        <div class="craft-close">×</div>
        <h3>🐮 牛来合成台</h3>
        <div class="craft-row">
          <div class="craft-item"><canvas width="16" height="16"></canvas><span class="nm">牛粪</span><span class="ct">× 0</span></div>
          <button class="craft-btn" data-craft="torch">2 牛粪 → 火把</button>
        </div>
        <div class="craft-row">
          <div class="craft-item"><canvas width="16" height="16"></canvas><span class="nm">花豹皮</span><span class="ct">× 0</span></div>
          <button class="craft-btn" data-craft="firework">2 豹皮 → 烟花</button>
        </div>
        <div class="craft-row">
          <div class="craft-item"><canvas width="16" height="16"></canvas><span class="nm">火把</span><span class="ct">× 0</span></div>
          <button class="craft-btn" data-craft="launch">火把+烟花 → 点燃</button>
        </div>
        <div class="craft-hint">按 C 关闭 · 挖草得牛粪 · 打花豹得豹皮</div>
      </div>
    `;

    this.$ = (id) => root.querySelector('#' + id);
    this.menu = this.$('menu');
    this.pause = this.$('pause');
    this.hud = this.$('hud');
    this.debug = this.$('debug');
    this.tip = this.$('tip');
    this.hbName = this.$('hb-name');
    this.waterOverlay = this.$('water-overlay');
    this.cowBanner = this.$('cow-banner');
    this.cowVignette = this.$('cow-vignette');
    this.cowFlash = this.$('cow-flash');

    this._tipTimer = null;
    this._nameTimer = null;
    this.debugVisible = false;
    this._lastHbIndex = -1;

    this.buildHotbarIcons(atlasCanvas);
    this.buildMenuBackground(atlasCanvas);
  }

  // 用泥土 tile 平铺做菜单背景(MC 味)
  buildMenuBackground(atlas) {
    const dirt = extractTileCanvas(atlas, TILE.DIRT);
    const dark = document.createElement('canvas');
    dark.width = dirt.width; dark.height = dirt.height;
    const ctx = dark.getContext('2d');
    ctx.drawImage(dirt, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, dark.width, dark.height);
    const url = `url(${dark.toDataURL()})`;
    this.menu.style.backgroundImage = url;
    this.menu.style.backgroundSize = '64px 64px';
    this.pause.style.backgroundImage = url;
    this.pause.style.backgroundSize = '64px 64px';
    this.pause.style.backgroundBlendMode = 'multiply';
    this.pause.style.backgroundColor = 'rgba(0,0,0,.45)';
  }

  // 等距 3D 方块图标
  drawBlockIcon(canvas, blockId) {
    const def = BLOCKS[blockId];
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const S = 16;
    const s = canvas.width * 0.29;      // 菱形半宽
    const h = canvas.width * 0.30;      // 垂直棱高
    const cx = canvas.width / 2, ty = canvas.height * 0.12;
    const topTile = extractTileCanvas(this.atlasCanvas, def.tiles[2]);
    const rightTile = extractTileCanvas(this.atlasCanvas, def.tiles[0]);
    const leftTile = extractTileCanvas(this.atlasCanvas, def.tiles[4]);

    // 顶面
    ctx.setTransform(s / S, s / (2 * S), -s / S, s / (2 * S), cx, ty);
    ctx.filter = 'brightness(1)';
    ctx.drawImage(topTile, 0, 0);
    // 右面(+x):原点在底点,沿 B→R,再向下 h
    ctx.setTransform(s / S, -s / (2 * S), 0, h / S, cx, ty + s);
    ctx.filter = 'brightness(0.78)';
    ctx.drawImage(rightTile, 0, 0);
    // 左面(-z 视角左)
    ctx.setTransform(s / S, s / (2 * S), 0, h / S, cx - s, ty + s / 2);
    ctx.filter = 'brightness(0.58)';
    ctx.drawImage(leftTile, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
  }

  buildHotbarIcons(atlasCanvas) {
    this.atlasCanvas = atlasCanvas;
    this.hotbarEl = this.$('hotbar');
  }

  setHotbar(blocks, selected) {
    if (this.hotbarEl.childElementCount !== blocks.length) {
      this.hotbarEl.innerHTML = '';
      for (let i = 0; i < blocks.length; i++) {
        const slot = document.createElement('div');
        slot.className = 'hb-slot';
        const c = document.createElement('canvas');
        c.width = 48; c.height = 48;
        this.drawBlockIcon(c, blocks[i]);
        slot.appendChild(c);
        this.hotbarEl.appendChild(slot);
      }
    }
    [...this.hotbarEl.children].forEach((el, i) => el.classList.toggle('sel', i === selected));
    if (selected !== this._lastHbIndex) {
      this._lastHbIndex = selected;
      this.showBlockName(BLOCKS[blocks[selected]].name);
    }
  }

  showBlockName(name) {
    this.hbName.textContent = name;
    this.hbName.style.opacity = '1';
    clearTimeout(this._nameTimer);
    this._nameTimer = setTimeout(() => { this.hbName.style.opacity = '0'; }, 1400);
  }

  showTip(text) {
    this.tip.textContent = text;
    this.tip.style.opacity = '1';
    clearTimeout(this._tipTimer);
    this._tipTimer = setTimeout(() => { this.tip.style.opacity = '0'; }, 1600);
  }

  setDebugVisible(v) { this.debugVisible = v; this.debug.classList.toggle('hidden', !v); }

  updateDebug(lines) { if (this.debugVisible) this.debug.textContent = lines; }

  setWaterOverlay(v) { this.waterOverlay.style.opacity = v ? '1' : '0'; }

  // 豹皮计数器(拾取到第一张才显示)
  updatePelts(n) {
    const el = this.$('pelt-counter');
    if (n <= 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('span').textContent = `× ${n}`;
  }

  initPeltIcon(atlasCanvas, peltCanvas) {
    const c = this.$('pelt-counter').querySelector('canvas');
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(peltCanvas, 0, 0, 16, 16);
  }

  updateFireworks(n) {
    const el = this.$('firework-counter');
    if (n <= 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('span').textContent = `× ${n}`;
  }

  // 通用计数器图标(把 canvas 贴到某个 counter 上)
  setCounterIcon(counterId, canvas) {
    const el = this.$(counterId);
    if (!el) return;
    const c = el.querySelector('canvas');
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(canvas, 0, 0, 16, 16);
  }

  initFireworkIcon(fireworkCanvas) { this.setCounterIcon('firework-counter', fireworkCanvas); }

  updateDung(n) {
    const el = this.$('dung-counter');
    if (n <= 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('span').textContent = `× ${n}`;
  }

  updateTorch(n) {
    const el = this.$('torch-counter');
    if (n <= 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('span').textContent = `× ${n}`;
  }

  // ---- 合成面板(net = {dung, pelt, torch, firework}) ----
  toggleCraft() {
    const el = this.$('craft-panel');
    el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
    if (el.style.display === 'block') this.refreshCraft();
  }
  hideCraft() { this.$('craft-panel').style.display = 'none'; }

  refreshCraft(net) {
    const el = this.$('craft-panel');
    const rows = el.querySelectorAll('.craft-row');
    const setCt = (rowIdx, val) => {
      const ct = rows[rowIdx].querySelector('.ct');
      if (ct) ct.textContent = `× ${val}`;
    };
    if (net) {
      setCt(0, net.dung); setCt(1, net.pelt); setCt(2, net.torch);
      // 按钮可用性
      rows[0].querySelector('button').classList.toggle('disabled', net.dung < 2);
      rows[1].querySelector('button').classList.toggle('disabled', net.pelt < 2);
      rows[2].querySelector('button').classList.toggle('disabled', net.torch < 1 || net.firework < 1);
    }
  }

  bindCraft({ onTorch, onFirework, onLaunch, onClose }) {
    const el = this.$('craft-panel');
    el.querySelector('.craft-close').onclick = onClose;
    el.querySelector('[data-craft="torch"]').onclick = onTorch;
    el.querySelector('[data-craft="firework"]').onclick = onFirework;
    el.querySelector('[data-craft="launch"]').onclick = onLaunch;
  }

  // 设置合成面板每行图标(dung/pelt/torch 三个 canvas)
  initCraftIcons(dungCanvas, peltCanvas, torchCanvas) {
    const el = this.$('craft-panel');
    const rows = el.querySelectorAll('.craft-row');
    const draw = (rowIdx, canvas) => {
      const c = rows[rowIdx].querySelector('canvas');
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 16, 16);
      ctx.drawImage(canvas, 0, 0, 16, 16);
    };
    draw(0, dungCanvas); draw(1, peltCanvas); draw(2, torchCanvas);
  }

  // —— "牛来"事件 UI ——
  showCowBanner(on, text = '牛来!!!') {
    const el = this.cowBanner;
    if (on) {
      // 只替换文字节点(保留 <small> 子元素)
      el.childNodes[0].nodeValue = text;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  setCowVignette(v) { this.cowVignette.style.opacity = String(Math.min(1, Math.max(0, v))); }

  // 终场怼脸:全屏牛头快闪
  flashCow() {
    const el = this.cowFlash;
    el.className = '';
    // 强制 reflow 保证动画重放
    void el.offsetWidth;
    el.style.backgroundImage = `url(${this._cowFaceUrl ?? (this._cowFaceUrl = this.makeCowFaceUrl())})`;
    el.classList.add('on');
    setTimeout(() => el.classList.add('fade'), 60);
    setTimeout(() => { el.className = ''; }, 700);
  }

  makeCowFaceUrl() {
    // 从 cow.js 的贴图 canvas 导出;若不可用则用纯色兜底
    if (this._cowCanvas) return this._cowCanvas.toDataURL();
    return '';
  }
  giveCowFace(canvas) { this._cowCanvas = canvas; }

  showMenu(hasSave) {
    this.menu.classList.remove('hidden');
    this.pause.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.$('btn-continue').style.display = hasSave ? 'block' : 'none';
  }
  hideMenu() { this.menu.classList.add('hidden'); this.hud.classList.remove('hidden'); }
  showPause() { this.pause.classList.remove('hidden'); }
  hidePause() { this.pause.classList.add('hidden'); }

  bind({ onContinue, onStart, onResume, onQuit }) {
    this.$('btn-continue').onclick = onContinue;
    this.$('btn-start').onclick = () => onStart(this.$('seed-input').value.trim());
    this.$('btn-resume').onclick = onResume;
    this.$('btn-quit').onclick = onQuit;
  }

  // 菜单随机 splash 文案
  randomSplash() {
    const list = ['100% 原汁原味!', '也能挖一整天!', '苦力怕在哪?', '无限世界!', '纯程序生成!', '别在基岩下挖!'];
    this.$('splash').textContent = list[Math.floor(Math.random() * list.length)];
  }
}
