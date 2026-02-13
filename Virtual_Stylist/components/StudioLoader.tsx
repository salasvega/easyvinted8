import { useEffect, useState } from 'react';

interface Props {
  message?: string;
}

export default function StudioLoader({ message = "Création en cours" }: Props) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="max-w-lg w-full px-6">
        <div className="relative mb-12">
          {/* Cercles animés multiples */}
          <div className="relative w-32 h-32 mx-auto">
            {/* Cercle extérieur lent */}
            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"
                 style={{
                   borderTopColor: '#1f2937',
                   animation: 'spin 3s linear infinite'
                 }}>
            </div>

            {/* Cercle moyen */}
            <div className="absolute inset-3 border-4 border-gray-100 rounded-full"
                 style={{
                   borderRightColor: '#4b5563',
                   animation: 'spin 2s linear infinite reverse'
                 }}>
            </div>

            {/* Cercle intérieur rapide */}
            <div className="absolute inset-6 border-4 border-gray-50 rounded-full"
                 style={{
                   borderBottomColor: '#6b7280',
                   animation: 'spin 1.5s linear infinite'
                 }}>
            </div>

            {/* Points décoratifs animés */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-3 h-3 bg-gray-800 rounded-full" style={{
                animation: 'pulse-scale 2s ease-in-out infinite'
              }}></div>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
              <div className="w-3 h-3 bg-gray-700 rounded-full" style={{
                animation: 'pulse-scale 2s ease-in-out infinite',
                animationDelay: '0.5s'
              }}></div>
            </div>
            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-3 h-3 bg-gray-600 rounded-full" style={{
                animation: 'pulse-scale 2s ease-in-out infinite',
                animationDelay: '1s'
              }}></div>
            </div>
            <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2">
              <div className="w-3 h-3 bg-gray-500 rounded-full" style={{
                animation: 'pulse-scale 2s ease-in-out infinite',
                animationDelay: '1.5s'
              }}></div>
            </div>
          </div>
        </div>

        {/* Texte de chargement avec points animés */}
        <div className="text-center mb-8">
          <p className="text-[9px] sm:text-[10px] font-black tracking-[0.3em] sm:tracking-[0.5em] uppercase text-black mb-2">
            Studio de Création IA
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-2">
            {message}
            <span className="inline-block w-8 text-left">{dots}</span>
          </p>
          <p className="text-sm text-gray-600">
            Modelisation en cours ...
          </p>
        </div>

        {/* Cartes fantômes en grille */}
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden relative"
              style={{
                animation: 'skeleton 1.5s ease-in-out infinite',
                animationDelay: `${index * 0.2}s`
              }}
            >
              {/* Effet de shimmer */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{
                  animation: 'shimmer 2s ease-in-out infinite',
                  animationDelay: `${index * 0.2}s`,
                  transform: 'translateX(-100%)'
                }}
              ></div>

              {/* Icône fantôme */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-gray-300/50 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Message informatif */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-xs font-medium text-gray-700">
              Cela ne prendra qu'un instant
            </span>
          </div>
        </div>

        <style>{`
          @keyframes pulse-scale {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.5);
              opacity: 0.5;
            }
          }

          @keyframes skeleton {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }

          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
