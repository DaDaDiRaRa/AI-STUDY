import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Loader2, 
  Download,
  RefreshCw,
  Building2,
  Info,
  Layers,
  Palette,
  ScanText,
  Key,
  Dices,
  Settings2,
  Pencil,
  Eraser,
  Check,
  X,
  Maximize2,
  Undo2,
  RotateCcw,
  Shield,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Types
interface ImageFile {
  file: File;
  preview: string;
  base64: string;
  width?: number;
  height?: number;
}

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl pointer-events-none"
          >
            <p className="text-[11px] leading-relaxed text-zinc-300 font-medium">{text}</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-zinc-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const STYLE_PRESETS = [
  {
    id: 'sunny',
    name: 'Sunny Day',
    icon: '☀️',
    positive: '(Masterpiece:1.3), (photorealistic:1.4), best quality, high quality, Ultra-detailed, 8k resolution, architecture photography, bright sunny day, clear blue sky, sharp shadows, vibrant colors, realistic materials, concrete, glass, wood, lush green landscaping.',
    negative: '(worst quality:1.4), (low quality:1.4), monochrome, flat lighting, overcast, rain, night, fog, distorted architecture, blurry, low resolution.'
  },
  {
    id: 'night',
    name: 'Night Cinematic',
    icon: '🌙',
    positive: '(Masterpiece:1.3), (photorealistic:1.4), best quality, high quality, Ultra-detailed, 8k resolution, architecture photography, cinematic night lighting, warm interior glow, cool exterior moonlight, long exposure, reflective surfaces, windows glowing, deep shadows, atmospheric.',
    negative: '(worst quality:1.4), (low quality:1.4), daylight, sun, bright sky, flat lighting, overexposed, low contrast, noisy, grainy.'
  },
  {
    id: 'perspective',
    name: 'Eye-Level',
    icon: '🚶',
    positive: '(Masterpiece:1.3), (photorealistic:1.4), Professional architectural exterior photography, eye-level perspective, human scale, street level view, corrected vertical lines, highly detailed facade, realistic street-side vegetation, 35mm lens, high dynamic range.',
    negative: '(worst quality:1.4), (low quality:1.4), bird view, high angle, looking down, interior, distorted lines, low-resolution, blurry trees, unrealistic shadows.'
  },
  {
    id: 'birdseye',
    name: 'Birds-Eye',
    icon: '🦅',
    positive: '(Masterpiece:1.3), (photorealistic:1.4), High-angle aerial photography, bird’s-eye view, architectural masterplan perspective, expansive site context, looking down at the building, miniature effect, realistic surrounding urban fabric and lush landscaping, volumetric lighting.',
    negative: '(worst quality:1.4), (low quality:1.4), eye level, street view, interior, low angle view, looking up, distorted perspective, blurry background, dark lighting.'
  }
];

