import React from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { appendMonthParam, isValidMonthKey } from "@/hooks/useMonthUrlSync";
import {
LayoutDashboard,
UtensilsCrossed,
ShoppingBag,
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

const MOBILE_QUICK_NAV_PAGE_NAMES = ["DailyCash", "Dashboard", "Orders", "Finance", "ShoppingList"];

export default function Layout({ children }) {
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
  const shoppingUrl = withMonth("ShoppingList");
  const isShoppingPage = location.pathname === createPageUrl("ShoppingList");
  const isActivePage = React.useCallback(
    (pageName) => location.pathname === createPageUrl(pageName),
    [location.pathname],
  );

  const navItems = [
    { pageName: "DailyCash", name: "Daily Cash", shortName: "Cash", url: withMonth("DailyCash"), icon: DollarSign },
    { pageName: "Dashboard", name: "Dashboard", shortName: "Dashboard", url: withMonth("Dashboard"), icon: LayoutDashboard },
    { pageName: "Orders", name: "Orders", shortName: "Orders", url: withMonth("Orders"), icon: ShoppingBag },
    { pageName: "Notion", name: "Notion", shortName: "Notion", url: withMonth("Notion"), icon: BookOpen },
    { pageName: "MenuManagement", name: "Menu", shortName: "Menu", url: withMonth("MenuManagement"), icon: UtensilsCrossed },
    { pageName: "Finance", name: "Finance", shortName: "Finance", url: withMonth("Finance"), icon: Wallet },
    { pageName: "ShoppingList", name: "Shopping List", shortName: "Shopping", url: withMonth("ShoppingList"), icon: ShoppingCart },
    { pageName: "EmployeeCalendar", name: "Employees", shortName: "Employees", url: withMonth("EmployeeCalendar"), icon: Users },
    { pageName: "Events", name: "Events", shortName: "Events", url: withMonth("Events"), icon: CalendarDays },
  ];
  const mobileQuickNavItems = navItems.filter((item) =>
    MOBILE_QUICK_NAV_PAGE_NAMES.includes(item.pageName),
  );
  const customerSiteUrl = withMonth("CustomerOrder");
  const isCustomerSitePage = isActivePage("CustomerOrder");

  const handleLogout = () => {
    logout();
  };

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  React.useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
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
                    isActivePage(item.pageName)
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
              <Link
                to={customerSiteUrl}
                title="Open customer site"
                className={`hidden items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-all lg:inline-flex ${
                  isCustomerSitePage
                    ? "bg-yellow-400 text-black hover:bg-yellow-300"
                    : "border border-yellow-500/20 text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Globe className="h-3 w-3" />
                <span>Customer Site</span>
              </Link>
              <Link
                to={shoppingUrl}
                title="Shopping"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all xl:hidden ${
                  isShoppingPage
                    ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                    : "border-yellow-500/20 text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <ShoppingCart className="h-4 w-4" />
              </Link>
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
          <>
            <button
              type="button"
              aria-label="Close navigation"
              className="fixed inset-0 z-40 bg-black/55 xl:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-50 border-t border-yellow-500/30 bg-[#1a1a1a] xl:hidden">
            <nav className="space-y-2 px-4 py-4">
              <div className="mb-3 rounded-lg border border-yellow-500/20 bg-black/20 p-2">
                <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-gray-500">Public</p>
                <Link
                  to={customerSiteUrl}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                    isCustomerSitePage
                      ? "bg-yellow-400 text-black"
                      : "text-gray-300 hover:bg-white/10"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Globe className="h-5 w-5" />
                  <span className="font-medium">Customer Site</span>
                </Link>
              </div>
              <div className="mb-3 rounded-lg border border-yellow-500/20 bg-black/20 p-2">
                <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-gray-500">Settings</p>
                <Link
                  to={withMonth("IntegrationsHub")}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                    isActivePage("IntegrationsHub")
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
                    isActivePage(item.pageName)
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
          </>
        )}

        <div className="border-t border-yellow-500/15 bg-[#161616] xl:hidden">
          <div className="overflow-x-auto px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <nav className="flex min-w-max items-center gap-2" aria-label="Mobile quick tabs">
              {mobileQuickNavItems.map((item) => (
                <Link
                  key={`mobile-quick-${item.name}`}
                  to={item.url}
                  className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-all ${
                    isActivePage(item.pageName)
                      ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                      : "border-yellow-500/20 bg-black/20 text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.shortName}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
