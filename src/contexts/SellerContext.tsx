import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Seller {
  id: string;
  name: string;
}

interface SellerContextValue {
  activeSeller: Seller | null;
  allSellers: Seller[];
  setActiveSeller: (seller: Seller) => void;
}

const SellerContext = createContext<SellerContextValue>({
  activeSeller: null,
  allSellers: [],
  setActiveSeller: () => {},
});

export function SellerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeSeller, setActiveSellerState] = useState<Seller | null>(null);
  const [allSellers, setAllSellers] = useState<Seller[]>([]);

  useEffect(() => {
    if (user) {
      loadSellers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadSellers() {
    if (!user) return;

    const [{ data: sellers }, { data: profile }] = await Promise.all([
      supabase
        .from('family_members')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('user_profiles')
        .select('default_seller_id')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    const list: Seller[] = sellers || [];
    setAllSellers(list);

    if (list.length === 0) return;

    const defaultId = (profile as any)?.default_seller_id;
    const found = defaultId ? list.find((m) => m.id === defaultId) : null;
    setActiveSellerState(found ?? list[0]);
  }

  function setActiveSeller(seller: Seller) {
    setActiveSellerState(seller);
  }

  return (
    <SellerContext.Provider value={{ activeSeller, allSellers, setActiveSeller }}>
      {children}
    </SellerContext.Provider>
  );
}

export function useSeller() {
  return useContext(SellerContext);
}
