import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Pizza, LayoutDashboard, UtensilsCrossed, ShoppingBag, Calendar, BarChart3, Menu, X, LogOut, Globe, Receipt, ShoppingCart, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { name: "Panel Principal", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
    { name: "Pedidos", url: createPageUrl("Orders"), icon: ShoppingBag },
    { name: "Estadísticas", url: createPageUrl("Statistics"), icon: BarChart3 },
    { name: "Menú", url: createPageUrl("MenuManagement"), icon: UtensilsCrossed },
    { name: "Finanzas", url: createPageUrl("CompanyAccount"), icon: Wallet },
    { name: "Lista de Compras", url: createPageUrl("ShoppingList"), icon: ShoppingCart },
    { name: "Empleados", url: createPageUrl("EmployeeCalendar"), icon: Users },
    { name: "Página de Clientes", url: createPageUrl("CustomerOrder"), icon: Globe, highlight: true },
  ];

  const handleLogout = () => {
    base44.auth.logout();
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

      {/* Top Bar */}
      <header className="bg-[#1a1a1a] border-b border-yellow-500/30 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
                <img 
                  src="https://media.base44.com/images/public/69b1d01a96680d8f83115050/0982a0490_los_tios_logo_8k.png" 
                  alt="Los Tíos"
                  className="w-12 h-12 rounded-xl object-contain bg-[#1a1a1a]"
                />
                <div>
                  <h1 className="text-xl font-bold text-yellow-400">Los Tíos</h1>
                  <p className="text-xs text-gray-400">Sistema de Gestión</p>
                </div>
              </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.url}
                  className={`nav-link flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    item.highlight 
                      ? 'highlight-link' 
                      : location.pathname === item.url
                        ? 'text-yellow-400 bg-yellow-400/10 active'
                        : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-gray-300 hover:text-white hover:bg-white/10"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-yellow-500/30 bg-[#1a1a1a]">
            <nav className="px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.url}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    item.highlight
                      ? 'highlight-link'
                      : location.pathname === item.url
                        ? 'text-yellow-400 bg-yellow-400/10'
                        : 'text-gray-300 hover:bg-white/10'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Cerrar Sesión
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
}