import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  BarChart3,
  Menu,
  X,
  LogOut,
  Globe,
  ShoppingCart,
  Wallet,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import losTiosLogo from "@/assets/los-tios-logo.png";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { logout } = useAuth();

  const navItems = [
    { name: "Panel Principal", shortName: "Panel", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
    { name: "Pedidos", shortName: "Pedidos", url: createPageUrl("Orders"), icon: ShoppingBag },
    { name: "Estadisticas", shortName: "Stats", url: createPageUrl("Statistics"), icon: BarChart3 },
    { name: "Menu", shortName: "Menu", url: createPageUrl("MenuManagement"), icon: UtensilsCrossed },
    { name: "Finanzas", shortName: "Finanzas", url: createPageUrl("CompanyAccount"), icon: Wallet },
    { name: "Lista de Compras", shortName: "Compras", url: createPageUrl("ShoppingList"), icon: ShoppingCart },
    { name: "Empleados", shortName: "Empleados", url: createPageUrl("EmployeeCalendar"), icon: Users },
    { name: "Pagina de Clientes", shortName: "Clientes", url: createPageUrl("CustomerOrder"), icon: Globe, highlight: true },
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <style>{`
        :root {
          --primary-600: #F5C400;
          --primary-700: #D4A900;
        }

        .nav-link {
          position: relative;
          transition: all 0.3s ease;
        }

        .nav-link::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: var(--primary-600);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .nav-link.active::before,
        .nav-link:hover::before {
          opacity: 1;
        }

        .highlight-link {
          background: linear-gradient(135deg, #F5C400 0%, #D4A900 100%);
          color: #1a1a1a !important;
          font-weight: 600;
        }

        .highlight-link:hover {
          background: linear-gradient(135deg, #D4A900 0%, #b89000 100%);
          color: #1a1a1a !important;
        }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-yellow-500/20 bg-[#1a1a1a]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-11 items-center justify-between gap-3">
            <Link to={createPageUrl("Dashboard")} className="shrink-0">
              <img
                src={losTiosLogo}
                alt="Los Tios"
                className="h-9 w-9 rounded-full bg-[#f5c400] p-[1px] border-2 border-yellow-300/90 object-contain shadow-sm"
              />
            </Link>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.url}
                  title={item.name}
                  className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition-all 2xl:px-2.5 ${
                    item.highlight
                      ? "bg-yellow-400 text-black hover:bg-yellow-300"
                      : location.pathname === item.url
                        ? "bg-yellow-400/10 text-yellow-400"
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <item.icon className="h-3 w-3" />
                  <span className="2xl:hidden">{item.shortName}</span>
                  <span className="hidden 2xl:inline">{item.name}</span>
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={handleLogout}
                className="hidden items-center gap-1.5 rounded bg-yellow-400/10 px-2 py-1.5 text-[11px] font-medium text-yellow-400 transition-all hover:bg-yellow-400/20 xl:flex 2xl:px-2.5"
              >
                <LogOut className="h-3 w-3" />
                <span className="2xl:hidden">Salir</span>
                <span className="hidden 2xl:inline">Cerrar Sesion</span>
              </button>

              <button
                className="p-1.5 text-gray-400 hover:text-white xl:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-yellow-500/30 bg-[#1a1a1a] xl:hidden">
            <nav className="space-y-2 px-4 py-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.url}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                    item.highlight
                      ? "highlight-link"
                      : location.pathname === item.url
                        ? "bg-yellow-400/10 text-yellow-400"
                        : "text-gray-300 hover:bg-white/10"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start px-4 py-3 text-gray-300 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Cerrar Sesion
              </Button>
            </nav>
          </div>
        )}
      </header>

      <main>{children}</main>
    </div>
  );
}
