import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, 
  Pencil, 
  Undo2, 
  Download, 
  ScanText, 
  Eraser, 
  Check, 
  Loader2, 
  Maximize2, 
  Info 
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface ImageFile {
  file: File;
  preview: string;
  base64: string;
  width?: number;
  height?: number;
}

interface PreviewCanvasProps {
  resultImage: string | null;
  setResultImage?: (val: string | null) => void;
  isEditing?: boolean;
  setIsEditing?: (val: boolean) => void;
  setShowComparison?: (val: boolean) => void;
  history?: string[];
  handleUndo?: () => void;
  handleDownload?: () => void;
  editPrompt?: string;
  setEditPrompt?: (val: string) => void;
  editPromptRef?: React.RefObject<HTMLTextAreaElement>;
  brushSize?: number;
  setBrushSize?: (val: number) => void;
  brushColor?: string;
  setBrushColor?: (val: string) => void;
  clearMask?: () => void;
  applyInpainting?: () => Promise<void>;
  isApplyingEdit?: boolean;
  handleUpscale?: (target: string) => Promise<void>;
  isUpscaling?: boolean;
  upscaleTarget?: string | null;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  canvasSize?: { width: number; height: number };
  startDrawing?: (e: React.MouseEvent | React.TouchEvent) => void;
  draw?: (e: React.MouseEvent | React.TouchEvent) => void;
  stopDrawing?: () => void;
  controlNetImg?: ImageFile | null;
  comparisonValue?: number;
  setComparisonValue?: (val: number) => void;
  isGenerating?: boolean;
}

