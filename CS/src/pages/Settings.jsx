import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient, tokenStorage } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/components/theme-provider";
import {
  Moon,
  Sun,
  Users,
  CreditCard,
  BarChart3,
  HelpCircle,
  Info,
  LogOut,
  ExternalLink,
  Building2,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/dialogs/ConfirmDialog";

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const { data: userMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['user-metrics'],
    queryFn: async () => {
      const token = tokenStorage.getUserToken();
      return await apiClient.get('/user/metrics', token);
    },
  });

  const generationsThisMonth = userMetrics?.generationsThisMonth ?? 0;
  const planName = userMetrics?.planName ?? 'Free';
  const companyPersonaCount = userMetrics?.companyPersonaCount ?? 0;
  const companyPersonaLimit = userMetrics?.companyPersonaLimit ?? 0;
  const activeCompanyName = user?.company || user?.full_name || 'Current Company';
  const activeCompanyInitial = activeCompanyName.charAt(0).toUpperCase();
  const isDarkTheme = theme !== 'light';

  const { data: companyPersonas = [] } = useQuery({
    queryKey: ['company-personas'],
    queryFn: async () => {
      const token = tokenStorage.getUserToken();
      return await apiClient.get('/company-personas', token);
    },
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleToggleTheme = () => {
    const nextTheme = isDarkTheme ? 'light' : 'dark';
    setTheme(nextTheme);
    toast({ title: `Switched to ${nextTheme} theme`, duration: 1500 });
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <h2 className="text-lg font-display font-bold text-foreground">
        Settings
      </h2>

      {/* Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Moon className="w-4 h-4 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground">
                Switch between light and dark mode
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleTheme}
              className="gap-2"
            >
              {isDarkTheme ? (
                <Moon className="w-3.5 h-3.5" />
              ) : (
                <Sun className="w-3.5 h-3.5" />
              )}
              {isDarkTheme ? "Dark" : "Light"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {user?.full_name?.charAt(0) || "U"}
              </div>
              <div>
                <p className="text-sm text-foreground">
                  {user?.full_name || "User"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.email || ""}
                </p>
              </div>
            </div>
            <Badge className="text-[10px]">Owner</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Current Plan</p>
              <p className="text-xs text-muted-foreground">
                {planName === 'Free' ? 'Limited features, upgrade for more' : 'Full access to all features'}
              </p>
            </div>
            <Badge className={`text-[10px] ${
              planName === 'Enterprise'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : planName === 'Pro'
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-muted text-muted-foreground border border-border'
            }`}>
              {planName}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">
              Generations this month
            </p>
            <span className="text-lg font-display font-bold text-foreground">
              {metricsLoading ? '—' : generationsThisMonth.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-foreground">Company personas</p>
            <span className="text-sm font-medium text-foreground">
              {metricsLoading ? '—' : `${companyPersonaCount}/${companyPersonaLimit}`}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Company Personas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {companyPersonas.length === 0 ? (
            <p className="text-xs text-muted-foreground">No company personas created yet.</p>
          ) : (
            companyPersonas.map((persona) => (
              <div key={persona.id} className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{persona.name}</p>
                    {persona.tagline && <p className="text-xs text-muted-foreground mt-1">{persona.tagline}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px]">{persona.company}</Badge>
                </div>
                {persona.analysis && <p className="mt-2 text-xs text-muted-foreground">{persona.analysis}</p>}
                {persona.logo_url && <p className="mt-2 text-xs text-muted-foreground">Logo: {persona.logo_url}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Help */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            Help & Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-sm gap-2 h-9"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Documentation
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-sm gap-2 h-9"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Support
          </Button>
          <Separator className="my-2" />
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3 h-3" /> Version
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              1.0.0
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Switch Company */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Switch Company
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Sign out of your current company account and log in as a different
            company user.
          </p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {activeCompanyInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {activeCompanyName}
              </p>
              <p className="text-xs text-muted-foreground">
                {user?.email || "current session"}
              </p>
            </div>
            <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20">
              Active
            </Badge>
          </div>
          <Button
            variant="outline"
            className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
            onClick={handleLogout}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Sign Out & Switch Company
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            After signing out, log in with the other company's credentials
          </p>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
        onClick={() => setLogoutConfirm(true)}
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>

      <ConfirmDialog
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sign out?"
        description="You'll need to sign in again to access the studio."
        confirmLabel="Sign Out"
        destructive
      />
    </div>
  );
}