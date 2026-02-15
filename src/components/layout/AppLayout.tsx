import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Package,
  Settings,
  BarChart3,
  Menu,
  X,
  LogOut,
  Users,
  LayoutDashboard,
  Shield,
  ChevronDown,
  Bot,
  Activity,
  Check,
  Shirt,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ShoppingBag } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { EmailVerificationBanner } from "../EmailVerificationBanner";
import { KellyProactive } from "../KellyProactive";
import "../../styles/navigation.css";

interface AppLayoutProps {
  children: React.ReactNode;
}

interface FamilyMember {
  id: string;
  name: string;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [defaultSeller, setDefaultSeller] = useState<FamilyMember | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSellerMenu, setShowSellerMenu] = useState(false);

  const [showKellyPanel, setShowKellyPanel] = useState(false);
  const [kellyInsightsCount, setKellyInsightsCount] = useState(0);

  const [headerScrolled, setHeaderScrolled] = useState(false);

  const [closingMenu, setClosingMenu] = useState(false);
  const [closingSellerMenu, setClosingSellerMenu] = useState(false);

  const [pagesExpanded, setPagesExpanded] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const sellerMenuRef = useRef<HTMLDivElement>(null);

  const MENU_CLOSE_MS = 520;

  useEffect(() => {
    if (user) {
      loadDefaultSeller();
      loadFamilyMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      setHeaderScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMenuWithAnimation = (menuType: "main" | "seller") => {
    if (menuType === "main") {
      setClosingMenu(true);
      window.setTimeout(() => {
        setMobileMenuOpen(false);
        setClosingMenu(false);
      }, MENU_CLOSE_MS);
    } else if (menuType === "seller") {
      setClosingSellerMenu(true);
      window.setTimeout(() => {
        setShowSellerMenu(false);
        setClosingSellerMenu(false);
      }, MENU_CLOSE_MS);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (mobileMenuOpen && !closingMenu) closeMenuWithAnimation("main");
      }
      if (sellerMenuRef.current && !sellerMenuRef.current.contains(event.target as Node)) {
        if (showSellerMenu && !closingSellerMenu) closeMenuWithAnimation("seller");
      }
    }

    if (mobileMenuOpen || showSellerMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileMenuOpen, showSellerMenu, closingMenu, closingSellerMenu]);

  async function loadDefaultSeller() {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("default_seller_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData?.default_seller_id) {
        const { data: sellerData, error: sellerError } = await supabase
          .from("family_members")
          .select("id, name")
          .eq("id", profileData.default_seller_id)
          .maybeSingle();

        if (!sellerError && sellerData) setDefaultSeller(sellerData);
      } else {
        const { data: firstSeller } = await supabase
          .from("family_members")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name")
          .limit(1)
          .maybeSingle();

        if (firstSeller) setDefaultSeller(firstSeller);
      }
    } catch (error) {
      console.error("Error loading default seller:", error);
    }
  }

  async function loadFamilyMembers() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("family_members")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setFamilyMembers(data || []);
    } catch (error) {
      console.error("Error loading family members:", error);
    }
  }

  async function setDefaultSellerHandler(sellerId: string) {
    if (!user) return;

    try {
      await supabase.from("family_members").update({ is_default: false }).eq("user_id", user.id);

      await supabase
        .from("family_members")
        .update({ is_default: true })
        .eq("id", sellerId)
        .eq("user_id", user.id);

      const { error } = await supabase
        .from("user_profiles")
        .update({ default_seller_id: sellerId })
        .eq("id", user.id);

      if (error) throw error;

      const selectedSeller = familyMembers.find((m) => m.id === sellerId);
      if (selectedSeller) setDefaultSeller(selectedSeller);

      closeMenuWithAnimation("seller");
    } catch (error) {
      console.error("Error setting default seller:", error);
    }
  }

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className={`bg-white border-b border-gray-200 sticky top-0 z-50 transition-all duration-300 ${
          headerScrolled ? "shadow-lg shadow-gray-200/50 backdrop-blur-xl bg-white/95" : ""
        }`}
      >
        <EmailVerificationBanner />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              {/* Logo = retour au dashboard */}
              <Link to="/mon_dressing" className="flex items-center gap-2 logo-animation ripple-effect">
                <ShoppingBag className="w-6 h-6 text-emerald-600 transition-transform" />
                <span className="text-xl font-bold text-gray-900">
                  <span className="text-emerald-600">Easy</span>Vinted
                </span>
              </Link>

              {/* Vendeur par défaut - cliquable si plusieurs vendeurs */}
              {familyMembers.length > 1 && (
                <div className="relative" ref={sellerMenuRef}>
                  <button
                    onClick={() => {
                      if (showSellerMenu) {
                        if (!closingSellerMenu) closeMenuWithAnimation("seller");
                      } else {
                        setShowSellerMenu(true);
                      }
                    }}
                    className="ripple-effect flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 group"
                    title="Changer le vendeur par défaut"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform"></div>
                    <span className="text-xs font-medium text-gray-700">{defaultSeller?.name || "Sélectionner"}</span>
                    <ChevronDown className={`w-3 h-3 text-gray-500 chevron-rotate transition-transform ${showSellerMenu ? "rotate-180" : ""}`} />
                  </button>

                  {showSellerMenu && (
                    <div className={`dropdown-menu ${closingSellerMenu ? "closing" : ""}`}>
                      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vendeur actif</p>
                      </div>
                      {familyMembers.map((member, index) => (
                        <button
                          key={member.id}
                          onClick={() => setDefaultSellerHandler(member.id)}
                          className={`menu-item flex items-center justify-between w-full px-4 py-2.5 text-sm transition-colors ${
                            defaultSeller?.id === member.id
                              ? "text-emerald-700 font-medium bg-emerald-50/50"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <span className="flex items-center gap-2.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${defaultSeller?.id === member.id ? "bg-emerald-500" : "bg-gray-300"}`}></div>
                            {member.name}
                          </span>
                          {defaultSeller?.id === member.id && (
                            <Check className="w-4 h-4 text-emerald-600 animate-in fade-in zoom-in duration-200" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="flex items-center gap-3">
              {/* Burger menu - visible sur mobile et desktop */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => {
                    if (mobileMenuOpen) {
                      if (!closingMenu) closeMenuWithAnimation("main");
                    } else {
                      setMobileMenuOpen(true);
                    }
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-300 hover:scale-110 ripple-effect"
                  aria-label="Menu"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6 animate-in spin-in-90 duration-300" /> : <Menu className="w-6 h-6 animate-in fade-in duration-300" />}
                </button>

                {mobileMenuOpen && (
                  <div className={`dropdown-menu dropdown-menu-large ${closingMenu ? "closing" : ""}`}>

                    {/* Section Pages */}
                    <div className="border-b border-gray-100">
                      <button
                        onClick={() => setPagesExpanded(!pagesExpanded)}
                        className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-bold text-gray-900 uppercase tracking-wider hover:bg-gray-50 transition-colors ripple-effect"
                      >
                        <span className="flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Pages
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${pagesExpanded ? "rotate-180" : ""}`} />
                      </button>

                      <div className={`overflow-hidden transition-all duration-300 ${pagesExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                        <Link
                          to="/mon_dressing"
                          onClick={() => closeMenuWithAnimation("main")}
                          className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium group ${
                            isActive("/mon_dressing") ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-gray-700 hover:bg-gray-50"
                          }`}
                          style={{ animationDelay: mobileMenuOpen && pagesExpanded ? "50ms" : "0ms" }}
                        >
                          <LayoutDashboard className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          Mon dressing
                        </Link>

                        <Link
                          to="/virtual-stylist"
                          onClick={() => closeMenuWithAnimation("main")}
                          className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium group ${
                            isActive("/virtual-stylist") ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-gray-700 hover:bg-gray-50"
                          }`}
                          style={{ animationDelay: mobileMenuOpen && pagesExpanded ? "90ms" : "0ms" }}
                        >
                          <Shirt className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          Cabine d'essayage
                        </Link>
                      </div>
                    </div>

                    {/* Section Actions */}
                    <div className="border-b border-gray-100">
                      <button
                        onClick={() => setActionsExpanded(!actionsExpanded)}
                        className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-bold text-gray-900 uppercase tracking-wider hover:bg-gray-50 transition-colors ripple-effect"
                      >
                        <span className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Actions
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${actionsExpanded ? "rotate-180" : ""}`} />
                      </button>

                      <div className={`overflow-hidden transition-all duration-300 ${actionsExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
                        <Link
                          to="/admin/agent-publisher-ia"
                          onClick={() => closeMenuWithAnimation("main")}
                          className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium group ${
                            isActive("/admin/agent-publisher-ia") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50"
                          }`}
                          style={{ animationDelay: mobileMenuOpen && actionsExpanded ? "50ms" : "0ms" }}
                        >
                          <Bot className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          Agent Publisher IA
                        </Link>

                        <Link
                          to="/admin/publication-monitor"
                          onClick={() => closeMenuWithAnimation("main")}
                          className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium group ${
                            isActive("/admin/publication-monitor") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50"
                          }`}
                          style={{ animationDelay: mobileMenuOpen && actionsExpanded ? "90ms" : "0ms" }}
                        >
                          <Activity className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          Monitoring publications
                        </Link>

                        <Link
                          to="/analytics"
                          onClick={() => closeMenuWithAnimation("main")}
                          className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium group ${
                            isActive("/analytics") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50"
                          }`}
                          style={{ animationDelay: mobileMenuOpen && actionsExpanded ? "130ms" : "0ms" }}
                        >
                          <BarChart3 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          Statistiques
                        </Link>
                      </div>
                    </div>

                    {/* Section Configuration */}
                    <div>
                      <button
                        onClick={() => setConfigExpanded(!configExpanded)}
                        className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-bold text-gray-900 uppercase tracking-wider hover:bg-gray-50 transition-colors ripple-effect"
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          Configuration
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${configExpanded ? "rotate-180" : ""}`} />
                      </button>

                      <div className={`overflow-hidden transition-all duration-300 ${configExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                        <Link
                          to="/profile"
                          onClick={() => closeMenuWithAnimation("main")}
                          className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium group ${
                            isActive("/profile") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50"
                          }`}
                          style={{ animationDelay: mobileMenuOpen && configExpanded ? "50ms" : "0ms" }}
                        >
                          <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="text-xs font-semibold text-white">{user?.email ? getInitials(user.email) : "U"}</span>
                          </div>
                          Mon Profil
                        </Link>

                        <Link
                          to="/family"
                          onClick={() => closeMenuWithAnimation("main")}
                          className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium group ${
                            isActive("/family") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50"
                          }`}
                          style={{ animationDelay: mobileMenuOpen && configExpanded ? "90ms" : "0ms" }}
                        >
                          <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          Vendeurs
                        </Link>

                        <button
                          onClick={handleSignOut}
                          className="mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium group text-red-600 hover:bg-red-50 w-full"
                          style={{ animationDelay: mobileMenuOpen && configExpanded ? "130ms" : "0ms" }}
                        >
                          <LogOut className="w-5 h-5 group-hover:translate-x-[-2px] transition-transform" />
                          Se déconnecter
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>

      <KellyProactive
        onNavigateToArticle={(articleId) => navigate(`/articles/${articleId}/preview`)}
        onCreateBundle={(articleIds) => navigate("/lots/new", { state: { preselectedArticles: articleIds } })}
        isOpenFromHeader={showKellyPanel}
        onToggleFromHeader={() => setShowKellyPanel(!showKellyPanel)}
        onInsightsCountChange={setKellyInsightsCount}
      />
    </div>
  );
}
