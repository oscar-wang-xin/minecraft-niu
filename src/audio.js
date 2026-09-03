// ============================================================
// audio.js — WebAudio 程序化音效(挖掘/放置/脚步),无音频文件
// ============================================================

import { BLOCK } from './blocks.js';

// 方块 → 材质类别(决定音色)
function matOf(id) {
  if (id === BLOCK.STONE || id === BLOCK.COBBLE || id === BLOCK.BEDROCK) return 'stone';
  if (id === BLOCK.LOG || id === BLOCK.PLANKS) return 'wood';
  if (id === BLOCK.SAND) return 'sand';
  if (id === BLOCK.LEAVES) return 'leaves';
  if (id === BLOCK.GLASS) return 'glass';
  return 'dirt';
}

export class Sfx {
  constructor() { this.ctx = null; this.master = null; this.enabled = true; }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // 白噪声 burst + 带通滤波
  burst(dur, freq, q, gain, rate = 1) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur);
  }

  tone(freq, dur, gain, type = 'square') {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur);
  }

  dig(id) {
    const m = matOf(id);
    const dt = 0.9 + Math.random() * 0.25;
    if (m === 'stone') this.burst(0.16, 720, 1.6, 0.9, dt);
    else if (m === 'wood') { this.burst(0.12, 480, 2.2, 0.8, dt); this.tone(190, 0.08, 0.12, 'triangle'); }
    else if (m === 'sand') this.burst(0.2, 1500, 0.7, 0.55, dt);
    else if (m === 'leaves') this.burst(0.14, 2600, 0.8, 0.4, dt);
    else if (m === 'glass') { this.burst(0.18, 3400, 3, 0.6, dt); this.tone(2200, 0.1, 0.1, 'sine'); }
    else this.burst(0.16, 380, 1.1, 0.85, dt);
  }

  place(id) {
    const m = matOf(id);
    this.burst(0.09, m === 'stone' ? 640 : 420, 1.8, 0.7);
    this.tone(m === 'stone' ? 240 : 170, 0.06, 0.1, 'triangle');
  }

  step(id) {
    const m = matOf(id);
    this.burst(0.07, m === 'sand' ? 1100 : m === 'stone' ? 520 : 300, 1.0, 0.16, 0.9 + Math.random() * 0.3);
  }

  splash() { this.burst(0.3, 900, 0.5, 0.5, 0.7); }

  // —— 牛被打到时喊"妈妈":优先浏览器中文 TTS(真人声),无则降级为卡通合成音 ——

  mama(pitch = 1, noCancel = false) {
    if (!this.enabled) return;
    try {
      if (window.speechSynthesis) {
        if (!noCancel) window.speechSynthesis.cancel(); // 单声:喊得干脆;合唱:排队
        const u = new SpeechSynthesisUtterance('妈妈');
        u.lang = 'zh-CN';
        u.pitch = Math.min(2, Math.max(0, 1.35 * pitch));
        u.rate = 0.85;
        u.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const zh = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh'));
        if (zh) u.voice = zh;
        window.speechSynthesis.speak(u);
        return;
      }
    } catch { /* TTS 异常则走合成 */ }
    this._mamaSynth(pitch);
  }

  // 卡通人声合成:两个 "ma" 音节,第二声哭腔上扬(锯齿波 + 双共振峰)
  _mamaSynth(pitch) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const p = pitch;
    const syllable = (start, f0, f1, dur, gain) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, start);
      o.frequency.linearRampToValueAtTime(f1, start + dur);
      const f1r = this.ctx.createBiquadFilter();
      f1r.type = 'bandpass'; f1r.frequency.value = 760 * p; f1r.Q.value = 7;   // /a/ 第一共振峰
      const f2r = this.ctx.createBiquadFilter();
      f2r.type = 'bandpass'; f2r.frequency.value = 1180 * p; f2r.Q.value = 9;  // /a/ 第二共振峰
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.04);
      g.gain.setValueAtTime(gain, start + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      o.connect(f1r); f1r.connect(f2r); f2r.connect(g); g.connect(this.master);
      o.start(start); o.stop(start + dur + 0.02);
    };
    syllable(t0, 205 * p, 235 * p, 0.2, 0.5);           // 妈(低)
    syllable(t0 + 0.24, 255 * p, 350 * p, 0.3, 0.55);   // 妈(上扬哭腔)
  }

  // 蛇的嘶嘶声:高通白噪声三连
  snakeHiss() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [[0, 0.14], [0.2, 0.26], [0.52, 0.12]].forEach(([dt, dur]) => {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 3400;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.28, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + dur);
      src.connect(hp); hp.connect(g); g.connect(this.master);
      src.start(t0 + dt); src.stop(t0 + dt + dur);
    });
  }

  // 拾取豹皮:"叮"上行双音
  pickupDing() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [[880, 0], [1318.5, 0.08]].forEach(([f, dt]) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.18);
      o.connect(g); g.connect(this.master);
      o.start(t0 + dt); o.stop(t0 + dt + 0.2);
    });
  }

  // 花豹受惊的"嗷呜"尖叫:快速上扬的锯齿波 + 颤音
  screech() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420, t0);
    o.frequency.exponentialRampToValueAtTime(1050, t0 + 0.32);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 11;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 45;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 2.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
    o.connect(filt); filt.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.45);
    lfo.start(t0); lfo.stop(t0 + 0.45);
  }

  // —— "牛来"专属:哞叫 + 魔性循环 BGM ——

  // 哞:锯齿波滑音 + 颤音 + 低通,听感接近牛叫
  moo(pitch = 1) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(150 * pitch, t0);
    o.frequency.linearRampToValueAtTime(85 * pitch, t0 + 0.45);
    // 颤音
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 6.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 11 * pitch;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 520 * pitch; filt.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.45, t0 + 0.06);
    g.gain.setValueAtTime(0.45, t0 + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);
    o.connect(filt); filt.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.7);
    lfo.start(t0); lfo.stop(t0 + 0.7);
  }

  // 事件 BGM:急促小调贝斯 + 上行 lead + 踩镲,周期性哞
  startBgm() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || this._bgmTimer) return;
    const bass = [82.4, 0, 82.4, 82.4, 98, 0, 82.4, 0, 123.5, 0, 110, 98, 82.4, 0, 73.4, 98];
    const lead = [329.6, 392, 493.9, 659.3, 0, 493.9, 392, 0];
    let step = 0;
    const blip = (freq, dur, gain, type) => {
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.value = freq;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1600;
      const gn = this.ctx.createGain();
      gn.gain.setValueAtTime(gain, t0);
      gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(f); f.connect(gn); gn.connect(this.master);
      o.start(t0); o.stop(t0 + dur);
    };
    const beat = () => {
      const b = bass[step % 16];
      if (b) blip(b, 0.14, 0.16, 'square');
      const l = lead[step % 8];
      if (l && (step % 16) >= 8) blip(l, 0.1, 0.06, 'square');
      if (step % 4 === 0) this.burst(0.04, 4200, 0.8, 0.1);
      if (step > 0 && step % 32 === 0) this.moo(0.8 + Math.random() * 0.4);
      step++;
    };
    beat();
    this._bgmTimer = setInterval(beat, 138);
  }

  stopBgm() {
    if (this._bgmTimer) { clearInterval(this._bgmTimer); this._bgmTimer = null; }
  }
}
