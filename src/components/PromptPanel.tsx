import React from 'react';
import { Palette, Info, Sparkles, Loader2, Shield } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface StylePreset {
  id: string;
  name: string;
  icon: string;
  positive: string;
  negative: string;
}

interface PromptPanelProps {
  positivePrompt: string;
  setPositivePrompt: (val: string) => void;
  negativePrompt: string;
  setNegativePrompt: (val: string) => void;
  originalPositivePrompt: string | null;
  setOriginalPositivePrompt: (val: string | null) => void;
  originalNegativePrompt: string | null;
  setOriginalNegativePrompt: (val: string | null) => void;
  showComparison: boolean;
  setShowComparison: (val: boolean) => void;
  showNegativeComparison: boolean;
  setShowNegativeComparison: (val: boolean) => void;
  handleImprovePrompt: () => Promise<void>;
  handleImproveNegativePrompt: () => Promise<void>;
  isImproving: boolean;
  isImprovingNegative: boolean;
  stylePresets: StylePreset[];
}

export const PromptPanel: React.FC<PromptPanelProps> = ({
  positivePrompt,
  setPositivePrompt,
  negativePrompt,
  setNegativePrompt,
  originalPositivePrompt,
  setOriginalPositivePrompt,
  originalNegativePrompt,
  setOriginalNegativePrompt,
  showComparison,
  setShowComparison,
  showNegativeComparison,
  setShowNegativeComparison,
  handleImprovePrompt,
  handleImproveNegativePrompt,
  isImproving,
  isImprovingNegative,
  stylePresets,
}) => {
  return (
    <div className="space-y-4">
      {/* Style Presets */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-medium text-zinc-300 font-mono uppercase tracking-wider">Quick Styles</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stylePresets.map((preset) => (
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
  );
};
