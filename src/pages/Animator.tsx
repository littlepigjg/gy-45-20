import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  Trash2,
  Download,
  Copy,
  Check,
  Settings2,
  Play,
  Pause,
  Eye,
  Plus,
  X,
  Film,
  Grid3X3,
  Wand2,
  RotateCcw,
  GripVertical,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  createIconItemsFromFiles,
  fileToDataUrl,
  getImageSize,
  downloadDataUrl,
  downloadText,
  cn,
} from '@/utils';
import {
  generateAnimationFromFrames,
  generateAnimationFromSprite,
  detectFramesFromSprite,
} from '@/services/animationGenerator';
import type { AnimationResult, AnimationDirection, AnimationFillMode } from '@/types';

type CodeTab = 'css' | 'scss' | 'keyframes' | 'class' | 'html';

export default function Animator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const spriteInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [spriteDragging, setSpriteDragging] = useState(false);
  const [animationResult, setAnimationResult] = useState<AnimationResult | null>(null);
  const [codeTab, setCodeTab] = useState<CodeTab>('css');
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);

  const {
    animationFrames,
    animationConfig,
    animationSpriteDataUrl,
    setAnimationFrames,
    addAnimationFrames,
    removeAnimationFrame,
    clearAnimationFrames,
    updateAnimationConfig,
    setAnimationSpriteDataUrl,
  } = useAppStore();

  const handleFrameFiles = useCallback(
    async (files: FileList | File[]) => {
      const icons = await createIconItemsFromFiles(files);
      if (icons.length > 0) {
        addAnimationFrames(icons);
      }
    },
    [addAnimationFrames]
  );

  const onFramesDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFrameFiles(e.dataTransfer.files);
      }
    },
    [handleFrameFiles]
  );

  const handleSpriteFile = useCallback(
    async (file: File) => {
      const dataUrl = await fileToDataUrl(file);
      const size = await getImageSize(dataUrl);
      setAnimationSpriteDataUrl(dataUrl);
      updateAnimationConfig({ frameWidth: size.width, frameHeight: size.height });
    },
    [setAnimationSpriteDataUrl, updateAnimationConfig]
  );

  const onSpriteDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setSpriteDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleSpriteFile(e.dataTransfer.files[0]);
      }
    },
    [handleSpriteFile]
  );

  const runAutoDetect = useCallback(async () => {
    if (!animationSpriteDataUrl) return;
    setIsDetecting(true);
    try {
      const detected = await detectFramesFromSprite(animationSpriteDataUrl);
      if (detected) {
        updateAnimationConfig({
          rows: detected.rows,
          columns: detected.columns,
          frameWidth: detected.frameWidth,
          frameHeight: detected.frameHeight,
        });
      }
    } finally {
      setIsDetecting(false);
    }
  }, [animationSpriteDataUrl, updateAnimationConfig]);

  useEffect(() => {
    let cancelled = false;
    setIsGenerating(true);
    const timer = setTimeout(async () => {
      let result: AnimationResult | null = null;
      if (animationConfig.sourceMode === 'frames') {
        if (animationFrames.length > 0) {
          result = await generateAnimationFromFrames(animationFrames, {
            ...animationConfig,
            columns: animationConfig.columns || animationFrames.length,
          });
        }
      } else {
        if (
          animationSpriteDataUrl &&
          animationConfig.frameWidth > 0 &&
          animationConfig.frameHeight > 0 &&
          animationConfig.rows > 0 &&
          animationConfig.columns > 0
        ) {
          result = await generateAnimationFromSprite(animationSpriteDataUrl, animationConfig);
        }
      }
      if (!cancelled) {
        setAnimationResult(result);
        setIsGenerating(false);
      }
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [animationFrames, animationSpriteDataUrl, animationConfig]);

  useEffect(() => {
    if (previewRef.current && animationResult) {
      const el = previewRef.current;
      const name = animationConfig.animationName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const prefix = animationConfig.classPrefix.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      el.className = `${prefix}-${name}`;
      const style = el.style;
      style.width = `${animationResult.frameWidth}px`;
      style.height = `${animationResult.frameHeight}px`;
      style.backgroundImage = `url("${animationResult.spriteDataUrl}")`;
      style.backgroundRepeat = 'no-repeat';
      style.display = 'inline-block';
      if (isPlaying) {
        const timing =
          animationConfig.useSteps && animationConfig.rows === 1
            ? `steps(${animationResult.frameCount}, end)`
            : 'step-end';
        const duration = animationResult.duration.toFixed(3);
        const iter =
          animationConfig.loopCount === 'infinite' ? 'infinite' : String(animationConfig.loopCount);
        style.animation = `${name} ${duration}s ${timing} ${iter} ${animationConfig.direction} ${animationConfig.fillMode}`;
        style.animationPlayState = 'running';
      } else {
        style.animationPlayState = 'paused';
      }
      style.transform = `scale(${previewZoom})`;
      style.transformOrigin = 'top left';
      style.willChange = animationConfig.optimizeGPU ? 'background-position' : 'auto';
    }
  }, [animationResult, isPlaying, previewZoom, animationConfig]);

  const removeFrame = (id: string) => {
    removeAnimationFrame(id);
  };

  const moveFrame = (fromIndex: number, toIndex: number) => {
    const next = [...animationFrames];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    setAnimationFrames(next);
  };

  const copyCode = async () => {
    if (!animationResult) return;
    let code = '';
    switch (codeTab) {
      case 'css':
        code = animationResult.cssCode;
        break;
      case 'scss':
        code = animationResult.scssCode;
        break;
      case 'keyframes':
        code = animationResult.keyframesCode;
        break;
      case 'class':
        code = animationResult.animationClassCode;
        break;
      case 'html':
        code = animationResult.htmlCode;
        break;
    }
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadAll = () => {
    if (!animationResult) return;
    const name = animationConfig.animationName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    downloadDataUrl(animationResult.spriteDataUrl, `${name}.png`);
    downloadText(animationResult.cssCode, `${name}.css`, 'text/css');
  };

  const downloadCode = () => {
    if (!animationResult) return;
    const name = animationConfig.animationName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    let code = '';
    let ext = '';
    let mime = 'text/plain';
    switch (codeTab) {
      case 'css':
        code = animationResult.cssCode;
        ext = 'css';
        mime = 'text/css';
        break;
      case 'scss':
        code = animationResult.scssCode;
        ext = 'scss';
        break;
      case 'keyframes':
        code = animationResult.keyframesCode;
        ext = 'css';
        mime = 'text/css';
        break;
      case 'class':
        code = animationResult.animationClassCode;
        ext = 'css';
        mime = 'text/css';
        break;
      case 'html':
        code = animationResult.htmlCode;
        ext = 'html';
        mime = 'text/html';
        break;
    }
    downloadText(code, `${name}.${ext}`, mime);
  };

  const DragHandle = ({ index }: { index: number }) => {
    const [dragging, setDragging] = useState(false);
    return (
      <div
        draggable
        onDragStart={(e) => {
          setDragging(true);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(index));
        }}
        onDragEnd={() => setDragging(false)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!Number.isNaN(fromIdx) && fromIdx !== index) {
            moveFrame(fromIdx, index);
          }
        }}
        className={cn(
          'group relative bg-ink-700/40 border rounded-lg overflow-hidden transition-all cursor-grab active:cursor-grabbing',
          dragging ? 'opacity-40 scale-95' : 'border-ink-600 hover:border-neon-cyan/40'
        )}
      >
        <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-5 h-5 rounded bg-ink-900/80 flex items-center justify-center">
            <GripVertical className="w-3 h-3 text-slate-400" />
          </div>
        </div>
        <button
          onClick={() => removeFrame(animationFrames[index].id)}
          className="absolute top-1 right-1 z-10 w-5 h-5 rounded bg-ink-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-all"
        >
          <X className="w-3 h-3 text-white" />
        </button>
        <div className="aspect-square checkerboard p-2 flex items-center justify-center">
          <img
            src={animationFrames[index].dataUrl}
            alt={animationFrames[index].name}
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        </div>
        <div className="px-2 py-1.5 bg-ink-800/80 border-t border-ink-700/50">
          <div className="text-[11px] text-slate-300 truncate font-mono">
            #{index + 1} {animationFrames[index].name}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {animationFrames[index].width}×{animationFrames[index].height}
          </div>
        </div>
      </div>
    );
  };

  const codeTabs: { key: CodeTab; label: string }[] = [
    { key: 'css', label: 'CSS' },
    { key: 'scss', label: 'SCSS' },
    { key: 'keyframes', label: '@keyframes' },
    { key: 'class', label: '.class' },
    { key: 'html', label: 'HTML' },
  ];

  const directionOptions: { value: AnimationDirection; label: string }[] = [
    { value: 'normal', label: '正常 (→)' },
    { value: 'reverse', label: '反向 (←)' },
    { value: 'alternate', label: '交替 (→←)' },
    { value: 'alternate-reverse', label: '反向交替 (←→)' },
  ];

  const fillModeOptions: { value: AnimationFillMode; label: string }[] = [
    { value: 'none', label: '无' },
    { value: 'forwards', label: '保持结束帧' },
    { value: 'backwards', label: '保持起始帧' },
    { value: 'both', label: '两者' },
  ];

  const hasContent = animationFrames.length > 0 || animationSpriteDataUrl;

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 px-6 py-4 border-b border-ink-700/50 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">动画精灵图生成器</h2>
          <p className="text-sm text-slate-500 mt-0.5">上传序列帧或精灵图，一键生成 CSS 动画 @keyframes 代码</p>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <button
              onClick={() => {
                if (animationConfig.sourceMode === 'frames') {
                  clearAnimationFrames();
                } else {
                  setAnimationSpriteDataUrl('');
                }
              }}
              className="btn btn-danger"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>
          )}
          {animationResult && (
            <button onClick={downloadAll} className="btn btn-primary">
              <Download className="w-4 h-4" />
              下载全部
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr_400px] gap-0">
        <div className="flex flex-col border-r border-ink-700/50 overflow-hidden">
          <div className="p-4 border-b border-ink-700/50">
            <div className="flex items-center gap-2 mb-3">
              <Settings2 className="w-4 h-4 text-neon-cyan" />
              <h3 className="font-semibold text-sm text-white">参数配置</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">素材来源</label>
                <div className="flex bg-ink-800 rounded-md border border-ink-600 overflow-hidden">
                  <button
                    onClick={() => updateAnimationConfig({ sourceMode: 'frames' })}
                    className={cn(
                      'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                      animationConfig.sourceMode === 'frames'
                        ? 'bg-neon-cyan text-ink-950'
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <Film className="w-3.5 h-3.5 inline mr-1.5" />
                    序列帧
                  </button>
                  <button
                    onClick={() => updateAnimationConfig({ sourceMode: 'sprite' })}
                    className={cn(
                      'flex-1 px-3 py-2 text-xs font-medium transition-colors border-l border-ink-600',
                      animationConfig.sourceMode === 'sprite'
                        ? 'bg-neon-cyan text-ink-950'
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <Grid3X3 className="w-3.5 h-3.5 inline mr-1.5" />
                    精灵图
                  </button>
                </div>
              </div>

              {animationConfig.sourceMode === 'sprite' && (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">行数 (rows)</label>
                    <input
                      type="number"
                      min={1}
                      max={64}
                      value={animationConfig.rows}
                      onChange={(e) =>
                        updateAnimationConfig({
                          rows: Math.max(1, Math.min(64, parseInt(e.target.value) || 1)),
                        })
                      }
                      className="w-16 h-7 bg-ink-800 border border-ink-600 rounded px-2 text-xs text-slate-200 text-center focus:outline-none focus:border-neon-cyan/60"
                    />
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">列数 (columns)</label>
                    <input
                      type="number"
                      min={1}
                      max={64}
                      value={animationConfig.columns}
                      onChange={(e) =>
                        updateAnimationConfig({
                          columns: Math.max(1, Math.min(64, parseInt(e.target.value) || 1)),
                        })
                      }
                      className="w-16 h-7 bg-ink-800 border border-ink-600 rounded px-2 text-xs text-slate-200 text-center focus:outline-none focus:border-neon-cyan/60"
                    />
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">帧宽 (px)</label>
                    <input
                      type="number"
                      min={1}
                      max={2048}
                      value={animationConfig.frameWidth}
                      onChange={(e) =>
                        updateAnimationConfig({
                          frameWidth: Math.max(1, Math.min(2048, parseInt(e.target.value) || 1)),
                        })
                      }
                      className="w-16 h-7 bg-ink-800 border border-ink-600 rounded px-2 text-xs text-slate-200 text-center focus:outline-none focus:border-neon-cyan/60"
                    />
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">帧高 (px)</label>
                    <input
                      type="number"
                      min={1}
                      max={2048}
                      value={animationConfig.frameHeight}
                      onChange={(e) =>
                        updateAnimationConfig({
                          frameHeight: Math.max(1, Math.min(2048, parseInt(e.target.value) || 1)),
                        })
                      }
                      className="w-16 h-7 bg-ink-800 border border-ink-600 rounded px-2 text-xs text-slate-200 text-center focus:outline-none focus:border-neon-cyan/60"
                    />
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">内边距 (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={64}
                      value={animationConfig.padding}
                      onChange={(e) =>
                        updateAnimationConfig({
                          padding: Math.max(0, Math.min(64, parseInt(e.target.value) || 0)),
                        })
                      }
                      className="w-16 h-7 bg-ink-800 border border-ink-600 rounded px-2 text-xs text-slate-200 text-center focus:outline-none focus:border-neon-cyan/60"
                    />
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">帧间距 (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={64}
                      value={animationConfig.spacing}
                      onChange={(e) =>
                        updateAnimationConfig({
                          spacing: Math.max(0, Math.min(64, parseInt(e.target.value) || 0)),
                        })
                      }
                      className="w-16 h-7 bg-ink-800 border border-ink-600 rounded px-2 text-xs text-slate-200 text-center focus:outline-none focus:border-neon-cyan/60"
                    />
                  </div>
                </>
              )}

              {animationConfig.sourceMode === 'frames' && (
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400">排列列数</label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={animationConfig.columns || animationFrames.length || 1}
                    onChange={(e) =>
                      updateAnimationConfig({
                        columns: Math.max(1, Math.min(64, parseInt(e.target.value) || 1)),
                      })
                    }
                    className="w-16 h-7 bg-ink-800 border border-ink-600 rounded px-2 text-xs text-slate-200 text-center focus:outline-none focus:border-neon-cyan/60"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400">帧率 (FPS)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={animationConfig.frameRate}
                    onChange={(e) =>
                      updateAnimationConfig({
                        frameRate: Math.max(1, Math.min(120, parseInt(e.target.value) || 24)),
                      })
                    }
                    className="w-16 h-7 bg-ink-800 border border-ink-600 rounded px-2 text-xs text-slate-200 text-center focus:outline-none focus:border-neon-cyan/60"
                  />
                </div>
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={animationConfig.frameRate}
                  onChange={(e) => updateAnimationConfig({ frameRate: parseInt(e.target.value) })}
                  className="w-full accent-neon-cyan"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400">循环次数</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      disabled={animationConfig.loopCount === 'infinite'}
                      value={animationConfig.loopCount === 'infinite' ? 1 : animationConfig.loopCount}
                      onChange={(e) =>
                        updateAnimationConfig({
                          loopCount: Math.max(1, Math.min(999, parseInt(e.target.value) || 1)),
                        })
                      }
                      className={cn(
                        'w-16 h-7 bg-ink-800 border border-ink-600 rounded px-2 text-xs text-slate-200 text-center focus:outline-none focus:border-neon-cyan/60',
                        animationConfig.loopCount === 'infinite' && 'opacity-40'
                      )}
                    />
                    <button
                      onClick={() =>
                        updateAnimationConfig({
                          loopCount: animationConfig.loopCount === 'infinite' ? 1 : 'infinite',
                        })
                      }
                      className={cn(
                        'h-7 px-2 rounded text-xs font-medium transition-colors border',
                        animationConfig.loopCount === 'infinite'
                          ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan'
                          : 'border-ink-600 bg-ink-800 text-slate-400 hover:text-slate-200'
                      )}
                    >
                      ∞
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">播放方向</label>
                <select
                  value={animationConfig.direction}
                  onChange={(e) =>
                    updateAnimationConfig({ direction: e.target.value as AnimationDirection })
                  }
                  className="input h-8 bg-ink-800 text-xs"
                >
                  {directionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">填充模式</label>
                <select
                  value={animationConfig.fillMode}
                  onChange={(e) =>
                    updateAnimationConfig({ fillMode: e.target.value as AnimationFillMode })
                  }
                  className="input h-8 bg-ink-800 text-xs"
                >
                  {fillModeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">CSS类名前缀</label>
                <input
                  type="text"
                  value={animationConfig.classPrefix}
                  onChange={(e) => updateAnimationConfig({ classPrefix: e.target.value || 'anim' })}
                  className="input font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">动画名称</label>
                <input
                  type="text"
                  value={animationConfig.animationName}
                  onChange={(e) =>
                    updateAnimationConfig({ animationName: e.target.value || 'sprite-animation' })
                  }
                  className="input font-mono text-xs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={animationConfig.useSteps}
                  onChange={(e) => updateAnimationConfig({ useSteps: e.target.checked })}
                  className="w-4 h-4 accent-neon-cyan"
                />
                <span className="text-xs text-slate-300">使用 steps() 函数（单行动画推荐）</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={animationConfig.optimizeGPU}
                  onChange={(e) => updateAnimationConfig({ optimizeGPU: e.target.checked })}
                  className="w-4 h-4 accent-neon-cyan"
                />
                <span className="text-xs text-slate-300">GPU 硬件加速优化</span>
              </label>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-ink-700/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-white">
                {animationConfig.sourceMode === 'frames' ? (
                  <>
                    帧序列 <span className="text-slate-500 font-normal">({animationFrames.length})</span>
                  </>
                ) : (
                  <>精灵图源</>
                )}
              </h3>
              {animationConfig.sourceMode === 'frames' && animationFrames.length > 0 && (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="btn-ghost btn !px-2 !py-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
              {animationConfig.sourceMode === 'frames' ? (
                <>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onFramesDrop}
                    onClick={() => inputRef.current?.click()}
                    className={cn(
                      'mb-3 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all',
                      isDragging
                        ? 'border-neon-cyan bg-neon-cyan/5'
                        : 'border-ink-600 hover:border-neon-cyan/40 hover:bg-white/[0.02]'
                    )}
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                    <div className="text-sm text-slate-400">
                      {isDragging ? '松开以上传' : '拖拽或点击上传序列帧'}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">支持 PNG / JPG / SVG / GIF / WebP</div>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFrameFiles(e.target.files)}
                  />
                  {animationFrames.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {animationFrames.map((_, i) => (
                        <DragHandle key={animationFrames[i].id} index={i} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setSpriteDragging(true);
                    }}
                    onDragLeave={() => setSpriteDragging(false)}
                    onDrop={onSpriteDrop}
                    onClick={() => spriteInputRef.current?.click()}
                    className={cn(
                      'mb-3 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all',
                      spriteDragging
                        ? 'border-neon-cyan bg-neon-cyan/5'
                        : 'border-ink-600 hover:border-neon-cyan/40 hover:bg-white/[0.02]'
                    )}
                  >
                    <Grid3X3 className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                    <div className="text-sm text-slate-400">
                      {spriteDragging ? '松开以导入' : '拖拽或点击上传精灵图'}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">PNG / JPG</div>
                  </div>
                  <input
                    ref={spriteInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && handleSpriteFile(e.target.files[0])}
                  />
                  {animationSpriteDataUrl && (
                    <div className="space-y-2">
                      <div className="relative checkerboard rounded-lg overflow-hidden">
                        <img src={animationSpriteDataUrl} alt="sprite" className="w-full h-auto" />
                      </div>
                      <button
                        onClick={runAutoDetect}
                        disabled={isDetecting}
                        className="btn btn-secondary w-full text-xs"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        {isDetecting ? '检测中...' : '自动检测帧参数'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-neon-cyan" />
              <h3 className="font-semibold text-sm text-white">动画预览</h3>
              {animationResult && (
                <>
                  <span className="chip bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 font-mono">
                    {animationResult.frameCount} 帧
                  </span>
                  <span className="chip bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                    {animationResult.duration.toFixed(2)}s
                  </span>
                  <span className="chip bg-lime-500/10 text-lime-400 border border-lime-500/20 font-mono">
                    {animationConfig.frameRate} FPS
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="btn-ghost btn !px-2 !py-1"
                disabled={!animationResult}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setPreviewZoom((z) => Math.max(0.25, z - 0.25))}
                className="btn-ghost btn !px-2 !py-1"
              >
                <span className="text-xs font-mono">-</span>
              </button>
              <span className="text-xs text-slate-400 w-14 text-center font-mono">
                {Math.round(previewZoom * 100)}%
              </span>
              <button
                onClick={() => setPreviewZoom((z) => Math.min(8, z + 0.25))}
                className="btn-ghost btn !px-2 !py-1"
              >
                <span className="text-xs font-mono">+</span>
              </button>
              <button onClick={() => setPreviewZoom(1)} className="btn-ghost btn !px-2 !py-1 ml-1">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto scrollbar-thin bg-ink-950/50 p-8">
            {isGenerating && !animationResult && (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">生成中...</div>
            )}
            {!isGenerating && !animationResult && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <Film className="w-16 h-16 mb-4 opacity-30" />
                <div className="text-sm">
                  {animationConfig.sourceMode === 'frames'
                    ? '上传序列帧图片开始生成动画'
                    : '上传精灵图并设置帧参数'}
                </div>
              </div>
            )}
            {animationResult && (
              <div className="flex items-center justify-center">
                <div className="checkerboard rounded-lg p-6 inline-block">
                  <div ref={previewRef} style={{ imageRendering: 'pixelated' }} />
                </div>
              </div>
            )}
          </div>
          {animationResult && (
            <div className="px-4 py-2 border-t border-ink-700/50 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span>
                  帧尺寸: {animationResult.frameWidth}×{animationResult.frameHeight}
                </span>
                <span>
                  精灵图: {animationResult.totalWidth}×{animationResult.totalHeight}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col border-l border-ink-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-700/50 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white">代码输出</h3>
            <div className="flex items-center gap-1">
              <div className="flex bg-ink-800 rounded-md border border-ink-600 overflow-hidden">
                {codeTabs.map(({ key, label }, idx) => (
                  <button
                    key={key}
                    onClick={() => setCodeTab(key)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-mono transition-colors',
                      codeTab === key ? 'bg-neon-cyan text-ink-950' : 'text-slate-400 hover:text-slate-200',
                      idx > 0 && 'border-l border-ink-600'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={copyCode}
                disabled={!animationResult}
                className="btn-ghost btn !px-2 !py-1 disabled:opacity-40"
              >
                {copied ? <Check className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={downloadCode}
                disabled={!animationResult}
                className="btn-ghost btn !px-2 !py-1 disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto scrollbar-thin p-4 bg-ink-950/60">
            {animationResult ? (
              <pre className="code-block text-slate-300">
                <code>
                  {codeTab === 'css' && animationResult.cssCode}
                  {codeTab === 'scss' && animationResult.scssCode}
                  {codeTab === 'keyframes' && animationResult.keyframesCode}
                  {codeTab === 'class' && animationResult.animationClassCode}
                  {codeTab === 'html' && animationResult.htmlCode}
                </code>
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                代码将在这里生成
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
