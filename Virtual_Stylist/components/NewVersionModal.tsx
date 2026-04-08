import React, { useState } from 'react';
import { AvatarProfile } from '../types';

interface NewVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalAvatar: AvatarProfile;
  onConfirm: (newName: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  gender: 'Genre',
  ageGroup: 'Âge',
  origin: 'Origine',
  skinTone: 'Carnation',
  hairColor: 'Couleur cheveux',
  hairCut: 'Coupe',
  hairTexture: 'Texture',
  eyeColor: 'Yeux',
  build: 'Corpulence',
  renderStyle: 'Style de rendu',
  additionalFeatures: 'Traits distinctifs'
};

const formatValue = (value: any): string => {
  if (typeof value === 'string') {
    return value.replace(/_/g, ' ');
  }
  return String(value);
};

export const NewVersionModal: React.FC<NewVersionModalProps> = ({
  isOpen,
  onClose,
  originalAvatar,
  onConfirm
}) => {
  const [newName, setNewName] = useState(`${originalAvatar.name} - V2`);
  const [errorMessage, setErrorMessage] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!newName.trim()) {
      setErrorMessage('Le nom ne peut pas être vide');
      return;
    }
    onConfirm(newName.trim());
    onClose();
  };

  const identicalFields = [
    'gender', 'ageGroup', 'origin', 'skinTone', 'hairColor',
    'hairCut', 'hairTexture', 'eyeColor', 'build', 'additionalFeatures'
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Créer une nouvelle version</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="text-blue-600 hover:text-blue-700 transition-colors p-1 rounded-full hover:bg-blue-50"
                title="Informations"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {showInfo && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200 animate-fadeIn">
              <div className="flex items-start justify-between">
                <div className="flex items-start flex-1">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Créer une variante sans régénérer</p>
                    <p>Cette action créera une copie de ce modèle avec toutes ses caractéristiques physiques. Vous pourrez ensuite modifier uniquement le style de rendu ou les métadonnées sans tout régénérer.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="text-blue-400 hover:text-blue-600 transition-colors ml-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de la nouvelle version
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setErrorMessage('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Marie - Studio, Marie - Casual..."
            />
            {errorMessage && (
              <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
            )}
            <p className="mt-2 text-sm text-gray-500">
              Suggestion: Utilisez un nom descriptif pour identifier facilement cette variante (ex: style, usage, ambiance)
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Aperçu des caractéristiques</h3>

            <div className="mb-4">
              <div className="flex items-center mb-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                <span className="text-sm font-medium text-gray-700">Ce qui change</span>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700">Nom</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{originalAvatar.name}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-orange-700">{newName}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center mb-2">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span className="text-sm font-medium text-gray-700">Ce qui reste identique</span>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200 space-y-2">
                {identicalFields.map((field) => {
                  const value = originalAvatar[field as keyof AvatarProfile];
                  if (!value) return null;

                  return (
                    <div key={field} className="flex justify-between text-sm">
                      <span className="text-gray-600">{FIELD_LABELS[field]}</span>
                      <span className="font-medium text-gray-800 capitalize">
                        {formatValue(value)}
                      </span>
                    </div>
                  );
                })}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Style de rendu</span>
                  <span className="font-medium text-gray-800 capitalize">
                    {formatValue(originalAvatar.renderStyle)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              Créer la version
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