const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  resultImage,
  setResultImage,
  isEditing: propsIsEditing,
  setIsEditing: propsSetIsEditing,
  setShowComparison: propsSetShowComparison,
  history: propsHistory,
  handleUndo: propsHandleUndo,
  handleDownload: propsHandleDownload,
  editPrompt: propsEditPrompt,
  setEditPrompt: propsSetEditPrompt,
  editPromptRef: propsEditPromptRef,
  brushSize: propsBrushSize,
  setBrushSize: propsSetBrushSize,
  brushColor: propsBrushColor,
  setBrushColor: propsSetBrushColor,
  clearMask: propsClearMask,
  applyInpainting: propsApplyInpainting,
  isApplyingEdit: propsIsApplyingEdit,
  handleUpscale: propsHandleUpscale,
  isUpscaling: propsIsUpscaling,
  upscaleTarget: propsUpscaleTarget,
  canvasRef: propsCanvasRef,
  canvasSize: propsCanvasSize,
  startDrawing: propsStartDrawing,
  draw: propsDraw,
  stopDrawing: propsStopDrawing,
  controlNetImg,
  comparisonValue: propsComparisonValue,
  setComparisonValue: propsSetComparisonValue,
  isGenerating = false,
}) => {
  // Internal state fallbacks
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const [internalHistory, setInternalHistory] = useState<string[]>([]);
  const [internalEditPrompt, setInternalEditPrompt] = useState('');
  const [internalBrushSize, setInternalBrushSize] = useState(30);
  const [internalBrushColor, setInternalBrushColor] = useState('rgba(57, 255, 20, 0.8)');
  const [internalIsApplyingEdit, setInternalIsApplyingEdit] = useState(false);
  const [internalIsUpscaling, setInternalIsUpscaling] = useState(false);
  const [internalUpscaleTarget, setInternalUpscaleTarget] = useState<string | null>(null);
  const [internalComparisonValue, setInternalComparisonValue] = useState(50);
  const [internalShowComparison, setInternalShowComparison] = useState(false);
  const [internalCanvasSize, setInternalCanvasSize] = useState({ width: 1024, height: 1024 });
  const [isDrawing, setIsDrawing] = useState(false);

  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const internalEditPromptRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = propsIsEditing !== undefined ? propsIsEditing : internalIsEditing;
  const setIsEditing = propsSetIsEditing || setInternalIsEditing;
  const setShowComparison = propsSetShowComparison || setInternalShowComparison;
  const history = propsHistory !== undefined ? propsHistory : internalHistory;
  const setHistory = setInternalHistory;
  const editPrompt = propsEditPrompt !== undefined ? propsEditPrompt : internalEditPrompt;
  const setEditPrompt = propsSetEditPrompt || setInternalEditPrompt;
  const editPromptRef = propsEditPromptRef || internalEditPromptRef;
  const brushSize = propsBrushSize !== undefined ? propsBrushSize : internalBrushSize;
  const setBrushSize = propsSetBrushSize || setInternalBrushSize;
  const brushColor = propsBrushColor !== undefined ? propsBrushColor : internalBrushColor;
  const setBrushColor = propsSetBrushColor || setInternalBrushColor;
  const isApplyingEdit = propsIsApplyingEdit !== undefined ? propsIsApplyingEdit : internalIsApplyingEdit;
  const isUpscaling = propsIsUpscaling !== undefined ? propsIsUpscaling : internalIsUpscaling;
  const upscaleTarget = propsUpscaleTarget !== undefined ? propsUpscaleTarget : internalUpscaleTarget;
  const canvasRef = propsCanvasRef || internalCanvasRef;
  const canvasSize = propsCanvasSize !== undefined ? propsCanvasSize : internalCanvasSize;
  const comparisonValue = propsComparisonValue !== undefined ? propsComparisonValue : internalComparisonValue;
  const setComparisonValue = propsSetComparisonValue || setInternalComparisonValue;

  const API_KEY = process.env.GEMINI_API_KEY || '';
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  useEffect(() => {
    if (controlNetImg?.width && controlNetImg?.height) {
      const ratio = controlNetImg.width / controlNetImg.height;
      setInternalCanvasSize({
        width: 1024,
        height: 1024 / ratio
      });
    }
  }, [controlNetImg]);

  const handleUndo = () => {
    if (propsHandleUndo) return propsHandleUndo();
    if (history.length === 0 || !setResultImage) return;
    const newHistory = [...history];
    const previousImage = newHistory.pop();
    if (previousImage) {
      setResultImage(previousImage);
      setHistory(newHistory);
    }
  };

  const handleDownload = () => {
    if (propsHandleDownload) return propsHandleDownload();
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'architectural-rendering.png';
    link.click();
  };

  const clearMask = () => {
    if (propsClearMask) return propsClearMask();
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (propsStartDrawing) return propsStartDrawing(e);
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (propsStopDrawing) return propsStopDrawing();
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (propsDraw) return propsDraw(e);
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor;
    ctx.globalCompositeOperation = 'source-over';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const applyInpainting = async () => {
    if (propsApplyInpainting) return propsApplyInpainting();
    if (!resultImage || !canvasRef.current || !setResultImage) return;
    setInternalIsApplyingEdit(true);
    
    try {
      const maskBase64 = canvasRef.current.toDataURL('image/png').split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            { inlineData: { data: resultImage.split(',')[1], mimeType: 'image/png' } },
            { inlineData: { data: maskBase64, mimeType: 'image/png' } },
            { text: `STRICT SELECTIVE EDITING TASK: ${editPrompt || "Refine the materials of the building facade."}.
                     CRITICAL INSTRUCTION:
                     1. The second image is the EXCLUSIVE REPLACEMENT MASK. 
                     2. You are STRICTLY FORBIDDEN from changing any parts of the image that are not highlighted/painted in the mask.
                     3. ONLY the exact pixels I have painted should be modified. Every other pixel must be preserved with 100% fidelity.
                     4. Treat the mask as the absolute boundary for your changes.` }
          ]
        },
        config: {
          seed: 42
        } as any
      });

      const allParts = response.candidates?.[0]?.content?.parts || [];
      const editedImgPart = allParts.find((p: any) => p.inlineData)?.inlineData;
      const textResponse = allParts.find((p: any) => p.text)?.text;

      if (editedImgPart) {
        setHistory(prev => [...prev, resultImage]);
        const url = `data:${editedImgPart.mimeType};base64,${editedImgPart.data}`;
        setResultImage(url);
        setIsEditing(false);
        clearMask();
      } else if (textResponse) {
        console.warn("Inpainting model returned text instead of image:", textResponse);
      }
    } catch (err: any) {
      console.error("Inpainting error:", err);
    } finally {
      setInternalIsApplyingEdit(false);
    }
  };

  const handleUpscale = async (resolution: string) => {
    if (propsHandleUpscale) return propsHandleUpscale(resolution);
    if (!resultImage || internalIsUpscaling || !setResultImage) return;
    
    setInternalIsUpscaling(true);
    setInternalUpscaleTarget(resolution);

    try {
      const base64 = resultImage.split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: 'image/png' } },
            { text: `Enhance and upscale this architectural rendering to ${resolution} resolution. Maintain all details, textures, and lighting perfectly while increasing clarity and sharpness.` }
          ]
        },
        config: {
          imageConfig: {
            imageSize: resolution as any
          }
        }
      });

      const allParts = response.candidates?.[0]?.content?.parts || [];
      const upscaledImgPart = allParts.find((p: any) => p.inlineData)?.inlineData;
      
      if (upscaledImgPart) {
        const upscaledUrl = `data:${upscaledImgPart.mimeType};base64,${upscaledImgPart.data}`;
        setHistory(prev => [...prev, resultImage]);
        setResultImage(upscaledUrl);
      } else {
        const textResponse = allParts.find((p: any) => p.text)?.text;
        if (textResponse) {
          console.warn("Upscale model returned text instead of image:", textResponse);
        }
      }
    } catch (err: any) {
      console.error("Upscale error:", err);
    } finally {
      setInternalIsUpscaling(false);
      setInternalUpscaleTarget(null);
    }
  };

  return (
    <div className="lg:col-span-5 relative">
      <div className="sticky top-24">
        {/* Main Result Display - Standard View */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex flex-col h-[calc(100vh-8rem)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-medium text-zinc-300 font-mono uppercase tracking-wider">Preview Image Node</h2>
            </div>
            <div className="flex items-center gap-2">
              {resultImage && (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowComparison(false);
                    }}
                    className="p-1.5 rounded-md transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase border bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100"
                    title="Open Large Editor"
                  >
                    <Pencil className="w-3 h-3" />
                    Enter Focus Edit
                  </button>
                  {history.length > 0 && (
                    <button 
                      onClick={handleUndo}
                      className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md transition-colors text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 text-[10px] font-bold uppercase"
                      title="Undo Last Action"
                    >
                      <Undo2 className="w-3 h-3" />
                      Undo
                    </button>
                  )}
                  <button 
                    onClick={handleDownload}
                    className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md transition-colors text-zinc-400 hover:text-zinc-100"
                    title="Save Image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {resultImage && (
            <div className="mb-4 p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Maximize2 className="w-3 h-3 text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Professional Upscale</span>
              </div>
              <div className="flex gap-2">
                {['1K', '2K', '4K'].map((res) => (
                  <button
                    key={res}
                    onClick={() => handleUpscale(res)}
                    disabled={isUpscaling}
                    className="flex-1 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-zinc-400 hover:text-indigo-400 rounded-md text-[10px] font-bold transition-all disabled:opacity-50"
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden flex items-center justify-center relative group">
            <AnimatePresence mode="wait">
              {isUpscaling && (
                <motion.div 
                  key="upscale-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                >
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest animate-pulse">Enhancing to {upscaleTarget}...</p>
                </motion.div>
              )}
              {resultImage ? (
                <motion.div 
                  key="result-container"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative w-full h-full overflow-hidden cursor-ew-resize flex items-center justify-center"
                >
                  <div className="relative w-full h-full">
                    <img
                      src={controlNetImg?.preview}
                      alt="Before"
                      className="absolute inset-0 w-full h-full object-contain opacity-50 grayscale"
                      referrerPolicy="no-referrer"
                    />
                    <div 
                      className="absolute inset-0 w-full h-full overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - comparisonValue}% 0 0)` }}
                    >
                      <img
                        src={resultImage}
                        alt="After"
                        className="absolute inset-0 w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10"
                      style={{ left: `${comparisonValue}%` }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-zinc-900">
                        <div className="flex gap-0.5">
                          <div className="w-0.5 h-3 bg-zinc-400 rounded-full" />
                          <div className="w-0.5 h-3 bg-zinc-400 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-widest border border-white/10 pointer-events-none z-30">Structure</div>
                  <div className="absolute bottom-4 right-4 px-2 py-1 bg-indigo-500/50 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-widest border border-indigo-500/30 pointer-events-none z-30">Render</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={comparisonValue}
                    onChange={(e) => setComparisonValue(parseInt(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-40"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center text-zinc-600 p-8 text-center"
                >
                  <div className="w-12 h-12 bg-zinc-900 rounded flex items-center justify-center mb-4 border border-zinc-800">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-mono text-zinc-500">Waiting for KSampler output...</p>
                </motion.div>
              )}
            </AnimatePresence>

            {isGenerating && (
              <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <div className="text-center font-mono">
                  <p className="text-sm text-zinc-300">Processing Nodes...</p>
                  <p className="text-xs text-zinc-500 mt-1">Applying ControlNet & IPAdapter</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LARGE FOCUS EDITOR OVERLAY */}
      <AnimatePresence>
        {isEditing && resultImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col p-6 items-center overflow-hidden"
          >
            {/* Header / Actions */}
            <div className="w-full max-w-[1600px] flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Pencil className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Focus Edit Mode</h2>
                  <p className="text-xs text-zinc-500 font-medium tracking-wide font-mono uppercase">Inpainting & Masking Engine</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearMask}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all"
                >
                  <Eraser className="w-4 h-4" />
                  Clear Mask
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={applyInpainting}
                  disabled={isApplyingEdit}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                >
                  {isApplyingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Generate Edit
                </button>
              </div>
            </div>

            <div className="w-full max-w-[1600px] flex-1 flex gap-8 min-h-0">
              {/* Left Column: Canvas (Large) */}
              <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden relative flex items-center justify-center p-8">
                <div 
                  className="relative max-w-full max-h-full shadow-2xl rounded-lg overflow-hidden group border border-white/5"
                  style={{ 
                    aspectRatio: controlNetImg ? `${controlNetImg.width} / ${controlNetImg.height}` : 'auto',
                    width: controlNetImg ? (controlNetImg.width > controlNetImg.height ? '100%' : 'auto') : 'auto',
                    height: controlNetImg ? (controlNetImg.height >= controlNetImg.width ? '100%' : 'auto') : 'auto'
                  }}
                >
                  <img
                    src={resultImage}
                    alt="To Edit"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    className="absolute inset-0 w-full h-full object-contain cursor-crosshair touch-none"
                  />
                </div>
              </div>

              {/* Right Column: Controls */}
              <div className="w-80 space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 block">Instruction</label>
                    <textarea
                      ref={editPromptRef}
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="e.g. 'Add a wooden balcony here', 'Change to a glass facade'..."
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-white focus:outline-none focus:border-indigo-500/50 transition-all resize-none leading-relaxed"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Brush Size</label>
                      <span className="text-[10px] font-mono text-indigo-400 font-bold">{brushSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="150" 
                      value={brushSize} 
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">Brush Color</label>
                    <div className="flex gap-2.5">
                      {[
                        { color: 'rgba(57, 255, 20, 0.8)', label: 'Green' },
                        { color: 'rgba(255, 20, 147, 0.8)', label: 'Pink' },
                        { color: 'rgba(0, 255, 255, 0.8)', label: 'Cyan' }
                      ].map((c) => (
                        <button
                          key={c.color}
                          onClick={() => setBrushColor(c.color)}
                          className={`w-8 h-8 rounded-full border-4 transition-all flex items-center justify-center ${brushColor === c.color ? 'border-white scale-110 shadow-lg shadow-white/10' : 'border-transparent opacity-60 hover:opacity-100'}`}
                          style={{ backgroundColor: c.color.replace('0.8', '1') }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                    <div className="flex items-start gap-2 text-[10px] text-indigo-300 font-medium leading-relaxed">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Tip: 마스크 영역은 수정될 곳이며, 브러시 색상은 작업 편의를 위한 시각적 요소입니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer Status */}
            <div className="mt-6 flex items-center gap-6 text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-widest">
              <span>Ready for Processing</span>
              <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
              <span>Hardware Acceleration Enabled</span>
              <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
              <span>Gemini 3.1 Advanced Arch-Inpainter</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PreviewCanvas;
