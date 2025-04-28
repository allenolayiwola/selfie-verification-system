import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import VerificationPage from "@/pages/verification-page";
import AdminPage from "@/pages/admin-page";
import UserManagementPage from "@/pages/user-management";
import VerificationHistoryPage from "@/pages/verification-history";
import VerificationDetailPage from "@/pages/verification-detail";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/verify" component={VerificationPage} />
      <ProtectedRoute path="/admin" component={AdminPage} />
      <ProtectedRoute path="/users" component={UserManagementPage} />
      <ProtectedRoute path="/history" component={VerificationHistoryPage} />
      {/* Use a normal Route instead of ProtectedRoute for verification details
          The component itself handles access control and redirection */}
      <Route path="/verification-detail/:id">
        {(params) => <VerificationDetailPage />}
      </Route>
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;