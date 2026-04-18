import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Users, Shirt, ChevronDown, ChevronUp, Eye, EyeOff, Key, ExternalLink, CheckCircle, AlertCircle, Plus, CreditCard as Edit2, Trash2, Star, Pencil, MoreVertical, X, Footprints, MapPin } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CustomPersonaModal, CustomPersonaData } from '../components/CustomPersonaModal';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUserProfileMutation } from '../hooks/useUserProfileMutation';
import { usePersonas } from '../hooks/usePersonas';
import { useFamilyMembers } from '../hooks/useFamilyMembers';
import { useFamilyMembersMutation } from '../hooks/useFamilyMembersMutation';
import type { UserProfile } from '../services/settings';
import type { FamilyMember } from '../services/settings';

type Section = 'mes-infos' | 'nos-vendeurs' | 'mon-style' | null;

interface Avatar {
  id: string;
  name: string;
  photo_base64: string | null;
  photo_url: string | null;
}

interface Location {
  id: string;
  name: string;
  photo_base64: string | null;
  photo_url: string | null;
}

function normalizeImageUrl(photo_url: string | null, photo_base64: string | null): string {
  if (photo_url) return photo_url;
  if (photo_base64) {
    if (photo_base64.startsWith('data:')) return photo_base64;
    if (photo_base64.startsWith('http://') || photo_base64.startsWith('https://')) return photo_base64;
    return `data:image/png;base64,${photo_base64}`;
  }
  return '';
}

function MemberAvatarPreview({ avatarId }: { avatarId: string }) {
  const [avatar, setAvatar] = useState<Avatar | null>(null);

  useEffect(() => {
    supabase
      .from('avatars')
      .select('id, name, photo_base64, photo_url')
      .eq('id', avatarId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) setAvatar(data);
      });
  }, [avatarId]);

  if (!avatar) return null;

  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <User className="w-4 h-4 text-slate-600" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Avatar</span>
      </div>
      <div className="aspect-square rounded-lg overflow-hidden mb-2">
        <img src={normalizeImageUrl(avatar.photo_url, avatar.photo_base64)} alt={avatar.name} className="w-full h-full object-cover" />
      </div>
      <p className="text-xs font-medium text-slate-700 truncate">{avatar.name}</p>
    </div>
  );
}

function MemberLocationPreview({ locationId }: { locationId: string }) {
  const [location, setLocation] = useState<Location | null>(null);

  useEffect(() => {
    supabase
      .from('locations')
      .select('id, name, photo_base64, photo_url')
      .eq('id', locationId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) setLocation(data);
      });
  }, [locationId]);

  if (!location) return null;

  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-4 h-4 text-slate-600" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Environnement</span>
      </div>
      <div className="aspect-square rounded-lg overflow-hidden mb-2">
        <img src={normalizeImageUrl(location.photo_url, location.photo_base64)} alt={location.name} className="w-full h-full object-cover" />
      </div>
      <p className="text-xs font-medium text-slate-700 truncate">{location.name}</p>
    </div>
  );
}

const SECTIONS = [
  { id: 'mes-infos' as Section, label: 'Mes Infos', icon: User, description: 'Informations personnelles, mot de passe, clé API et identifiants Vinted' },
  { id: 'nos-vendeurs' as Section, label: 'Nos Vendeurs', icon: Users, description: 'Gérez les vendeurs de votre compte' },
  { id: 'mon-style' as Section, label: 'Mon Style', icon: Shirt, description: 'Ajoutez ou sélectionnez le modèle ou le fond que vous souhaitez utiliser pour l\'essayage de vos articles' },
];

