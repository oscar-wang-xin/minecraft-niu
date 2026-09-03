// ============================================================
// items.js — 物品 HUD 图标(16x16 像素画,用于计数器与合成面板)
// 全部程序生成,零外部资源
// ============================================================

// 通用 16x16 像素画布
function newCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  return c;
}
function pxPaint(canvas, painter) {
  const ctx = canvas.getContext('2d');
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  painter(px);
  return canvas;
}

// 牛粪图标(棕色圆团 + 尖顶)
export function makeDungIcon() {
  return pxPaint(newCanvas(), (px) => {
    const B = '#6b4a25', D = '#4a3013', H = '#8a6236', T = '#3d270e';
    // 底部宽圆
    [[2,5],[3,5],[4,5],[5,5],[3,6],[4,6],[2,6],[5,6]].forEach(([x,y]) => px(x,y,B));
    // 中部叠层
    [[3,4],[4,4],[3,5],[4,5],[3,7],[4,7]].forEach(([x,y]) => px(x,y,B));
    // 尖顶
    px(3,2,T); px(4,2,T); px(3,3,T); px(4,3,T); px(4,1,T);
    // 高光
    px(2,5,H); px(3,4,H); px(3,5,H);
    // 暗部
    px(5,5,D); px(4,6,D); px(2,6,D);
  });
}

// 火把图标(木柄 + 橙色火焰 + 黄色内核)
export function makeTorchIcon() {
  return pxPaint(newCanvas(), (px) => {
    const WOOD = '#8a5a2b', WOOD_D = '#5e3a16', FIRE = '#ff7b00', FIRE_L = '#ffd23e', CORE = '#fff2b0';
    // 木柄
    [[7,7],[7,8],[7,9],[7,10],[7,11],[7,12],[7,13],[7,14],[8,9]].forEach(([x,y]) => px(x,y,WOOD));
    px(7,13,WOOD_D); px(7,11,WOOD_D);
    // 火焰外焰
    [[7,2],[7,3],[6,4],[8,4],[6,5],[8,5],[6,6],[8,6],[7,1],[6,3],[8,3]].forEach(([x,y]) => px(x,y,FIRE));
    // 内焰(黄)
    [[7,3],[7,4],[7,5]].forEach(([x,y]) => px(x,y,FIRE_L));
    // 内核(亮白)
    px(7,4,CORE); px(7,5,CORE);
  });
}

// 烟花图标(红筒 + 引线 + 星芒)
export function makeFireworkIcon() {
  return pxPaint(newCanvas(), (px) => {
    const BODY = '#c62828', BODY_D = '#8e1b1b', CAP = '#5a3d1a', SPARK = '#ffd23e', LINE = '#c9a95e';
    // 筒身
    for (let y = 8; y <= 14; y++) { px(6,y,BODY); px(7,y,BODY); }
    // 暗部
    px(7,9,BODY_D); px(7,11,BODY_D); px(7,13,BODY_D);
    // 顶盖
    px(6,8,CAP); px(7,8,CAP);
    // 引线(弧线从顶伸出)
    px(7,7,LINE); px(6,6,LINE); px(5,5,LINE); px(4,4,LINE);
    // 火花星芒
    [[4,3],[3,4],[4,4],[5,4],[4,5]].forEach(([x,y]) => px(x,y,SPARK));
  });
}
