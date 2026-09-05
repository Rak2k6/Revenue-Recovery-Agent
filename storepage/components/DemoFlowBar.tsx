import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Play, RefreshCw, Check, Circle } from 'lucide-react';

interface DemoFlowBarProps {
  currentStepIndex: number;
  onReset: () => void;
  onRunAutoDemo?: () => void;
}

const STEPS = [
  '1. Checkout review initiated',
  '2. Payment fails',
  '3. Customer views failure & review',
  '4. Backend AI Recovery agent runs',
  '5. Backend creates recovery link',
  '6. Backend notification published',
  '7. Notification bell updates',
  '8. Toast: "Your payment link is ready"',
  '9. Customer clicks "Complete Payment"',
  '10. Customer completes payment',
  '11. Order confirmed & recovered',
];

export const DemoFlowBar: React.FC<DemoFlowBarProps> = ({
  currentStepIndex,
  onReset,
  onRunAutoDemo,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-[#1A1A1A] text-white text-xs border-b border-[#333330]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-3 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Active Step Title in Editorial Style */}
        <div className="flex items-center gap-3">
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#D44D2F] bg-white/10 px-2 py-0.5 border border-[#D44D2F]/30">
            Hackathon Demo Guide
          </span>

          <span className="text-[#9A9A95] text-[11px] uppercase tracking-wider hidden sm:inline">
            Active Sequence:
          </span>
          <span className="font-serif italic text-white text-sm">
            {STEPS[currentStepIndex] || 'Ready to begin (Click Checkout)'}
          </span>
        </div>

        {/* Right: Controls & Stepper Toggle */}
        <div className="flex items-center gap-3">
          {onRunAutoDemo && (
            <button
              onClick={onRunAutoDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-[#1A1A1A] hover:bg-[#E5E5E2] font-bold text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
            >
              <Play className="w-2.5 h-2.5 fill-[#1A1A1A]" />
              <span>Simulate Flow</span>
            </button>
          )}

          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[#9A9A95] hover:text-white text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
            title="Reset to fresh store state"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[#9A9A95] hover:text-white text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'Hide Steps' : 'All 11 Steps'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Step Checklist */}
      {isExpanded && (
        <div className="bg-[#111111] border-t border-[#333330] px-6 sm:px-10 py-4">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px]">
            {STEPS.map((step, idx) => {
              const isPassed = currentStepIndex > idx;
              const isCurrent = currentStepIndex === idx;

              return (
                <div
                  key={step}
                  className={`flex items-center gap-2 p-2 border ${
                    isCurrent
                      ? 'bg-[#222220] border-[#D44D2F] text-white font-semibold'
                      : isPassed
                      ? 'bg-neutral-900 border-neutral-800 text-[#9A9A95]'
                      : 'bg-[#161616] border-neutral-900 text-[#666662]'
                  }`}
                >
                  {isPassed ? (
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <span className="w-1.5 h-1.5 bg-[#D44D2F] rounded-full animate-ping shrink-0" />
                  ) : (
                    <Circle className="w-2.5 h-2.5 text-neutral-700 shrink-0" />
                  )}
                  <span className="truncate">{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
