import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

interface FashionLoaderProps {
  context?: 'model' | 'accessory' | 'background' | 'pose' | 'general';
  className?: string;
  compact?: boolean;
}

const LOADING_MESSAGES = {
  model: [
    "Création de votre mannequin...",
    "Ajustement des proportions...",
    "Calibrage du style vestimentaire...",
    "Analyse de la silhouette...",
    "Finalisation du rendu...",
  ],
  accessory: [
    "Essayage de l'accessoire...",
    "Ajustement de la position...",
    "Harmonisation des couleurs...",
    "Vérification du rendu...",
    "Dernières retouches...",
  ],
  background: [
    "Analyse de l'environnement...",
    "Optimisation de l'éclairage...",
    "Ajustement du contraste...",
    "Harmonisation des couleurs...",
    "Finalisation de l'arrière-plan...",
  ],
  pose: [
    "Génération de la nouvelle pose...",
    "Ajustement de la perspective...",
    "Préservation des détails...",
    "Harmonisation de l'éclairage...",
    "Finalisation du rendu...",
  ],
  general: [
    "Analyse de l'image...",
    "Ajustement de l'éclairage...",
    "Application des modifications...",
    "Optimisation du rendu...",
    "Dernières retouches...",
  ],
};

export function FashionLoader({ context = 'general', className = '', compact = false }: FashionLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [scanPosition, setScanPosition] = useState(0);

  const messages = LOADING_MESSAGES[context];

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => clearInterval(messageInterval);
  }, [messages.length]);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 30) {
          return prev + 2;
        } else if (prev < 95) {
          return prev + 0.3;
        }
        return prev;
      });
    }, 100);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    const scanInterval = setInterval(() => {
      setScanPosition((prev) => (prev >= 100 ? 0 : prev + 2));
    }, 50);

    return () => clearInterval(scanInterval);
  }, []);

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-400 rounded-full blur-md opacity-30 animate-pulse" />
          <div className="relative bg-gradient-to-br from-emerald-600 to-green-600 rounded-full p-2 shadow-lg">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-900 animate-fade-in">
            {messages[messageIndex]}
          </p>
          <div className="mt-1 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative w-full max-w-md">
        <div className="relative bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-8 shadow-lg border border-emerald-100 overflow-hidden">
          <div
            className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60 transition-all duration-75 ease-linear"
            style={{ transform: `translateX(${scanPosition - 50}%)` }}
          />

          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur-xl opacity-30 animate-pulse" />
              <div className="relative bg-gradient-to-br from-emerald-600 to-green-600 rounded-full p-4 shadow-lg">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-lg font-bold text-emerald-900 animate-fade-in">
                {messages[messageIndex]}
              </p>
              <p className="text-sm text-emerald-600">
                Magie de l'IA en cours...
              </p>
            </div>

            <div className="w-full space-y-2">
              <div className="relative h-3 bg-emerald-100 rounded-full overflow-hidden shadow-inner">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 rounded-full transition-all duration-300 ease-out shadow-lg"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
                </div>
              </div>
              <p className="text-xs text-center text-emerald-500 font-medium">
                {Math.round(Math.min(progress, 100))}%
              </p>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }

        @keyframes fade-in {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
