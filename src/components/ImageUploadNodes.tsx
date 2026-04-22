import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Info, Layers, Palette, ScanText, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Tooltip } from './Tooltip';

interface ImageFile {
  file: File;
  preview: string;
  base64: string;
  width?: number;
  height?: number;
}

interface ImageUploadNodesProps {
  controlNetImg: ImageFile | null;
  setControlNetImg: (img: ImageFile | null) => void;
  ipAdapterImg: ImageFile | null;
  setIpAdapterImg: (img: ImageFile | null) => void;
  florenceImg: ImageFile | null;
  setFlorenceImg: (img: ImageFile | null) => void;
  ipAdapterStrength?: number;
  setIpAdapterStrength?: (val: number) => void;
  florenceStrength?: number;
  setFlorenceStrength?: (val: number) => void;
}

const ImageUploadNodes: React.FC<ImageUploadNodesProps> = ({
  controlNetImg,
  setControlNetImg,
  ipAdapterImg,
  setIpAdapterImg,
  florenceImg,
  setFlorenceImg,
  ipAdapterStrength = 0.8,
  setIpAdapterStrength,
  florenceStrength = 0.8,
  setFlorenceStrength,
}) => {
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const createDropHandler = (setter: (img: ImageFile | null) => void) => 
    useCallback(async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        const base64 = await fileToBase64(file);
        const dimensions = await getImageDimensions(file);
        setter({ file, preview: URL.createObjectURL(file), base64, ...dimensions });
      }
    }, [setter]);

  const { getRootProps: getRootCN, getInputProps: getInputCN, isDragActive: isDragCN } = useDropzone({ onDrop: createDropHandler(setControlNetImg), accept: { 'image/*': [] }, multiple: false } as any);
  const { getRootProps: getRootIP, getInputProps: getInputIP, isDragActive: isDragIP } = useDropzone({ onDrop: createDropHandler(setIpAdapterImg), accept: { 'image/*': [] }, multiple: false } as any);
  const { getRootProps: getRootFL, getInputProps: getInputFL, isDragActive: isDragFL } = useDropzone({ onDrop: createDropHandler(setFlorenceImg), accept: { 'image/*': [] }, multiple: false } as any);

  const clearControlNet = () => setControlNetImg(null);
  const clearIPAdapter = () => setIpAdapterImg(null);
  const clearFlorence = () => setFlorenceImg(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ControlNet Node */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 flex flex-col">
        <div className="flex items-center gap-2 mb-3 text-zinc-300">
          <Layers className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium">원본 이미지</h3>
          <Tooltip text="건물의 뼈대를 결정합니다. 화이트 모델, 스케치, 혹은 도면 이미지를 넣어주세요. 구조는 그대로 유지됩니다.">
            <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
          </Tooltip>
        </div>
        <div 
          {...getRootCN()} 
          className={`relative flex-1 aspect-square rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${isDragCN ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
        >
          <input {...getInputCN()} />
          {controlNetImg ? (
            <>
              <img src={controlNetImg.preview} alt="ControlNet" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <AnimatePresence>
                {controlNetImg && (
                  <motion.button
                    key="clear-cn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearControlNet();
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors z-10"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
              <Upload className="w-6 h-6" />
              <p className="text-xs">Clay Model / Base</p>
            </div>
          )}
        </div>
      </div>

      {/* IPAdapter Node */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 flex flex-col">
        <div className="flex items-center gap-2 mb-3 text-zinc-300">
          <Palette className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium">IPAdapter (Style)</h3>
          <Tooltip text="원하는 색감이나 재질이 담긴 이미지를 넣으세요. 건물에 그 느낌(재질, 빛)만 입혀줍니다.">
            <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
          </Tooltip>
        </div>
        <div 
          {...getRootIP()} 
          className={`relative flex-1 aspect-square rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${isDragIP ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
        >
          <input {...getInputIP()} />
          {ipAdapterImg ? (
            <>
              <img src={ipAdapterImg.preview} alt="IPAdapter" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <AnimatePresence>
                {ipAdapterImg && (
                  <motion.button
                    key="clear-ip"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearIPAdapter();
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors z-10"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
              <Upload className="w-6 h-6" />
              <p className="text-xs">Style Reference</p>
            </div>
          )}
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${ipAdapterImg ? 'text-zinc-500' : 'text-zinc-700'}`}>
              Style Strength
              <Tooltip text="레퍼런스 이미지의 영향력을 조절합니다. 0에 가까우면 무시하고, 1에 가까우면 사진을 그대로 따릅니다.">
                <Info className="w-3 h-3 cursor-help" />
              </Tooltip>
            </label>
            <span className={`text-[10px] font-mono font-bold ${ipAdapterImg ? 'text-purple-400' : 'text-zinc-700'}`}>{ipAdapterStrength.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={ipAdapterStrength}
            onChange={(e) => setIpAdapterStrength?.(parseFloat(e.target.value))}
            disabled={!ipAdapterImg}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-500 ${ipAdapterImg ? 'bg-zinc-800' : 'bg-zinc-900'}`}
          />
        </div>
      </div>

      {/* Florence Node */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 flex flex-col">
        <div className="flex items-center gap-2 mb-3 text-zinc-300">
          <ScanText className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium">Florence (Context)</h3>
          <Tooltip text="주변 배경이나 분위기를 결정합니다. 숲, 도시, 하늘 등 환경 정보가 담긴 이미지를 활용하세요.">
            <Info className="w-3.5 h-3.5 text-zinc-600 cursor-help" />
          </Tooltip>
        </div>
        <div 
          {...getRootFL()} 
          className={`relative flex-1 aspect-square rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${isDragFL ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
        >
          <input {...getInputFL()} />
          {florenceImg ? (
            <>
              <img src={florenceImg.preview} alt="Florence" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <AnimatePresence>
                {florenceImg && (
                  <motion.button
                    key="clear-fl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFlorence();
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors z-10"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
              <Upload className="w-6 h-6" />
              <p className="text-xs">Context Image</p>
            </div>
          )}
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${florenceImg ? 'text-zinc-500' : 'text-zinc-700'}`}>
              Context Strength
              <Tooltip text="레퍼런스 이미지의 영향력을 조절합니다. 0에 가까우면 무시하고, 1에 가까우면 사진을 그대로 따릅니다.">
                <Info className="w-3 h-3 cursor-help" />
              </Tooltip>
            </label>
            <span className={`text-[10px] font-mono font-bold ${florenceImg ? 'text-amber-400' : 'text-zinc-700'}`}>{florenceStrength.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={florenceStrength}
            onChange={(e) => setFlorenceStrength?.(parseFloat(e.target.value))}
            disabled={!florenceImg}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 ${florenceImg ? 'bg-zinc-800' : 'bg-zinc-900'}`}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageUploadNodes;
