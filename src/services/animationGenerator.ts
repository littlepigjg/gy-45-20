import type { IconItem, AnimationConfig, AnimationResult, FrameItem } from '../types';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function naturalSortNames(a: { name: string }, b: { name: string }): number {
  const extract = (s: string) => s.split(/(\d+)/).map((t) => (/\d+/.test(t) ? parseInt(t, 10) : t));
  const aa = extract(a.name);
  const bb = extract(b.name);
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    if (aa[i] === undefined) return -1;
    if (bb[i] === undefined) return 1;
    if (typeof aa[i] === 'number' && typeof bb[i] === 'number') {
      if (aa[i] !== bb[i]) return (aa[i] as number) - (bb[i] as number);
    } else if (String(aa[i]) !== String(bb[i])) {
      return String(aa[i]).localeCompare(String(bb[i]));
    }
  }
  return 0;
}

export async function generateAnimationFromFrames(
  icons: IconItem[],
  config: AnimationConfig
): Promise<AnimationResult> {
  if (icons.length === 0) {
    return emptyResult(config);
  }

  const sortedIcons = [...icons].sort(naturalSortNames);
  const loadedImages = await Promise.all(
    sortedIcons.map((icon) => loadImage(icon.dataUrl))
  );

  const frameWidth = Math.max(...loadedImages.map((img) => img.width));
  const frameHeight = Math.max(...loadedImages.map((img) => img.height));
  const frameCount = sortedIcons.length;

  const { columns = frameCount, rows = 1, spacing = 0, padding = 0 } = config;
  const actualCols = Math.min(columns || frameCount, frameCount);
  const actualRows = Math.max(rows || 1, Math.ceil(frameCount / actualCols));

  const totalWidth = actualCols * frameWidth + (actualCols + 1) * spacing + padding * 2;
  const totalHeight = actualRows * frameHeight + (actualRows + 1) * spacing + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  const frames: FrameItem[] = [];

  sortedIcons.forEach((icon, index) => {
    const img = loadedImages[index];
    const row = Math.floor(index / actualCols);
    const col = index % actualCols;
    const x = padding + spacing + col * (frameWidth + spacing);
    const y = padding + spacing + row * (frameHeight + spacing);
    const offsetX = (frameWidth - img.width) / 2;
    const offsetY = (frameHeight - img.height) / 2;

    ctx.drawImage(img, x + offsetX, y + offsetY, img.width, img.height);

    frames.push({
      index,
      dataUrl: icon.dataUrl,
      width: img.width,
      height: img.height,
    });
  });

  const spriteDataUrl = canvas.toDataURL('image/png');

  return buildResult(spriteDataUrl, frameWidth, frameHeight, frameCount, totalWidth, totalHeight, frames, {
    ...config,
    rows: actualRows,
    columns: actualCols,
    frameWidth,
    frameHeight,
  });
}

export async function generateAnimationFromSprite(
  spriteDataUrl: string,
  config: AnimationConfig
): Promise<AnimationResult> {
  if (!spriteDataUrl) {
    return emptyResult(config);
  }

  const img = await loadImage(spriteDataUrl);
  const { rows, columns, frameWidth, frameHeight, spacing = 0, padding = 0 } = config;

  if (!rows || !columns || !frameWidth || !frameHeight) {
    return emptyResult(config);
  }

  const frameCount = rows * columns;
  const totalWidth = img.width;
  const totalHeight = img.height;

  const canvas = document.createElement('canvas');
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext('2d')!;

  const frames: FrameItem[] = [];

  for (let i = 0; i < frameCount; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const sx = padding + spacing + col * (frameWidth + spacing);
    const sy = padding + spacing + row * (frameHeight + spacing);

    ctx.clearRect(0, 0, frameWidth, frameHeight);
    ctx.drawImage(img, sx, sy, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);

    frames.push({
      index: i,
      dataUrl: canvas.toDataURL('image/png'),
      width: frameWidth,
      height: frameHeight,
    });
  }

  return buildResult(spriteDataUrl, frameWidth, frameHeight, frameCount, totalWidth, totalHeight, frames, config);
}

function emptyResult(config: AnimationConfig): AnimationResult {
  return {
    spriteDataUrl: '',
    frameWidth: config.frameWidth || 0,
    frameHeight: config.frameHeight || 0,
    frameCount: 0,
    totalWidth: 0,
    totalHeight: 0,
    cssCode: '',
    scssCode: '',
    htmlCode: '',
    keyframesCode: '',
    animationClassCode: '',
    frames: [],
    duration: 0,
  };
}

