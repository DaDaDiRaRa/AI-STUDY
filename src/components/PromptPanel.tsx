import React, { useState } from 'react';
import { Palette, Info, Sparkles, Loader2, Shield } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from './Tooltip';

interface StylePreset {
  id: string;
  name: string;
  icon: string;
  positive: string;
  negative: string;
}

const STYLE_PRESETS: StylePreset[] = [
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

interface PromptPanelProps {
  positivePrompt: string;
  setPositivePrompt: (val: string) => void;
  negativePrompt: string;
  setNegativePrompt: (val: string) => void;
  originalPositivePrompt?: string | null;
  setOriginalPositivePrompt?: (val: string | null) => void;
  originalNegativePrompt?: string | null;
  setOriginalNegativePrompt?: (val: string | null) => void;
  showComparison?: boolean;
  setShowComparison?: (val: boolean) => void;
  showNegativeComparison?: boolean;
  setShowNegativeComparison?: (val: boolean) => void;
  handleImprovePrompt?: () => Promise<void>;
  handleImproveNegativePrompt?: () => Promise<void>;
  isImproving?: boolean;
  isImprovingNegative?: boolean;
  stylePresets?: StylePreset[];
}

const PromptPanel: React.FC<PromptPanelProps> = ({
  positivePrompt,
  setPositivePrompt,
  negativePrompt,
  setNegativePrompt,
  originalPositivePrompt: propsOriginalPositivePrompt,
  setOriginalPositivePrompt: propsSetOriginalPositivePrompt,
  originalNegativePrompt: propsOriginalNegativePrompt,
  setOriginalNegativePrompt: propsSetOriginalNegativePrompt,
  showComparison: propsShowComparison,
  setShowComparison: propsSetShowComparison,
  showNegativeComparison: propsShowNegativeComparison,
  setShowNegativeComparison: propsSetShowNegativeComparison,
  handleImprovePrompt: propsHandleImprovePrompt,
  handleImproveNegativePrompt: propsHandleImproveNegativePrompt,
  isImproving: propsIsImproving,
  isImprovingNegative: propsIsImprovingNegative,
  stylePresets = STYLE_PRESETS,
}) => {
  // Internal state fallbacks
  const [internalOriginalPositivePrompt, setInternalOriginalPositivePrompt] = useState<string | null>(null);
  const [internalOriginalNegativePrompt, setInternalOriginalNegativePrompt] = useState<string | null>(null);
  const [internalShowComparison, setInternalShowComparison] = useState(false);
  const [internalShowNegativeComparison, setInternalShowNegativeComparison] = useState(false);
  const [internalIsImproving, setInternalIsImproving] = useState(false);
  const [internalIsImprovingNegative, setInternalIsImprovingNegative] = useState(false);
  const [internalShowPositive, setInternalShowPositive] = useState(false);
  const [internalShowNegative, setInternalShowNegative] = useState(false);

  const originalPositivePrompt = propsOriginalPositivePrompt !== undefined ? propsOriginalPositivePrompt : internalOriginalPositivePrompt;
  const setOriginalPositivePrompt = propsSetOriginalPositivePrompt || setInternalOriginalPositivePrompt;
  const originalNegativePrompt = propsOriginalNegativePrompt !== undefined ? propsOriginalNegativePrompt : internalOriginalNegativePrompt;
  const setOriginalNegativePrompt = propsSetOriginalNegativePrompt || setInternalOriginalNegativePrompt;
  const showComparison = propsShowComparison !== undefined ? propsShowComparison : internalShowComparison;
  const setShowComparison = propsSetShowComparison || setInternalShowComparison;
  const showNegativeComparison = propsShowNegativeComparison !== undefined ? propsShowNegativeComparison : internalShowNegativeComparison;
  const setShowNegativeComparison = propsSetShowNegativeComparison || setInternalShowNegativeComparison;
  const isImproving = propsIsImproving !== undefined ? propsIsImproving : internalIsImproving;
  const isImprovingNegative = propsIsImprovingNegative !== undefined ? propsIsImprovingNegative : internalIsImprovingNegative;

  const API_KEY = process.env.GEMINI_API_KEY || '';
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const handleImprovePrompt = async () => {
    if (propsHandleImprovePrompt) return propsHandleImprovePrompt();
    if (!positivePrompt.trim() || internalIsImproving) return;
    
    setInternalIsImproving(true);
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
    } finally {
      setInternalIsImproving(false);
    }
  };

  const handleImproveNegativePrompt = async () => {
    if (propsHandleImproveNegativePrompt) return propsHandleImproveNegativePrompt();
    if (!negativePrompt.trim() || internalIsImprovingNegative) return;
    
    setInternalIsImprovingNegative(true);
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
    } finally {
      setInternalIsImprovingNegative(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* POSITIVE PROMPT Section */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
        <button 
          onClick={() => setInternalShowPositive(!internalShowPositive)}
          className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <h2 className="text-sm font-medium text-emerald-400 font-mono uppercase tracking-wider">POSITIVE PROMPT</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
              {internalShowPositive ? 'Collapse' : 'Expand to Edit'}
            </span>
          </div>
        </button>

        <AnimatePresence>
          {internalShowPositive && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3 pt-2 border-t border-zinc-800">
                <Tooltip text="나오길 원하는 것을 적으세요 (예: 푸른 하늘, 대리석 벽). 빈칸으로 두면 AI가 이미지를 분석해 알아서 그립니다.">
                  <div className="flex items-center gap-1 text-zinc-500 cursor-help">
                    <Info className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium italic">Guidance</span>
                  </div>
                </Tooltip>
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
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                  placeholder="Optional: Type here or leave blank for Auto-Pilot rendering..."
                />
                {showComparison && originalPositivePrompt && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/30 backdrop-blur-sm">
                    AI ENHANCED
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* NEGATIVE PROMPT Section */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
        <button 
          onClick={() => setInternalShowNegative(!internalShowNegative)}
          className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <h2 className="text-sm font-medium text-red-400 font-mono uppercase tracking-wider">NEGATIVE PROMPT</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
              {internalShowNegative ? 'Collapse' : 'Expand to Edit'}
            </span>
          </div>
        </button>

        <AnimatePresence>
          {internalShowNegative && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3 pt-2 border-t border-zinc-800">
                <Tooltip text="나오지 않기를 원하는 것을 적으세요 (예: 왜곡된 선, 사람, 자동차). Enhance 버튼을 눌러 품질을 높이세요.">
                  <div className="flex items-center gap-1 text-zinc-500 cursor-help">
                    <Info className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium italic">Guidance</span>
                  </div>
                </Tooltip>
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[10px] font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImprovingNegative ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                    Improve
                  </button>
                </div>
              </div>
              
              <div className="relative">
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
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                  placeholder="Elements to exclude..."
                />
                {showNegativeComparison && originalNegativePrompt && (
                  <div className="mt-2 flex items-center gap-1.5 text-[9px] text-red-400/70 font-medium italic">
                    <Info className="w-2.5 h-2.5" />
                    Viewing improved negative prompt.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};

export default PromptPanel;
