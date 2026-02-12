import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { NotificationBanner } from './components/NotificationBanner';

const DashboardPageV2 = lazy(() => import('./pages/DashboardPageV2').then(m => ({ default: m.DashboardPageV2 })));
const ArticleFormPageV2 = lazy(() => import('./pages/ArticleFormPageV2').then(m => ({ default: m.ArticleFormPageV2 })));
const PreviewPage = lazy(() => import('./pages/PreviewPage').then(m => ({ default: m.PreviewPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const PlannerPage = lazy(() => import('./pages/PlannerPage').then(m => ({ default: m.PlannerPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then(m => ({ default: m.SignupPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const FamilyMembersPage = lazy(() => import('./pages/FamilyMembersPage').then(m => ({ default: m.FamilyMembersPage })));
const PhotoStudioPage = lazy(() => import('./pages/PhotoStudioPage').then(m => ({ default: m.PhotoStudioPage })));
const MonDressingPage = lazy(() => import('./pages/MonDressingPage').then(m => ({ default: m.MonDressingPage })));
const AgentOptimizedView = lazy(() => import('./pages/AgentOptimizedView'));
const AgentPublisherIA = lazy(() => import('./pages/AgentPublisherIA'));
const PublicationMonitorPage = lazy(() => import('./pages/PublicationMonitorPage').then(m => ({ default: m.PublicationMonitorPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })));
const StructureFormPage = lazy(() => import('./pages/StructureFormPage').then(m => ({ default: m.StructureFormPage })));
const LotStructureFormPage = lazy(() => import('./pages/LotStructureFormPage').then(m => ({ default: m.LotStructureFormPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const VirtualStylistPage = lazy(() => import('./pages/VirtualStylistPage').then(m => ({ default: m.VirtualStylistPage })));

const LoadingFallback = () => (
  <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-48"></div>
          <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded w-64"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 border-2 border-gray-100"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 flex-shrink-0"></div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-full"></div>
                <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded w-2/3"></div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl"></div>
              <div className="w-9 h-9 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Pages publiques */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/contact" element={<ContactPage />} />

            {/* Onboarding (protégée mais sans AppLayout) */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* Pages protégées */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <NotificationBanner />
                  <AppLayout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Routes>
                        <Route path="/dashboard-v2" element={<DashboardPageV2 />} />
                        <Route path="/mon_dressing" element={<MonDressingPage />} />

                        <Route path="/admin/agent-optimized" element={<AgentOptimizedView />} />
                        <Route path="/admin/agent-publisher-ia" element={<AgentPublisherIA />} />
                        <Route path="/admin/publication-monitor" element={<PublicationMonitorPage />} />
                        <Route path="/articles/new-v2" element={<ArticleFormPageV2 />} />
                        <Route path="/articles/:id/edit-v2" element={<ArticleFormPageV2 />} />
                        <Route path="/articles/:id/preview" element={<PreviewPage />} />
                        <Route path="/articles/:id/structure" element={<StructureFormPage />} />
                        <Route path="/lots/:id/structure" element={<LotStructureFormPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/planner" element={<PlannerPage />} />
                        <Route path="/photo-studio" element={<PhotoStudioPage />} />
                        <Route path="/virtual-stylist" element={<VirtualStylistPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/family" element={<FamilyMembersPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<Navigate to="/mon_dressing" replace />} />
                      </Routes>
                    </Suspense>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
