import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Settings,
  ShieldCheck,
  LogOut,
  BarChart3,
  Zap,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { tokenStorage } from '@/api/apiClient';

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/superadmin/dashboard" },
  { label: "Analytics", icon: BarChart3, path: "/superadmin/analytics" },
  { label: "Companies", icon: Building2, path: "/superadmin/companies" },
  { label: "Users", icon: Users, path: "/superadmin/users" },
  { label: "Usage", icon: Zap, path: "/superadmin/usage" },
  { label: "Plans", icon: Layers, path: "/superadmin/plans" },
  { label: "Billing", icon: CreditCard, path: "/superadmin/billing" },
  { label: "Settings", icon: Settings, path: "/superadmin/settings" },
];

export default function SuperAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuperAdminAuthenticated =
    typeof window !== "undefined" && window.localStorage.getItem("superadmin_auth") === "true";

  if (!isSuperAdminAuthenticated) {
    navigate("/login", { replace: true });
    return null;
  }

  const handleLogout = () => {
    window.localStorage.removeItem("superadmin_auth");
    tokenStorage.clearSuperAdminToken();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 bg-card border-r border-border flex flex-col transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-foreground leading-tight">Superadmin</p>
            <p className="text-xs text-muted-foreground">Control Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ label, icon: Icon, path }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-card/80 backdrop-blur border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className="text-xl leading-none">
              {mobileOpen ? "×" : "☰"}
            </span>
          </button>

          <p className="text-sm text-muted-foreground hidden md:block">
            Logged in as <span className="text-foreground font-medium">superadmin@creativestudio.com</span>
          </p>

          <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-medium">
            Superadmin
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}