import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleFilterSectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'primary' | 'secondary' | 'accent';
  children: React.ReactNode;
}

export const CollapsibleFilterSection: React.FC<CollapsibleFilterSectionProps> = ({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  variant = 'primary',
  children
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isHovered, setIsHovered] = useState(false);

  const variantStyles = {
    primary: {
      header: 'bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200',
      headerOpen: 'bg-gradient-to-r from-slate-100 to-slate-200',
      border: 'border-slate-200',
      accent: 'border-slate-400',
      text: 'text-slate-900',
      icon: 'text-slate-700',
      button: 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800',
      shimmer: 'from-transparent via-slate-300/30 to-transparent'
    },
    secondary: {
      header: 'bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100',
      headerOpen: 'bg-gradient-to-r from-amber-100 to-orange-100',
      border: 'border-amber-200',
      accent: 'border-amber-400',
      text: 'text-amber-900',
      icon: 'text-amber-700',
      button: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700',
      shimmer: 'from-transparent via-amber-300/30 to-transparent'
    },
    accent: {
      header: 'bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100',
      headerOpen: 'bg-gradient-to-r from-emerald-100 to-green-100',
      border: 'border-emerald-200',
      accent: 'border-emerald-400',
      text: 'text-emerald-900',
      icon: 'text-emerald-700',
      button: 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700',
      shimmer: 'from-transparent via-emerald-300/30 to-transparent'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={`
        rounded-2xl border ${styles.border} overflow-hidden
        transition-all duration-500 ease-in-out
        ${isOpen ? `shadow-xl ${isHovered ? 'scale-[1.01]' : ''}` : 'shadow-md hover:scale-[1.01]'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-6 py-4 flex items-center justify-between
          transition-all duration-500 ease-in-out
          relative overflow-hidden
          ${isOpen ? styles.headerOpen : styles.header}
        `}
      >
        {isHovered && (
          <div
            className={`
              absolute inset-0 bg-gradient-to-r ${styles.shimmer}
              animate-[shimmer_2s_infinite]
            `}
          />
        )}

        <div className="flex items-center gap-3 relative z-10">
          <div className={`
            ${styles.icon}
            transition-all duration-300
            ${isHovered ? 'scale-110 rotate-6' : ''}
          `}>
            {icon}
          </div>
          <div className="text-left">
            <h3 className={`font-semibold ${styles.text}`}>{title}</h3>
            <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          {isOpen && isHovered && (
            <span className="text-xs text-gray-600 animate-in fade-in duration-300">
              Masquer
            </span>
          )}

          <ChevronDown
            className={`
              w-5 h-5 ${styles.icon}
              transition-transform duration-500 ease-in-out
              ${isOpen ? 'rotate-180' : ''}
            `}
          />
        </div>
      </button>

      <div
        className={`
          transition-all duration-500 ease-in-out
          ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
          overflow-hidden
        `}
      >
        <div className="p-6 bg-white">
          {children}
        </div>

        {isOpen && (
          <div className={`h-1 bg-gradient-to-r ${styles.button}`} />
        )}
      </div>
    </div>
  );
};
