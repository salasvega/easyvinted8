import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import ProfileStep, { ProfileData } from '../components/onboarding/ProfileStep';
import PersonaStep, { PersonaData } from '../components/onboarding/PersonaStep';
import AvatarSetupStep, { AvatarSetupData } from '../components/onboarding/AvatarSetupStep';
import TeamStep, { TeamData } from '../components/onboarding/TeamStep';
import CompletionStep from '../components/onboarding/CompletionStep';

type Step = 'profile' | 'persona' | 'avatar' | 'team' | 'completion';

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [personaData, setPersonaData] = useState<PersonaData | null>(null);
  const [avatarSetupData, setAvatarSetupData] = useState<AvatarSetupData | null>(null);
  const [teamData, setTeamData] = useState<TeamData | null>(null);

  const steps: Step[] = ['profile', 'persona', 'avatar', 'team', 'completion'];
  const currentStepIndex = steps.indexOf(currentStep);

  const handleProfileNext = (data: ProfileData) => {
    setProfileData(data);
    setCurrentStep('persona');
  };

  const handlePersonaNext = (data: PersonaData) => {
    setPersonaData(data);
    setCurrentStep('avatar');
  };

  const handlePersonaSkip = () => {
    setPersonaData(null);
    setCurrentStep('avatar');
  };

  const handlePersonaBack = () => {
    setCurrentStep('profile');
  };

  const handleAvatarSetupNext = (data: AvatarSetupData) => {
    setAvatarSetupData(data);
    setCurrentStep('team');
  };

  const handleAvatarSetupSkip = () => {
    setAvatarSetupData(null);
    setCurrentStep('team');
  };

  const handleAvatarSetupBack = () => {
    setCurrentStep('persona');
  };

  const handleTeamNext = (data: TeamData) => {
    setTeamData(data);
    setCurrentStep('completion');
  };

  const handleTeamSkip = () => {
    if (profileData) {
      setTeamData({
        members: [
          {
            id: 'main',
            display_name: profileData.name,
            is_default: true,
          },
        ],
        defaultMemberId: 'main',
      });
    }
    setCurrentStep('completion');
  };

  const handleTeamBack = () => {
    setCurrentStep('avatar');
  };

  const handleComplete = async () => {
    if (!user || !profileData) return;

    setLoading(true);
    setError(null);

    try {
      let defaultSellerId: string | null = null;
      let customPersonaId: string | null = null;

      // Create custom persona first if needed
      if (personaData && !personaData.personaId && personaData.customPersonaName) {
        const { data: customPersona, error: customPersonaError } = await supabase
          .from('custom_personas')
          .insert({
            user_id: user.id,
            name: personaData.customPersonaName,
            description: 'Persona personnalisé',
            writing_style: personaData.customPersonaStyle || '',
          })
          .select()
          .single();

        if (customPersonaError) throw customPersonaError;
        customPersonaId = customPersona?.id || null;
      }

      const { data: existingSellers } = await supabase
        .from('family_members')
        .select('id')
        .eq('user_id', user.id);

      if (!existingSellers || existingSellers.length === 0) {
        const sellersToCreate = teamData?.members || [
          {
            id: 'main',
            display_name: profileData.name,
            is_default: true,
          },
        ];

        for (const member of sellersToCreate) {
          const isMainUser = member.id === 'main' || member.display_name === profileData.name;

          const familyMemberData: any = {
            user_id: user.id,
            name: member.display_name,
            age: isMainUser && profileData.age ? parseInt(profileData.age) : 0,
            top_size: isMainUser ? profileData.top_size || null : null,
            bottom_size: isMainUser ? profileData.bottom_size || null : null,
            shoe_size: isMainUser ? profileData.shoe_size || null : null,
            persona_id: isMainUser && personaData?.personaId ? personaData.personaId : 'vinted_expert',
            is_default: member.is_default || member.id === teamData?.defaultMemberId,
            default_avatar_id: isMainUser && avatarSetupData?.avatarId ? avatarSetupData.avatarId : null,
            default_location_id: isMainUser && avatarSetupData?.locationId ? avatarSetupData.locationId : null,
          };

          // Add custom persona ID if created
          if (isMainUser && customPersonaId) {
            familyMemberData.custom_persona_id = customPersonaId;
          }

          if (isMainUser && personaData) {
            if (personaData.personaId && personaData.personaWritingStyle) {
              familyMemberData.writing_style = personaData.personaWritingStyle;
            } else if (personaData.customPersonaStyle) {
              familyMemberData.writing_style = personaData.customPersonaStyle;
            }
          }

          const { data: newSeller, error: sellerError } = await supabase
            .from('family_members')
            .insert(familyMemberData)
            .select()
            .single();

          if (sellerError) throw sellerError;

          if (member.is_default || member.id === teamData?.defaultMemberId) {
            defaultSellerId = newSeller.id;
          }
        }
      }

      const profileUpdate: any = {
        id: user.id,
        name: profileData.name,
        age: profileData.age ? parseInt(profileData.age) : null,
        top_size: profileData.top_size || '',
        bottom_size: profileData.bottom_size || '',
        shoe_size: profileData.shoe_size || '',
        onboarding_complet: true,
      };

      if (defaultSellerId) {
        profileUpdate.default_seller_id = defaultSellerId;
      }

      if (personaData?.personaId) {
        profileUpdate.persona_id = personaData.personaId;
      }

      if (customPersonaId) {
        profileUpdate.custom_persona_id = customPersonaId;
      }

      if (personaData?.customPersonaStyle) {
        profileUpdate.writing_style = personaData.customPersonaStyle;
      }

      if (avatarSetupData?.avatarId) {
        profileUpdate.default_avatar_id = avatarSetupData.avatarId;
      }

      if (avatarSetupData?.locationId) {
        profileUpdate.default_location_id = avatarSetupData.locationId;
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert(profileUpdate, { onConflict: 'id' });

      if (profileError) throw profileError;

      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Error completing onboarding:', err);
      setError('Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-center gap-1 sm:gap-2 mb-4 px-2">
              {steps.slice(0, -1).map((step, index) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold transition-all ${
                      index <= currentStepIndex
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  {index < steps.length - 2 && (
                    <div
                      className={`w-8 sm:w-16 h-1 mx-1 sm:mx-2 transition-all ${
                        index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm sm:text-base">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8">
            {currentStep === 'profile' && (
              <ProfileStep onNext={handleProfileNext} initialData={profileData || undefined} />
            )}

            {currentStep === 'persona' && (
              <PersonaStep
                onNext={handlePersonaNext}
                onSkip={handlePersonaSkip}
                onBack={handlePersonaBack}
                initialData={personaData || undefined}
              />
            )}

            {currentStep === 'avatar' && (
              <AvatarSetupStep
                onNext={handleAvatarSetupNext}
                onSkip={handleAvatarSetupSkip}
                onBack={handleAvatarSetupBack}
                initialData={avatarSetupData || undefined}
              />
            )}

            {currentStep === 'team' && profileData && (
              <TeamStep
                onNext={handleTeamNext}
                onSkip={handleTeamSkip}
                onBack={handleTeamBack}
                mainUserName={profileData.name}
                initialData={teamData || undefined}
              />
            )}

            {currentStep === 'completion' && profileData && (
              <CompletionStep
                onComplete={handleComplete}
                userName={profileData.name}
                avatarId={avatarSetupData?.avatarId || null}
                locationId={avatarSetupData?.locationId || null}
              />
            )}
          </div>

          {loading && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-700">Configuration de votre compte...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
