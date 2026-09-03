# 🐮 MineCraft 牛来网页版

[English version below](#-minecraft-moo-web-edition)

一个用 **Three.js + Vite** 从零复刻的《我的世界》网页版，融合"牛来"魔性生态。所有纹理、音效均由程序生成，**无任何外部资源文件**。

 **在线试玩**: [GitHub Pages 链接]

## 🎮 核心玩法

### 牛来事件
- **按 G** 召唤牛来事件 —— 天空转暗红、屏幕红晕、魔性 BGM
- 金褐牛群从四面八方冲来将你撞飞
- 终场巨型牛头怼脸闪光
- **左键打牛** —— 牛喊"妈妈"(中文 TTS)然后被击飞旋转

### 挖石出蛇 → 花豹扑食
- **挖草方块**有 **35% 概率**钻出一条蛇（嘶嘶声、盘身探头）
- 1.5 秒后**花豹从远处贴地飞扑**，一口吞掉蛇
- 花豹停留 12 秒，偷袭它：一声"妈妈" + 吓飞 + 掉落**豹皮**
- 花豹永远面朝你，靠近 5 格内受惊起飞

### 牛雨天气
- **按 Y** 召唤（90 秒冷却），或每 90 秒 8% 概率自动天降
- 20 秒内金色牛头旋转着从天而降
- 落地冲击波把 3 格内的你轰飞
- 结束时全场牛排队齐喊"妈妈"(TTS 大合唱)

### 牛粪经济系统
- **挖草方块** 25% 概率掉落**牛粪**
- **按 C** 查看收集：牛粪、火把、烟花计数
- **按 1**: 2 牛粪 → 1 火把
- **按 2**: 1 火把 + 1 烟花 → 点燃**牛来烟花秀**（10 个牛头升空）
- 花豹皮自动同步为烟花

## 🎯 完整生态链

```
挖草方块 → 牛粪 → 火把
              ↓
挖石头 → 炸弹  花豹 → 烟花 → 牛来烟花秀
              ↓
挖草方块 → 蛇 → 花豹扑食
```

## 🚀 运行

**最简单方式**: 双击 `启动游戏.bat`（首次自动安装依赖，然后自动打开浏览器）

或手动：
```bash
npm install
npm run dev        # 开发服务器，浏览器打开 http://localhost:5173
npm run build      # 生产构建 (输出 dist/)
npm run preview    # 预览生产构建
```

> ⚠️ 不能直接双击 `index.html` —— 浏览器会拦截 ES Module，必须通过本地服务器访问。

## 📦 部署到服务器

游戏构建产物是**纯静态文件**（dist/ 目录），不需要 Node/数据库。

1. 双击 `构建发布包.bat` 得到 `dist.zip`
2. 上传到服务器（宝塔面板：文件 → 上传 → 解压）
3. 绑定域名，开启 HTTPS
4. 访问即可游玩

## 🎨 技术特点

- **程序化资产**: 所有纹理（牛头、花豹、蛇、豹皮）用 Canvas 逐像素生成
- **程序化音效**: 哞叫、嘶嘶、尖叫、BGM 全部用 WebAudio 合成
- **无限世界**: 多层噪声地形、生物群系、洞穴、树木
- **分块渲染**: 只渲染暴露面，顶点 AO，水面下沉
- **真实物理**: AABB 碰撞、游泳浮力、潜行防坠边
- **零外部依赖**: 无需图片/音频文件，开箱即用

## 📁 项目结构

```
src/
├── main.js          # 入口：渲染循环、输入、交互
├── world.js         # 世界数据、地形生成、存档
├── mesher.js        # 区块网格构建（暴露面剔除+AO）
├── player.js        # 玩家物理（碰撞/游泳/飞行）+ 射线
├── cow.js           # 牛来事件、花豹、蛇、牛雨、豹皮
├── blocks.js        # 方块定义 + 程序化纹理图集
├── audio.js         # WebAudio 音效（哞叫/合成 BGM）
├── hud.js           # UI：菜单/HUD/快捷栏/计数器
└── storage.js       # localStorage 存档
```

## 🎯 操作说明

| 按键 | 功能 |
|---|---|
| `W A S D` | 移动 |
| `空格` | 跳跃 / 游泳上浮 / 飞行上升 |
| `Shift` | 潜行 / 飞行下降 |
| `Ctrl` 或双击 `W` | 疾跑 |
| `F` | 飞行模式 |
| `G` | **牛来!!!** |
| `Y` | **牛雨** |
| `C` | 查看牛粪/火把/烟花计数 |
| `1` | 2 牛粪 → 1 火把 |
| `2` | 1 火把 +1 烟花 → 点燃烟花 |
| `左键` | 挖掘 / 打牛 / 打蛇 / 打花豹 |
| `右键` | 放置方块 |
| `滚轮` | 切换快捷栏方块 |
| `F3` | 调试信息 |
| `ESC` | 暂停菜单 |

## 📝 更新日志

### v1.1 牛来生态
- ✅ 牛来事件（喊妈妈的牛群 + 巨牛脸）
- ✅ 花豹系统（潜伏/扑食/受惊/豹皮）
- ✅ 挖石出蛇（蛇→花豹扑食链）
- ✅ 牛雨天气（坠牛 + 冲击波 + 大合唱）
- ✅ 牛粪经济（收集/合成/烟花秀）
- ✅ 石头炸弹（15% 概率，1 秒倒计时爆炸）

### v1.0 基础复刻
- ✅ 无限世界 + 程序化地形
- ✅ 分块网格渲染
- ✅ 玩家物理 + 碰撞
- ✅ 挖掘/放置
- ✅ 存档系统

##  贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT License

---

# 🐮 MineCraft Moo Web Edition

A **Three.js + Vite** powered Minecraft web clone with magical "Moo" ecosystem. All textures and sounds are procedurally generated, **zero external assets**.

 **Live Demo**: [GitHub Pages Link]

## 🎮 Core Features

### Moo Event (Press G)
- Sky turns dark red, screen vignette, meme BGM
- Golden-brown cows charge from all directions
- Finale: giant cow face flash
- **Left-click cows** — they scream "Mama!" (Chinese TTS) and get knocked back

### Dig Stone → Snake → Leopard Hunt
- **Dig grass blocks**: 35% chance to spawn a snake (hissing, coiled)
- After 1.5s, a **leopard pounces** and eats the snake
- Leopard stays for 12s — sneak attack: "Mama!" + knockback + **leopard pelt**
- Leopards always face you, get scared when you approach within 5 blocks

### Cow Rain (Press Y)
- 90s cooldown, or 8% chance every 90s to auto-trigger
- Golden cow heads rain from sky for 20s
- Ground impact creates shockwave that launches you
- Finale: all cows queue up and scream "Mama!" (TTS chorus)

### Cow Dung Economy
- **Dig grass blocks**: 25% chance to drop cow dung
- **Press C**: view dung/torch/firework count
- **Press 1**: 2 dung → 1 torch
- **Press 2**: 1 torch + 1 firework → launch **Moo Firework Show** (10 cow heads)
- Leopard pelts auto-convert to fireworks

## 🎯 Full Ecosystem Chain

```
Grass Block → Dung → Torch
                          ↓
Stone → Bomb  Leopard → Firework → Moo Firework Show
                          ↓
Grass Block → Snake → Leopard Hunt
```

## 🚀 Quick Start

**Easiest**: Double-click `启动游戏.bat` (auto-installs deps, opens browser)

Or manually:
```bash
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build (dist/)
npm run preview    # Preview production build
```

##  Deployment

Build output is **pure static files** (dist/), no Node/database needed.

1. Double-click `构建发布包.bat` to get `dist.zip`
2. Upload to any static host (Vercel, Netlify, GitHub Pages)
3. Bind domain, enable HTTPS
4. Play!

## 🎨 Tech Highlights

- **Procedural Assets**: All textures (cow, leopard, snake, pelt) generated pixel-by-pixel with Canvas
- **Procedural Audio**: Moos, hisses, screeches, BGM all synthesized with WebAudio
- **Infinite World**: Multi-layer noise terrain, biomes, caves, trees
- **Chunked Rendering**: Only exposed faces, vertex AO, water sink
- **Real Physics**: AABB collision, swimming buoyancy, sneak edge-guard
- **Zero External Dependencies**: No images/audio files, works out of the box

##  Project Structure

```
src/
── main.js          # Entry: render loop, input, interaction
├── world.js         # World data, terrain gen, save/load
├── mesher.js        # Chunk meshing (culling + AO)
├── player.js        # Player physics (collision/swim/fly) + raycast
├── cow.js           # Moo event, leopards, snakes, cow rain, pelts
├── blocks.js        # Block definitions + procedural texture atlas
── audio.js         # WebAudio SFX (moos/synth BGM)
├── hud.js           # UI: menu/HUD/hotbar/counters
└── storage.js       # localStorage save/load
```

##  Controls

| Key | Action |
|---|---|
| `W A S D` | Move |
| `Space` | Jump / Swim up / Fly up |
| `Shift` | Sneak / Fly down |
| `Ctrl` or double-tap `W` | Sprint |
| `F` | Fly mode |
| `G` | **Moo Event!!!** |
| `Y` | **Cow Rain** |
| `C` | View dung/torch/firework count |
| `1` | 2 dung → 1 torch |
| `2` | 1 torch +1 firework → launch fireworks |
| `LMB` | Mine / Hit cow/snake/leopard |
| `RMB` | Place block |
| `Scroll` | Cycle hotbar blocks |
| `F3` | Debug info |
| `ESC` | Pause menu |

## 📝 Changelog

### v1.1 Moo Ecosystem
- ✅ Moo Event (screaming cows + giant face flash)
- ✅ Leopard system (stalk/hunt/scare/pelt)
- ✅ Dig-for-snake (snake→leopard hunt chain)
- ✅ Cow Rain (falling cows + shockwave + chorus)
- ✅ Dung economy (gather/craft/firework show)
- ✅ Stone bombs (15% chance, 1s fuse)

### v1.0 Base Clone
- ✅ Infinite world + procedural terrain
- ✅ Chunked mesh rendering
- ✅ Player physics + collision
- ✅ Mine/place blocks
- ✅ Save system

## 🤝 Contributing

Issues and PRs welcome!

## 📄 License

MIT License
