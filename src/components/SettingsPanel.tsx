import React from 'react';
import { Info, Settings2, Sparkles, Dices, RefreshCw } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface SettingsPanelProps {
  selectedModes: string[];
  setSelectedModes?: (modes: string[]) => void;
  toggleMode?: (mode: string) => void;
  temperature: number;
  setTemperature: (val: number) => void;
  seedMode: 'random' | 'fixed';
  setSeedMode: (mode: 'random' | 'fixed') => void;
  seedValue: number;
  setSeedValue: (val: number) => void;
  lastUsedSeed?: number | null;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  selectedModes,
  setSelectedModes,
  toggleMode,
  temperature,
  setTemperature,
  seedMode,
  setSeedMode,
  seedValue,
  setSeedValue,
  lastUsedSeed = null,
}) => {
  const handleToggleMode = (mode: string) => {
    if (toggleMode) {
      toggleMode(mode);
    } else if (setSelectedModes) {
      setSelectedModes(
        selectedModes.includes(mode)
          ? selectedModes.filter((m) => m !== mode)
          : [...selectedModes, mode]
      );
    }
  };

  return (
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
                onClick={() => handleToggleMode(mode.id)}
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
  );
};

export default SettingsPanel;
