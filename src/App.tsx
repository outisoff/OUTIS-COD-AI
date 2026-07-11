import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { StoreFilterProvider } from "@/contexts/StoreFilterContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { lazy, Suspense, Component, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import Login from "./pages/Login";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";

// Retry wrapper for lazy imports (handles transient 503 during HMR)
function lazyRetry(factory: () => Promise<any>) {
  return lazy(() => factory().catch(() => 
    new Promise(resolve => setTimeout(resolve, 1500)).then(() => factory())
  ));
}

// Patterns that indicate a transient HMR / chunk-loading error worth auto-reloading once.
const TRANSIENT_ERROR_PATTERNS = [
  /Loading chunk [\d]+ failed/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /ChunkLoadError/i,
  /must be used within an? \w+Provider/i, // stale context after HMR
  /Cannot read properties of undefined \(reading '__H'\)/i, // React HMR hook desync
];

const HMR_RELOAD_KEY = 'hmr-auto-reload-ts';

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  const matched = TRANSIENT_ERROR_PATTERNS.find((re) => re.test(msg));
  if (matched) {
    console.warn('[AutoReload] Transient error detected — will trigger reload', {
      pattern: matched.toString(),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  // Log non-transient errors too so we can see what's caught but NOT triggering reload
  console.error('[AutoReload] Non-transient error caught (no reload)', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return false;
}

function shouldAutoReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(HMR_RELOAD_KEY) || '0');
    // Avoid reload loops: only auto-reload if we haven't done so in the last 10s.
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(HMR_RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; reloading: boolean }> {
  state = { hasError: false, reloading: false };
  static getDerivedStateFromError() { return { hasError: true, reloading: false }; }
  componentDidCatch(error: unknown) {
    if (isTransientError(error) && shouldAutoReload()) {
      this.setState({ reloading: true });
      // Small delay so React can flush state before reload
      setTimeout(() => window.location.reload(), 150);
    }
  }
  render() {
    if (this.state.hasError) {
      if (this.state.reloading) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        );
      }
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
          <p className="text-muted-foreground">Une erreur est survenue lors du chargement.</p>
          <button className="px-4 py-2 rounded bg-primary text-primary-foreground" onClick={() => { this.setState({ hasError: false, reloading: false }); window.location.reload(); }}>
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Catch unhandled promise rejections from dynamic imports (chunk load failures during HMR)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (isTransientError(event.reason) && shouldAutoReload()) {
      window.location.reload();
    }
  });
}

const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const Orders = lazyRetry(() => import("./pages/Orders"));
const Products = lazyRetry(() => import("./pages/Products"));
const Customers = lazyRetry(() => import("./pages/Customers"));
const CustomersRisk = lazyRetry(() => import("./pages/CustomersRisk"));
const CustomersBlacklist = lazyRetry(() => import("./pages/CustomersBlacklist"));
const Confirmation = lazyRetry(() => import("./pages/Confirmation"));
const Expedition = lazyRetry(() => import("./pages/Expedition"));
const Tracking = lazyRetry(() => import("./pages/Tracking"));
const Delivery = lazyRetry(() => import("./pages/Delivery"));
const Stock = lazyRetry(() => import("./pages/Stock"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const Automatisation = lazyRetry(() => import("./pages/Automatisation"));
const Finance = lazyRetry(() => import("./pages/Finance"));
const Charges = lazyRetry(() => import("./pages/Charges"));
const Reports = lazyRetry(() => import("./pages/Reports"));
const Chatbot = lazyRetry(() => import("./pages/Chatbot"));
const MesPrompts = lazyRetry(() => import("./pages/MesPrompts"));
const EchangeSwap = lazyRetry(() => import("./pages/EchangeSwap"));
const PayeRetour = lazyRetry(() => import("./pages/PayeRetour"));
const Stores = lazyRetry(() => import("./pages/Stores"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isApproved, isLoading, isApprovalLoading } = useAuth();

  if (isLoading || (isAuthenticated && !isApproved && isApprovalLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Redirect unapproved users to pending approval page
  if (!isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }
  
  return <MainLayout>{children}</MainLayout>;
}

function AppRoutes() {
  const { isAuthenticated, isApproved, isLoading, isApprovalLoading } = useAuth();

  if (isLoading || (isAuthenticated && !isApproved && isApprovalLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const suspenseFallback = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <ErrorBoundary>
    <Suspense fallback={suspenseFallback}>
    <Routes>
      <Route path="/" element={
        isAuthenticated 
          ? (isApproved ? <Navigate to="/dashboard" replace /> : <Navigate to="/pending-approval" replace />)
          : <Navigate to="/login" replace />
      } />
      <Route path="/login" element={
        isAuthenticated 
          ? (isApproved ? <Navigate to="/dashboard" replace /> : <Navigate to="/pending-approval" replace />)
          : <Login />
      } />
      <Route path="/pending-approval" element={
        !isAuthenticated 
          ? <Navigate to="/login" replace />
          : (isApproved ? <Navigate to="/dashboard" replace /> : <PendingApproval />)
      } />
      <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/customers/risk" element={<ProtectedRoute><CustomersRisk /></ProtectedRoute>} />
      <Route path="/customers/blacklist" element={<ProtectedRoute><CustomersBlacklist /></ProtectedRoute>} />
      <Route path="/confirmation" element={<ProtectedRoute><Confirmation /></ProtectedRoute>} />
      <Route path="/expedition" element={<ProtectedRoute><Expedition /></ProtectedRoute>} />
      <Route path="/tracking" element={<ProtectedRoute><Tracking /></ProtectedRoute>} />
      
      <Route path="/echange-swap" element={<ProtectedRoute><EchangeSwap /></ProtectedRoute>} />
      <Route path="/paye-retour" element={<ProtectedRoute><PayeRetour /></ProtectedRoute>} />
      <Route path="/delivery" element={<ProtectedRoute><Delivery /></ProtectedRoute>} />
      <Route path="/stock" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/automatisation" element={<Navigate to="/automatisation/confirmation-ia" replace />} />
      <Route path="/automatisation/:subPage" element={<ProtectedRoute><Automatisation /></ProtectedRoute>} />
      <Route path="/payments" element={<Navigate to="/finance" replace />} />
      <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
      <Route path="/charges" element={<ProtectedRoute><Charges /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/chatbot" element={<ProtectedRoute><Chatbot /></ProtectedRoute>} />
      <Route path="/chatbot/prompts" element={<ProtectedRoute><MesPrompts /></ProtectedRoute>} />
      <Route path="/stores" element={<ProtectedRoute><Stores /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DateRangeProvider>
          <StoreFilterProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
          </StoreFilterProvider>
        </DateRangeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
