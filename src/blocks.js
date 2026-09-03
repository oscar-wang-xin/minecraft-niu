// ============================================================
// blocks.js — 方块定义 + 程序化像素纹理图集
// 所有纹理用 Canvas 逐像素生成,16x16/格,无外部资源
// ============================================================

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  WATER: 6,
  LOG: 7,
  LEAVES: 8,
  PLANKS: 9,
  GLASS: 10,
  BEDROCK: 11,
  SNOW: 12,
  DUNG: 13,  // 牛粪
};

// tile 在图集(8 列)中的索引
export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3,
  COBBLE: 4, SAND: 5, LOG_SIDE: 6, LOG_TOP: 7,
  LEAVES: 8, PLANKS: 9, GLASS: 10, WATER: 11,
  BEDROCK: 12, SNOW_TOP: 13, SNOW_SIDE: 14,
};

//tiles: [+x 东, -x 西, +y 顶, -y 底, +z 南, -z 北]
//solid: 参与 AABB 碰撞; transparent: 邻居面剔除规则用透明逻辑
export const BLOCKS = {
  [BLOCK.AIR]:     { name: '空气',   solid: false, transparent: true,  tiles: null },
  [BLOCK.GRASS]:   { name: '草方块', solid: true,  transparent: false, tiles: [TILE.GRASS_SIDE, TILE.GRASS_SIDE, TILE.GRASS_TOP, TILE.DIRT, TILE.GRASS_SIDE, TILE.GRASS_SIDE] },
  [BLOCK.DIRT]:    { name: '泥土',   solid: true,  transparent: false, tiles: six(TILE.DIRT) },
  [BLOCK.STONE]:   { name: '石头',   solid: true,  transparent: false, tiles: six(TILE.STONE) },
  [BLOCK.COBBLE]:  { name: '圆石',   solid: true,  transparent: false, tiles: six(TILE.COBBLE) },
  [BLOCK.SAND]:    { name: '沙子',   solid: true,  transparent: false, tiles: six(TILE.SAND) },
  [BLOCK.WATER]:   { name: '水',     solid: false, transparent: true,  tiles: six(TILE.WATER) },
  [BLOCK.LOG]:     { name: '橡木原木', solid: true, transparent: false, tiles: [TILE.LOG_SIDE, TILE.LOG_SIDE, TILE.LOG_TOP, TILE.LOG_TOP, TILE.LOG_SIDE, TILE.LOG_SIDE] },
  [BLOCK.LEAVES]:  { name: '橡树树叶', solid: true, transparent: true,  tiles: six(TILE.LEAVES) },
  [BLOCK.PLANKS]:  { name: '橡木木板', solid: true, transparent: false, tiles: six(TILE.PLANKS) },
  [BLOCK.GLASS]:   { name: '玻璃',   solid: true,  transparent: true,  tiles: six(TILE.GLASS) },
  [BLOCK.BEDROCK]: { name: '基岩',   solid: true,  transparent: false, tiles: six(TILE.BEDROCK) },
  [BLOCK.SNOW]:    { name: '雪块',   solid: true,  transparent: false, tiles: [TILE.SNOW_SIDE, TILE.SNOW_SIDE, TILE.SNOW_TOP, TILE.DIRT, TILE.SNOW_SIDE, TILE.SNOW_SIDE] },
  [BLOCK.DUNG]:  { name: '牛粪',   solid: true,  transparent: false, tiles: six(TILE.DIRT) },
};

function six(t) { return [t, t, t, t, t, t]; }

// 快捷栏可放置的方块
export const HOTBAR_BLOCKS = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLE, BLOCK.PLANKS,
  BLOCK.LOG, BLOCK.LEAVES, BLOCK.SAND, BLOCK.GLASS,
];

// ============================================================
// 纹理图集
// ============================================================

export const TILE_PX = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 2; // 15 个 tile,2 行足够

// 种子 PRNG(mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

// 在 ctx 上画一个 16x16 tile:base [r,g,b],shades 为按行扫描的像素修改器
function paintTile(ctx, tileIndex, painter) {
  const tx = (tileIndex % ATLAS_COLS) * TILE_PX;
  const ty = Math.floor(tileIndex / ATLAS_COLS) * TILE_PX;
  const img = ctx.createImageData(TILE_PX, TILE_PX);
  const d = img.data;
  const px = (x, y, r, g, b, a = 255) => {
    const i = (y * TILE_PX + x) * 4;
    d[i] = clamp255(r); d[i + 1] = clamp255(g); d[i + 2] = clamp255(b); d[i + 3] = a;
  };
  painter(px, mulberry32(0x9E3779B9 ^ (tileIndex * 7919 + 13)));
  ctx.putImageData(img, tx, ty);
}

