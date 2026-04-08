import { UserCheck } from 'lucide-react';

interface TeamStepProps {
  onNext: (data: TeamData) => void;
  onSkip: () => void;
  onBack: () => void;
  mainUserName: string;
  initialData?: TeamData;
}

export interface TeamMember {
  id: string;
  display_name: string;
  is_default: boolean;
}

export interface TeamData {
  members: TeamMember[];
  defaultMemberId: string;
}

export default function TeamStep({ onNext, onBack, mainUserName }: TeamStepProps) {
  const mainMember: TeamMember = {
    id: 'main',
    display_name: mainUserName,
    is_default: true,
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({
      members: [mainMember],
      defaultMemberId: 'main',
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6 sm:mb-8">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-green-500 to-teal-500 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center">
          <UserCheck className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Vendeur principal</h2>
        <p className="text-sm sm:text-base text-gray-600 px-4">
          Vous êtes défini comme vendeur principal
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="p-6 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-lg">{mainUserName}</div>
              <div className="text-sm text-gray-600">Vendeur par défaut</div>
            </div>
            <span className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full font-medium">
              Actif
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-gray-600">
              <strong>Astuce :</strong> Vous pourrez ajouter d'autres vendeurs (famille, amis...)
              plus tard dans la section <span className="font-semibold text-blue-700">Vendeurs</span>.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Retour
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Suivant
          </button>
        </div>
      </form>
    </div>
  );
}
