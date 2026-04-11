import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface GeminiContextType {
  hasGeminiKey: boolean | null;
  refreshGeminiKey: () => Promise<void>;
}

const GeminiContext = createContext<GeminiContextType | undefined>(undefined);

export function GeminiProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);

  const refreshGeminiKey = async () => {
    if (!user) {
      setHasGeminiKey(null);
      return;
    }
    const { data } = await supabase
      .from('user_profiles')
      .select('gemini_api_key')
      .eq('id', user.id)
      .maybeSingle();
    setHasGeminiKey(!!(data as any)?.gemini_api_key);
  };

  useEffect(() => {
    if (user) {
      refreshGeminiKey();
    } else {
      setHasGeminiKey(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <GeminiContext.Provider value={{ hasGeminiKey, refreshGeminiKey }}>
      {children}
    </GeminiContext.Provider>
  );
}

export function useGemini() {
  const context = useContext(GeminiContext);
  if (context === undefined) {
    throw new Error('useGemini must be used within a GeminiProvider');
  }
  return context;
}
