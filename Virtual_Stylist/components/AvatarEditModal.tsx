import React, { useState } from 'react';
import { X, Info, Save, AlertCircle, ChevronDown } from 'lucide-react';
import { AvatarProfile, Gender, AgeGroup, Origin, SkinTone, HairColor, EyeColor, HairCut, HairTexture, Build, RenderStyle } from '../types';

interface AvatarEditModalProps {
  avatar: AvatarProfile;
  onClose: () => void;
  onSave: (data: Partial<AvatarProfile>) => void;
  isProcessing?: boolean;
}

const SKIN_COLORS: Record<SkinTone, string> = {
  porcelain: '#F7E7E2', golden_fair: '#F8F4D0', fair: '#F3D9C9', light: '#F0CBB0',
  medium: '#EBB68D', medium_cool: '#D0A78B', light_tan: '#C6A681', tan: '#AD8360',
  bronze_medium: '#D9A873', bronze_dark: '#C18E5E', dark: '#8C5B3F', deep: '#624335'
};

const HAIR_COLORS: Record<HairColor, string> = {
  platinum: '#E5DECF', blonde: '#D1A361', honey: '#B98C46', ginger: '#BC5434',
  red: '#A62C2B', auburn: '#7E3128', chestnut: '#5E3A2B', brown: '#4A2E1F',
  chocolate: '#362016', black: '#1A1A1A', grey: '#8E8E8E', plum: '#5A314A'
};

const EYE_COLORS: Record<EyeColor, string> = {
  blue: '#7BB9E8', green: '#7C9E59', brown: '#634133', grey: '#8E9DA2', honey: '#BA8C08', black: '#1C1C1C'
};

const cuts: { id: HairCut; label: string }[] = [
  { id: 'bald', label: 'Chauve' },
  { id: 'short', label: 'Cheveux Courts' },
  { id: 'medium', label: 'Cheveux Mi-longs' },
  { id: 'long', label: 'Cheveux Longs' }
];

const textures: { id: HairTexture; label: string }[] = [
  { id: 'straight', label: 'Lisses' },
  { id: 'wavy', label: 'Ondulés' },
  { id: 'curly', label: 'Bouclés' },
  { id: 'coily', label: 'Frisés' }
];

const skinTones: SkinTone[] = [
  'porcelain', 'golden_fair', 'fair', 'light', 'medium', 'medium_cool',
  'light_tan', 'tan', 'bronze_medium', 'bronze_dark', 'dark', 'deep'
];

const hairColors: HairColor[] = [
  'platinum', 'blonde', 'honey', 'ginger', 'red', 'auburn',
  'chestnut', 'brown', 'chocolate', 'black', 'grey', 'plum'
];

const eyeColors: EyeColor[] = ['blue', 'green', 'brown', 'grey', 'honey', 'black'];

