import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/store";

import LoginPage from "@/pages/LoginPage";
import EmployeeLayout from "@/pages/employee/EmployeeLayout";
import DashboardPage from "@/pages/employee/DashboardPage";
import OrderPage from "@/pages/employee/OrderPage";
import HistoryPage from "@/pages/employee/HistoryPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminEmployees from "@/pages/admin/AdminEmployees";
import AdminGroups from "@/pages/admin/AdminGroups";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminLogs from "@/pages/admin/AdminLogs";

function WithEmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <LoginPage />;
  return <EmployeeLayout>{children}</EmployeeLayout>;
}

function WithAdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <LoginPage />;
  if (!user.isAdmin) return <LoginPage />;
  return <AdminLayout>{children}</AdminLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />

      <Route path="/dashboard">
        <WithEmployeeLayout><DashboardPage /></WithEmployeeLayout>
      </Route>
      <Route path="/pedido">
        <WithEmployeeLayout><OrderPage /></WithEmployeeLayout>
      </Route>
      <Route path="/historico">
        <WithEmployeeLayout><HistoryPage /></WithEmployeeLayout>
      </Route>

      <Route path="/admin/funcionarios">
        <WithAdminLayout><AdminEmployees /></WithAdminLayout>
      </Route>
      <Route path="/admin/grupos">
        <WithAdminLayout><AdminGroups /></WithAdminLayout>
      </Route>
      <Route path="/admin/pedidos">
        <WithAdminLayout><AdminOrders /></WithAdminLayout>
      </Route>
      <Route path="/admin/config">
        <WithAdminLayout><AdminSettings /></WithAdminLayout>
      </Route>
      <Route path="/admin/logs">
        <WithAdminLayout><AdminLogs /></WithAdminLayout>
      </Route>
      <Route path="/admin">
        <WithAdminLayout><AdminDashboard /></WithAdminLayout>
      </Route>

      <Route>
        <LoginPage />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
