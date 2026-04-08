import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface PriceSuggestionProps {
  brand?: string;
  title?: string;
  condition?: string;
  currentPrice?: number;
  onApplyPrice?: (price: number) => void;
  cachedSuggestion?: PricingData | null;
  onSuggestionGenerated?: (data: PricingData) => void;
  autoGenerate?: boolean;
}

export interface PricingData {
  suggestedMin: number;
  suggestedMax: number;
  optimal: number;
  reasoning: string;
  confidence: number;
}

function getAI() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

async function getPriceSuggestion(
  brand: string,
  title: string,
  condition: string
): Promise<PricingData> {
  const ai = getAI();

  const prompt = `Tu es un expert pricing pour Vinted. Analyse et suggère un prix optimal pour cet article:

Titre: ${title}
Marque: ${brand}
État: ${condition}

IMPORTANT: Base-toi sur le marché réel Vinted français. Les prix doivent être RÉALISTES pour la revente.

Réponds en JSON strict:
{
  "suggestedMin": 15,
  "suggestedMax": 25,
  "optimal": 19,
  "reasoning": "Pour une pièce ${brand} en ${condition}, le marché Vinted se situe à 15-25€. Le prix optimal de 19€ maximise tes chances de vente rapide.",
  "confidence": 0.85
}

Génère maintenant:`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
  });

  const result = response.text;
  return JSON.parse(result);
}

export function PriceSuggestion({
  brand,
  title,
  condition,
  currentPrice,
  onApplyPrice,
  cachedSuggestion,
  onSuggestionGenerated,
  autoGenerate = false,
}: PriceSuggestionProps) {
  const [suggestion, setSuggestion] = useState<PricingData | null>(cachedSuggestion || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedSuggestion) {
      setSuggestion(cachedSuggestion);
      return;
    }
  }, [cachedSuggestion]);

  useEffect(() => {
    if (!autoGenerate) return;
    if (cachedSuggestion) return;
    if (!brand || !title || !condition) {
      setSuggestion(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPriceSuggestion(brand, title, condition);
        setSuggestion(data);
        if (onSuggestionGenerated) {
          onSuggestionGenerated(data);
        }
      } catch (err) {
        console.error('Error getting price suggestion:', err);
        setError('Impossible de générer une suggestion');
      } finally {
        setLoading(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [brand, title, condition, autoGenerate, cachedSuggestion, onSuggestionGenerated]);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
        <span className="text-sm text-blue-700">Kelly analyse le prix optimal...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-700">{error}</span>
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  const getStatus = () => {
    if (!currentPrice) return 'neutral';
    if (currentPrice < suggestion.suggestedMin) return 'low';
    if (currentPrice > suggestion.suggestedMax) return 'high';
    return 'optimal';
  };

  const status = getStatus();

  const statusConfig = {
    low: {
      icon: TrendingUp,
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      label: 'Prix trop bas',
      message: `Tu pourrais gagner ${suggestion.optimal - (currentPrice || 0)}€ de plus!`,
    },
    high: {
      icon: TrendingDown,
      color: 'text-red-600 bg-red-50 border-red-200',
      label: 'Prix trop élevé',
      message: 'Risque de vente plus lente',
    },
    optimal: {
      icon: CheckCircle2,
      color: 'text-green-600 bg-green-50 border-green-200',
      label: 'Prix optimal!',
      message: 'Ton prix est parfait',
    },
    neutral: {
      icon: Sparkles,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      label: 'Suggestion de Kelly',
      message: suggestion.reasoning,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`border rounded-lg p-3 ${config.color}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-1">{config.label}</div>
          <div className="text-xs mb-2">{config.message}</div>

          <div className="bg-white bg-opacity-60 rounded p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Fourchette:</span>
              <span className="font-semibold">
                {suggestion.suggestedMin}€ - {suggestion.suggestedMax}€
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Prix optimal:</span>
              <span className="font-bold text-green-600">{suggestion.optimal}€</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Confiance:</span>
              <span className="font-medium">{Math.round(suggestion.confidence * 100)}%</span>
            </div>
          </div>

          {status !== 'optimal' && onApplyPrice && (
            <button
              onClick={() => onApplyPrice(suggestion.optimal)}
              className="mt-2 w-full bg-gray-900 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-800 transition-colors"
            >
              Appliquer {suggestion.optimal}€
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
