import { Toaster } from "./components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from './lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from './lib/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Generate from './pages/Generate';
import History from './pages/History';
import Settings from './pages/Settings';
import PersonaSelect from './pages/PersonaSelect';
import Register from './pages/Register';
import Login from './pages/Login';
import RefineContent from './pages/RefineContent';

import SuperAdminLogin from './pages/superadmin/SuperAdminLogin';
import SuperAdminLayout from './components/superadmin/SuperAdminLayout';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminCompanies from './pages/superadmin/SuperAdminCompanies';
import SuperAdminUsers from './pages/superadmin/SuperAdminUsers';
import SuperAdminBilling from './pages/superadmin/SuperAdminBilling';
import SuperAdminSettings from './pages/superadmin/SuperAdminSettings';
import SuperAdminAnalytics from './pages/superadmin/SuperAdminAnalytics';
import SuperAdminUsage from './pages/superadmin/SuperAdminUsage';
import SuperAdminPlans from './pages/superadmin/SuperAdminPlans';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, authError, navigateToLogin } = useAuth();

  // Loading
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Auth errors
  if (authError) {
    if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // ❗ NOT AUTHENTICATED → ONLY SHARED LOGIN
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<SuperAdminLayout />}>
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/superadmin/analytics" element={<SuperAdminAnalytics />} />
          <Route path="/superadmin/companies" element={<SuperAdminCompanies />} />
          <Route path="/superadmin/users" element={<SuperAdminUsers />} />
          <Route path="/superadmin/usage" element={<SuperAdminUsage />} />
          <Route path="/superadmin/plans" element={<SuperAdminPlans />} />
          <Route path="/superadmin/billing" element={<SuperAdminBilling />} />
          <Route path="/superadmin/settings" element={<SuperAdminSettings />} />
        </Route>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // ✅ AUTHENTICATED APP
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<MainLayout />}>
        <Route path="/" element={<Generate />} />
        <Route path="/history" element={<History />} />
        <Route path="/refine" element={<RefineContent />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/personas" element={<PersonaSelect />} />
      </Route>

      <Route path="/register" element={<Register />} />

      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route element={<SuperAdminLayout />}>
        <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
        <Route path="/superadmin/analytics" element={<SuperAdminAnalytics />} />
        <Route path="/superadmin/companies" element={<SuperAdminCompanies />} />
        <Route path="/superadmin/users" element={<SuperAdminUsers />} />
        <Route path="/superadmin/usage" element={<SuperAdminUsage />} />
        <Route path="/superadmin/plans" element={<SuperAdminPlans />} />
        <Route path="/superadmin/billing" element={<SuperAdminBilling />} />
        <Route path="/superadmin/settings" element={<SuperAdminSettings />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

function AppShell() {
  return (
    <QueryClientProvider client={queryClientInstance}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthenticatedApp />
        </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;