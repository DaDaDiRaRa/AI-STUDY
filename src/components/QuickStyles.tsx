import React from 'react';
import { Palette } from 'lucide-react';

export interface StylePreset {
  id: string;
  name: string;
  icon: string;
  positive: string;
  negative: string;
}

export const STYLE_PRESETS: StylePreset[] = [
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

interface QuickStylesProps {
  onSelect: (preset: StylePreset) => void;
}

export const QuickStyles: React.FC<QuickStylesProps> = ({ onSelect }) => {
  return (
    <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-2 h-full flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Palette className="w-3 h-3 text-indigo-400 shrink-0" />
        <h2 className="text-[9px] font-bold text-zinc-400 font-mono uppercase tracking-wider truncate">Styles</h2>
      </div>
      <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className="flex flex-col items-center justify-center gap-1 p-2 bg-zinc-950 border border-zinc-800 rounded-lg hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group shrink-0 aspect-square"
            title={preset.name}
          >
            <span className="text-xl group-hover:scale-110 transition-transform">{preset.icon}</span>
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter group-hover:text-indigo-400 truncate w-full text-center">{preset.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
