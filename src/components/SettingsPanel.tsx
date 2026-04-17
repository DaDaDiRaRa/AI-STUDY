import React from 'react';
import { Info, Sparkles, Dices, RefreshCw } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface SettingsPanelProps {
  temperature: number;
  setTemperature: (val: number) => void;
  seedMode: 'random' | 'fixed';
  setSeedMode: (mode: 'random' | 'fixed') => void;
  seedValue: number;
  setSeedValue: (val: number) => void;
  lastUsedSeed?: number | null;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  temperature,
  setTemperature,
  seedMode,
  setSeedMode,
  seedValue,
  setSeedValue,
  lastUsedSeed = null,
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Imagination Level (Temperature) */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-2 flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <h2 className="text-[10px] font-bold text-zinc-300 font-mono uppercase tracking-wider">Imagination</h2>
          <Tooltip text="AI가 얼마나 창의적으로 그릴지 결정합니다. 낮으면 원본에 충실하고, 높으면 배경과 조명이 화려해집니다.">
            <Info className="w-3 h-3 text-zinc-600 cursor-help" />
          </Tooltip>
        </div>
        <div>
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 mb-2">
            {[
              { label: 'Cons.', val: 0.2 },
              { label: 'Bal.', val: 0.7 },
              { label: 'Creative', val: 1.2 }
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => setTemperature(preset.val)}
                className={`flex-1 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${temperature === preset.val ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </section>

      {/* Seed Control */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-2 flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-2">
          <Dices className="w-3.5 h-3.5 text-indigo-400" />
          <h2 className="text-[10px] font-bold text-zinc-300 font-mono uppercase tracking-wider">Seed</h2>
          <Tooltip text="이미지의 '고유 번호'입니다. 랜덤은 매번 새롭게, 고정(Fixed)은 마음에 드는 구도를 유지하며 수정할 때 씁니다.">
            <Info className="w-3 h-3 text-zinc-600 cursor-help" />
          </Tooltip>
        </div>
        <div className="space-y-2">
          <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 h-7">
            <button
              onClick={() => setSeedMode('random')}
              className={`flex-1 text-[9px] font-bold uppercase rounded-md transition-all ${seedMode === 'random' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Rnd
            </button>
            <button
              onClick={() => setSeedMode('fixed')}
              className={`flex-1 text-[9px] font-bold uppercase rounded-md transition-all ${seedMode === 'fixed' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Fix
            </button>
          </div>
          <div className="relative h-7">
            <input
              type="number"
              value={seedMode === 'fixed' ? seedValue : (lastUsedSeed ?? '')}
              disabled={seedMode === 'random'}
              onChange={(e) => setSeedValue(parseInt(e.target.value) || 0)}
              className={`w-full h-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 text-[10px] font-mono transition-all focus:outline-none ${
                seedMode === 'random' ? 'text-zinc-600 opacity-50' : 'text-zinc-200 focus:border-indigo-500/50'
              }`}
              placeholder="Seed #"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;