import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CustomPersonaModal, CustomPersonaData } from '../components/CustomPersonaModal';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUserProfileMutation } from '../hooks/useUserProfileMutation';
import type { UserProfile } from '../services/settings';

export function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: profileData, isLoading: loading } = useUserProfile(user?.id);
  const profileMutation = useUserProfileMutation(user?.id);

  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    persona_id: 'vinted_expert',
    writing_style: '',
    vinted_email: '',
    vinted_password: '',
  });

  const [showVintedPassword, setShowVintedPassword] = useState(false);
  const [savingVintedCredentials, setSavingVintedCredentials] = useState(false);

  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [customPersonaData, setCustomPersonaData] = useState<CustomPersonaData | null>(null);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (profileData) {
      setProfile({
        name: profileData.name || '',
        persona_id: profileData.persona_id || 'vinted_expert',
        writing_style: profileData.writing_style || '',
        vinted_email: (profileData as any).vinted_email || '',
        vinted_password: (profileData as any).vinted_password || '',
      });
    }
  }, [profileData]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setToast(null);

    try {
      await profileMutation.mutateAsync(profile);
      setToast({ type: 'success', text: 'Profil enregistré avec succès' });
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      console.error('Error saving profile:', error);
      setToast({ type: 'error', text: 'Erreur lors de l\'enregistrement du profil' });
    }
  };

  const handleVintedCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingVintedCredentials(true);
    setToast(null);

    try {
      await profileMutation.mutateAsync({
        vinted_email: profile.vinted_email,
        vinted_password: profile.vinted_password,
      });
      setToast({ type: 'success', text: 'Identifiants Vinted enregistrés' });
    } catch (error) {
      console.error('Error saving Vinted credentials:', error);
      setToast({ type: 'error', text: 'Erreur lors de l\'enregistrement' });
    } finally {
      setSavingVintedCredentials(false);
    }
  };

  const [savingPassword, setSavingPassword] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);

    if (!passwordData.currentPassword) {
      setToast({ type: 'error', text: 'Veuillez saisir votre mot de passe actuel' });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setToast({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setToast({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' });
      return;
    }

    setSavingPassword(true);

    try {
      // Vérifier d'abord le mot de passe actuel
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordData.currentPassword,
      });

      if (signInError) {
        setToast({ type: 'error', text: 'Mot de passe actuel incorrect' });
        setSavingPassword(false);
        return;
      }

      // Si le mot de passe actuel est correct, mettre à jour
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      setToast({ type: 'success', text: 'Mot de passe modifié avec succès' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      console.error('Error updating password:', error);
      setToast({ type: 'error', text: 'Erreur lors de la modification du mot de passe' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <Toast
          message={toast.text}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mon profil</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Informations personnelles</h2>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom
              </label>
              <p className="text-sm text-gray-500 mb-2">Le nom associé à ce compte</p>
              <input
                type="text"
                id="name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Votre nom"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Adresse e-mail
              </label>
              <p className="text-sm text-gray-500 mb-2">L'adresse e-mail associée à ce compte</p>
              <input
                type="email"
                id="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </div>


        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Mes identifiants Vinted</h2>
              <p className="text-sm text-gray-500 mt-0.5">Optionnel — utilisés pour la publication automatique</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Optionnel</span>
          </div>

          <form onSubmit={handleVintedCredentialsSubmit} className="space-y-4">
            <div>
              <label htmlFor="vinted_email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Vinted
              </label>
              <input
                type="email"
                id="vinted_email"
                value={profile.vinted_email || ''}
                onChange={(e) => setProfile({ ...profile, vinted_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="votre@email.com"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="vinted_password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe Vinted
              </label>
              <div className="relative">
                <input
                  type={showVintedPassword ? 'text' : 'password'}
                  id="vinted_password"
                  value={profile.vinted_password || ''}
                  onChange={(e) => setProfile({ ...profile, vinted_password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Votre mot de passe Vinted"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowVintedPassword(!showVintedPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showVintedPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={savingVintedCredentials}>
                {savingVintedCredentials ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Modifier mon mot de passe Easyvinted</h2>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe actuel
              </label>
              <input
                type="password"
                id="currentPassword"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Votre mot de passe actuel"
                required
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                id="newPassword"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Minimum 6 caractères"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Confirmer le mot de passe"
                required
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              >
                {savingPassword ? 'Modification...' : 'Modifier le mot de passe'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <CustomPersonaModal
        isOpen={isPersonaModalOpen}
        onClose={() => {
          setIsPersonaModalOpen(false);
          setCustomPersonaData(null);
        }}
        onSave={(data) => {
          setProfile({ ...profile, persona_id: 'custom', writing_style: data.description });
          setIsPersonaModalOpen(false);
          setCustomPersonaData(null);
        }}
        initialData={customPersonaData}
      />
    </>
  );
}
