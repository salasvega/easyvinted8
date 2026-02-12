import { useState } from 'react';
import { FashionLoader } from '../components/ui/FashionLoader';

export default function FashionLoaderDemo() {
  const [context, setContext] = useState<'model' | 'accessory' | 'background' | 'pose' | 'general'>('general');

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Fashion Loader Demo</h1>
          <p className="text-slate-600">
            Test des différents contextes de chargement pour le Studio Magik-AI
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Sélectionner le contexte</h2>
          <div className="flex flex-wrap gap-3">
            {(['model', 'accessory', 'background', 'pose', 'general'] as const).map((ctx) => (
              <button
                key={ctx}
                onClick={() => setContext(ctx)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  context === ctx
                    ? 'bg-purple-600 text-white shadow-lg scale-105'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {ctx}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-8 min-h-[500px]">
          <FashionLoader context={context} />
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-slate-900 mb-3">Caractéristiques</h3>
          <ul className="space-y-2 text-slate-700">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Messages rotatifs toutes les 2 secondes
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Progression pseudo intelligente (30% rapide → 95% lente)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Effet de scan visuel animé
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Messages contextuels selon l'action
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
