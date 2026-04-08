import { useState, useEffect, useRef } from 'react';
import { User, MapPin, Upload, Camera, Check, Sparkles, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AvatarCreationLoader from '../ui/AvatarCreationLoader';
import { ConfirmModal } from '../ui/ConfirmModal';

export interface AvatarSetupData {
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

interface Props {
  onNext: (data: AvatarSetupData) => void;
  onSkip: () => void;
  onBack: () => void;
  initialData?: AvatarSetupData;
}

export default function AvatarSetupStep({ onNext, onSkip, onBack, initialData }: Props) {
  const { user } = useAuth();
  const [availableAvatars, setAvailableAvatars] = useState<Avatar[]>([]);
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(initialData?.avatarId || null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(initialData?.locationId || null);
  const [isCreatingAvatar, setIsCreatingAvatar] = useState(false);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [avatarName, setAvatarName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLocation, setUploadingLocation] = useState(false);
  const [deleteAvatarId, setDeleteAvatarId] = useState<string | null>(null);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAvatarsAndLocations();
  }, [user]);

  async function loadAvatarsAndLocations() {
    if (!user) return;

    try {
      const [avatarsResult, locationsResult] = await Promise.all([
        supabase
          .from('avatars')
          .select('id, name, photo_base64')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('locations')
          .select('id, name, photo_base64')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      if (avatarsResult.data) setAvailableAvatars(avatarsResult.data);
      if (locationsResult.data) setAvailableLocations(locationsResult.data);
    } catch (error) {
      console.error('Error loading avatars and locations:', error);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        const { data, error } = await supabase
          .from('avatars')
          .insert({
            user_id: user.id,
            name: avatarName || 'Mon Avatar',
            photo_base64: base64String,
            render_style: 'studio'
          })
          .select()
          .single();

        if (error) throw error;

        setSelectedAvatarId(data.id);
        await loadAvatarsAndLocations();
        setIsCreatingAvatar(false);
        setAvatarName('');
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setUploadingAvatar(false);
    }
  }

  async function handleLocationUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingLocation(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        const { data, error } = await supabase
          .from('locations')
          .insert({
            user_id: user.id,
            name: locationName || 'Mon Environnement',
            description: '',
            photo_base64: base64String
          })
          .select()
          .single();

        if (error) throw error;

        setSelectedLocationId(data.id);
        await loadAvatarsAndLocations();
        setIsCreatingLocation(false);
        setLocationName('');
        setUploadingLocation(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading location:', error);
      setUploadingLocation(false);
    }
  }

  function handleDeleteAvatar(avatarId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteAvatarId(avatarId);
  }

  async function confirmDeleteAvatar() {
    if (!deleteAvatarId) return;

    try {
      const { error } = await supabase
        .from('avatars')
        .delete()
        .eq('id', deleteAvatarId);

      if (error) throw error;

      if (selectedAvatarId === deleteAvatarId) {
        setSelectedAvatarId(null);
      }
      await loadAvatarsAndLocations();
      setDeleteAvatarId(null);
    } catch (error) {
      console.error('Error deleting avatar:', error);
      setDeleteAvatarId(null);
    }
  }

  function handleDeleteLocation(locationId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteLocationId(locationId);
  }

  async function confirmDeleteLocation() {
    if (!deleteLocationId) return;

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', deleteLocationId);

      if (error) throw error;

      if (selectedLocationId === deleteLocationId) {
        setSelectedLocationId(null);
      }
      await loadAvatarsAndLocations();
      setDeleteLocationId(null);
    } catch (error) {
      console.error('Error deleting location:', error);
      setDeleteLocationId(null);
    }
  }

  function handleNext() {
    onNext({
      avatarId: selectedAvatarId,
      locationId: selectedLocationId
    });
  }

  return (
    <>
      {uploadingAvatar && <AvatarCreationLoader message="Création de votre avatar" />}
      {uploadingLocation && <AvatarCreationLoader message="Création de votre environnement" />}

      <ConfirmModal
        isOpen={deleteAvatarId !== null}
        onClose={() => setDeleteAvatarId(null)}
        onConfirm={confirmDeleteAvatar}
        title="Supprimer l'avatar"
        message="Êtes-vous sûr de vouloir supprimer cet avatar ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />

      <ConfirmModal
        isOpen={deleteLocationId !== null}
        onClose={() => setDeleteLocationId(null)}
        onConfirm={confirmDeleteLocation}
        title="Supprimer l'environnement"
        message="Êtes-vous sûr de vouloir supprimer cet environnement ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />

      <div className="space-y-6 sm:space-y-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-3 sm:mb-4">
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 px-4">Créez votre identité visuelle</h2>
          <p className="text-sm sm:text-base text-gray-600 px-4">
            Personnalisez vos photos d'articles avec votre propre avatar et environnement
          </p>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Votre Avatar</h3>
              <p className="text-sm text-gray-600">Optionnel</p>
            </div>
          </div>

          {!isCreatingAvatar ? (
            <>
              {availableAvatars.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-4">Aucun avatar pour le moment</p>
                  <button
                    onClick={() => setIsCreatingAvatar(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Créer mon avatar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label
                    className={`block border-2 rounded-lg p-3 cursor-pointer transition-all ${
                      !selectedAvatarId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="avatar"
                      checked={!selectedAvatarId}
                      onChange={() => setSelectedAvatarId(null)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                      <span className="font-medium text-gray-900">Aucun avatar</span>
                    </div>
                  </label>

                  {availableAvatars.map(avatar => (
                    <label
                      key={avatar.id}
                      className={`block border-2 rounded-lg p-3 cursor-pointer transition-all relative group ${
                        selectedAvatarId === avatar.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="avatar"
                        checked={selectedAvatarId === avatar.id}
                        onChange={() => setSelectedAvatarId(avatar.id)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3">
                        <img
                          src={avatar.photo_base64}
                          alt={avatar.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <span className="font-medium text-gray-900 flex-1">{avatar.name}</span>
                        {selectedAvatarId === avatar.id && (
                          <Check className="w-5 h-5 text-blue-600" />
                        )}
                        <button
                          onClick={(e) => handleDeleteAvatar(avatar.id, e)}
                          className="ml-2 p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors opacity-0 group-hover:opacity-100"
                          title="Supprimer cet avatar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </label>
                  ))}

                  <button
                    onClick={() => setIsCreatingAvatar(true)}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-700 hover:text-blue-600"
                  >
                    <Upload className="w-4 h-4 inline mr-2" />
                    Ajouter un nouvel avatar
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'avatar
                </label>
                <input
                  type="text"
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                  placeholder="Ex: Mon look pro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo de l'avatar
                </label>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-700 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  Choisir une photo
                </button>
              </div>

              <button
                onClick={() => {
                  setIsCreatingAvatar(false);
                  setAvatarName('');
                }}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Votre Environnement</h3>
              <p className="text-sm text-gray-600">Optionnel</p>
            </div>
          </div>

          {!isCreatingLocation ? (
            <>
              {availableLocations.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-4">Aucun environnement pour le moment</p>
                  <button
                    onClick={() => setIsCreatingLocation(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    Créer mon environnement
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label
                    className={`block border-2 rounded-lg p-3 cursor-pointer transition-all ${
                      !selectedLocationId
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="location"
                      checked={!selectedLocationId}
                      onChange={() => setSelectedLocationId(null)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-gray-400" />
                      </div>
                      <span className="font-medium text-gray-900">Aucun environnement</span>
                    </div>
                  </label>

                  {availableLocations.map(location => (
                    <label
                      key={location.id}
                      className={`block border-2 rounded-lg p-3 cursor-pointer transition-all relative group ${
                        selectedLocationId === location.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="location"
                        checked={selectedLocationId === location.id}
                        onChange={() => setSelectedLocationId(location.id)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3">
                        <img
                          src={location.photo_base64}
                          alt={location.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <span className="font-medium text-gray-900 flex-1">{location.name}</span>
                        {selectedLocationId === location.id && (
                          <Check className="w-5 h-5 text-purple-600" />
                        )}
                        <button
                          onClick={(e) => handleDeleteLocation(location.id, e)}
                          className="ml-2 p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors opacity-0 group-hover:opacity-100"
                          title="Supprimer cet environnement"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </label>
                  ))}

                  <button
                    onClick={() => setIsCreatingLocation(true)}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-sm font-medium text-gray-700 hover:text-purple-600"
                  >
                    <Upload className="w-4 h-4 inline mr-2" />
                    Ajouter un nouvel environnement
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'environnement
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Ex: Mon salon"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo de l'environnement
                </label>
                <input
                  ref={locationInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLocationUpload}
                  className="hidden"
                />
                <button
                  onClick={() => locationInputRef.current?.click()}
                  disabled={uploadingLocation}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-sm font-medium text-gray-700 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  Choisir une photo
                </button>
              </div>

              <button
                onClick={() => {
                  setIsCreatingLocation(false);
                  setLocationName('');
                }}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-6 border-t">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Retour
        </button>
        <button
          onClick={onSkip}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Passer cette étape
        </button>
        <button
          onClick={handleNext}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-colors"
        >
          Continuer
        </button>
      </div>
      </div>
    </>
  );
}
