import { useQuery } from '@tanstack/react-query';
import { PERSONAS } from '../constants/personas';

export interface Persona {
  id: string;
  name: string;
  description: string;
  writing_style: string;
  emoji: string;
  color: string;
}

export function usePersonas() {
  return useQuery({
    queryKey: ['personas'],
    queryFn: async () => {
      // Return personas from constants instead of database
      return PERSONAS.map(persona => ({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        writing_style: persona.writingStyle,
        emoji: persona.emoji,
        color: persona.color,
      })) as Persona[];
    },
    staleTime: 1000 * 60 * 60,
  });
}
