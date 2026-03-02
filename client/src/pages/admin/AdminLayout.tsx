import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, ShoppingBag, LogOut, Layers, Settings, Shield } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";

const tabs = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/funcionarios", label: "Funcionários", icon: Users },
  { path: "/admin/grupos", label: "Grupos", icon: Layers },
  { path: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { path: "/admin/logs", label: "Logs", icon: Shield },
  { path: "/admin/config", label: "Config", icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { logout } = useAuthStore();
  const [location, navigate] = useLocation();
  const { data: settings } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });
  const companyName = settings?.companyName || "Brasfrut";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-2xl mx-auto">
      <header className="bg-green-900 text-white px-4 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{companyName} Admin</h1>
          <p className="text-green-200 text-xs">Painel Administrativo</p>
        </div>
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className="w-9 h-9 bg-green-800 rounded-xl flex items-center justify-center"
          data-testid="button-admin-logout"
        >
          <LogOut size={16} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white border-t border-gray-100 flex overflow-x-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = location === path;
          return (
            <Link
              key={path}
              to={path}
              className={"flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-semibold min-w-[56px] transition-colors " +
                (active ? "text-green-900" : "text-gray-400")}
              data-testid={`admin-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px]">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
