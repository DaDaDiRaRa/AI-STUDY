import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { GoogleGenAI } from "@google/genai";
import { 
  Loader2, 
  RefreshCw,
  Building2,
  Key,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Tooltip } from './components/Tooltip';
import { ImageUploadNodes } from './components/ImageUploadNodes';
import { SettingsPanel } from './components/SettingsPanel';
import { PromptPanel } from './components/PromptPanel';
import { PreviewCanvas } from './components/PreviewCanvas';

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
            <ImageUploadNodes
              controlNetImg={controlNetImg}
              getRootCN={getRootCN}
              getInputCN={getInputCN}
              isDragCN={isDragCN}
              clearControlNet={clearControlNet}
              ipAdapterImg={ipAdapterImg}
              getRootIP={getRootIP}
              getInputIP={getInputIP}
              isDragIP={isDragIP}
              clearIPAdapter={clearIPAdapter}
              ipAdapterStrength={ipAdapterStrength}
              setIpAdapterStrength={setIpAdapterStrength}
              florenceImg={florenceImg}
              getRootFL={getRootFL}
              getInputFL={getInputFL}
              isDragFL={isDragFL}
              clearFlorence={clearFlorence}
              florenceStrength={florenceStrength}
              setFlorenceStrength={setFlorenceStrength}
            />

            <SettingsPanel
              selectedModes={selectedModes}
              toggleMode={toggleMode}
              temperature={temperature}
              setTemperature={setTemperature}
              seedMode={seedMode}
              setSeedMode={setSeedMode}
              seedValue={seedValue}
              setSeedValue={setSeedValue}
              lastUsedSeed={lastUsedSeed}
            />

            <PromptPanel
              positivePrompt={positivePrompt}
              setPositivePrompt={setPositivePrompt}
              negativePrompt={negativePrompt}
              setNegativePrompt={setNegativePrompt}
              originalPositivePrompt={originalPositivePrompt}
              setOriginalPositivePrompt={setOriginalPositivePrompt}
              originalNegativePrompt={originalNegativePrompt}
              setOriginalNegativePrompt={setOriginalNegativePrompt}
              showComparison={showComparison}
              setShowComparison={setShowComparison}
              showNegativeComparison={showNegativeComparison}
              setShowNegativeComparison={setShowNegativeComparison}
              handleImprovePrompt={handleImprovePrompt}
              handleImproveNegativePrompt={handleImproveNegativePrompt}
              isImproving={isImproving}
              isImprovingNegative={isImprovingNegative}
              stylePresets={STYLE_PRESETS}
            />

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

          <PreviewCanvas
            resultImage={resultImage}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            setShowComparison={setShowComparison}
            history={history}
            handleUndo={handleUndo}
            handleDownload={handleDownload}
            editPrompt={editPrompt}
            setEditPrompt={setEditPrompt}
            editPromptRef={editPromptRef}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            brushColor={brushColor}
            setBrushColor={setBrushColor}
            clearMask={clearMask}
            applyInpainting={applyInpainting}
            isApplyingEdit={isApplyingEdit}
            handleUpscale={handleUpscale}
            isUpscaling={isUpscaling}
            upscaleTarget={upscaleTarget}
            canvasRef={canvasRef}
            canvasSize={canvasSize}
            startDrawing={startDrawing}
            draw={draw}
            stopDrawing={stopDrawing}
            controlNetImg={controlNetImg}
            comparisonValue={comparisonValue}
            setComparisonValue={setComparisonValue}
            isGenerating={isGenerating}
          />
        </div>
      </main>
    </div>
  );
}