export function MyAccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: profileData, isLoading: profileLoading } = useUserProfile(user?.id);
  const profileMutation = useUserProfileMutation(user?.id);

  const { data: members = [], isLoading: membersLoading } = useFamilyMembers(user?.id);
  const { createMutation, updateMutation, deleteMutation } = useFamilyMembersMutation(user?.id);
  const { data: personas = [] } = usePersonas();

  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    persona_id: 'vinted_expert',
    writing_style: '',
    vinted_email: '',
    vinted_password: '',
    gemini_api_key: '',
  });

  const [showVintedPassword, setShowVintedPassword] = useState(false);
  const [savingVintedCredentials, setSavingVintedCredentials] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [savingGeminiKey, setSavingGeminiKey] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [customPersonaData, setCustomPersonaData] = useState<CustomPersonaData | null>(null);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isMemberPersonaModalOpen, setIsMemberPersonaModalOpen] = useState(false);
  const [memberCustomPersonaData, setMemberCustomPersonaData] = useState<CustomPersonaData | null>(null);
  const [editingBasePersonaId, setEditingBasePersonaId] = useState<string | null>(null);
  const [editingCustomPersonaId, setEditingCustomPersonaId] = useState<string | null>(null);
  const [customPersonas, setCustomPersonas] = useState<Record<string, CustomPersonaData & { id: string }>>({});
  const [standaloneCustomPersonas, setStandaloneCustomPersonas] = useState<Array<CustomPersonaData & { id: string }>>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showPersonaSection, setShowPersonaSection] = useState(false);
  const [availableAvatars, setAvailableAvatars] = useState<Avatar[]>([]);
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [showAvatarSection, setShowAvatarSection] = useState(false);
  const [memberFormData, setMemberFormData] = useState({
    name: '', age: '', persona_id: 'vinted_expert', writing_style: '',
    is_default: false, top_size: '', bottom_size: '', shoe_size: '',
    default_avatar_id: '', default_location_id: '',
  });

  const [stylistAvatars, setStylistAvatars] = useState<Avatar[]>([]);
  const [stylistLocations, setStylistLocations] = useState<Location[]>([]);
  const [stylistLoading, setStylistLoading] = useState(false);
  const [defaultAvatarId, setDefaultAvatarId] = useState<string | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [savingDefaults, setSavingDefaults] = useState(false);

  useEffect(() => {
    if (profileData) {
      setProfile({
        name: profileData.name || '',
        persona_id: profileData.persona_id || 'vinted_expert',
        writing_style: profileData.writing_style || '',
        vinted_email: (profileData as any).vinted_email || '',
        vinted_password: (profileData as any).vinted_password || '',
        gemini_api_key: (profileData as any).gemini_api_key || '',
      });
      setDefaultAvatarId((profileData as any).default_avatar_id || null);
      setDefaultLocationId((profileData as any).default_location_id || null);
    }
  }, [profileData]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    if (activeMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenuId]);

  useEffect(() => {
    if (activeSection === 'nos-vendeurs') {
      loadCustomPersonas();
      loadAvatarsAndLocations();
    }
    if (activeSection === 'mon-style') {
      loadStylistData();
    }
  }, [activeSection, user]);

  async function loadCustomPersonas() {
    if (!user) return;
    const { data, error } = await supabase.from('custom_personas').select('*').eq('user_id', user.id);
    if (error) return;
    const personasMap: Record<string, CustomPersonaData & { id: string }> = {};
    const standalone: Array<CustomPersonaData & { id: string }> = [];
    data?.forEach(persona => {
      const p = { id: persona.id, name: persona.name, emoji: persona.emoji, description: persona.description, color: persona.color, writing_style: persona.writing_style };
      if (persona.base_persona_id) personasMap[persona.base_persona_id] = p;
      else standalone.push(p);
    });
    setCustomPersonas(personasMap);
    setStandaloneCustomPersonas(standalone);
  }

  async function loadAvatarsAndLocations() {
    if (!user) return;
    const [avatarsResult, locationsResult] = await Promise.all([
      supabase.from('avatars').select('id, name, photo_base64, photo_url').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('locations').select('id, name, photo_base64, photo_url').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);
    setAvailableAvatars(avatarsResult.data || []);
    setAvailableLocations(locationsResult.data || []);
  }

  async function loadStylistData() {
    if (!user) return;
    setStylistLoading(true);
    try {
      const [avatarsResult, locationsResult] = await Promise.all([
        supabase.from('avatars').select('id, name, photo_base64, photo_url').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('locations').select('id, name, photo_base64, photo_url').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);
      setStylistAvatars(avatarsResult.data || []);
      setStylistLocations(locationsResult.data || []);
    } finally {
      setStylistLoading(false);
    }
  }

  async function handleSaveDefaults() {
    if (!user) return;
    setSavingDefaults(true);
    try {
      await supabase.from('user_profiles').update({ default_avatar_id: defaultAvatarId, default_location_id: defaultLocationId }).eq('id', user.id);
      setToast({ type: 'success', text: 'Sélection sauvegardée' });
    } catch {
      setToast({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setSavingDefaults(false);
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await profileMutation.mutateAsync(profile);
      setToast({ type: 'success', text: 'Profil enregistré avec succès' });
    } catch {
      setToast({ type: 'error', text: 'Erreur lors de l\'enregistrement du profil' });
    }
  };

  const handleVintedCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVintedCredentials(true);
    try {
      await profileMutation.mutateAsync({ vinted_email: profile.vinted_email, vinted_password: profile.vinted_password });
      setToast({ type: 'success', text: 'Identifiants Vinted enregistrés' });
    } catch {
      setToast({ type: 'error', text: 'Erreur lors de l\'enregistrement' });
    } finally {
      setSavingVintedCredentials(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.currentPassword) { setToast({ type: 'error', text: 'Veuillez saisir votre mot de passe actuel' }); return; }
    if (passwordData.newPassword !== passwordData.confirmPassword) { setToast({ type: 'error', text: 'Les mots de passe ne correspondent pas' }); return; }
    if (passwordData.newPassword.length < 6) { setToast({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' }); return; }
    setSavingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: passwordData.currentPassword });
      if (signInError) { setToast({ type: 'error', text: 'Mot de passe actuel incorrect' }); setSavingPassword(false); return; }
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      setToast({ type: 'success', text: 'Mot de passe modifié avec succès' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      setToast({ type: 'error', text: 'Erreur lors de la modification du mot de passe' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleGeminiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeminiKey(true);
    try {
      await profileMutation.mutateAsync({ gemini_api_key: profile.gemini_api_key || null } as any);
      setToast({ type: 'success', text: 'Clé API Gemini enregistrée' });
    } catch {
      setToast({ type: 'error', text: 'Erreur lors de l\'enregistrement' });
    } finally {
      setSavingGeminiKey(false);
    }
  };

  function openMemberModal(member?: FamilyMember) {
    if (member) {
      setEditingMember(member);
      setMemberFormData({
        name: member.name, age: member.age.toString(), persona_id: member.persona_id,
        writing_style: member.writing_style || '', is_default: member.is_default,
        top_size: member.top_size || '', bottom_size: member.bottom_size || '',
        shoe_size: member.shoe_size || '', default_avatar_id: member.default_avatar_id || '',
        default_location_id: member.default_location_id || '',
      });
    } else {
      setEditingMember(null);
      setMemberFormData({ name: '', age: '', persona_id: 'vinted_expert', writing_style: '', is_default: false, top_size: '', bottom_size: '', shoe_size: '', default_avatar_id: '', default_location_id: '' });
    }
    setShowPersonaSection(false);
    setShowAvatarSection(false);
    setShowMemberModal(true);
    setActiveMenuId(null);
  }

  function closeMemberModal() {
    setShowMemberModal(false);
    setEditingMember(null);
    setShowPersonaSection(false);
    setShowAvatarSection(false);
  }

  async function handleMemberSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const age = parseInt(memberFormData.age);
    if (isNaN(age) || age < 1 || age > 120) { setToast({ type: 'error', text: 'Veuillez entrer un âge valide' }); return; }
    try {
      const memberData = {
        name: memberFormData.name.trim(), age, persona_id: memberFormData.persona_id,
        custom_persona_id: null, writing_style: memberFormData.writing_style || null,
        is_default: memberFormData.is_default, top_size: memberFormData.top_size || null,
        bottom_size: memberFormData.bottom_size || null, shoe_size: memberFormData.shoe_size || null,
        default_avatar_id: memberFormData.default_avatar_id || null,
        default_location_id: memberFormData.default_location_id || null,
      };
      if (editingMember) {
        await updateMutation.mutateAsync({ memberId: editingMember.id, member: memberData });
        setToast({ type: 'success', text: 'Vendeur modifié avec succès' });
      } else {
        await createMutation.mutateAsync(memberData);
        setToast({ type: 'success', text: 'Vendeur ajouté avec succès' });
      }
      closeMemberModal();
    } catch {
      setToast({ type: 'error', text: 'Erreur lors de l\'enregistrement' });
    }
  }

  async function handleDeleteMember() {
    if (!memberToDelete) return;
    try {
      await deleteMutation.mutateAsync(memberToDelete);
      setToast({ type: 'success', text: 'Vendeur supprimé avec succès' });
      setMemberToDelete(null);
    } catch {
      setToast({ type: 'error', text: 'Erreur lors de la suppression' });
    }
  }

  async function toggleDefault(id: string, currentDefault: boolean) {
    if (!user) return;
    try {
      if (!currentDefault) {
        for (const member of members) {
          if (member.is_default) await updateMutation.mutateAsync({ memberId: member.id, member: { is_default: false } });
        }
      }
      await updateMutation.mutateAsync({ memberId: id, member: { is_default: !currentDefault } });
      if (!currentDefault) await supabase.from('user_profiles').update({ default_seller_id: id }).eq('id', user.id);
      setActiveMenuId(null);
    } catch {
      setToast({ type: 'error', text: 'Erreur lors de la mise à jour' });
    }
  }

  function getPersonaInfo(member: FamilyMember) {
    if (member.persona_id === 'custom' && member.custom_persona_id) {
      const sp = standaloneCustomPersonas.find(p => p.id === member.custom_persona_id);
      if (sp) return { name: sp.name || 'Persona personnalisé', emoji: sp.emoji, color: sp.color, description: sp.description || 'Description personnalisée', writingStyle: sp.writing_style };
    }
    const cp = customPersonas[member.persona_id];
    if (cp) {
      const bp = personas.find(p => p.id === member.persona_id);
      return { name: cp.name || bp?.name || 'Personnalisé', emoji: cp.emoji || bp?.emoji || '✨', color: cp.color || bp?.color || 'bg-gray-100 border-gray-300', description: cp.description || bp?.description || 'Description personnalisée', writingStyle: cp.writing_style || bp?.writing_style || 'Style d\'écriture personnalisé' };
    }
    const persona = personas.find(p => p.id === member.persona_id);
    if (persona) return { name: persona.name, emoji: persona.emoji, color: persona.color, description: persona.description, writingStyle: member.writing_style || persona.writing_style };
    return { name: 'Personnalisé', emoji: '✨', color: 'bg-gray-100 border-gray-300', description: 'Style personnalisé', writingStyle: member.writing_style || 'Style d\'écriture personnalisé' };
  }

  async function handleSaveMemberPersona(personaData: CustomPersonaData) {
    if (!user) return;
    try {
      if (editingCustomPersonaId) {
        await supabase.from('custom_personas').update({ name: personaData.name, emoji: personaData.emoji, description: personaData.description, color: personaData.color, writing_style: personaData.writing_style }).eq('id', editingCustomPersonaId).eq('user_id', user.id);
      } else if (editingBasePersonaId) {
        await supabase.from('custom_personas').upsert({ user_id: user.id, base_persona_id: editingBasePersonaId, name: personaData.name, emoji: personaData.emoji, description: personaData.description, color: personaData.color, writing_style: personaData.writing_style }, { onConflict: 'user_id,base_persona_id' });
      } else {
        const { data } = await supabase.from('custom_personas').insert({ user_id: user.id, base_persona_id: null, name: personaData.name, emoji: personaData.emoji, description: personaData.description, color: personaData.color, writing_style: personaData.writing_style }).select().single();
        if (data) setMemberFormData(prev => ({ ...prev, persona_id: 'custom', writing_style: personaData.writing_style }));
      }
      await loadCustomPersonas();
      setToast({ type: 'success', text: 'Persona sauvegardé avec succès' });
      setIsMemberPersonaModalOpen(false);
      setEditingBasePersonaId(null);
      setEditingCustomPersonaId(null);
      setMemberCustomPersonaData(null);
    } catch {
      setToast({ type: 'error', text: 'Erreur lors de la sauvegarde du persona' });
    }
  }

  const toggleSection = (sectionId: Section) => {
    setActiveSection(prev => prev === sectionId ? null : sectionId);
  };

  return (
    <>
      {toast && <Toast message={toast.text} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mon Compte</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos informations, vendeurs et style personnalisé</p>
        </div>

        <div className="space-y-3">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            const isOpen = activeSection === section.id;

            return (
              <div key={section.id} className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isOpen ? 'border-emerald-200 shadow-md' : 'border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md'}`}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isOpen ? 'bg-emerald-100' : 'bg-gray-100 group-hover:bg-emerald-50'}`}>
                      <Icon className={`w-5 h-5 transition-colors ${isOpen ? 'text-emerald-600' : 'text-gray-500 group-hover:text-emerald-500'}`} />
                    </div>
                    <div>
                      <h2 className={`text-base font-semibold transition-colors ${isOpen ? 'text-emerald-700' : 'text-gray-900'}`}>{section.label}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                    </div>
                  </div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ml-4 ${isOpen ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-emerald-600" />
                      : <ChevronDown className="w-4 h-4 text-gray-500" />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-6 pb-6 pt-5 animate-in fade-in slide-in-from-top-2 duration-200">
                    {section.id === 'mes-infos' && (
                      <MesInfosSection
                        profile={profile}
                        setProfile={setProfile}
                        user={user}
                        profileMutation={profileMutation}
                        handleProfileSubmit={handleProfileSubmit}
                        passwordData={passwordData}
                        setPasswordData={setPasswordData}
                        handlePasswordSubmit={handlePasswordSubmit}
                        savingPassword={savingPassword}
                        showGeminiKey={showGeminiKey}
                        setShowGeminiKey={setShowGeminiKey}
                        handleGeminiKeySubmit={handleGeminiKeySubmit}
                        savingGeminiKey={savingGeminiKey}
                        showVintedPassword={showVintedPassword}
                        setShowVintedPassword={setShowVintedPassword}
                        handleVintedCredentialsSubmit={handleVintedCredentialsSubmit}
                        savingVintedCredentials={savingVintedCredentials}
                        loading={profileLoading}
                      />
                    )}

                    {section.id === 'nos-vendeurs' && (
                      <NosVendeursSection
                        members={members}
                        loading={membersLoading}
                        openMemberModal={openMemberModal}
                        activeMenuId={activeMenuId}
                        setActiveMenuId={setActiveMenuId}
                        toggleDefault={toggleDefault}
                        setMemberToDelete={setMemberToDelete}
                        getPersonaInfo={getPersonaInfo}
                      />
                    )}

                    {section.id === 'mon-style' && (
                      <MonStyleSection
                        loading={stylistLoading}
                        avatars={stylistAvatars}
                        locations={stylistLocations}
                        defaultAvatarId={defaultAvatarId}
                        setDefaultAvatarId={setDefaultAvatarId}
                        defaultLocationId={defaultLocationId}
                        setDefaultLocationId={setDefaultLocationId}
                        onSave={handleSaveDefaults}
                        savingDefaults={savingDefaults}
                        onNavigate={() => navigate('/virtual-stylist')}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showMemberModal && (
        <Modal isOpen={showMemberModal} onClose={closeMemberModal} title={editingMember ? 'Modifier le vendeur' : 'Ajouter un vendeur'}>
          <form onSubmit={handleMemberSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom / Pseudo <span className="text-red-500">*</span></label>
                <input type="text" value={memberFormData.name} onChange={e => setMemberFormData({ ...memberFormData, name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="Ex: Nina, Tom, Papa..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Âge <span className="text-red-500">*</span></label>
                <input type="number" value={memberFormData.age} onChange={e => setMemberFormData({ ...memberFormData, age: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="Ex: 25" min="1" max="120" required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5"><div className="flex items-center gap-1"><Shirt className="w-4 h-4" />Taille Haut</div></label>
                  <select value={memberFormData.top_size} onChange={e => setMemberFormData({ ...memberFormData, top_size: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                    <option value="">-</option>
                    {['XS','S','M','L','XL','XXL','3XL'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5"><div className="flex items-center gap-1"><Shirt className="w-4 h-4" />Taille Bas</div></label>
                  <select value={memberFormData.bottom_size} onChange={e => setMemberFormData({ ...memberFormData, bottom_size: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                    <option value="">-</option>
                    {['34','36','38','40','42','44','46','48','50'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5"><div className="flex items-center gap-1"><Footprints className="w-4 h-4" />Pointure</div></label>
                  <select value={memberFormData.shoe_size} onChange={e => setMemberFormData({ ...memberFormData, shoe_size: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                    <option value="">-</option>
                    {Array.from({ length: 30 }, (_, i) => (i + 20).toString()).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <button type="button" onClick={() => setShowPersonaSection(!showPersonaSection)} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">Style rédactionnel</span>
                  <span className="text-xs text-slate-600">(optionnel)</span>
                </div>
                {showPersonaSection ? <X className="w-5 h-5 text-slate-600" /> : <Plus className="w-5 h-5 text-slate-600" />}
              </button>

              {showPersonaSection && (
                <div className="mt-4 space-y-3 max-h-[400px] overflow-y-auto">
                  <div className="flex items-center justify-end">
                    <Button type="button" variant="secondary" onClick={() => setIsMemberPersonaModalOpen(true)} className="text-xs">
                      <Plus className="w-3 h-3" />Créer un style personnalisé
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {personas.map(persona => {
                      const cp = customPersonas[persona.id];
                      const dp = cp || persona;
                      return (
                        <label key={persona.id} className={`flex items-start gap-3 p-3 border rounded-lg transition-all cursor-pointer ${memberFormData.persona_id === persona.id ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                          <input type="radio" name="persona" value={persona.id} checked={memberFormData.persona_id === persona.id} onChange={() => setMemberFormData({ ...memberFormData, persona_id: persona.id, writing_style: cp?.writing_style || persona.writing_style })} className="mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{dp.emoji}</span>
                              <span className="font-medium text-slate-900 text-sm">{dp.name}</span>
                              {cp && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Personnalisé</span>}
                            </div>
                            <p className="text-xs text-slate-600">{dp.description}</p>
                          </div>
                          <button type="button" onClick={e => { e.preventDefault(); setEditingBasePersonaId(persona.id); setMemberCustomPersonaData(cp || { name: persona.name, emoji: persona.emoji, description: persona.description, color: persona.color, writing_style: persona.writing_style }); setIsMemberPersonaModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded transition-colors flex-shrink-0">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </label>
                      );
                    })}
                    {standaloneCustomPersonas.map(cp => (
                      <label key={cp.id} className={`flex items-start gap-3 p-3 border rounded-lg transition-all cursor-pointer ${memberFormData.persona_id === 'custom' ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <input type="radio" name="persona" value="custom" checked={memberFormData.persona_id === 'custom'} onChange={() => setMemberFormData({ ...memberFormData, persona_id: 'custom', writing_style: cp.writing_style })} className="mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{cp.emoji}</span>
                            <span className="font-medium text-slate-900 text-sm">{cp.name}</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Personnalisé</span>
                          </div>
                          <p className="text-xs text-slate-600">{cp.description}</p>
                        </div>
                        <button type="button" onClick={e => { e.preventDefault(); setEditingCustomPersonaId(cp.id); setMemberCustomPersonaData({ name: cp.name, emoji: cp.emoji, description: cp.description, color: cp.color, writing_style: cp.writing_style }); setIsMemberPersonaModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded transition-colors flex-shrink-0">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-5">
              <button type="button" onClick={() => setShowAvatarSection(!showAvatarSection)} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">Avatar et environnement</span>
                  <span className="text-xs text-slate-600">(optionnel)</span>
                </div>
                {showAvatarSection ? <X className="w-5 h-5 text-slate-600" /> : <Plus className="w-5 h-5 text-slate-600" />}
              </button>

              {showAvatarSection && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2"><div className="flex items-center gap-2"><User className="w-4 h-4" />Avatar par défaut</div></label>
                    {availableAvatars.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">Aucun avatar disponible. Créez-en un dans le Virtual Stylist.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                        <label className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${!memberFormData.default_avatar_id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <input type="radio" name="avatar" value="" checked={!memberFormData.default_avatar_id} onChange={() => setMemberFormData({ ...memberFormData, default_avatar_id: '' })} className="sr-only" />
                          <div className="aspect-square bg-slate-100 rounded flex items-center justify-center"><User className="w-8 h-8 text-slate-400" /></div>
                          <p className="text-xs text-center mt-1 font-medium">Aucun</p>
                        </label>
                        {availableAvatars.map(avatar => (
                          <label key={avatar.id} className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${memberFormData.default_avatar_id === avatar.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="avatar" value={avatar.id} checked={memberFormData.default_avatar_id === avatar.id} onChange={() => setMemberFormData({ ...memberFormData, default_avatar_id: avatar.id })} className="sr-only" />
                            <div className="aspect-square rounded overflow-hidden"><img src={normalizeImageUrl(avatar.photo_url, avatar.photo_base64)} alt={avatar.name} className="w-full h-full object-cover" /></div>
                            <p className="text-xs text-center mt-1 truncate font-medium">{avatar.name}</p>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2"><div className="flex items-center gap-2"><MapPin className="w-4 h-4" />Environnement par défaut</div></label>
                    {availableLocations.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">Aucun environnement disponible. Créez-en un dans le Virtual Stylist.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                        <label className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${!memberFormData.default_location_id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <input type="radio" name="location" value="" checked={!memberFormData.default_location_id} onChange={() => setMemberFormData({ ...memberFormData, default_location_id: '' })} className="sr-only" />
                          <div className="aspect-square bg-slate-100 rounded flex items-center justify-center"><MapPin className="w-8 h-8 text-slate-400" /></div>
                          <p className="text-xs text-center mt-1 font-medium">Aucun</p>
                        </label>
                        {availableLocations.map(location => (
                          <label key={location.id} className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${memberFormData.default_location_id === location.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="location" value={location.id} checked={memberFormData.default_location_id === location.id} onChange={() => setMemberFormData({ ...memberFormData, default_location_id: location.id })} className="sr-only" />
                            <div className="aspect-square rounded overflow-hidden"><img src={normalizeImageUrl(location.photo_url, location.photo_base64)} alt={location.name} className="w-full h-full object-cover" /></div>
                            <p className="text-xs text-center mt-1 truncate font-medium">{location.name}</p>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={memberFormData.is_default} onChange={e => setMemberFormData({ ...memberFormData, is_default: e.target.checked })} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm text-slate-700">Définir comme vendeur par défaut</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={closeMemberModal} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">{editingMember ? 'Sauvegarder' : 'Ajouter'}</Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmModal
        isOpen={memberToDelete !== null}
        onClose={() => setMemberToDelete(null)}
        onConfirm={handleDeleteMember}
        title="Supprimer le vendeur"
        message="Êtes-vous sûr de vouloir supprimer ce vendeur ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />

      <CustomPersonaModal
        isOpen={isPersonaModalOpen}
        onClose={() => { setIsPersonaModalOpen(false); setCustomPersonaData(null); }}
        onSave={(data) => { setProfile({ ...profile, persona_id: 'custom', writing_style: data.description }); setIsPersonaModalOpen(false); setCustomPersonaData(null); }}
        initialData={customPersonaData}
      />

      <CustomPersonaModal
        isOpen={isMemberPersonaModalOpen}
        onClose={() => { setIsMemberPersonaModalOpen(false); setEditingBasePersonaId(null); setEditingCustomPersonaId(null); setMemberCustomPersonaData(null); }}
        onSave={handleSaveMemberPersona}
        initialData={memberCustomPersonaData}
        basePersonaId={editingBasePersonaId || undefined}
      />
    </>
  );
}

interface MesInfosSectionProps {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  user: any;
  profileMutation: any;
  handleProfileSubmit: (e: React.FormEvent) => void;
  passwordData: { currentPassword: string; newPassword: string; confirmPassword: string };
  setPasswordData: (d: any) => void;
  handlePasswordSubmit: (e: React.FormEvent) => void;
  savingPassword: boolean;
  showGeminiKey: boolean;
  setShowGeminiKey: (v: boolean) => void;
  handleGeminiKeySubmit: (e: React.FormEvent) => void;
  savingGeminiKey: boolean;
  showVintedPassword: boolean;
  setShowVintedPassword: (v: boolean) => void;
  handleVintedCredentialsSubmit: (e: React.FormEvent) => void;
  savingVintedCredentials: boolean;
  loading: boolean;
}

function MesInfosSection({ profile, setProfile, user, profileMutation, handleProfileSubmit, passwordData, setPasswordData, handlePasswordSubmit, savingPassword, showGeminiKey, setShowGeminiKey, handleGeminiKeySubmit, savingGeminiKey, showVintedPassword, setShowVintedPassword, handleVintedCredentialsSubmit, savingVintedCredentials, loading }: MesInfosSectionProps) {
  if (loading) return (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Informations personnelles</h3>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <p className="text-xs text-gray-500 mb-2">Le nom associé à ce compte</p>
            <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="Votre nom" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse e-mail</label>
            <p className="text-xs text-gray-500 mb-2">L'adresse e-mail associée à ce compte</p>
            <input type="email" value={user?.email || ''} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={profileMutation.isPending}>{profileMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </div>
        </form>
      </div>

      <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Modifier mon mot de passe Easyvinted</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
            <input type="password" value={passwordData.currentPassword} onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="Votre mot de passe actuel" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
            <input type="password" value={passwordData.newPassword} onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="Minimum 6 caractères" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
            <input type="password" value={passwordData.confirmPassword} onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="Confirmer le mot de passe" required />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}>{savingPassword ? 'Modification...' : 'Modifier le mot de passe'}</Button>
          </div>
        </form>
      </div>

      <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-900">Ma clé API Gemini (IA)</h3>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Requis pour l'IA</span>
        </div>
        <div className={`flex items-start gap-2 p-3 rounded-lg mb-4 mt-3 ${profile.gemini_api_key ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          {profile.gemini_api_key
            ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            : <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          }
          <p className={`text-sm ${profile.gemini_api_key ? 'text-emerald-700' : 'text-amber-700'}`}>
            {profile.gemini_api_key ? 'Votre clé API est configurée. Toutes les fonctions IA utilisent votre propre compte Google.' : 'Aucune clé API configurée. Les fonctions IA (analyse d\'articles, Kelly, Styliste) ne seront pas disponibles.'}
          </p>
        </div>
        <form onSubmit={handleGeminiKeySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clé API Google Gemini</label>
            <p className="text-xs text-gray-500 mb-2">
              Obtenez votre clé gratuite sur{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-0.5 font-medium">
                Google AI Studio <ExternalLink className="w-3 h-3" />
              </a>
              . Chaque appel IA sera facturé sur votre compte Google.
            </p>
            <div className="relative">
              <input type={showGeminiKey ? 'text' : 'password'} value={profile.gemini_api_key || ''} onChange={e => setProfile({ ...profile, gemini_api_key: e.target.value })} className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm" placeholder="AIzaSy..." autoComplete="off" />
              <button type="button" onClick={() => setShowGeminiKey(!showGeminiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            {profile.gemini_api_key && <button type="button" onClick={() => setProfile({ ...profile, gemini_api_key: '' })} className="text-sm text-red-500 hover:text-red-700">Supprimer la clé</button>}
            <div className="ml-auto">
              <Button type="submit" disabled={savingGeminiKey}>{savingGeminiKey ? 'Enregistrement...' : 'Enregistrer'}</Button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Mes identifiants Vinted</h3>
            <p className="text-xs text-gray-500 mt-0.5">Optionnel — utilisés pour la publication automatique</p>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Optionnel</span>
        </div>
        <form onSubmit={handleVintedCredentialsSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Vinted</label>
            <input type="email" value={profile.vinted_email || ''} onChange={e => setProfile({ ...profile, vinted_email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="votre@email.com" autoComplete="off" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe Vinted</label>
            <div className="relative">
              <input type={showVintedPassword ? 'text' : 'password'} value={profile.vinted_password || ''} onChange={e => setProfile({ ...profile, vinted_password: e.target.value })} className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="Votre mot de passe Vinted" autoComplete="new-password" />
              <button type="button" onClick={() => setShowVintedPassword(!showVintedPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showVintedPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingVintedCredentials}>{savingVintedCredentials ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface NosVendeursSectionProps {
  members: FamilyMember[];
  loading: boolean;
  openMemberModal: (member?: FamilyMember) => void;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  toggleDefault: (id: string, current: boolean) => void;
  setMemberToDelete: (id: string) => void;
  getPersonaInfo: (member: FamilyMember) => any;
}

function NosVendeursSection({ members, loading, openMemberModal, activeMenuId, setActiveMenuId, toggleDefault, setMemberToDelete, getPersonaInfo }: NosVendeursSectionProps) {
  if (loading) return (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button type="button" onClick={() => openMemberModal()}>
          <Plus className="w-4 h-4" />Ajouter
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Aucun vendeur</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">Créez des profils pour les différents vendeurs de votre équipe</p>
          <Button type="button" onClick={() => openMemberModal()}>
            <Plus className="w-4 h-4" />Ajouter votre premier vendeur
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map(member => {
            const personaInfo = getPersonaInfo(member);
            return (
              <div key={member.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <h3 className="text-base font-bold text-slate-900 truncate">{member.name}</h3>
                          {member.is_default && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 flex-shrink-0">
                              <Star className="w-3 h-3 mr-1 fill-current" />Par défaut
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{member.age} ans</p>
                      </div>
                      <div className="relative flex-shrink-0">
                        <button onClick={e => { e.stopPropagation(); setActiveMenuId(activeMenuId === member.id ? null : member.id); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {activeMenuId === member.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                            <button onClick={() => toggleDefault(member.id, member.is_default)} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                              <Star className={`w-4 h-4 ${member.is_default ? 'fill-current text-emerald-600' : 'text-slate-400'}`} />
                              {member.is_default ? 'Retirer par défaut' : 'Définir par défaut'}
                            </button>
                            <button onClick={() => openMemberModal(member)} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                              <Edit2 className="w-4 h-4 text-blue-600" />Modifier
                            </button>
                            <button onClick={() => { setMemberToDelete(member.id); setActiveMenuId(null); }} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                              <Trash2 className="w-4 h-4" />Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {(member.top_size || member.bottom_size || member.shoe_size) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {member.top_size && <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg text-xs border border-gray-200"><Shirt className="w-3.5 h-3.5 text-gray-500" /><span className="text-gray-400">Haut:</span><span className="font-medium text-gray-800">{member.top_size}</span></div>}
                        {member.bottom_size && <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg text-xs border border-gray-200"><Shirt className="w-3.5 h-3.5 text-gray-500" /><span className="text-gray-400">Bas:</span><span className="font-medium text-gray-800">{member.bottom_size}</span></div>}
                        {member.shoe_size && <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg text-xs border border-gray-200"><Footprints className="w-3.5 h-3.5 text-gray-500" /><span className="font-medium text-gray-800">{member.shoe_size}</span></div>}
                      </div>
                    )}

                    <div className={`flex items-start gap-3 p-3 rounded-lg border ${personaInfo.color}`}>
                      <span className="text-xl flex-shrink-0 mt-0.5">{personaInfo.emoji}</span>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Persona:</span>
                          <span className="text-sm font-bold text-slate-900">{personaInfo.name}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{personaInfo.description}</p>
                      </div>
                    </div>

                    {(member.default_avatar_id || member.default_location_id) && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {member.default_avatar_id && <MemberAvatarPreview avatarId={member.default_avatar_id} />}
                        {member.default_location_id && <MemberLocationPreview locationId={member.default_location_id} />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MonStyleSectionProps {
  loading: boolean;
  avatars: Avatar[];
  locations: Location[];
  defaultAvatarId: string | null;
  setDefaultAvatarId: (id: string | null) => void;
  defaultLocationId: string | null;
  setDefaultLocationId: (id: string | null) => void;
  onSave: () => void;
  savingDefaults: boolean;
  onNavigate: () => void;
}

function MonStyleSection({ loading, avatars, locations, defaultAvatarId, setDefaultAvatarId, defaultLocationId, setDefaultLocationId, onSave, savingDefaults, onNavigate }: MonStyleSectionProps) {
  if (loading) return (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
    </div>
  );

  const hasContent = avatars.length > 0 || locations.length > 0;

  return (
    <div className="space-y-6">
      {!hasContent ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shirt className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Aucun modèle ou fond créé</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">Créez vos avatars et environnements dans le Virtual Stylist pour les sélectionner ici</p>
          <Button type="button" onClick={onNavigate}>
            <Shirt className="w-4 h-4" />Ouvrir le Virtual Stylist
          </Button>
        </div>
      ) : (
        <>
          {avatars.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Modèles (Avatars)</h3>
                </div>
                <span className="text-xs text-gray-400">{avatars.length} disponible{avatars.length > 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                <button
                  onClick={() => setDefaultAvatarId(null)}
                  className={`relative rounded-xl border-2 p-2 cursor-pointer transition-all ${!defaultAvatarId ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                >
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-xs text-center mt-1.5 font-medium text-gray-500">Aucun</p>
                  {!defaultAvatarId && <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle className="w-3 h-3 text-white" /></div>}
                </button>
                {avatars.map(avatar => (
                  <button
                    key={avatar.id}
                    onClick={() => setDefaultAvatarId(avatar.id)}
                    className={`relative rounded-xl border-2 p-2 cursor-pointer transition-all ${defaultAvatarId === avatar.id ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden">
                      <img src={normalizeImageUrl(avatar.photo_url, avatar.photo_base64)} alt={avatar.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-center mt-1.5 truncate font-medium text-gray-700">{avatar.name}</p>
                    {defaultAvatarId === avatar.id && <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle className="w-3 h-3 text-white" /></div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {locations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Fonds (Environnements)</h3>
                </div>
                <span className="text-xs text-gray-400">{locations.length} disponible{locations.length > 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                <button
                  onClick={() => setDefaultLocationId(null)}
                  className={`relative rounded-xl border-2 p-2 cursor-pointer transition-all ${!defaultLocationId ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                >
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-xs text-center mt-1.5 font-medium text-gray-500">Aucun</p>
                  {!defaultLocationId && <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle className="w-3 h-3 text-white" /></div>}
                </button>
                {locations.map(location => (
                  <button
                    key={location.id}
                    onClick={() => setDefaultLocationId(location.id)}
                    className={`relative rounded-xl border-2 p-2 cursor-pointer transition-all ${defaultLocationId === location.id ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden">
                      <img src={normalizeImageUrl(location.photo_url, location.photo_base64)} alt={location.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-center mt-1.5 truncate font-medium text-gray-700">{location.name}</p>
                    {defaultLocationId === location.id && <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle className="w-3 h-3 text-white" /></div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button onClick={onNavigate} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1.5">
              <Shirt className="w-4 h-4" />Gérer mes modèles et fonds
            </button>
            <Button type="button" onClick={onSave} disabled={savingDefaults}>
              {savingDefaults ? 'Enregistrement...' : 'Sauvegarder la sélection'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
