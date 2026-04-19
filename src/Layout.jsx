import React from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { appendMonthParam, isValidMonthKey } from "@/hooks/useMonthUrlSync";
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
  DollarSign,
  Users,
  BookOpen,
Settings2,
CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import losTiosLogo from "@/assets/los-tios-logo.png";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { logout } = useAuth();

  /* Propagate ?month=YYYY-MM across every sidebar link so the selected period persists
     through any navigation path (even via pages that don't themselves use the param).
     Pages that don't care about `month` simply ignore it. */
  const currentMonthParam = searchParams.get("month");
  const activeMonth = isValidMonthKey(currentMonthParam) ? currentMonthParam : null;
  const withMonth = React.useCallback(
    (pageName) => appendMonthParam(createPageUrl(pageName), activeMonth),
    [activeMonth],
  );

  const navItems = [
    { name: "Daily Cash", shortName: "Cash", url: withMonth("DailyCash"), icon: DollarSign },
    { name: "Dashboard", shortName: "Dashboard", url: withMonth("Dashboard"), icon: LayoutDashboard },
    { name: "Orders", shortName: "Orders", url: withMonth("Orders"), icon: ShoppingBag },
    { name: "Notion", shortName: "Notion", url: withMonth("Notion"), icon: BookOpen },
    { name: "Statistics", shortName: "Stats", url: withMonth("Statistics"), icon: BarChart3 },
    { name: "Menu", shortName: "Menu", url: withMonth("MenuManagement"), icon: UtensilsCrossed },
    { name: "Finance", shortName: "Finance", url: withMonth("Finance"), icon: Wallet },
    { name: "Shopping List", shortName: "Shopping", url: withMonth("ShoppingList"), icon: ShoppingCart },
    { name: "Employees", shortName: "Employees", url: withMonth("EmployeeCalendar"), icon: Users },
    { name: "Events", shortName: "Events", url: withMonth("Events"), icon: CalendarDays },
    { name: "Customer Page", shortName: "Customers", url: withMonth("CustomerOrder"), icon: Globe, highlight: true },
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
          <div className="flex h-10 items-center justify-between gap-2.5" lang="en">
            <div className="flex shrink-0 items-center gap-2">
              <Link to={withMonth("Dashboard")} className="shrink-0">
                <img
                  src={losTiosLogo}
                  alt="Los Tios"
                  className="h-9 w-9 rounded-full bg-[#f5c400] p-[1px] border-2 border-yellow-300/90 object-contain shadow-sm"
                />
              </Link>
              <Link
                to={withMonth("IntegrationsHub")}
                title="Settings & Integrations"
                className={`hidden xl:inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-all ${
                  location.pathname === createPageUrl("IntegrationsHub")
                    ? "bg-yellow-400/10 text-yellow-300 border border-yellow-400/30"
                    : "text-gray-400 border border-yellow-500/20 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Settings2 className="h-3 w-3" />
                Settings
              </Link>
            </div>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 xl:flex">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.url}
                  title={item.name}
                  className={`flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-all 2xl:px-2.5 ${
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
                className="hidden items-center gap-1 rounded bg-yellow-400/10 px-1.5 py-1 text-[10px] font-medium text-yellow-400 transition-all hover:bg-yellow-400/20 xl:flex 2xl:px-2"
              >
                <LogOut className="h-3 w-3" />
                <span className="2xl:hidden">Logout</span>
                <span className="hidden 2xl:inline">Sign Out</span>
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
              <div className="mb-3 rounded-lg border border-yellow-500/20 bg-black/20 p-2">
                <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-gray-500">Settings</p>
                <Link
                  to={withMonth("IntegrationsHub")}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                    location.pathname === createPageUrl("IntegrationsHub")
                      ? "bg-yellow-400/10 text-yellow-400"
                      : "text-gray-300 hover:bg-white/10"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Settings2 className="h-5 w-5" />
                  <span className="font-medium">Integrations</span>
                </Link>
              </div>
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
                Sign Out
              </Button>
            </nav>
          </div>
        )}
      </header>

      <main>{children}</main>
    </div>
  );
}
