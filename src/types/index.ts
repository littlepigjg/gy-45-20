export interface IconMeta {
  id: string;
  name: string;
  originalName: string;
  width: number;
  height: number;
  addedAt: number;
}

export interface IconItem extends IconMeta {
  dataUrl: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  iconIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SpriteConfig {
  columns: number;
  spacing: number;
  bgColor: string;
  classPrefix: string;
  retina: boolean;
}

export interface IconPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteResult {
  imageDataUrl: string;
  cssCode: string;
  scssCode: string;
  iconPositions: IconPosition[];
  totalWidth: number;
  totalHeight: number;
  cellWidth: number;
  cellHeight: number;
}

export interface SplitConfig {
  rows: number;
  columns: number;
  iconWidth: number;
  iconHeight: number;
  spacing: number;
  padding: number;
}

export interface SplitIcon {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
  name: string;
}

export type AnimationSourceMode = 'frames' | 'sprite';

export type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

export type AnimationFillMode = 'none' | 'forwards' | 'backwards' | 'both';

export interface AnimationConfig {
  sourceMode: AnimationSourceMode;
  frameRate: number;
  loopCount: number | 'infinite';
  direction: AnimationDirection;
  fillMode: AnimationFillMode;
  playOnLoad: boolean;
  classPrefix: string;
  animationName: string;
  useSteps: boolean;
  optimizeGPU: boolean;
  rows: number;
  columns: number;
  frameWidth: number;
  frameHeight: number;
  spacing: number;
  padding: number;
}

export interface FrameItem {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface AnimationResult {
  spriteDataUrl: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  totalWidth: number;
  totalHeight: number;
  cssCode: string;
  scssCode: string;
  htmlCode: string;
  keyframesCode: string;
  animationClassCode: string;
  frames: FrameItem[];
  duration: number;
}
