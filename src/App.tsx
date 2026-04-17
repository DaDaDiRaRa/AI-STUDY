import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Loader2, Shield } from 'lucide-react';
import ImageUploadNodes from './components/ImageUploadNodes';
import SettingsPanel from './components/SettingsPanel';
import PromptPanel from './components/PromptPanel';
import PreviewCanvas from './components/PreviewCanvas';
import { QuickStyles, StylePreset } from './components/QuickStyles';

// --- Global Config ---
const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenAI({ apiKey: API_KEY });

// --- 브라우저 내부: 이미지 자동 추출기 (Lineart / Depth) ---
const processImageInBrowser = async (base64Img: string, mode: 'lineart' | 'depth'): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Img);
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      if (mode === 'lineart') {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          const avg = (r + g + b) / 3;
          const color = avg < 150 ? 0 : 255;
          data[i] = data[i+1] = data[i+2] = color;
        }
      } else if (mode === 'depth') {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          const avg = (r + g + b) / 3;
          data[i] = data[i+1] = data[i+2] = avg;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      if (mode === 'depth') {
        ctx.globalAlpha = 0.5;
        for(let j = -2; j <= 2; j+=2) {
            ctx.drawImage(canvas, j, j);
        }
      }
      
      resolve(canvas.toDataURL('image/jpeg').split(',')[1]);
    };
    img.src = `data:image/jpeg;base64,${base64Img}`;
  });
};

// --- 브라우저 내부: 무왜곡 패딩(아웃페인팅) 리사이즈 함수 ---
const padImageToBase64 = async (base64Img: string, targetRatioStr: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const [wRatio, hRatio] = targetRatioStr.split(':').map(Number);
      const targetRatio = wRatio / hRatio;
      const currentRatio = img.width / img.height;

      let targetWidth = img.width;
      let targetHeight = img.height;

      if (Math.abs(targetRatio - currentRatio) < 0.01) {
        return resolve(base64Img);
      }

      if (currentRatio > targetRatio) {
        targetHeight = targetWidth / targetRatio;
      } else {
        targetWidth = targetHeight * targetRatio;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Img);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const dx = (targetWidth - img.width) / 2;
      const dy = (targetHeight - img.height) / 2;
      ctx.drawImage(img, dx, dy);

      resolve(canvas.toDataURL('image/jpeg').split(',')[1]);
    };
    img.onerror = reject;
    img.src = `data:image/jpeg;base64,${base64Img}`;
  });
};

const getClosestAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;
  const targets = [
    { label: "1:1", value: 1 },
    { label: "4:3", value: 4/3 },
    { label: "3:4", value: 3/4 },
    { label: "16:9", value: 16/9 },
    { label: "9:16", value: 9/16 }
  ];
  return targets.reduce((prev, curr) => 
    Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev
  ).label;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('site_auth') === 'true');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [controlNetImg, setControlNetImg] = useState<any>(null);
  const [ipAdapterImg, setIpAdapterImg] = useState<any>(null);
  const [florenceImg, setFlorenceImg] = useState<any>(null);
  
  const [positivePrompt, setPositivePrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  
  // UI에서 모드 선택이 사라졌으므로 상태값 삭제, 대신 백엔드에서 강제 고정
  const [seedMode, setSeedMode] = useState<'random' | 'fixed'>('random');
  const [seedValue, setSeedValue] = useState(42);
  const [temperature, setTemperature] = useState(0.7);
  
  const [ipAdapterStrength, setIpAdapterStrength] = useState(0.8);
  const [florenceStrength, setFlorenceStrength] = useState(0.8);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '0908') {
      setIsAuthenticated(true);
      sessionStorage.setItem('site_auth', 'true');
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
      setPasswordInput('');
    }
  };

  const getStrengthText = (strength: number, type: 'style' | 'context') => {
    if (strength <= 0.3) return `Low influence.`;
    if (strength <= 0.7) return `Moderate influence.`;
    return `Strictly apply (Maximum influence).`;
  };

  const generateRendering = async () => {
    if (!controlNetImg) return setError("Please upload the Structure image.");
    
    // Check for API key if using preview models
    if (!hasApiKey && (window as any).aistudio) {
      setError("Please select an API key to use high-quality rendering.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Re-initialize for fresh key
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const currentSeed = seedMode === 'fixed' ? seedValue : Math.floor(Math.random() * 2147483647);
      const aspectRatio = getClosestAspectRatio(controlNetImg.width || 1, controlNetImg.height || 1);
      const paddedBaseImage = await padImageToBase64(controlNetImg.base64, aspectRatio);
      
      const isLineartEnabled = true;
      const isDepthEnabled = true;
      
      let lineartBase64 = null;
      let depthBase64 = null;

      const extractionTasks = [];
      if (isLineartEnabled) extractionTasks.push(processImageInBrowser(paddedBaseImage, 'lineart').then(res => lineartBase64 = res));
      if (isDepthEnabled) extractionTasks.push(processImageInBrowser(paddedBaseImage, 'depth').then(res => depthBase64 = res));
      await Promise.all(extractionTasks);

      const parts: any[] = [
        { text: `TASK: Professional Architectural Visualization. 
                 CRITICAL RULE: The camera angle, perspective, and overall composition MUST 100% match NODE 1. NEVER change the original camera angle.` },
  
        { text: "NODE 1 [Base Geometry]: The padded original building structure. DO NOT stretch the building to fill the frame. Fill the padded white areas ONLY with simple, unobtrusive background elements (e.g., plain sky, clouds, flat ground, simple grass/asphalt). ABSOLUTELY DO NOT extend the building's roof, walls, or architectural structures into the white padded areas." },
       { inlineData: { data: paddedBaseImage, mimeType: 'image/jpeg' } },
      ];

      if (isLineartEnabled && lineartBase64) {
        parts.push({ text: "NODE 2 [Lineart]: CAD boundaries." });
        parts.push({ inlineData: { data: lineartBase64, mimeType: 'image/jpeg' } });
      }

      if (isDepthEnabled && depthBase64) {
        parts.push({ text: "NODE 3 [Depth]: Massing layout." });
        parts.push({ inlineData: { data: depthBase64, mimeType: 'image/jpeg' } });
      }

      if (ipAdapterImg) {
        parts.push({ text: `NODE 4 [Style]: Reference for materials/lighting. Strength: ${ipAdapterStrength}` });
        parts.push({ inlineData: { data: ipAdapterImg.base64, mimeType: ipAdapterImg.file.type } });
      }

      if (florenceImg) {
        parts.push({ text: `NODE 5 [Context]: Reference for sky/landscape. Strength: ${florenceStrength}` });
        parts.push({ inlineData: { data: florenceImg.base64, mimeType: florenceImg.file.type } });
      }

      parts.push({ text: `POSITIVE PROMPT: ${positivePrompt || 'Modern architectural masterpiece, photorealistic, 8k, cinematic lighting'} \nNEGATIVE PROMPT: ${negativePrompt}` });

      // Primary Model: gemini-3.1-flash-image-preview for high quality
      // Fallback: gemini-2.5-flash-image
      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: { parts },
          config: { 
            seed: currentSeed, 
            temperature,
            imageConfig: {
              aspectRatio: aspectRatio as any, 
              imageSize: "1K" 
            }
          } as any
        });
      } catch (e: any) {
        console.warn("Primary model failed, trying fallback...", e);
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts },
          config: { seed: currentSeed, temperature } as any
        });
      }

      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY') {
        throw new Error("Generation blocked by safety filters. Please try a different prompt or less artistic style.");
      }

      const partsArray = candidate?.content?.parts || [];
      const generatedImgPart = partsArray.find((p: any) => p.inlineData)?.inlineData;
      const explanationText = partsArray.find((p: any) => p.text)?.text;

      if (generatedImgPart) {
        setResultImage(`data:${generatedImgPart.mimeType || 'image/jpeg'};base64,${generatedImgPart.data}`);
      } else if (explanationText) {
        throw new Error(`Model Response: ${explanationText}`);
      } else {
        throw new Error("Generation failed: No image returned. The model may have had trouble interpreting the multi-node input.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans text-white">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
          <Shield className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Kunwon AI</h1>
          <p className="text-zinc-400 text-sm mb-6">Enter password to access ArchViz Engine</p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 mb-4 text-center focus:outline-none focus:border-indigo-500 tracking-widest"
            />
            {passwordError && <p className="text-red-400 text-sm mb-4">{passwordError}</p>}
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition-all">
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    // [수정점] 가로세로 100% 꽉 채우고 메인 스크롤 없앰
    <div className="h-screen w-screen overflow-hidden bg-[#0a0a0a] text-zinc-100 font-sans flex flex-col">
      <main className="flex-1 w-full h-full p-4 lg:p-6 grid lg:grid-cols-12 items-start gap-6 min-h-0">
        
        {/* --- Sidebar Panel: Assets, Settings, Prompts & Execute --- */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-4 h-full overflow-y-auto pr-2 pb-2 
                        scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          
          <header className="flex flex-col gap-0.5 shrink-0">
            <h1 className="text-lg font-bold tracking-tight text-white uppercase italic">Sketch 2 Render</h1>
            <div className="flex items-center gap-1.5 leading-none mb-2">
              <span className="text-[10px] text-zinc-500 font-bold">EXTERIOR EXPERT</span>
              <span className="text-[7px] text-zinc-700 font-medium uppercase tracking-tighter border-l border-zinc-800 pl-1.5">
                © 2026. Junghyun Kim
              </span>
            </div>
          </header>

          <ImageUploadNodes 
            controlNetImg={controlNetImg} setControlNetImg={setControlNetImg}
            ipAdapterImg={ipAdapterImg} setIpAdapterImg={setIpAdapterImg}
            florenceImg={florenceImg} setFlorenceImg={setFlorenceImg}
            ipAdapterStrength={ipAdapterStrength} setIpAdapterStrength={setIpAdapterStrength}
            florenceStrength={florenceStrength} setFlorenceStrength={setFlorenceStrength}
          />
          <SettingsPanel 
            temperature={temperature} setTemperature={setTemperature}
            seedMode={seedMode} setSeedMode={setSeedMode}
            seedValue={seedValue} setSeedValue={setSeedValue}
          />

          <div className="flex gap-2 min-h-0">
            <div className="flex-[2] min-w-0">
              <PromptPanel 
                positivePrompt={positivePrompt} setPositivePrompt={setPositivePrompt}
                negativePrompt={negativePrompt} setNegativePrompt={setNegativePrompt}
              />
            </div>
            <div className="flex-1 min-w-0">
              <QuickStyles onSelect={(preset: StylePreset) => {
                setPositivePrompt(preset.positive);
                setNegativePrompt(preset.negative);
              }} />
            </div>
          </div>
          
          <div className="space-y-4">
            {!hasApiKey && (window as any).aistudio && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                <p className="text-[10px] text-indigo-300 mb-2">High-quality rendering requires a paid API key.</p>
                <button 
                  onClick={handleOpenKeyDialog}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold rounded-lg transition-all"
                >
                  Select API Key
                </button>
              </div>
            )}
            
            <button
              onClick={generateRendering} disabled={!controlNetImg || isGenerating}
              className="w-full py-4 shrink-0 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold uppercase tracking-wide text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Executing Pipeline...</>
              ) : (
                "Queue Prompt"
              )}
            </button>
            
            {error && <p className="text-red-400 p-3 bg-red-900/20 border border-red-900/50 rounded-xl text-xs shrink-0">{error}</p>}
          </div>
        </div>

        {/* --- 오른쪽 패널: 캔버스 영역 --- */}
        <div className="lg:col-span-8 xl:col-span-8 h-full relative min-h-0">
          <PreviewCanvas 
            resultImage={resultImage} setResultImage={setResultImage} 
            controlNetImg={controlNetImg}
          />
        </div>
        
      </main>
    </div>
  );
}