const ColorPicker: React.FC<{
  value: string;
  colors: Record<string, string>;
  onChange: (value: string) => void;
  label: string;
}> = ({ value, colors, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all group"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="w-6 h-6 rounded-lg shadow-sm ring-1 ring-black/10"
            style={{ backgroundColor: colors[value] }}
          />
          <span className="text-xs sm:text-sm font-semibold text-gray-900 capitalize truncate">
            {value.replace(/_/g, ' ')}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(colors).map(([key, color]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setIsOpen(false);
                  }}
                  className={`relative w-full aspect-square rounded-lg transition-all hover:scale-110 ${
                    value === key ? 'ring-2 ring-black ring-offset-2 scale-110' : 'ring-1 ring-black/10'
                  }`}
                  style={{ backgroundColor: color }}
                  title={key.replace(/_/g, ' ')}
                >
                  {value === key && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white shadow-lg" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all appearance-none cursor-pointer"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const AvatarEditModal: React.FC<AvatarEditModalProps> = ({
  avatar,
  onClose,
  onSave,
  isProcessing = false
}) => {
  const [formData, setFormData] = useState<AvatarProfile>({ ...avatar });
  const [showInfo, setShowInfo] = useState(false);

  const updateField = <K extends keyof AvatarProfile>(field: K, value: AvatarProfile[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 lg:p-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] sm:max-h-[85vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex-shrink-0 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-serif italic text-gray-900 mb-1">
                Éditer le modèle
              </h2>
              <p className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-gray-400">
                Modifier les caractéristiques
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInfo(!showInfo)}
                className={`p-2.5 rounded-xl transition-all ${
                  showInfo
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
                title="Informations"
              >
                <Info className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all text-gray-600 hover:text-gray-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Info Banner */}
          {showInfo && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-blue-900">
                  <p className="font-bold mb-1.5">Modifications des métadonnées</p>
                  <p>Les modifications que vous apportez ici mettent à jour les caractéristiques du modèle (nom, attributs, style) sans régénérer la photo.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Preview Sidebar */}
          <div className="hidden lg:flex w-64 xl:w-72 flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 border-r border-gray-200 p-4 overflow-y-auto">
            <div className="space-y-3 w-full">
              <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-xl ring-1 ring-black/5">
                <img
                  src={formData.photoBase64}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <p className="text-xs font-bold text-gray-900 mb-2 truncate">{formData.name || 'Sans nom'}</p>
                <div className="space-y-1 text-[10px] text-gray-600">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Genre</span>
                    <span className="font-semibold capitalize">{formData.gender === 'masculine' ? 'Masculin' : 'Féminin'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Âge</span>
                    <span className="font-semibold capitalize">
                      {formData.ageGroup === 'baby' ? 'Bébé' : formData.ageGroup === 'child' ? 'Enfant' : formData.ageGroup === 'teen' ? 'Ado' : formData.ageGroup === 'senior' ? 'Senior' : 'Adulte'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Style</span>
                    <span className="font-semibold capitalize">
                      {formData.renderStyle === 'casual' ? 'Décontracté' : formData.renderStyle === '3d_hyperrealistic' ? '3D Hyper' : 'Studio Pro'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Form Fields */}
            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8 pb-6">

              {/* Identity Section */}
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                  <span className="text-2xl">👤</span>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900">
                    Identité
                  </h3>
                </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">
                      Nom du modèle
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => updateField('name', e.target.value)}
                      placeholder="Ex: Sophie, Model Paris..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:gap-5">
                    <SelectField
                      label="Genre"
                      value={formData.gender}
                      onChange={v => updateField('gender', v as Gender)}
                      options={[
                        { value: 'masculine', label: 'Masculin' },
                        { value: 'feminine', label: 'Féminin' }
                      ]}
                    />
                    <SelectField
                      label="Âge"
                      value={formData.ageGroup}
                      onChange={v => updateField('ageGroup', v as AgeGroup)}
                      options={[
                        { value: 'baby', label: 'Bébé' },
                        { value: 'child', label: 'Enfant' },
                        { value: 'teen', label: 'Ado' },
                        { value: 'adult', label: 'Adulte' },
                        { value: 'senior', label: 'Senior' }
                      ]}
                    />
                  </div>

                  <SelectField
                    label="Origine"
                    value={formData.origin}
                    onChange={v => updateField('origin', v as Origin)}
                    options={[
                      { value: 'african', label: 'Afro' },
                      { value: 'east_asian', label: 'Est-Asiatique' },
                      { value: 'south_asian', label: 'Sud-Asiatique' },
                      { value: 'caucasian', label: 'Européen' },
                      { value: 'hispanic', label: 'Latino' },
                      { value: 'middle_eastern', label: 'Moyen-Orient' }
                    ]}
                  />
                </div>

              {/* Appearance Section */}
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                  <span className="text-2xl">✨</span>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900">
                    Apparence
                  </h3>
                </div>

                <SelectField
                  label="Morphologie"
                  value={formData.build}
                  onChange={v => updateField('build', v as Build)}
                  options={[
                    { value: 'slim', label: 'Mince' },
                    { value: 'average', label: 'Moyen' },
                    { value: 'athletic', label: 'Athlétique' },
                    { value: 'curvy', label: 'Rond' }
                  ]}
                />

                <ColorPicker
                  label="Carnation"
                  value={formData.skinTone}
                  colors={SKIN_COLORS}
                  onChange={v => updateField('skinTone', v as SkinTone)}
                />

                <div className="grid grid-cols-2 gap-4 sm:gap-5">
                    <ColorPicker
                      label="Couleur Cheveux"
                      value={formData.hairColor}
                      colors={HAIR_COLORS}
                      onChange={v => updateField('hairColor', v as HairColor)}
                    />
                    <ColorPicker
                      label="Couleur Yeux"
                      value={formData.eyeColor}
                      colors={EYE_COLORS}
                      onChange={v => updateField('eyeColor', v as EyeColor)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:gap-5">
                    <SelectField
                      label="Coupe Cheveux"
                      value={formData.hairCut}
                      onChange={v => updateField('hairCut', v as HairCut)}
                      options={cuts.map(c => ({ value: c.id, label: c.label }))}
                    />
                    <SelectField
                      label="Texture Cheveux"
                      value={formData.hairTexture}
                      onChange={v => updateField('hairTexture', v as HairTexture)}
                      options={textures.map(t => ({ value: t.id, label: t.label }))}
                    />
                  </div>
                </div>

              {/* Style Section */}
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                  <span className="text-2xl">🎨</span>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900">
                    Style
                  </h3>
                </div>

                <SelectField
                  label="Direction Artistique"
                  value={formData.renderStyle || 'studio'}
                  onChange={v => updateField('renderStyle', v as RenderStyle)}
                  options={[
                    { value: 'casual', label: 'Décontracté' },
                    { value: 'studio', label: 'Studio Pro' },
                    { value: '3d_hyperrealistic', label: '3D Hyperréaliste' }
                  ]}
                />

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">
                    Caractéristiques supplémentaires
                  </label>
                  <textarea
                    value={formData.additionalFeatures}
                    onChange={e => updateField('additionalFeatures', e.target.value)}
                    placeholder="Ex: Sourire chaleureux, lunettes rondes, tatouage au poignet..."
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all resize-none"
                    rows={5}
                  />
                  <p className="mt-2 text-[10px] sm:text-xs text-gray-400">
                    Ajoutez des détails spécifiques pour personnaliser davantage votre modèle
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-t border-gray-200 bg-gray-50 shadow-lg">
          <div className="flex justify-end">
            <button
              onClick={() => onSave(formData)}
              disabled={!formData.name.trim() || isProcessing}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-xs sm:text-sm uppercase tracking-wide transition-all ${
                formData.name.trim() && !isProcessing
                  ? 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarEditModal;
