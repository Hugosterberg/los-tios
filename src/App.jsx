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
import NotionPage from './pages/Notion';
import LocalSetupHelp from '@/components/LocalSetupHelp';
import IncomeTracker from './pages/IncomeTracker';
import IntegrationsHub from './pages/IntegrationsHub';
import { Button } from "@/components/ui/button";

const { Pages, Layout } = pagesConfig;
const DashboardPage = Pages["Dashboard"];

const CenteredStatusCard = ({ children, maxWidth = "max-w-lg" }) => (
  <div className="min-h-screen bg-[#111111] p-6 text-white flex items-center justify-center">
    <div className={`w-full ${maxWidth} rounded-2xl border bg-[#1b1b1b] p-6`}>
      {children}
    </div>
  </div>
);

class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown runtime error",
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <CenteredStatusCard maxWidth="max-w-2xl">
          <div className="rounded-2xl border border-red-500/30 p-0">
            <div className="p-6">
              <h1 className="text-xl font-semibold text-red-300">Admin page crashed</h1>
              <p className="mt-2 text-sm text-gray-300">
                A runtime error occurred while rendering this admin page.
              </p>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-red-200">
                {this.state.errorMessage}
              </pre>
            </div>
          </div>
        </CenteredStatusCard>
      );
    }

    return this.props.children;
  }
}

const LayoutWrapper = ({ children }) => (Layout ? <Layout>{children}</Layout> : children);

const renderAdminPage = (page) => (
  <AdminErrorBoundary>
    <LayoutWrapper>{page}</LayoutWrapper>
  </AdminErrorBoundary>
);

const FullScreenSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const isCustomerPage = window.location.pathname === '/';

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
    return <FullScreenSpinner />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'local_config_missing') {
      return <LocalSetupHelp />;
    } else if (authError.type === 'auth_required') {
      if (import.meta.env.DEV) {
        return (
          <CenteredStatusCard>
            <div className="rounded-2xl border border-yellow-500/20 p-0">
              <div className="p-6">
                <h1 className="text-xl font-semibold text-yellow-300">Authentication required</h1>
                <p className="mt-2 text-sm text-gray-300">
                  The app could not authenticate for `/admin`. In local development, this usually means missing or stale auth parameters.
                </p>
                <div className="mt-4">
                  <Button onClick={() => navigateToLogin()} className="bg-yellow-400 text-black hover:bg-yellow-300">
                    Go to login
                  </Button>
                </div>
              </div>
            </div>
          </CenteredStatusCard>
        );
      }

      navigateToLogin();
      return <FullScreenSpinner />;
    }
  }

  // Render admin pages
  return (
    <Routes>
      {/* Admin pages - with layout */}
      <Route path="/admin" element={renderAdminPage(DashboardPage ? <DashboardPage /> : null)} />
      <Route path="/CustomerOrder" element={<CustomerOrder />} />
      <Route path="/Notion" element={renderAdminPage(<NotionPage />)} />
      <Route path="/IncomeTracker" element={renderAdminPage(<IncomeTracker />)} />
      <Route path="/IntegrationsHub" element={renderAdminPage(<IntegrationsHub />)} />
      {Object.entries(Pages).map(([path, Page]) => (
        path !== "CustomerOrder" && (
          <Route
            key={path}
            path={`/${path}`}
            element={renderAdminPage(<Page />)}
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