function buildResult(
  spriteDataUrl: string,
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  totalWidth: number,
  totalHeight: number,
  frames: FrameItem[],
  config: AnimationConfig
): AnimationResult {
  const duration = frameCount / Math.max(config.frameRate, 1);
  const keyframesCode = generateKeyframes(config, frameWidth, frameHeight, totalWidth, totalHeight, frameCount);
  const animationClassCode = generateAnimationClass(config, frameWidth, frameHeight, duration);
  const cssCode = generateFullCSS(config, keyframesCode, animationClassCode);
  const scssCode = generateFullSCSS(config, keyframesCode, animationClassCode, frameWidth, frameHeight, duration, totalWidth, totalHeight, frameCount);
  const htmlCode = generateHTML(config);

  return {
    spriteDataUrl,
    frameWidth,
    frameHeight,
    frameCount,
    totalWidth,
    totalHeight,
    cssCode,
    scssCode,
    htmlCode,
    keyframesCode,
    animationClassCode,
    frames,
    duration,
  };
}

function generateKeyframes(
  config: AnimationConfig,
  frameWidth: number,
  frameHeight: number,
  totalWidth: number,
  totalHeight: number,
  frameCount: number
): string {
  const name = sanitizeName(config.animationName || 'sprite-animation');
  const { rows = 1, columns = frameCount, spacing = 0, padding = 0 } = config;
  const isHorizontal = rows === 1;

  if (config.useSteps) {
    if (isHorizontal) {
      const offset = padding + spacing;
      return `@keyframes ${name} {
  from {
    background-position: -${offset}px -${offset}px;
  }
  to {
    background-position: -${offset + (frameCount - 1) * (frameWidth + spacing)}px -${offset}px;
  }
}
`;
    } else {
      let kf = `@keyframes ${name} {\n`;
      for (let i = 0; i < frameCount; i++) {
        const row = Math.floor(i / columns);
        const col = i % columns;
        const x = padding + spacing + col * (frameWidth + spacing);
        const y = padding + spacing + row * (frameHeight + spacing);
        const percent = (i / frameCount) * 100;
        kf += `  ${percent.toFixed(2)}% {\n    background-position: -${x}px -${y}px;\n  }\n`;
      }
      kf += `  100% {\n    background-position: -${padding + spacing + ((frameCount - 1) % columns) * (frameWidth + spacing)}px -${padding + spacing + Math.floor((frameCount - 1) / columns) * (frameHeight + spacing)}px;\n  }\n`;
      return kf + '}\n';
    }
  }

  let kf = `@keyframes ${name} {\n`;
  for (let i = 0; i <= frameCount; i++) {
    const idx = i === frameCount ? frameCount - 1 : i;
    const row = Math.floor(idx / columns);
    const col = idx % columns;
    const x = padding + spacing + col * (frameWidth + spacing);
    const y = padding + spacing + row * (frameHeight + spacing);
    const percent = (i / frameCount) * 100;
    kf += `  ${percent.toFixed(2)}% {\n    background-position: -${x}px -${y}px;\n  }\n`;
  }
  return kf + '}\n';
}

function generateAnimationClass(
  config: AnimationConfig,
  frameWidth: number,
  frameHeight: number,
  duration: number
): string {
  const prefix = sanitizeName(config.classPrefix || 'anim');
  const name = sanitizeName(config.animationName || 'sprite-animation');
  const { rows = 1, columns = 1 } = config;
  const actualFrameCount = columns * rows || 1;

  const iteration = config.loopCount === 'infinite' ? 'infinite' : String(config.loopCount);
  const direction = config.direction;
  const fillMode = config.fillMode;

  const timingFunction = config.useSteps && rows === 1
    ? `steps(${actualFrameCount}, end)`
    : 'step-end';

  const gpuOpt = config.optimizeGPU
    ? `  transform: translateZ(0);\n  will-change: background-position;\n  backface-visibility: hidden;\n`
    : '';

  return `.${prefix}-${name} {
  display: inline-block;
  width: ${frameWidth}px;
  height: ${frameHeight}px;
  background-image: url('${name}.png');
  background-repeat: no-repeat;
${gpuOpt}  animation: ${name} ${duration.toFixed(3)}s ${timingFunction} ${iteration} ${direction} ${fillMode};
}
`;
}

function generateFullCSS(
  config: AnimationConfig,
  keyframesCode: string,
  animationClassCode: string
): string {
  const header = `/* Sprite Animation CSS */
/* Generated by SpriteLab */
/* FPS: ${config.frameRate}, Frames: see keyframes, Duration: ${(parseFloat(animationClassCode.match(/([\d.]+)s/)?.[1] || '0')).toFixed(3)}s */
\n`;
  return header + keyframesCode + '\n' + animationClassCode;
}

