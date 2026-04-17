import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Loader2, Shield } from 'lucide-react';
import ImageUploadNodes from './components/ImageUploadNodes';
import SettingsPanel from './components/SettingsPanel';
import PromptPanel from './components/PromptPanel';
import PreviewCanvas from './components/PreviewCanvas';

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
    if (!API_KEY) return setError("API key is missing.");
    
    setIsGenerating(true);
    setError(null);

    try {
      const currentSeed = seedMode === 'fixed' ? seedValue : Math.floor(Math.random() * 2147483647);
      const aspectRatio = getClosestAspectRatio(controlNetImg.width || 1, controlNetImg.height || 1);
      const paddedBaseImage = await padImageToBase64(controlNetImg.base64, aspectRatio);
      
      // [핵심] 유저 UI와 상관없이 항상 Depth와 Lineart를 강제로 추출 및 적용합니다.
      const isLineartEnabled = true;
      const isDepthEnabled = true;
      
      let lineartBase64 = null;
      let depthBase64 = null;

      const extractionTasks = [];
      if (isLineartEnabled) extractionTasks.push(processImageInBrowser(paddedBaseImage, 'lineart').then(res => lineartBase64 = res));
      if (isDepthEnabled) extractionTasks.push(processImageInBrowser(paddedBaseImage, 'depth').then(res => depthBase64 = res));
      await Promise.all(extractionTasks);

      const parts: any[] = [
        { text: `TASK: HIGH-FIDELITY ARCHITECTURAL RENDERING. 
                 DETERMINISTIC MODE: ON. 
                 STRUCTURAL FIDELITY: 100%. 
                 CRITICAL: The final render MUST align perfectly with the geometry of Node 1, 2, and 3.` },
        
        { text: "NODE 1 [Base Geometry]: The absolute source of truth for camera angle and perspective. This building shape and camera position must be locked." },
        { inlineData: { data: paddedBaseImage, mimeType: 'image/jpeg' } },
      ];

      if (isLineartEnabled && lineartBase64) {
        parts.push({ text: "NODE 2 [Lineart Constraint]: STRICT BOUNDARY. Every edge in this image must be preserved. Do not add or remove structural lines." });
        parts.push({ inlineData: { data: lineartBase64, mimeType: 'image/jpeg' } });
      }

      if (isDepthEnabled && depthBase64) {
        parts.push({ text: "NODE 3 [Depth/Massing Map]: Absolute spatial layout. Maintain this exact volume." });
        parts.push({ inlineData: { data: depthBase64, mimeType: 'image/jpeg' } });
      }

      if (ipAdapterImg) {
        parts.push({ text: `NODE 4 [Style Reference]: ${getStrengthText(ipAdapterStrength, 'style')}
        CRITICAL WARNING: Extract ONLY Material/Color/Lighting. 
        ABSOLUTELY IGNORE the building structure and camera angle of this Style image. 
        If the style image has a building, DO NOT copy its shape.` });
        parts.push({ inlineData: { data: ipAdapterImg.base64, mimeType: ipAdapterImg.file.type } });
      }

      if (florenceImg) {
        parts.push({ text: `NODE 5 [Environmental Context]: ${getStrengthText(florenceStrength, 'context')}
        Extract ONLY Sky/Weather/Landscaping. 
        DO NOT copy any buildings or architectural structures from this image.` });
        parts.push({ inlineData: { data: florenceImg.base64, mimeType: florenceImg.file.type } });
      }

      parts.push({ text: `USER PROMPT (Style Details): ${positivePrompt} \nNEGATIVE PROMPT: ${negativePrompt}` });

      const response = await genAI.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
        config: { 
          systemInstruction: `You are a 'High-End Architectural Visualization (Arch-Viz) Engine' and a 'Deterministic ControlNet AI'. 
          Your goal is to translate 3D structural guides (SketchUp/CAD base) and stylistic references into professional-grade renders.

          [NODE-Based Processing Protocols]
          1. NODE 1 [Base Geometry]: The absolute source of truth for camera angle, perspective, and building proportion. You MUST naturally 'outpaint' empty padding with sky/landscaping. DO NOT stretch the building.
          2. NODE 2 [Lineart]: Precise CAD boundaries. You are STRICTLY FORBIDDEN from drawing window frames, balconies, or vertical lines outside of these exact black edges.
          3. NODE 3 [Depth]: 3D massing and spatial layout. Use this to calculate realistic ambient occlusion, shadows, and depth of field.
          4. NODE 4 [Style]: Material and color reference. Extract ONLY the texture, reflectivity, and lighting tones. ABSOLUTELY IGNORE the building shape and camera angle of this image.
          5. NODE 5 [Context]: Environmental reference. Extract ONLY sky, weather, and landscaping. DO NOT copy any architectural structures from this image.

          [Quality Standards]
          - Structural Fidelity: 100% Locked perspective. Zero tolerance for distorted geometry or misaligned windows.
          - Visual Excellence: Global Illumination, realistic reflections, professional photography.`,
          seed: currentSeed, 
          temperature,
          imageConfig: {
            aspectRatio: aspectRatio as any, 
            imageSize: "1K" 
          }
        } as any
      });

      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY') {
        throw new Error("Generation blocked by safety filters. Please try a different prompt or image.");
      }

      // Check all parts for image data
      const allParts = candidate?.content?.parts || [];
      const generatedImgPart = allParts.find((p: any) => p.inlineData)?.inlineData;
      const textResponse = allParts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');

      if (generatedImgPart) {
        setResultImage(`data:${generatedImgPart.mimeType};base64,${generatedImgPart.data}`);
      } else if (textResponse) {
        console.warn("Model returned text instead of image:", textResponse);
        throw new Error(`Model returned text but no image: ${textResponse}`);
      } else {
        console.error("Full response:", JSON.stringify(response, null, 2));
        throw new Error("Generation failed. No image or text was returned by the model. Check console for details.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans text-white">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
          <Shield className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sketch 2 Render</h1>
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
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans pb-20">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 사용자님이 요청하신 소중한 헤더 (절대 지우지 않음!) */}
        <header className="mb-8 flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">Sketch 2 Render</h1>
          <div className="flex items-baseline gap-2">
            <span className="text-lg text-zinc-500 font-medium">for Exterior</span>
            <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
              © 2026. Junghyun Kim. All rights reserved.
            </span>
          </div>
        </header>
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <ImageUploadNodes 
              controlNetImg={controlNetImg} setControlNetImg={setControlNetImg}
              ipAdapterImg={ipAdapterImg} setIpAdapterImg={setIpAdapterImg}
              florenceImg={florenceImg} setFlorenceImg={setFlorenceImg}
              ipAdapterStrength={ipAdapterStrength} setIpAdapterStrength={setIpAdapterStrength}
              florenceStrength={florenceStrength} setFlorenceStrength={setFlorenceStrength}
            />
            {/* selectedModes 속성 제거됨 */}
            <SettingsPanel 
              temperature={temperature} setTemperature={setTemperature}
              seedMode={seedMode} setSeedMode={setSeedMode}
              seedValue={seedValue} setSeedValue={setSeedValue}
            />
            <PromptPanel 
              positivePrompt={positivePrompt} setPositivePrompt={setPositivePrompt}
              negativePrompt={negativePrompt} setNegativePrompt={setNegativePrompt}
            />
            <button
              onClick={generateRendering} disabled={!controlNetImg || isGenerating}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold uppercase tracking-wide text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Executing Pipeline...</>
              ) : (
                "Queue Prompt"
              )}
            </button>
            {error && <p className="text-red-400 p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-sm">{error}</p>}
          </div>
          <div className="lg:col-span-5 relative">
            <PreviewCanvas 
              resultImage={resultImage} setResultImage={setResultImage} 
              controlNetImg={controlNetImg}
            />
          </div>
        </div>
      </main>
    </div>
  );
}