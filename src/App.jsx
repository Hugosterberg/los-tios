import React from 'react';
import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import CustomerOrder from './pages/CustomerOrder';
import LocalSetupHelp from '@/components/LocalSetupHelp';

const { Pages, Layout } = pagesConfig;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const location = window.location;
  const isCustomerPage = location.pathname === '/';

  // Always render customer page without auth
  if (isCustomerPage) {
    return (
      <Routes>
        <Route path="/" element={<CustomerOrder />} />
        <Route path="*" element={<CustomerOrder />} />
      </Routes>
    );
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'local_config_missing') {
      return <LocalSetupHelp />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // Render admin pages
  return (
    <Routes>
      {/* Customer-facing page - no admin layout */}
      <Route path="/" element={<CustomerOrder />} />

      {/* Admin pages - with layout */}
      <Route path="/admin" element={
        <LayoutWrapper currentPageName="Dashboard">
          {Pages["Dashboard"] ? React.createElement(Pages["Dashboard"]) : <></>}
        </LayoutWrapper>
      } />
      <Route path="/CustomerOrder" element={<CustomerOrder />} />
      {Object.entries(Pages).map(([path, Page]) => (
        path !== "CustomerOrder" && (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        )
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