function generateFullSCSS(
  config: AnimationConfig,
  keyframesCode: string,
  animationClassCode: string,
  frameWidth: number,
  frameHeight: number,
  duration: number,
  totalWidth: number,
  totalHeight: number,
  frameCount: number
): string {
  const prefix = sanitizeName(config.classPrefix || 'anim');
  const name = sanitizeName(config.animationName || 'sprite-animation');
  const iteration = config.loopCount === 'infinite' ? 'infinite' : String(config.loopCount);

  const scssVars = `// Sprite Animation SCSS
// Generated by SpriteLab

$anim-${name}-url: '${name}.png';
$anim-${name}-frame-width: ${frameWidth}px;
$anim-${name}-frame-height: ${frameHeight}px;
$anim-${name}-total-width: ${totalWidth}px;
$anim-${name}-total-height: ${totalHeight}px;
$anim-${name}-frame-count: ${frameCount};
$anim-${name}-fps: ${config.frameRate};
$anim-${name}-duration: ${duration.toFixed(3)}s;
$anim-${name}-iteration: ${iteration};
$anim-${name}-direction: ${config.direction};
$anim-${name}-fill-mode: ${config.fillMode};

@mixin ${prefix}-${name}-base {
  display: inline-block;
  width: $anim-${name}-frame-width;
  height: $anim-${name}-frame-height;
  background-image: url($anim-${name}-url);
  background-repeat: no-repeat;
${config.optimizeGPU ? '  transform: translateZ(0);\n  will-change: background-position;\n  backface-visibility: hidden;\n' : ''}}

@mixin ${prefix}-${name}-play {
  @include ${prefix}-${name}-base;
  animation: ${name} $anim-${name}-duration ${config.useSteps && config.rows === 1 ? 'steps($anim-${name}-frame-count, end)' : 'step-end'} $anim-${name}-iteration $anim-${name}-direction $anim-${name}-fill-mode;
}

`;

  return scssVars + '\n' + keyframesCode + '\n' + animationClassCode;
}

function generateHTML(config: AnimationConfig): string {
  const prefix = sanitizeName(config.classPrefix || 'anim');
  const name = sanitizeName(config.animationName || 'sprite-animation');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprite Animation Preview</title>
  <link rel="stylesheet" href="${name}.css">
</head>
<body>
  <div class="${prefix}-${name}"></div>
</body>
</html>
`;
}

export function estimateSpriteDimensions(
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  columns: number,
  spacing: number = 0,
  padding: number = 0
): { width: number; height: number; cols: number; rows: number } {
  const cols = Math.min(columns || frameCount, frameCount);
  const rows = Math.ceil(frameCount / cols);
  return {
    width: cols * frameWidth + (cols + 1) * spacing + padding * 2,
    height: rows * frameHeight + (rows + 1) * spacing + padding * 2,
    cols,
    rows,
  };
}

export function detectFramesFromSprite(
  dataUrl: string
): Promise<{ frameWidth: number; frameHeight: number; rows: number; columns: number; frameCount: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);

      try {
        const w = img.width;
        const h = img.height;
        const divisors = (n: number) => {
          const result: number[] = [];
          for (let i = 1; i <= n; i++) if (n % i === 0) result.push(i);
          return result;
        };
        const wDivs = divisors(w);
        const hDivs = divisors(h);
        let best: { fw: number; fh: number; rows: number; cols: number; score: number } | null = null;

        for (const fw of wDivs) {
          for (const fh of hDivs) {
            if (fw < 4 || fh < 4) continue;
            if (fw > 512 || fh > 512) continue;
            const cols = w / fw;
            const rows = h / fh;
            if (cols * rows < 2) continue;
            let uniform = true;
            let sampleScore = 0;
            for (let r = 0; r < rows && uniform; r++) {
              for (let c = 0; c < cols && uniform; c++) {
                const x = c * fw;
                const y = r * fh;
                try {
                  const cornerData = ctx.getImageData(x, y, 1, 1).data;
                  sampleScore += cornerData[3] > 0 ? 1 : 0;
                } catch {
                  uniform = false;
                }
              }
            }
            if (uniform) {
              const ratio = Math.min(fw, fh) / Math.max(fw, fh);
              const score = ratio * 0.4 + (sampleScore / (cols * rows)) * 0.6;
              if (!best || score > best.score) {
                best = { fw, fh, rows, cols, score };
              }
            }
          }
        }

        if (best) {
          resolve({
            frameWidth: best.fw,
            frameHeight: best.fh,
            rows: best.rows,
            columns: best.cols,
            frameCount: best.rows * best.cols,
          });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