// 基础噪点填充:base 颜色 + 每像素随机明暗幅度 amp(0~1)
function noisyFill(px, rand, base, amp, alpha = 255) {
  for (let y = 0; y < TILE_PX; y++)
    for (let x = 0; x < TILE_PX; x++) {
      const f = 1 + (rand() * 2 - 1) * amp;
      px(x, y, base[0] * f, base[1] * f, base[2] * f, alpha);
    }
}

export function buildAtlas() {
  const atlas = document.createElement('canvas');
  atlas.width = ATLAS_COLS * TILE_PX;
  atlas.height = ATLAS_ROWS * TILE_PX;
  const ctx = atlas.getContext('2d');

  // —— 草顶 #7CBD51 ——
  paintTile(ctx, TILE.GRASS_TOP, (px, rand) => {
    noisyFill(px, rand, [124, 189, 81], 0.10);
    for (let i = 0; i < 26; i++) {
      const x = (rand() * 16) | 0, y = (rand() * 16) | 0;
      const f = 0.82 + rand() * 0.12;
      px(x, y, 124 * f, 189 * f, 81 * f);
    }
  });

  // —— 泥土 #8A6244 ——
  const dirtPainter = (px, rand) => {
    noisyFill(px, rand, [138, 98, 68], 0.09);
    for (let i = 0; i < 20; i++) {
      const x = (rand() * 15) | 0, y = (rand() * 16) | 0;
      const f = 0.74 + rand() * 0.1;
      px(x, y, 138 * f, 98 * f, 68 * f);
      px(x + 1, y, 138 * f, 98 * f, 68 * f);
    }
  };
  paintTile(ctx, TILE.DIRT, dirtPainter);

  // —— 草侧:泥土 + 顶部草皮 ——
  paintTile(ctx, TILE.GRASS_SIDE, (px, rand) => {
    dirtPainter(px, rand);
    for (let x = 0; x < 16; x++) {
      const depth = 3 + ((rand() * 3) | 0); // 草皮垂入深度 3~5px
      for (let y = 0; y < depth; y++) {
        const f = 1 + (rand() * 2 - 1) * 0.10;
        const isEdge = y === depth - 1;
        const f2 = isEdge ? f * 0.88 : f;
        px(x, y, 110 * f2, 178 * f2, 68 * f2);
      }
    }
  });

  // —— 石头 #8C8C8C ——
  paintTile(ctx, TILE.STONE, (px, rand) => {
    noisyFill(px, rand, [140, 140, 140], 0.07);
    // 裂纹:几条随机深色短横线
    for (let i = 0; i < 5; i++) {
      let x = (rand() * 12) | 0, y = (rand() * 16) | 0;
      const len = 3 + (rand() * 4) | 0;
      for (let j = 0; j < len; j++) {
        px(x + j, y, 104, 104, 104);
        if (rand() < 0.3) y += rand() < 0.5 ? 1 : -1;
        if (y < 0 || y > 15) break;
      }
    }
  });

  // —— 圆石:石底 + 圆斑石块 ——
  paintTile(ctx, TILE.COBBLE, (px, rand) => {
    noisyFill(px, rand, [122, 122, 122], 0.08);
    const stones = [
      [3, 3, 2.6], [11, 2, 2.2], [7, 8, 2.8], [13, 9, 2.0],
      [2, 11, 2.2], [9, 13, 2.4], [14, 14, 1.6], [0, 7, 1.4],
    ];
    for (const [cx, cy, r] of stones) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const dx = x - cx, dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < r) {
            const edge = dist > r - 1.2;
            const f = edge ? 0.62 : 1 + (rand() * 2 - 1) * 0.07;
            px(x, y, 140 * f, 140 * f, 140 * f);
          }
        }
    }
  });

  // —— 沙子 #DCD3A0 ——
  paintTile(ctx, TILE.SAND, (px, rand) => {
    noisyFill(px, rand, [220, 211, 160], 0.06);
    for (let i = 0; i < 14; i++) {
      const x = (rand() * 16) | 0, y = (rand() * 16) | 0;
      px(x, y, 196, 186, 133);
    }
  });

  // —— 原木侧:竖条纹树皮 ——
  paintTile(ctx, TILE.LOG_SIDE, (px, rand) => {
    const cols = [];
    for (let x = 0; x < 16; x++) cols.push(0.82 + rand() * 0.36);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        let f = cols[x] * (1 + (rand() * 2 - 1) * 0.06);
        if (rand() < 0.05) f *= 0.7; // 断口
        px(x, y, 107 * f, 84 * f, 50 * f);
      }
  });

  // —— 原木顶:年轮 ——
  paintTile(ctx, TILE.LOG_TOP, (px, rand) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
        const ring = Math.max(dx, dy) | 0; // 方形同心环
        let r, g, b;
        if (ring >= 7) { r = 107; g = 84; b = 50; }            // 树皮
        else if (ring % 2 === 0) { r = 176; g = 143; b = 92; } // 亮环
        else { r = 151; g = 121; b = 73; }                     // 暗环
        const f = 1 + (rand() * 2 - 1) * 0.05;
        px(x, y, r * f, g * f, b * f);
      }
  });

  // —— 树叶(带透明孔) ——
  paintTile(ctx, TILE.LEAVES, (px, rand) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const r = rand();
        if (r < 0.14) { px(x, y, 0, 0, 0, 0); continue; } // 孔
        let base;
        if (r < 0.24) base = [85, 153, 59];        // 亮点
        else if (r < 0.4) base = [44, 94, 27];     // 暗点
        else base = [62, 122, 40];
        const f = 1 + (rand() * 2 - 1) * 0.08;
        px(x, y, base[0] * f, base[1] * f, base[2] * f);
      }
  });

  // —— 木板 ——
  paintTile(ctx, TILE.PLANKS, (px, rand) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const plankRow = (y / 4) | 0;
        let base = [184, 148, 95];
        if (y % 4 === 3) base = [122, 92, 52];           // 板缝
        else if ((x + plankRow * 5) % 16 === 8) base = [150, 118, 71]; // 竖拼接
        const f = 1 + (rand() * 2 - 1) * 0.05 + ((plankRow % 2) ? 0.03 : -0.02);
        px(x, y, base[0] * f, base[1] * f, base[2] * f);
      }
  });

  // —— 玻璃:边框 + 高光,内部透明 ——
  paintTile(ctx, TILE.GLASS, (px, rand) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) px(x, y, 0, 0, 0, 0);
    for (let i = 0; i < 16; i++) {
      px(i, 0, 222, 239, 240); px(i, 15, 222, 239, 240);
      px(0, i, 222, 239, 240); px(15, i, 222, 239, 240);
    }
    // 斜高光
    for (let i = 0; i < 6; i++) px(3 + i, 12 - i, 255, 255, 255);
    for (let i = 0; i < 3; i++) px(9 + i, 13 - i, 198, 222, 224);
  });

  // —— 水(不透明度交给材质) ——
  paintTile(ctx, TILE.WATER, (px, rand) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        let base = [49, 92, 199];
        if ((y * 2 + ((x / 4) | 0)) % 8 === 0 && rand() < 0.8) base = [64, 112, 216]; // 波纹亮线
        const f = 1 + (rand() * 2 - 1) * 0.06;
        px(x, y, base[0] * f, base[1] * f, base[2] * f);
      }
  });

  // —— 基岩:块状黑白斑 ——
  paintTile(ctx, TILE.BEDROCK, (px, rand) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const bx = x >> 1, by = y >> 1;
        const h = Math.abs(Math.sin(bx * 127.1 + by * 311.7) * 43758.5) % 1;
        const v = h < 0.4 ? 46 : h < 0.75 ? 84 : 118;
        const f = 1 + (rand() * 2 - 1) * 0.08;
        px(x, y, v * f, v * f, v * f);
      }
  });

  // —— 雪顶 ——
  paintTile(ctx, TILE.SNOW_TOP, (px, rand) => {
    noisyFill(px, rand, [240, 246, 246], 0.04);
    for (let i = 0; i < 8; i++) {
      const x = (rand() * 16) | 0, y = (rand() * 16) | 0;
      px(x, y, 219, 229, 231);
    }
  });

  // —— 雪侧:泥土 + 顶雪 ——
  paintTile(ctx, TILE.SNOW_SIDE, (px, rand) => {
    dirtPainter(px, rand);
    for (let x = 0; x < 16; x++) {
      const depth = 4 + ((rand() * 2) | 0);
      for (let y = 0; y < depth; y++) {
        const f = 1 + (rand() * 2 - 1) * 0.05;
        px(x, y, 238 * f, 245 * f, 245 * f);
      }
    }
  });

  return atlas;
}

// 生成单个 tile 的独立 canvas(HUD 图标用)
export function extractTileCanvas(atlasCanvas, tileIndex) {
  const c = document.createElement('canvas');
  c.width = TILE_PX; c.height = TILE_PX;
  const ctx = c.getContext('2d');
  const tx = (tileIndex % ATLAS_COLS) * TILE_PX;
  const ty = Math.floor(tileIndex / ATLAS_COLS) * TILE_PX;
  ctx.drawImage(atlasCanvas, tx, ty, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
  return c;
}
