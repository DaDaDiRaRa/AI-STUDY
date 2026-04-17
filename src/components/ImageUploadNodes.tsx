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
    <div className="grid grid-cols-3 gap-2">
      {/* ControlNet Node */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-2 flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5 text-zinc-300">
          <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider truncate">BASE</h3>
        </div>
        <div 
          {...getRootCN()} 
          className={`relative h-32 rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${isDragCN ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
        >
          <input {...getInputCN()} />
          {controlNetImg ? (
            <>
              <img src={controlNetImg.preview} alt="ControlNet" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <AnimatePresence>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearControlNet();
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors z-10"
                >
                  <X className="w-2.5 h-2.5" />
                </motion.button>
              </AnimatePresence>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-1.5 p-1 text-center">
              <Upload className="w-5 h-5 opacity-40" />
              <p className="text-[9px] font-bold uppercase tracking-tight">Base Image</p>
            </div>
          )}
        </div>
        <div className="mt-2 opacity-0 h-4 invisible"> {/* Space balancer for strengths below other nodes */}
           {/* No strength slider for base usually needed here or move to match others if needed */}
        </div>
      </div>

      {/* IPAdapter Node */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-2 flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5 text-zinc-300">
          <Palette className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider truncate">Style</h3>
        </div>
        <div 
          {...getRootIP()} 
          className={`relative h-32 rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${isDragIP ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
        >
          <input {...getInputIP()} />
          {ipAdapterImg ? (
            <>
              <img src={ipAdapterImg.preview} alt="IPAdapter" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <AnimatePresence>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearIPAdapter();
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors z-10"
                >
                  <X className="w-2.5 h-2.5" />
                </motion.button>
              </AnimatePresence>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-1.5 p-1 text-center">
              <Upload className="w-5 h-5 opacity-40" />
              <p className="text-[9px] font-bold uppercase tracking-tight">Style Ref</p>
            </div>
          )}
        </div>
        <div className="mt-2 space-y-1">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={ipAdapterStrength}
            onChange={(e) => setIpAdapterStrength?.(parseFloat(e.target.value))}
            disabled={!ipAdapterImg}
            className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-purple-500 ${ipAdapterImg ? 'bg-zinc-800' : 'bg-zinc-900'}`}
          />
        </div>
      </div>

      {/* Florence Node */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-2 flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5 text-zinc-300">
          <ScanText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider truncate">Context</h3>
        </div>
        <div 
          {...getRootFL()} 
          className={`relative h-32 rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${isDragFL ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
        >
          <input {...getInputFL()} />
          {florenceImg ? (
            <>
              <img src={florenceImg.preview} alt="Florence" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <AnimatePresence>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFlorence();
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors z-10"
                >
                  <X className="w-2.5 h-2.5" />
                </motion.button>
              </AnimatePresence>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-1.5 p-1 text-center">
              <Upload className="w-5 h-5 opacity-40" />
              <p className="text-[9px] font-bold uppercase tracking-tight">Context Ref</p>
            </div>
          )}
        </div>
        <div className="mt-2 space-y-1">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={florenceStrength}
            onChange={(e) => setFlorenceStrength?.(parseFloat(e.target.value))}
            disabled={!florenceImg}
            className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-amber-500 ${florenceImg ? 'bg-zinc-800' : 'bg-zinc-900'}`}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageUploadNodes;
