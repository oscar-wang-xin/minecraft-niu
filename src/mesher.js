// ============================================================
// mesher.js — 区块网格构建
// 只生成暴露面;顶点 AO;水面下沉;树叶/玻璃走 alphaTest 材质
// ============================================================

import { BLOCK, BLOCKS, TILE_PX, ATLAS_COLS, ATLAS_ROWS } from './blocks.js';
import { CHUNK_SIZE, WORLD_HEIGHT } from './world.js';

// 面:法线、四顶点(从外看 CCW)、基础亮度
// 与 BLOCKS.tiles 顺序一致:[+x, -x, +y, -y, +z, -z]
const FACES = [
  { dir: [1, 0, 0],  shade: 0.65, corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { dir: [-1, 0, 0], shade: 0.65, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { dir: [0, 1, 0],  shade: 1.00, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.52, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [0, 0, 1],  shade: 0.80, corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { dir: [0, 0, -1], shade: 0.80, corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const AO_LEVELS = [0.42, 0.62, 0.82, 1.0];

function occludes(world, x, y, z) {
  const def = BLOCKS[world.getBlock(x, y, z)];
  return def ? def.solid && !def.transparent : false;
}

function tileUV(tile) {
  const c = tile % ATLAS_COLS, r = Math.floor(tile / ATLAS_COLS);
  const eu = 0.1 / (ATLAS_COLS * TILE_PX), ev = 0.1 / (ATLAS_ROWS * TILE_PX);
  return {
    u0: c / ATLAS_COLS + eu, u1: (c + 1) / ATLAS_COLS - eu,
    // canvas y 向下、UV v 向上(flipY),故行 0 在图集最上方
    v0: 1 - (r + 1) / ATLAS_ROWS + ev, v1: 1 - r / ATLAS_ROWS - ev,
  };
}

function faceRendered(world, x, y, z, dir, selfId) {
  const nid = world.getBlock(x + dir[0], y + dir[1], z + dir[2]);
  if (nid === selfId) return false;   // 同类相邻不画(水-水、叶-叶、玻-玻)
  const nd = BLOCKS[nid];
  if (!nd) return true;               // 空气
  return nd.transparent;              // 邻居透明才画
}

// 构建一个区块的网格数据;返回 { opaque, water } 各含 position/uv/color/index 数组
export function buildChunkGeometry(world, cx, cz) {
  const bx = cx * CHUNK_SIZE, bz = cz * CHUNK_SIZE;
  const opaque = { positions: [], colors: [], uvs: [], indices: [] };
  const water = { positions: [], colors: [], uvs: [], indices: [] };

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = world.getBlock(bx + lx, y, bz + lz);
        if (id === BLOCK.AIR) continue;
        const def = BLOCKS[id];
        const wx = bx + lx, wz = bz + lz;
        const target = id === BLOCK.WATER ? water : opaque;
        // 水面下沉:上方不是水时顶面降低,更像真实水面
        const sink = id === BLOCK.WATER && world.getBlock(wx, y + 1, wz) !== BLOCK.WATER ? 0.12 : 0;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          if (!faceRendered(world, wx, y, wz, face.dir, id)) continue;

          const { u0, u1, v0, v1 } = tileUV(def.tiles[f]);
          const vi = target.positions.length / 3;
          const ao = [1, 1, 1, 1];

          // 每顶点 AO:检查面外侧的 side1/side2/corner 三个邻居
          if (!sink) {
            for (let ci = 0; ci < 4; ci++) {
              const c = face.corners[ci];
              const ox = c[0] === 1 ? 1 : -1;
              const oy = c[1] === 1 ? 1 : -1;
              const oz = c[2] === 1 ? 1 : -1;
              let s1, s2, cnr;
              if (face.dir[0] !== 0) {
                s1 = occludes(world, wx + face.dir[0], y + oy, wz);
                s2 = occludes(world, wx + face.dir[0], y, wz + oz);
                cnr = occludes(world, wx + face.dir[0], y + oy, wz + oz);
              } else if (face.dir[1] !== 0) {
                s1 = occludes(world, wx + ox, y + face.dir[1], wz);
                s2 = occludes(world, wx, y + face.dir[1], wz + oz);
                cnr = occludes(world, wx + ox, y + face.dir[1], wz + oz);
              } else {
                s1 = occludes(world, wx + ox, y, wz + face.dir[2]);
                s2 = occludes(world, wx, y + oy, wz + face.dir[2]);
                cnr = occludes(world, wx + ox, y + oy, wz + face.dir[2]);
              }
              ao[ci] = (s1 && s2) ? AO_LEVELS[0] : AO_LEVELS[3 - (s1 + s2 + cnr)];
            }
          }

          for (let ci = 0; ci < 4; ci++) {
            const c = face.corners[ci];
            let vy = y + c[1];
            if (sink && c[1] === 1) vy -= sink;
            target.positions.push(wx + c[0], vy, wz + c[2]);
            const l = face.shade * ao[ci];
            target.colors.push(l, l, l);
            target.uvs.push(UV[ci][0] ? u1 : u0, UV[ci][1] ? v1 : v0);
          }

          // AO 各向异性修复:按 AO 和选择对角线
          if (ao[0] + ao[2] >= ao[1] + ao[3]) {
            target.indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
          } else {
            target.indices.push(vi + 1, vi + 2, vi + 3, vi + 1, vi + 3, vi);
          }
        }
      }
    }
  }
  return { opaque, water };
}
