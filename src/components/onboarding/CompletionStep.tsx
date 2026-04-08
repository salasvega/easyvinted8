import { useState, useEffect } from 'react';
import { User, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CompletionStepProps {
  onComplete: () => void;
  userName: string;
  avatarId: string | null;
  locationId: string | null;
}

interface Avatar {
  id: string;
  name: string;
  photo_base64: string;
}

interface Location {
  id: string;
  name: string;
  photo_base64: string;
}

export default function CompletionStep({ onComplete, userName, avatarId, locationId }: CompletionStepProps) {
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [location, setLocation] = useState<Location | null>(null);

  useEffect(() => {
    loadAvatarAndLocation();
  }, [avatarId, locationId]);

  async function loadAvatarAndLocation() {
    try {
      if (avatarId) {
        const { data } = await supabase
          .from('avatars')
          .select('id, name, photo_base64')
          .eq('id', avatarId)
          .maybeSingle();
        if (data) setAvatar(data);
      }

      if (locationId) {
        const { data } = await supabase
          .from('locations')
          .select('id, name, photo_base64')
          .eq('id', locationId)
          .maybeSingle();
        if (data) setLocation(data);
      }
    } catch (error) {
      console.error('Error loading avatar/location:', error);
    }
  }
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center">
        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl sm:text-3xl md:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4 px-4">
        Bienvenue sur EasyVinted, {userName} !
      </h2>

      <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8 px-4">
        Votre compte est prêt. Vous pouvez maintenant commencer à créer vos articles et gérer vos ventes facilement.
      </p>

      {(avatar || location) && (
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-white border-2 border-blue-200 rounded-xl">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Votre identité visuelle</h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {avatar && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Avatar</span>
                </div>
                <div className="aspect-square rounded-lg overflow-hidden mb-2">
                  <img
                    src={avatar.photo_base64}
                    alt={avatar.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-sm font-medium text-slate-700 truncate">{avatar.name}</p>
              </div>
            )}
            {location && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Environnement</span>
                </div>
                <div className="aspect-square rounded-lg overflow-hidden mb-2">
                  <img
                    src={location.photo_base64}
                    alt={location.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-sm font-medium text-slate-700 truncate">{location.name}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Prochaines étapes :</h3>
        <div className="space-y-3 text-left">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs sm:text-sm">
              1
            </div>
            <div>
              <div className="text-sm sm:text-base font-medium text-gray-900">Créez votre premier article</div>
              <div className="text-xs sm:text-sm text-gray-600">Prenez des photos et laissez l'IA vous aider</div>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs sm:text-sm">
              2
            </div>
            <div>
              <div className="text-sm sm:text-base font-medium text-gray-900">Optimisez vos descriptions</div>
              <div className="text-xs sm:text-sm text-gray-600">Utilisez votre persona pour des textes percutants</div>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs sm:text-sm">
              3
            </div>
            <div>
              <div className="text-sm sm:text-base font-medium text-gray-900">Publiez sur Vinted</div>
              <div className="text-xs sm:text-sm text-gray-600">Exportez vos articles en un clic</div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onComplete}
        className="w-full py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold text-base sm:text-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
      >
        Accéder à EasyVinted
      </button>
    </div>
  );
}
