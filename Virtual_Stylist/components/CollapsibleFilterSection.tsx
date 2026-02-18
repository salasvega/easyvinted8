import React, { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

interface CollapsibleFilterSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent';
}

export const CollapsibleFilterSection: React.FC<CollapsibleFilterSectionProps> = ({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  children,
  variant = 'primary'
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isHovered, setIsHovered] = useState(false);

  const variantStyles = {
    primary: {
      bg: 'bg-gradient-to-br from-slate-50 via-white to-slate-50',
      border: 'border-slate-200',
      headerBg: 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900',
      headerHover: 'hover:from-slate-800 hover:via-slate-700 hover:to-slate-800',
      textColor: 'text-white',
      iconColor: 'text-slate-300',
      accentColor: 'bg-slate-500',
      glowColor: 'shadow-slate-500/20'
    },
    secondary: {
      bg: 'bg-gradient-to-br from-amber-50 via-white to-amber-50',
      border: 'border-amber-200',
      headerBg: 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400',
      headerHover: 'hover:from-amber-300 hover:via-amber-200 hover:to-amber-300',
      textColor: 'text-gray-900',
      iconColor: 'text-gray-700',
      accentColor: 'bg-amber-500',
      glowColor: 'shadow-amber-400/20'
    },
    accent: {
      bg: 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50',
      border: 'border-emerald-200',
      headerBg: 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600',
      headerHover: 'hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-500',
      textColor: 'text-white',
      iconColor: 'text-emerald-100',
      accentColor: 'bg-emerald-400',
      glowColor: 'shadow-emerald-500/20'
    }
  };

  const currentVariant = variantStyles[variant];

  return (
    <div
      className={`rounded-2xl border ${currentVariant.border} ${currentVariant.bg} overflow-hidden transition-all duration-500 ${
        isOpen ? `shadow-2xl ${currentVariant.glowColor}` : 'shadow-lg hover:shadow-xl'
      } ${isHovered ? 'scale-[1.01]' : 'scale-100'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-full ${currentVariant.headerBg} ${currentVariant.headerHover} ${currentVariant.textColor} px-6 py-4 flex items-center justify-between transition-all duration-300 group overflow-hidden`}
      >
        {/* Animated background shimmer */}
        <div className={`absolute inset-0 ${currentVariant.accentColor} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

        {/* Sparkle effect on hover */}
        {isHovered && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <Sparkles className="w-6 h-6 text-white/20 animate-pulse" />
          </div>
        )}

        <div className="flex items-center gap-3 relative z-10">
          {icon && (
            <div className={`${currentVariant.iconColor} transition-all duration-500 ${
              isOpen ? 'scale-110 rotate-12' : 'scale-100 rotate-0'
            } ${isHovered ? 'animate-pulse' : ''}`}>
              {icon}
            </div>
          )}
          <div className="text-left">
            <h3 className={`text-sm font-black uppercase tracking-wider transition-all duration-300 ${
              isOpen ? 'scale-105' : 'scale-100'
            }`}>
              {title}
            </h3>
            {subtitle && (
              <p className={`text-[10px] ${currentVariant.iconColor} opacity-90 mt-0.5 transition-all duration-300 ${
                isOpen ? 'opacity-100' : 'opacity-70'
              }`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          {isOpen && (
            <span className={`text-[9px] font-bold uppercase tracking-wider ${currentVariant.iconColor} animate-in fade-in slide-in-from-right-2 duration-300`}>
              Masquer
            </span>
          )}
          <ChevronDown
            className={`w-5 h-5 transition-all duration-500 ${
              isOpen ? 'rotate-180 scale-110' : 'rotate-0 scale-100'
            } ${isHovered ? 'scale-125' : ''}`}
          />
        </div>
      </button>

      <div
        className={`transition-all duration-500 ease-in-out ${
          isOpen
            ? 'max-h-[2000px] opacity-100'
            : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className={`p-6 ${isOpen ? 'animate-in fade-in slide-in-from-top-4 duration-700' : ''}`}>
          {children}
        </div>
      </div>

      {/* Bottom accent line when open */}
      {isOpen && (
        <div className={`h-1 ${currentVariant.accentColor} animate-in slide-in-from-left duration-700`} />
      )}
    </div>
  );
};
