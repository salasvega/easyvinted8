import { useEffect, useState } from 'react';
import { Sparkles, Eye, Tag, DollarSign, Palette, CheckCircle2 } from 'lucide-react';

interface Props {
  stage?: 'uploading' | 'analyzing' | 'processing' | 'finalizing';
}

const STAGE_MESSAGES = {
  uploading: {
    title: 'Upload des photos',
    subtitle: 'Préparation des images pour l\'analyse...',
    icon: Sparkles,
  },
  analyzing: {
    title: 'Analyse en cours',
    subtitle: 'Kelly examine vos photos en détail...',
    icon: Eye,
  },
  processing: {
    title: 'Extraction des données',
    subtitle: 'Identification de la marque, taille, couleur...',
    icon: Tag,
  },
  finalizing: {
    title: 'Finalisation',
    subtitle: 'Génération du titre et de la description...',
    icon: CheckCircle2,
  },
};

const CONTEXTUAL_MESSAGES = [
  "Analyse de la marque et du modèle...",
  "Détection de la couleur et du matériau...",
  "Identification de la taille...",
  "Évaluation de l'état de l'article...",
  "Génération du titre optimisé...",
  "Création de la description détaillée...",
  "Suggestion du prix optimal...",
  "Optimisation SEO et hashtags...",
];

export function ArticleAnalysisLoader({ stage = 'analyzing' }: Props) {
  const [dots, setDots] = useState('');
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const stageConfig = STAGE_MESSAGES[stage];
  const Icon = stageConfig.icon;

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(dotsInterval);
  }, []);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex(prev => (prev + 1) % CONTEXTUAL_MESSAGES.length);
    }, 2500);
    return () => clearInterval(messageInterval);
  }, []);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 3;
      });
    }, 300);
    return () => clearInterval(progressInterval);
  }, []);

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/95 via-white/95 to-green-50/95 backdrop-blur-md flex items-center justify-center z-[100]">
      <div className="max-w-lg w-full px-6">
        <div className="relative mb-12">
          {/* Cercles animés multiples */}
          <div className="relative w-32 h-32 mx-auto">
            {/* Cercle extérieur lent */}
            <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"
                 style={{
                   borderTopColor: '#10b981',
                   animation: 'spin 3s linear infinite'
                 }}>
            </div>

            {/* Cercle moyen */}
            <div className="absolute inset-3 border-4 border-green-50 rounded-full"
                 style={{
                   borderRightColor: '#059669',
                   animation: 'spin 2s linear infinite reverse'
                 }}>
            </div>

            {/* Cercle intérieur rapide */}
            <div className="absolute inset-6 border-4 border-emerald-50 rounded-full"
                 style={{
                   borderBottomColor: '#34d399',
                   animation: 'spin 1.5s linear infinite'
                 }}>
            </div>

            {/* Icône centrale */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30"
                   style={{ animation: 'pulse 2s ease-in-out infinite' }}>
                <Icon className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Points décoratifs animés */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-3 h-3 bg-emerald-600 rounded-full" style={{
                animation: 'pulse-scale 2s ease-in-out infinite'
              }}></div>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
              <div className="w-3 h-3 bg-green-600 rounded-full" style={{
                animation: 'pulse-scale 2s ease-in-out infinite',
                animationDelay: '0.5s'
              }}></div>
            </div>
            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full" style={{
                animation: 'pulse-scale 2s ease-in-out infinite',
                animationDelay: '1s'
              }}></div>
            </div>
            <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2">
              <div className="w-3 h-3 bg-green-500 rounded-full" style={{
                animation: 'pulse-scale 2s ease-in-out infinite',
                animationDelay: '1.5s'
              }}></div>
            </div>
          </div>
        </div>

        {/* Texte de chargement avec points animés */}
        <div className="text-center mb-8">
          <p className="text-[9px] sm:text-[10px] font-black tracking-[0.3em] sm:tracking-[0.5em] uppercase text-emerald-600 mb-2">
            Kelly AI Assistant
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-2">
            {stageConfig.title}
            <span className="inline-block w-8 text-left">{dots}</span>
          </p>
          <p className="text-sm text-gray-600">
            {stageConfig.subtitle}
          </p>
        </div>

        {/* Barre de progression */}
        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="h-full bg-gradient-to-r from-white/0 via-white/30 to-white/0 animate-shimmer"></div>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">{Math.round(progress)}%</p>
        </div>

        {/* Message contextuel avec transition */}
        <div className="mb-8 h-6 flex items-center justify-center">
          <div
            className="text-sm font-medium text-emerald-700 transition-all duration-500"
            key={currentMessageIndex}
            style={{
              animation: 'fadeInUp 0.5s ease-out'
            }}
          >
            {CONTEXTUAL_MESSAGES[currentMessageIndex]}
          </div>
        </div>

        {/* Icônes d'analyse en grille */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { icon: Eye, label: 'Vision', delay: '0s' },
            { icon: Tag, label: 'Tags', delay: '0.2s' },
            { icon: Palette, label: 'Couleur', delay: '0.4s' },
            { icon: DollarSign, label: 'Prix', delay: '0.6s' },
          ].map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-emerald-100 shadow-sm"
              style={{
                animation: 'skeleton 1.5s ease-in-out infinite',
                animationDelay: item.delay
              }}
            >
              <item.icon className="w-6 h-6 text-emerald-500" />
              <span className="text-xs text-gray-600 font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Message informatif */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-xs font-medium text-emerald-700">
              Analyse en cours, merci de patienter
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
              transform: scale(1);
            }
            50% {
              opacity: 0.6;
              transform: scale(0.98);
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

          @keyframes fadeInUp {
            0% {
              opacity: 0;
              transform: translateY(10px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .animate-shimmer {
            animation: shimmer 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    </div>
  );
}
