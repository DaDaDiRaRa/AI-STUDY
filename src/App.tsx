import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Loader2, Shield } from 'lucide-react';
import ImageUploadNodes from './components/ImageUploadNodes';
import SettingsPanel from './components/SettingsPanel';
import PromptPanel from './components/PromptPanel';
import PreviewCanvas from './components/PreviewCanvas';

// --- Global Config ---
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
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

// --- [신규] 브라우저 내부: 무왜곡 패딩(아웃페인팅) 리사이즈 함수 ---
const padImageToBase64 = async (base64Img: string, targetRatioStr: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 비율 계산 (예: "4:3" -> 4/3)
      const [wRatio, hRatio] = targetRatioStr.split(':').map(Number);
      const targetRatio = wRatio / hRatio;
      const currentRatio = img.width / img.height;

      let targetWidth = img.width;
      let targetHeight = img.height;

      // 이미 타겟 비율과 거의 일치하면 원본 반환
      if (Math.abs(targetRatio - currentRatio) < 0.01) {
        return resolve(base64Img);
      }

      // 비율을 맞추기 위해 도화지 크기 계산 (비율을 강제로 늘리지 않고 여백 추가)
      if (currentRatio > targetRatio) {
        // 이미지가 더 가로로 길 때 -> 세로 여백(위아래) 추가
        targetHeight = targetWidth / targetRatio;
      } else {
        // 이미지가 더 세로로 길 때 -> 가로 여백(양옆) 추가
        targetWidth = targetHeight * targetRatio;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Img);

      // 하얀색 배경으로 여백 채우기 (AI가 자연스럽게 하늘이나 땅으로 아웃페인팅함)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // 원본 이미지를 정중앙에 배치
      const dx = (targetWidth - img.width) / 2;
      const dy = (targetHeight - img.height) / 2;
      ctx.drawImage(img, dx, dy);

      resolve(canvas.toDataURL('image/jpeg').split(',')[1]);
    };
    img.onerror = reject;
    img.src = `data:image/jpeg;base64,${base64Img}`;
  });
};

// --- 비율 계산 헬퍼 함수 (Gemini API 지원 비율로 고정) ---
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
  const [selectedModes, setSelectedModes] = useState<string[]>(['depth', 'lineart']);
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
      
      // 1. 제미나이 지원 비율 계산
      const aspectRatio = getClosestAspectRatio(controlNetImg.width || 1, controlNetImg.height || 1);
      
      // 2. [핵심] 원본 이미지를 강제로 늘리지 않고 여백(Padding)을 주어 완벽한 비율로 맞춤
      const paddedBaseImage = await padImageToBase64(controlNetImg.base64, aspectRatio);
      
      const isLineartEnabled = selectedModes.includes('lineart');
      const isDepthEnabled = selectedModes.includes('depth');
      
      let lineartBase64 = null;
      let depthBase64 = null;

      // 3. 비율이 완벽하게 맞춰진 이미지를 바탕으로 Depth와 Lineart를 추출함 (오차 제로)
      const extractionTasks = [];
      if (isLineartEnabled) extractionTasks.push(processImageInBrowser(paddedBaseImage, 'lineart').then(res => lineartBase64 = res));
      if (isDepthEnabled) extractionTasks.push(processImageInBrowser(paddedBaseImage, 'depth').then(res => depthBase64 = res));
      await Promise.all(extractionTasks);

      // 4. 프롬프트 조립 (구도 통제 강화 적용)
      const parts: any[] = [
        { text: `TASK: Professional Architectural Visualization. 
                 CRITICAL RULE: The camera angle, perspective, and overall composition MUST 100% match NODE 1. NEVER change the original camera angle.` },
        
        { text: "NODE 1 [Base Geometry]: The padded original building structure. Do not stretch it. Fill the white/empty areas creatively based on the Context node." },
        { inlineData: { data: paddedBaseImage, mimeType: 'image/jpeg' } },
      ];

      if (isLineartEnabled && lineartBase64) {
        parts.push({ text: "NODE 2 [Lineart Constraint]: This is the exact CAD drawing. DO NOT distort window frames, balconies, or vertical lines. The final render must perfectly align with these lines." });
        parts.push({ inlineData: { data: lineartBase64, mimeType: 'image/jpeg' } });
      }

      if (isDepthEnabled && depthBase64) {
        parts.push({ text: "NODE 3 [Depth/Massing Map]: Maintain this exact 3D volume, distance, and perspective." });
        parts.push({ inlineData: { data: depthBase64, mimeType: 'image/jpeg' } });
      }

      if (ipAdapterImg) {
        parts.push({ text: `NODE 4 [Style]: ${getStrengthText(ipAdapterStrength, 'style')}\nWARNING: Extract ONLY colors and materials. ABSOLUTELY IGNORE the camera angle, perspective, and building shape of this image.` });
        parts.push({ inlineData: { data: ipAdapterImg.base64, mimeType: ipAdapterImg.file.type } });
      }

      if (florenceImg) {
        parts.push({ text: `NODE 5 [Context]: ${getStrengthText(florenceStrength, 'context')}\nWARNING: Extract ONLY sky, weather, and landscaping mood. ABSOLUTELY IGNORE the perspective and spatial layout of this image. Do not copy buildings from this image.` });
        parts.push({ inlineData: { data: florenceImg.base64, mimeType: florenceImg.file.type } });
      }

      parts.push({ text: `POSITIVE PROMPT: ${positivePrompt} \nNEGATIVE PROMPT: ${negativePrompt}` });

      const response = await genAI.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
        config: { 
          seed: currentSeed, 
          temperature,
          imageConfig: {
            aspectRatio: aspectRatio as any, 
            imageSize: "1K" // 고해상도 유지
          }
        } as any
      });

      const generatedImgPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
      if (generatedImgPart) {
        setResultImage(`data:${generatedImgPart.mimeType};base64,${generatedImgPart.data}`);
      } else {
        throw new Error("Generation failed.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- UI ---
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
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans pb-20">
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <ImageUploadNodes 
              controlNetImg={controlNetImg} setControlNetImg={setControlNetImg}
              ipAdapterImg={ipAdapterImg} setIpAdapterImg={setIpAdapterImg}
              florenceImg={florenceImg} setFlorenceImg={setFlorenceImg}
              ipAdapterStrength={ipAdapterStrength} setIpAdapterStrength={setIpAdapterStrength}
              florenceStrength={florenceStrength} setFlorenceStrength={setFlorenceStrength}
            />
            <SettingsPanel 
              selectedModes={selectedModes} setSelectedModes={setSelectedModes}
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