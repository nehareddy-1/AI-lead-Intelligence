import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles, Database } from 'lucide-react';

interface UploadZoneProps {
  onFileUpload: (file: File) => void;
  onLoadSample: () => void;
  error?: string | null;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileUpload,
  onLoadSample,
  error,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel') {
        onFileUpload(file);
      } else {
        alert('Please upload a valid .csv file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  const expectedFields = [
    'Name',
    'Phone',
    'Email',
    'Location',
    'Education',
    'Experience',
    'German Level',
    'Lead Source',
    'Last Contacted',
    'Conversation / Notes',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-8 sm:p-10 text-center border-b border-slate-100 bg-linear-to-b from-slate-50/50 to-white">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-4 shadow-2xs">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Upload Lead Dataset
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Upload a CSV containing your B2C leads. The system will clean, understand, prioritize and prepare each lead for sales outreach.
          </p>
        </div>

        {/* Drop Area & Content */}
        <div className="p-6 sm:p-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Dataset Error:</span> {error}
              </div>
            </div>
          )}

          {/* Drag & Drop Target */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/60 scale-[1.008]'
                : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/70 bg-slate-50/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,text/csv"
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100/70 text-indigo-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-semibold text-slate-800">
                  Drop your CSV here
                </p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  or select a file from your computer
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs cursor-pointer"
              >
                Browse CSV
              </button>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-2 border-t border-slate-200/60 w-full max-w-sm">
                <span>Supported format: <strong>CSV</strong></span>
                <span>&bull;</span>
                <span>Maximum leads: <strong>100</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Start with 30 Sample Leads Button */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">
                  Demonstration Dataset Available
                </p>
                <p className="text-xs text-slate-600">
                  Load 30 pre-configured leads with realistic messy fields, duplicates, and edge cases.
                </p>
              </div>
            </div>
            <button
              onClick={onLoadSample}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition shadow-2xs shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Load Sample 30 Leads
            </button>
          </div>

          {/* Expected Fields Info */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Expected CSV Fields (Messy & Missing Data Tolerated)
              </h3>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                Resilient Parser
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs text-slate-700">
              {expectedFields.map((field) => (
                <div
                  key={field}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100/70 border border-slate-200/60 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium truncate">{field}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500 leading-normal">
              *The pipeline does not require every column or value. Real-world B2C inquiries often lack language grades, phone formatting, or structured notes. Missing attributes will be flagged during the Clean and Reviewer phases.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
