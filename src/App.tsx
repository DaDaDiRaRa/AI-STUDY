import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Loader2, Lock, Shield } from 'lucide-react';
import ImageUploadNodes from './components/ImageUploadNodes';
import SettingsPanel from './components/SettingsPanel';
import PromptPanel from './components/PromptPanel';
import PreviewCanvas from './components/PreviewCanvas';

// --- Global Config ---
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenAI({ apiKey: API_KEY });

// --- 브라우저 내부: 이미지 자동 추출기 (Method A) ---
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

export default function App() {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('site_auth') === 'true');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // --- Node States ---
  const [controlNetImg, setControlNetImg] = useState<any>(null);
  const [ipAdapterImg, setIpAdapterImg] = useState<any>(null);
  const [florenceImg, setFlorenceImg] = useState<any>(null);
  
  // --- Prompt & Settings States ---
  const [positivePrompt, setPositivePrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModes, setSelectedModes] = useState<string[]>(['depth', 'lineart']);
  const [seedMode, setSeedMode] = useState<'random' | 'fixed'>('random');
  const [seedValue, setSeedValue] = useState(42);
  const [temperature, setTemperature] = useState(0.7);
  
  // 복구된 상태값들
  const [ipAdapterStrength, setIpAdapterStrength] = useState(0.8);
  const [florenceStrength, setFlorenceStrength] = useState(0.8);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Password Handler ---
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

  // --- 핵심 렌더링 로직 ---
  const generateRendering = async () => {
    if (!controlNetImg) return setError("Please upload the Structure image.");
    if (!API_KEY) return setError("API key is missing.");
    
    setIsGenerating(true);
    setError(null);

    try {
      const currentSeed = seedMode === 'fixed' ? seedValue : Math.floor(Math.random() * 2147483647);
      
      const isLineartEnabled = selectedModes.includes('lineart');
      const isDepthEnabled = selectedModes.includes('depth');
      
      let lineartBase64 = null;
      let depthBase64 = null;

      const extractionTasks = [];
      if (isLineartEnabled) extractionTasks.push(processImageInBrowser(controlNetImg.base64, 'lineart').then(res => lineartBase64 = res));
      if (isDepthEnabled) extractionTasks.push(processImageInBrowser(controlNetImg.base64, 'depth').then(res => depthBase64 = res));
      await Promise.all(extractionTasks);

      // 2단계: 추출된 이미지들을 AI에게 보낼 프롬프트 덩어리(parts)로 조립
      const parts: any[] = [
        { text: "TASK: High-end Architectural Visualization. Professional ArchViz.\nCRITICAL RULE: The camera angle, perspective, and overall composition MUST 100% match NODE 1, 2, and 3. NEVER change the original camera angle." },
        
        { text: "NODE 1 [Base Geometry]: The original building structure. Lock the camera to this exact view." },
        { inlineData: { data: controlNetImg.base64, mimeType: controlNetImg.file.type } },
      ];

      // LINEART가 선택되었다면 AI에게 도면을 주입
      if (isLineartEnabled && lineartBase64) {
        parts.push({ text: "NODE 2 [Lineart Constraint]: This is the exact CAD drawing. DO NOT distort window frames, balconies, or vertical lines. The final render must perfectly align with these lines." });
        parts.push({ inlineData: { data: lineartBase64, mimeType: 'image/jpeg' } });
      }

      // DEPTH가 선택되었다면 AI에게 공간감/덩어리감을 주입
      if (isDepthEnabled && depthBase64) {
        parts.push({ text: "NODE 3 [Depth/Massing Map]: Maintain this exact 3D volume, distance, and perspective. Do not alter the depth of field." });
        parts.push({ inlineData: { data: depthBase64, mimeType: 'image/jpeg' } });
      }

      // [핵심 변경] Style 레퍼런스에는 "구도는 무시해라"는 경고 추가
      if (ipAdapterImg) {
        parts.push({ text: `NODE 4 [Style/Material Reference]: ${getStrengthText(ipAdapterStrength, 'style')}\nWARNING: Extract ONLY the textures, materials, and lighting colors. ABSOLUTELY IGNORE the camera angle, perspective, and building shape of this image.` });
        parts.push({ inlineData: { data: ipAdapterImg.base64, mimeType: ipAdapterImg.file.type } });
      }

      // [핵심 변경] Context 레퍼런스에도 "구도는 무시해라"는 경고 추가
      if (florenceImg) {
        parts.push({ text: `NODE 5 [Context/Environment Reference]: ${getStrengthText(florenceStrength, 'context')}\nWARNING: Extract ONLY the sky, weather, and landscaping mood. ABSOLUTELY IGNORE the perspective and spatial layout of this image.` });
        parts.push({ inlineData: { data: florenceImg.base64, mimeType: florenceImg.file.type } });
      }

      // 프롬프트 및 기존 노드 추가
      parts.push({ text: `POSITIVE PROMPT: ${positivePrompt} \nNEGATIVE PROMPT: ${negativePrompt}` });

      const response = await genAI.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
        config: { seed: currentSeed, temperature } as any
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

  // 복구된 화면: 로그인 페이지
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans text-white">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
          <Shield className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sketch2 Render</h1>
          <p className="text-zinc-400 text-sm mb-6">Enter password to access ArchViz Engine</p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 mb-4 text-center focus:outline-none focus:border-indigo-500"
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
        <header className="mb-8 flex items-baseline gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">Sketch 2 Render</h1>
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
            © 2026 Junghyun Kim. All rights reserved.
          </span>
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
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold uppercase text-white disabled:opacity-50"
            >
              {isGenerating ? "Executing KSampler (Extracting Maps...)" : "Queue Prompt"}
            </button>
            {error && <p className="text-red-400 p-4 bg-red-900/20 rounded-xl">{error}</p>}
          </div>
          <div className="lg:col-span-5 relative">
            {/* PreviewCanvas에는 인페인팅 및 다운로드 로직이 포함될 수 있도록 상태를 넘깁니다 */}
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