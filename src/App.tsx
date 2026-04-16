import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Loader2, Key } from 'lucide-react';
// 분리하신 컴포넌트들을 불러옵니다 (경로 확인 필수)
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
      if (!ctx) return resolve(base64Img); // 에러 시 원본 반환
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      if (mode === 'lineart') {
        // [Lineart] 윤곽선 추출 (간단한 Sobel 연산 유사 효과)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          // 회색조 변환 후 대비를 극대화하여 스케치업 선을 강조
          const avg = (r + g + b) / 3;
          const color = avg < 150 ? 0 : 255; // 150보다 어두운 선은 검은색, 나머진 흰색
          data[i] = data[i+1] = data[i+2] = color;
        }
      } else if (mode === 'depth') {
        // [Pseudo-Depth] 깊이맵 모방 (가까운건 밝게, 먼건 어둡게 대비 조절)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          const avg = (r + g + b) / 3;
          // 회색조 변환 및 블러를 통해 매스감(덩어리)만 남김
          data[i] = data[i+1] = data[i+2] = avg;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      if (mode === 'depth') {
        // 깊이맵은 자잘한 선을 뭉개야 하므로 캔버스 자체 블러 적용
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
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('site_auth') === 'true');
  const [passwordInput, setPasswordInput] = useState('0908');
  const [passwordError, setPasswordError] = useState('0908');

  // Node States
  const [controlNetImg, setControlNetImg] = useState<any>(null);
  const [ipAdapterImg, setIpAdapterImg] = useState<any>(null);
  const [florenceImg, setFlorenceImg] = useState<any>(null);
  
  // Prompt & Settings States
  const [positivePrompt, setPositivePrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModes, setSelectedModes] = useState<string[]>(['depth', 'lineart']); // 기본 둘다 선택
  const [seedMode, setSeedMode] = useState<'random' | 'fixed'>('random');
  const [seedValue, setSeedValue] = useState(42);
  const [temperature, setTemperature] = useState(0.7);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- 핵심 렌더링 로직 (멀티 모달 동적 조립) ---
  const generateRendering = async () => {
    if (!controlNetImg) return setError("Please upload the Structure image.");
    if (!API_KEY) return setError("API key is missing.");
    
    setIsGenerating(true);
    setError(null);

    try {
      const model = genAI.models;
      const currentSeed = seedMode === 'fixed' ? seedValue : Math.floor(Math.random() * 2147483647);
      
      // 1단계: 사용자가 선택한 모드에 따라 브라우저에서 이미지를 실시간 추출!
      const isLineartEnabled = selectedModes.includes('lineart');
      const isDepthEnabled = selectedModes.includes('depth');
      
      let lineartBase64 = null;
      let depthBase64 = null;

      // Promise.all로 병렬 고속 추출
      const extractionTasks = [];
      if (isLineartEnabled) extractionTasks.push(processImageInBrowser(controlNetImg.base64, 'lineart').then(res => lineartBase64 = res));
      if (isDepthEnabled) extractionTasks.push(processImageInBrowser(controlNetImg.base64, 'depth').then(res => depthBase64 = res));
      await Promise.all(extractionTasks);

      // 2단계: 추출된 이미지들을 AI에게 보낼 프롬프트 덩어리(parts)로 조립
      const parts: any[] = [
        { text: "TASK: High-end Architectural Visualization. Professional ArchViz. Strictly follow the provided structural guides." },
        
        { text: "NODE 1 [Base Geometry]: The original building structure." },
        { inlineData: { data: controlNetImg.base64, mimeType: controlNetImg.file.type } },
      ];

      // LINEART가 선택되었다면 AI에게 도면을 주입
      if (isLineartEnabled && lineartBase64) {
        parts.push({ text: "NODE 2 [Lineart Constraint]: This is the exact CAD drawing. DO NOT distort window frames, balconies, or vertical lines. Keep strictly within these black boundaries." });
        parts.push({ inlineData: { data: lineartBase64, mimeType: 'image/jpeg' } });
      }

      // DEPTH가 선택되었다면 AI에게 공간감/덩어리감을 주입
      if (isDepthEnabled && depthBase64) {
        parts.push({ text: "NODE 3 [Depth/Massing Map]: This represents the 3D volume and distance. Use this to calculate realistic ambient occlusion and depth of field." });
        parts.push({ inlineData: { data: depthBase64, mimeType: 'image/jpeg' } });
      }

      // 프롬프트 및 기존 노드 추가
      parts.push({ text: `POSITIVE PROMPT: ${positivePrompt} \nNEGATIVE PROMPT: ${negativePrompt}` });

      // 3단계: Gemini 3.1 Flash Image 모델로 전송
      const response = await model.generateContent({
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

  // UI (컴포넌트로 분리된 상태이므로 매우 간결합니다)
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans pb-20">
      {/* 컴포넌트에 필요한 Props를 내려줍니다 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <ImageUploadNodes 
              controlNetImg={controlNetImg} setControlNetImg={setControlNetImg}
              ipAdapterImg={ipAdapterImg} setIpAdapterImg={setIpAdapterImg}
              florenceImg={florenceImg} setFlorenceImg={setFlorenceImg}
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
            <PreviewCanvas resultImage={resultImage} setResultImage={setResultImage} />
          </div>
        </div>
      </main>
    </div>
  );
}