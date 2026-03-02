import { Link, useLocation } from "wouter";
import { LayoutDashboard, ShoppingCart, History, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/store";

const tabs = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/pedido", label: "Pedido", icon: ShoppingCart },
  { path: "/historico", label: "Histórico", icon: History },
];

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

export default function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const { user, logout } = useAuthStore();
  const [location, navigate] = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-2xl mx-auto">
      <header className="bg-green-900 text-white px-4 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Brasfrut</h1>
          <p className="text-green-200 text-xs">{user?.name?.split(" ")[0]}</p>
        </div>
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className="w-9 h-9 bg-green-800 rounded-xl flex items-center justify-center"
          data-testid="button-logout"
        >
          <LogOut size={16} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white border-t border-gray-100 flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = location === path;
          return (
            <Link
              key={path}
              to={path}
              className={"flex-1 flex flex-col items-center justify-center py-3 gap-1 text-xs font-semibold transition-colors " +
                (active ? "text-green-900" : "text-gray-400")}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