// --- Global Config & Helpers ---
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: API_KEY });

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('site_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [controlNetImg, setControlNetImg] = useState<ImageFile | null>(null);
  const [ipAdapterImg, setIpAdapterImg] = useState<ImageFile | null>(null);
  const [florenceImg, setFlorenceImg] = useState<ImageFile | null>(null);
  
  const [positivePrompt, setPositivePrompt] = useState<string>('');
  const [originalPositivePrompt, setOriginalPositivePrompt] = useState<string | null>(null);
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  
  const [selectedModes, setSelectedModes] = useState<string[]>(['depth']);
  const [seedMode, setSeedMode] = useState<'random' | 'fixed'>('random');
  const [seedValue, setSeedValue] = useState<number>(42);
  const [lastUsedSeed, setLastUsedSeed] = useState<number | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [isImprovingNegative, setIsImprovingNegative] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleTarget, setUpscaleTarget] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(30);
  const [brushColor, setBrushColor] = useState('rgba(57, 255, 20, 0.4)'); // Default Neon Green (40% Opacity)
  const [editPrompt, setEditPrompt] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showNegativeComparison, setShowNegativeComparison] = useState(false);
  const [comparisonValue, setComparisonValue] = useState(50);
  const [temperature, setTemperature] = useState(0.7);
  const [ipAdapterStrength, setIpAdapterStrength] = useState(0.8);
  const [florenceStrength, setFlorenceStrength] = useState(0.8);
  const [canvasSize, setCanvasSize] = useState({ width: 1024, height: 1024 });
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [originalNegativePrompt, setOriginalNegativePrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editPromptRef = useRef<HTMLTextAreaElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (isEditing && editPromptRef.current) {
      editPromptRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has);
      } else {
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '9698') {
      setIsAuthenticated(true);
      sessionStorage.setItem('site_auth', 'true');
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
      setPasswordInput('');
    }
  };

  const toggleMode = (mode: string) => {
    setSelectedModes(prev => 
      prev.includes(mode) 
        ? prev.filter(m => m !== mode) 
        : [...prev, mode]
    );
  };

  const handleImprovePrompt = async () => {
    if (!positivePrompt.trim() || isImproving) return;
    
    setIsImproving(true);
    setError(null);
    if (!originalPositivePrompt) {
      setOriginalPositivePrompt(positivePrompt);
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a professional Architectural Photographer and Prompt Engineer. 
        Your task is to translate (if Korean) and enrich the following architectural prompt into a high-end, professional English prompt.
        
        [Guidelines]:
        1. Preserve the core architectural building form as the centerpiece.
        2. Enrich the scene with realistic atmospheric details: cinematic sky (sunset, overcast, etc.), realistic vegetation (lush trees, grass), high-quality designer furniture, and subtle people for scale.
        3. Use professional photography terms (e.g., "corrected verticals", "soft global illumination", "high dynamic range").
        4. Ensure the output is a single, cohesive, ultra-detailed prompt block.
        5. Do NOT include any conversational text, only the prompt.
        
        [Input Prompt]:
        ${positivePrompt}`,
      });

      const improved = response.text?.trim();
      if (improved) {
        setPositivePrompt(improved);
        setShowComparison(true);
      }
    } catch (err: any) {
      console.error("Improvement error:", err);
      setError("Failed to improve prompt. Please check your connection.");
    } finally {
      setIsImproving(false);
    }
  };

  const handleImproveNegativePrompt = async () => {
    if (!negativePrompt.trim() || isImprovingNegative) return;
    
    setIsImprovingNegative(true);
    setError(null);
    if (!originalNegativePrompt) {
      setOriginalNegativePrompt(negativePrompt);
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a professional Architectural Quality Inspector. Expand the user's negative prompt into a comprehensive list of technical rendering artifacts to avoid. 
        - Focus on: distorted perspectives, non-physical lighting, unrealistic material tiling, overexposed highlights, blurry distant buildings, and warped geometry.
        - Translate Korean to English if necessary.
        - Output only the improved negative prompt string.
        
        [Input Negative Prompt]:
        ${negativePrompt}`,
      });

      const improved = response.text?.trim();
      if (improved) {
        setNegativePrompt(improved);
        setShowNegativeComparison(true);
      }
    } catch (err: any) {
      console.error("Negative improvement error:", err);
      setError("Failed to improve negative prompt. Please check your connection.");
    } finally {
      setIsImprovingNegative(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const getClosestAspectRatio = (width: number, height: number): string => {
    const ratio = width / height;
    const targets = [
      { label: "1:1", value: 1 },
      { label: "4:3", value: 4/3 },
      { label: "3:4", value: 3/4 },
      { label: "16:9", value: 16/9 },
      { label: "9:16", value: 9/16 },
      { label: "3:2", value: 3/2 },
      { label: "2:3", value: 2/3 }
    ];
    
    return targets.reduce((prev, curr) => 
      Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev
    ).label;
  };

  const createDropHandler = (setter: React.Dispatch<React.SetStateAction<ImageFile | null>>) => 
    useCallback(async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        const base64 = await fileToBase64(file);
        const dimensions = await getImageDimensions(file);
        setter({ file, preview: URL.createObjectURL(file), base64, ...dimensions });
        
        // Sync canvas ratio with ControlNet (Structure) image
        if (setter === setControlNetImg) {
          const ratio = dimensions.width / dimensions.height;
          setCanvasSize({
            width: 1024,
            height: 1024 / ratio
          });
        }
      }
    }, []);

  const { getRootProps: getRootCN, getInputProps: getInputCN, isDragActive: isDragCN } = useDropzone({ onDrop: createDropHandler(setControlNetImg), accept: { 'image/*': [] }, multiple: false } as any);
  const { getRootProps: getRootIP, getInputProps: getInputIP, isDragActive: isDragIP } = useDropzone({ onDrop: createDropHandler(setIpAdapterImg), accept: { 'image/*': [] }, multiple: false } as any);
  const { getRootProps: getRootFL, getInputProps: getInputFL, isDragActive: isDragFL } = useDropzone({ onDrop: createDropHandler(setFlorenceImg), accept: { 'image/*': [] }, multiple: false } as any);

  const clearControlNet = () => setControlNetImg(null);
  const clearIPAdapter = () => setIpAdapterImg(null);
  const clearFlorence = () => setFlorenceImg(null);

  const generateRendering = async () => {
    if (!controlNetImg) return setError("Please upload the Structure image.");
    setIsGenerating(true);
    setError(null);

    try {
      const currentSeed = seedMode === 'fixed' ? seedValue : Math.floor(Math.random() * 2147483647);
      if (seedMode === 'random') setLastUsedSeed(currentSeed);

      const aspectRatio = getClosestAspectRatio(controlNetImg.width || 1, controlNetImg.height || 1);

      const getStrengthText = (strength: number, type: 'style' | 'context') => {
        if (strength <= 0.2) return `Subtly reference the ${type === 'style' ? 'materials/colors' : 'environment/context'} of this image (Very low influence).`;
        if (strength <= 0.4) return `Lightly apply the ${type === 'style' ? 'materials/colors' : 'environment/context'} of this image (Low influence).`;
        if (strength <= 0.7) return `Apply the ${type === 'style' ? 'materials, lighting, and aesthetic vibe' : 'environment and context'} from this reference (Moderate influence).`;
        if (strength <= 0.9) return `Strongly apply the ${type === 'style' ? 'materials, lighting, and aesthetic vibe' : 'environment and context'} from this reference (High influence).`;
        return `Strictly and heavily apply every ${type === 'style' ? 'material and color detail' : 'environmental and contextual detail'} from this image (Maximum influence).`;
      };

      // NODE-based pipeline construction
      const parts: any[] = [
        { text: "Architectural Rendering Engine Mode. High-fidelity output required. Force perfect vertical lines alignment, tilt-shift lens effect, and high-end PBR material rendering." },
        { text: "NODE 1 [Structure]: Strictly preserve all architectural structural lines from the base image. Do not warp windows or columns." },
        { inlineData: { data: controlNetImg.base64, mimeType: controlNetImg.file.type } },
        ipAdapterImg && { text: `NODE 2 [Style]: ${getStrengthText(ipAdapterStrength, 'style')}` },
        ipAdapterImg && { inlineData: { data: ipAdapterImg.base64, mimeType: ipAdapterImg.file.type } },
        florenceImg && { text: `NODE 3 [Context]: ${getStrengthText(florenceStrength, 'context')} Prioritize photorealistic vegetation and realistic atmospheric sky.` },
        florenceImg && { inlineData: { data: florenceImg.base64, mimeType: florenceImg.file.type } },
        { text: `POSITIVE: ${positivePrompt} --mode ${selectedModes.join(' ')}\nNEGATIVE: ${negativePrompt}` }
      ].filter(Boolean);

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
        config: {
          seed: currentSeed,
          temperature: temperature,
          imageConfig: {
            aspectRatio: aspectRatio as any,
            // Enable 2K for high-res inputs
            imageSize: (controlNetImg.width && controlNetImg.width > 1200) ? "2K" : "1K"
          }
        }
      } as any);

      const generatedImgPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
      if (generatedImgPart) {
        const url = `data:${generatedImgPart.mimeType};base64,${generatedImgPart.data}`;
        setResultImage(url);
      } else {
        throw new Error("No image was generated. Please try again.");
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      const errMsg = err.message || "An error occurred during generation.";
      setError(errMsg);
      if (errMsg.includes("Requested entity was not found.") || errMsg.includes("PERMISSION_DENIED")) {
        setHasKey(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'architectural-rendering.png';
    link.click();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
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

  const clearMask = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const applyInpainting = async () => {
    if (!resultImage || !canvasRef.current) return;
    setIsApplyingEdit(true);
    setError(null);
    
    try {
      // Extract mask from canvas (matching current canvas size)
      const maskBase64 = canvasRef.current.toDataURL('image/png').split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            { inlineData: { data: resultImage.split(',')[1], mimeType: 'image/png' } },
            { inlineData: { data: maskBase64, mimeType: 'image/png' } },
            { text: editPrompt || "Refine materials and lighting in the masked area." }
          ]
        },
        config: {
          editMode: 'inpainting-modify',
          seed: seedMode === 'fixed' ? seedValue : 42
        } as any
      });

      const editedImgPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
      if (editedImgPart) {
        setHistory(prev => [...prev, resultImage]);
        const url = `data:${editedImgPart.mimeType};base64,${editedImgPart.data}`;
        setResultImage(url);
        setIsEditing(false);
        clearMask();
      } else {
        throw new Error("No image was generated. Please try again.");
      }
    } catch (err: any) {
      console.error("Inpainting error:", err);
      setError(err.message || "Failed to apply edit.");
    } finally {
      setIsApplyingEdit(false);
    }
  };

  const handleUpscale = async (resolution: string) => {
    if (!resultImage || isUpscaling) return;
    
    setIsUpscaling(true);
    setUpscaleTarget(resolution);
    setError(null);

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
            imageSize: resolution as any // "1K", "2K", "4K"
          }
        }
      });

      let upscaledImg = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          upscaledImg = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (upscaledImg) {
        if (resultImage) {
          setHistory(prev => [...prev, resultImage]);
        }
        setResultImage(upscaledImg);
      } else {
        throw new Error("Upscaling failed. Please try again.");
      }
    } catch (err: any) {
      console.error("Upscale error:", err);
      setError(err.message || "Failed to upscale image.");
    } finally {
      setIsUpscaling(false);
      setUpscaleTarget(null);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const previousImage = newHistory.pop();
    if (previousImage) {
      setResultImage(previousImage);
      setHistory(newHistory);
    }
  };

  const reset = () => {
    setControlNetImg(null);
    setIpAdapterImg(null);
    setFlorenceImg(null);
    setResultImage(null);
    setHistory([]);
    setTemperature(0.7);
    setError(null);
    setLastUsedSeed(null);
    setOriginalPositivePrompt(null);
    setOriginalNegativePrompt(null);
    setShowComparison(false);
    setShowNegativeComparison(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">Access Restricted</h1>
            <p className="text-zinc-400 text-sm mt-2 text-center">Please enter the password to access the Architectural Rendering Engine.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center tracking-widest"
                autoFocus
              />
            </div>
            {passwordError && (
              <p className="text-red-400 text-sm text-center">{passwordError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (hasKey === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-indigo-500" />
          </div>
          <h1 className="text-2xl font-semibold mb-4">API Key Required</h1>
          <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
            This application uses the advanced <code>gemini-3.1-flash-image-preview</code> model, which requires a paid Google Cloud project API key.
            <br/><br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">Learn more about billing</a>
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-zinc-700 selection:text-white pb-20">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-100 rounded flex items-center justify-center">
              <Building2 className="w-5 h-5 text-zinc-900" />
            </div>
            <h1 className="text-[22px] font-[Arial] font-semibold tracking-tight">Kunwon AI <span className="text-xs text-zinc-500 font-mono ml-2 border border-zinc-800 px-2 py-0.5 rounded">for exterior image</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={reset}
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Nodes
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Left Column: Inputs & Nodes */}
          <div className="lg:col-span-7 space-y-6">
            {/* Node Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ControlNet Node */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 flex flex-col">
                <div className="flex items-center gap-2 mb-3 text-zinc-300">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium">ControlNet (Structure)</h3>
                  <Tooltip text="건물의 뼈대를 결정합니다. 화이트 모델, 스케치, 혹은 도면 이미지를 넣어주세요. 구조는 그대로 유지됩니다.">
                    <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <div 
                  {...getRootCN()} 
                  className={`relative flex-1 aspect-square rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${isDragCN ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
                >
                  <input {...getInputCN()} />
                  {controlNetImg ? (
                    <>
                      <img src={controlNetImg.preview} alt="ControlNet" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <AnimatePresence>
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearControlNet();
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors z-10"
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      </AnimatePresence>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
                      <Upload className="w-6 h-6" />
                      <p className="text-xs">Clay Model / Base</p>
                    </div>
                  )}
                </div>
              </div>

              {/* IPAdapter Node */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 flex flex-col">
                <div className="flex items-center gap-2 mb-3 text-zinc-300">
                  <Palette className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-medium">IPAdapter (Style)</h3>
                  <Tooltip text="원하는 색감이나 재질이 담긴 이미지를 넣으세요. 건물에 그 느낌(재질, 빛)만 입혀줍니다.">
                    <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <div 
                  {...getRootIP()} 
                  className={`relative flex-1 aspect-square rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${isDragIP ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
                >
                  <input {...getInputIP()} />
                  {ipAdapterImg ? (
                    <>
                      <img src={ipAdapterImg.preview} alt="IPAdapter" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <AnimatePresence>
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearIPAdapter();
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors z-10"
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      </AnimatePresence>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
                      <Upload className="w-6 h-6" />
                      <p className="text-xs">Style Reference</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${ipAdapterImg ? 'text-zinc-500' : 'text-zinc-700'}`}>
                      Style Strength
                      <Tooltip text="레퍼런스 이미지의 영향력을 조절합니다. 0에 가까우면 무시하고, 1에 가까우면 사진을 그대로 따릅니다.">
                        <Info className="w-3 h-3 cursor-help" />
                      </Tooltip>
                    </label>
                    <span className={`text-[10px] font-mono font-bold ${ipAdapterImg ? 'text-purple-400' : 'text-zinc-700'}`}>{ipAdapterStrength.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={ipAdapterStrength}
                    onChange={(e) => setIpAdapterStrength(parseFloat(e.target.value))}
                    disabled={!ipAdapterImg}
                    className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-500 ${ipAdapterImg ? 'bg-zinc-800' : 'bg-zinc-900'}`}
                  />
                </div>
              </div>

              {/* Florence Node */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 flex flex-col">
                <div className="flex items-center gap-2 mb-3 text-zinc-300">
                  <ScanText className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-medium">Florence (Context)</h3>
                  <Tooltip text="주변 배경이나 분위기를 결정합니다. 숲, 도시, 하늘 등 환경 정보가 담긴 이미지를 활용하세요.">
                    <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <div 
                  {...getRootFL()} 
                  className={`relative flex-1 aspect-square rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${isDragFL ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
                >
                  <input {...getInputFL()} />
                  {florenceImg ? (
                    <>
                      <img src={florenceImg.preview} alt="Florence" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <AnimatePresence>
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearFlorence();
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors z-10"
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      </AnimatePresence>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
                      <Upload className="w-6 h-6" />
                      <p className="text-xs">Context Image</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${florenceImg ? 'text-zinc-500' : 'text-zinc-700'}`}>
                      Context Strength
                      <Tooltip text="레퍼런스 이미지의 영향력을 조절합니다. 0에 가까우면 무시하고, 1에 가까우면 사진을 그대로 따릅니다.">
                        <Info className="w-3 h-3 cursor-help" />
                      </Tooltip>
                    </label>
                    <span className={`text-[10px] font-mono font-bold ${florenceImg ? 'text-amber-400' : 'text-zinc-700'}`}>{florenceStrength.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={florenceStrength}
                    onChange={(e) => setFlorenceStrength(parseFloat(e.target.value))}
                    disabled={!florenceImg}
                    className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 ${florenceImg ? 'bg-zinc-800' : 'bg-zinc-900'}`}
                  />
                </div>
              </div>
            </div>

            {/* Generation Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Multi-Control Mode Selector */}
              <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-medium text-zinc-300 font-mono uppercase tracking-wider">Multi-Control Mode</h2>
                  <Tooltip text="AI가 구조를 해석하는 방식입니다. Depth는 입체감을, Lineart는 선을 위주로 봅니다. 보통 2개 이상 섞으면 정확도가 높습니다.">
                    <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'depth', label: 'Depth', color: 'blue' },
                    { id: 'lineart', label: 'Lineart', color: 'purple' },
                    { id: 'segmentation', label: 'Segmentation', color: 'amber' },
                    { id: 'canny', label: 'Canny', color: 'red' }
                  ].map((mode) => {
                    const isActive = selectedModes.includes(mode.id);
                    const colorClasses = {
                      blue: isActive ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-400',
                      purple: isActive ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-400',
                      amber: isActive ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-400',
                      red: isActive ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-400'
                    }[mode.color as 'blue' | 'purple' | 'amber' | 'red'];

                    return (
                      <button
                        key={mode.id}
                        onClick={() => toggleMode(mode.id)}
                        className={`py-2 px-3 text-[10px] font-bold uppercase tracking-tighter rounded-lg border transition-all flex items-center justify-center gap-2 ${colorClasses}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? {
                          blue: 'bg-blue-400',
                          purple: 'bg-purple-400',
                          amber: 'bg-amber-400',
                          red: 'bg-red-400'
                        }[mode.color as 'blue' | 'purple' | 'amber' | 'red'] : 'bg-zinc-800'}`} />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Imagination Level (Temperature) */}
              <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-medium text-zinc-300 font-mono uppercase tracking-wider">Imagination Level</h2>
                  <Tooltip text="AI가 얼마나 창의적으로 그릴지 결정합니다. 낮으면 원본에 충실하고, 높으면 배경과 조명이 화려해집니다.">
                    <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <div className="space-y-4">
                  <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    {[
                      { label: 'Conservative', val: 0.2 },
                      { label: 'Balanced', val: 0.7 },
                      { label: 'Creative', val: 1.2 }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setTemperature(preset.val)}
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${temperature === preset.val ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Temperature</label>
                      <span className="text-[10px] font-mono text-indigo-400 font-bold">{temperature.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <p className="text-[9px] text-zinc-500 font-medium italic px-1 flex items-center gap-1">
                      <Info className="w-2.5 h-2.5" />
                      Lower for precision, higher for creative surroundings.
                    </p>
                  </div>
                </div>
              </section>

              {/* Seed Control */}
              <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Dices className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-medium text-zinc-300 font-mono uppercase tracking-wider">Seed Control</h2>
                  <Tooltip text="이미지의 '고유 번호'입니다. 랜덤은 매번 새롭게, 고정(Fixed)은 마음에 드는 구도를 유지하며 수정할 때 씁니다.">
                    <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <div className="space-y-4">
                  <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => setSeedMode('random')}
                      className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${seedMode === 'random' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Random
                    </button>
                    <button
                      onClick={() => setSeedMode('fixed')}
                      className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${seedMode === 'fixed' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Fixed
                    </button>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Active Seed</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={seedMode === 'fixed' ? seedValue : (lastUsedSeed ?? '')}
                        disabled={seedMode === 'random'}
                        onChange={(e) => setSeedValue(parseInt(e.target.value) || 0)}
                        className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-mono transition-all focus:outline-none ${
                          seedMode === 'random' 
                            ? 'text-zinc-500 cursor-not-allowed opacity-60' 
                            : 'text-zinc-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20'
                        }`}
                        placeholder={seedMode === 'random' ? "Generating randomly..." : "Enter fixed seed..."}
                      />
                      {seedMode === 'random' && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <RefreshCw className="w-3 h-3 text-zinc-600 animate-spin-slow" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Prompts */}
            <div className="space-y-4">
              {/* Style Presets */}
              <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-sm font-medium text-zinc-300 font-mono uppercase tracking-wider">Quick Styles</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setPositivePrompt(preset.positive);
                        setNegativePrompt(preset.negative);
                        setOriginalPositivePrompt(null);
                        setOriginalNegativePrompt(null);
                        setShowComparison(false);
                        setShowNegativeComparison(false);
                      }}
                      className="flex flex-col items-center justify-center gap-1.5 p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">{preset.icon}</span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight group-hover:text-indigo-300">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <h2 className="text-sm font-medium text-emerald-400 font-mono uppercase tracking-wider">Positive Prompt (CLIP Text Encode)</h2>
                    <Tooltip text="나오길 원하는 것을 적으세요 (예: 푸른 하늘, 대리석 벽). 빈칸으로 두면 AI가 이미지를 분석해 알아서 그립니다.">
                      <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    {originalPositivePrompt && (
                      <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 mr-2">
                        <button
                          onClick={() => setShowComparison(false)}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${!showComparison ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
                        >
                          Original
                        </button>
                        <button
                          onClick={() => setShowComparison(true)}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${showComparison ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
                        >
                          Improved
                        </button>
                      </div>
                    )}
                    <button
                      onClick={handleImprovePrompt}
                      disabled={isImproving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isImproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Improve
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    value={showComparison && originalPositivePrompt ? positivePrompt : (originalPositivePrompt || positivePrompt)}
                    onChange={(e) => {
                      if (showComparison && originalPositivePrompt) {
                        setPositivePrompt(e.target.value);
                      } else if (originalPositivePrompt) {
                        setOriginalPositivePrompt(e.target.value);
                      } else {
                        setPositivePrompt(e.target.value);
                      }
                    }}
                    className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                    placeholder="Optional: Type here or leave blank for Auto-Pilot rendering..."
                  />
                  {showComparison && originalPositivePrompt && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/30 backdrop-blur-sm">
                      AI ENHANCED
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <h2 className="text-sm font-medium text-red-400 font-mono uppercase tracking-wider">Negative Prompt (CLIP Text Encode)</h2>
                    <Tooltip text="나오지 않기를 원하는 것을 적으세요 (예: 왜곡된 선, 사람, 자동차). Enhance 버튼을 눌러 품질을 높이세요.">
                      <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    {originalNegativePrompt && (
                      <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 mr-2">
                        <button
                          onClick={() => setShowNegativeComparison(false)}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${!showNegativeComparison ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
                        >
                          Original
                        </button>
                        <button
                          onClick={() => setShowNegativeComparison(true)}
                          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${showNegativeComparison ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
                        >
                          Improved
                        </button>
                      </div>
                    )}
                    <button
                      onClick={handleImproveNegativePrompt}
                      disabled={isImprovingNegative || !negativePrompt.trim()}
                      className={`
                        flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                        ${isImprovingNegative 
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40'}
                      `}
                    >
                      {isImprovingNegative ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Refining...
                        </>
                      ) : (
                        <>
                          <Shield className="w-3 h-3" />
                          Improve
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <textarea
                  value={showNegativeComparison && originalNegativePrompt ? negativePrompt : (originalNegativePrompt || negativePrompt)}
                  onChange={(e) => {
                    if (showNegativeComparison && originalNegativePrompt) {
                      setNegativePrompt(e.target.value);
                    } else if (originalNegativePrompt) {
                      setOriginalNegativePrompt(e.target.value);
                    } else {
                      setNegativePrompt(e.target.value);
                    }
                  }}
                  className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                />
                {showNegativeComparison && originalNegativePrompt && (
                  <div className="mt-2 flex items-center gap-1.5 text-[9px] text-red-400/70 font-medium italic">
                    <Info className="w-2.5 h-2.5" />
                    Viewing improved negative prompt. Switch to 'Original' to edit base keywords.
                  </div>
                )}
              </section>
            </div>

            <button
              onClick={generateRendering}
              disabled={!controlNetImg || isGenerating}
              className={`
                w-full py-4 rounded-xl font-bold tracking-wide uppercase text-sm flex items-center justify-center gap-2 transition-all
                ${!controlNetImg || isGenerating 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.99] shadow-lg shadow-indigo-500/20'}
              `}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing KSampler...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Queue Prompt
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Right Column: Result (Preview Image Node) */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-24">
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
                            setIsEditing(!isEditing);
                            if (!isEditing) setShowComparison(false);
                          }}
                          className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase border ${
                            isEditing 
                              ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' 
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100'
                          }`}
                          title="Edit Image (Inpainting)"
                        >
                          <Pencil className="w-3 h-3" />
                          {isEditing ? 'Exit Edit' : 'Edit'}
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

                {isEditing && (
                  <div className="mb-4 space-y-3">
                    <div className="p-4 bg-zinc-950 border border-indigo-500/30 rounded-xl shadow-lg shadow-indigo-500/5">
                      <div className="flex items-center gap-2 mb-2">
                        <ScanText className="w-3 h-3 text-indigo-400" />
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Edit Instruction (What to change in the masked area?)</label>
                      </div>
                      <textarea
                        ref={editPromptRef}
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="Example: 'Change to a wooden door', 'Add a balcony', 'Change material to brick'..."
                        className="w-full h-20 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
                      />
                    </div>

                    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Brush Size</span>
                        <input 
                          type="range" 
                          min="5" 
                          max="100" 
                          value={brushSize} 
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="flex-1 accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-zinc-400 w-6">{brushSize}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Highlight</span>
                        <div className="flex gap-1.5">
                          {[
                            { color: 'rgba(57, 255, 20, 0.4)', label: 'Green' },
                            { color: 'rgba(255, 20, 147, 0.4)', label: 'Pink' },
                            { color: 'rgba(0, 255, 255, 0.4)', label: 'Cyan' },
                            { color: 'rgba(255, 69, 0, 0.4)', label: 'Orange' }
                          ].map((c) => (
                            <button
                              key={c.color}
                              onClick={() => setBrushColor(c.color)}
                              className={`w-5 h-5 rounded-full border-2 transition-all ${brushColor === c.color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                              style={{ backgroundColor: c.color.replace('0.4', '1') }}
                              title={c.label}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={clearMask}
                          className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
                          title="Clear All"
                        >
                          <Eraser className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={applyInpainting}
                          disabled={isApplyingEdit}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                          {isApplyingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Apply Edit
                        </button>
                      </div>
                    </div>
                    <p className="text-[9px] text-zinc-500 font-medium italic px-1">
                      * The brush color is for your reference only; it will not affect the final image colors.
                    </p>
                  </div>
                )}

                {resultImage && !isEditing && (
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
                      <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest animate-pulse">Enhancing to {upscaleTarget}...</p>
                      </div>
                    )}
                    {resultImage ? (
                      <div className="relative w-full h-full overflow-hidden">
                        {isEditing ? (
                          <div className="relative w-full h-full flex items-center justify-center bg-black/20">
                            <img
                              src={resultImage}
                              alt="To Edit"
                              className="max-w-full max-h-full object-contain pointer-events-none"
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
                        ) : (
                          <div className="relative w-full h-full overflow-hidden cursor-ew-resize flex items-center justify-center">
                            <div className="relative w-full h-full">
                              {/* Before (ControlNet Image) */}
                              <img
                                src={controlNetImg?.preview}
                                alt="Before"
                                className="absolute inset-0 w-full h-full object-contain opacity-50 grayscale"
                                referrerPolicy="no-referrer"
                              />
                              
                              {/* After (Result Image) */}
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

                              {/* Slider Handle */}
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

                            {/* Labels */}
                            <div className="absolute bottom-4 left-4 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-widest border border-white/10 pointer-events-none z-30">
                              Structure
                            </div>
                            <div className="absolute bottom-4 right-4 px-2 py-1 bg-indigo-500/50 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-widest border border-indigo-500/30 pointer-events-none z-30">
                              Render
                            </div>

                            {/* Invisible Input for Slider Control */}
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={comparisonValue}
                              onChange={(e) => setComparisonValue(parseInt(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-40"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <motion.div
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
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
          </div>
        </div>
      </main>
    </div>
  );
}
