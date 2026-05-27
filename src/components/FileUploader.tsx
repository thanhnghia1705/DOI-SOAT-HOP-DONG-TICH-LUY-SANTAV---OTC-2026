/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback } from 'react';
import { Upload, FileCheck, X, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  label: string;
  description: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept?: string;
  iconColor?: string;
  index: number;
  status?: 'idle' | 'success' | 'error';
}

export function FileUploader({ 
  label, 
  description, 
  file, 
  onFileSelect, 
  accept = ".xlsx, .xls, .csv",
  iconColor = "bg-[#031D44]/10 text-[#031D44]",
  index,
  status = 'idle'
}: FileUploaderProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="p-6 rounded-[22px] bg-[rgba(255,255,255,0.48)] backdrop-blur-[18px] border border-[rgba(255,255,255,0.42)] shadow-[0_18px_45px_rgba(3,29,68,0.10)] flex flex-col h-full transition-all group/card hover:bg-[rgba(255,255,255,0.6)]">
      <div className="space-y-4 flex-1 flex flex-col">
        {/* Header with Icon and Title */}
        <div className="flex items-start gap-4">
          <div className={cn("w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 border border-white/50 backdrop-blur-sm shadow-sm", iconColor)}>
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-[#031D44] text-[18px] leading-tight mt-0.5">
              {index}. {label}
            </h3>
            <p className="text-[14px] text-[#031D44]/70 leading-[1.5] font-medium">
              {description}
            </p>
          </div>
        </div>

        {/* Upload Area */}
        <div 
          className={cn(
            "mt-auto relative flex-1 min-h-[160px] rounded-[16px] border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-center p-5 group cursor-pointer",
            file 
              ? status === 'success'
                ? "border-emerald-500/50 bg-emerald-50/50 shadow-inner"
                : status === 'error'
                  ? "border-rose-500/50 bg-rose-50/50 shadow-inner"
                  : "border-[#031D44]/30 bg-[#031D44]/5 shadow-inner" 
              : "border-[#031D44]/20 bg-white/40 hover:border-[#031D44]/40 hover:bg-white/60 hover:shadow-md"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {file ? (
            <div className="space-y-3 animate-in fade-in zoom-in duration-300 w-full px-2">
              <div className={cn(
                "w-12 h-12 rounded-[14px] flex items-center justify-center mx-auto shadow-sm backdrop-blur-sm",
                status === 'success' 
                  ? "bg-emerald-100 text-emerald-600 border border-emerald-200" 
                  : status === 'error'
                    ? "bg-rose-100 text-rose-600 border border-rose-200"
                    : "bg-[#F3EFE0] text-[#031D44] border border-white"
              )}>
                {status === 'error' ? <X className="w-6 h-6" /> : <FileCheck className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <p className="font-bold text-[#031D44] text-[15px] truncate max-w-[90%] mx-auto" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[13px] text-[#031D44]/60 font-medium">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onFileSelect(null);
                }}
                className="mt-3 px-4 py-2 rounded-xl bg-white/80 backdrop-blur border border-rose-100 text-[13px] font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors flex items-center gap-1.5 mx-auto shadow-sm hover:shadow"
              >
                <X className="w-4 h-4" />
                Đổi file
              </button>
            </div>
          ) : (
            <div className="space-y-3 relative z-10 pointer-events-none">
              <div className="w-14 h-14 rounded-[16px] bg-white border border-white/50 backdrop-blur-sm flex items-center justify-center text-[#031D44]/40 shadow-sm group-hover:text-[#031D44] group-hover:scale-105 group-hover:shadow transition-all duration-300 mx-auto">
                <Upload className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <p className="font-bold text-[#031D44] text-[16px] group-hover:text-[#031D44]">Tải file Excel</p>
                <p className="text-[11px] text-[#031D44]/50 font-bold uppercase tracking-[0.05em]">
                  Hỗ trợ .xlsx, .xls, .csv
                </p>
              </div>
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer pointer-events-auto"
                onChange={handleFileChange}
                accept={accept}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
