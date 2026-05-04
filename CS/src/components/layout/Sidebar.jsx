import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Settings, Sparkles, LogOut, Building2 } from "lucide-react";
import { platforms, getPersonaById } from "@/lib/personas";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { icon: Sparkles, label: "Generate", path: "/" },
  { icon: Building2, label: "Company Personas", path: "/personas" },
  { icon: Clock, label: "History", path: "/history" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export default function Sidebar({ activePersona, onPersonaChange, collapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const persona = getPersonaById(activePersona);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside
      className={`flex flex-col bg-card border-r border-border h-full transition-all duration-200 ${
        collapsed ? "w-16" : "w-52"
      }`}
    >
      {/* Persona badge */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-border">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-display font-bold shrink-0"
          style={{
            background: `${persona.color}1f`,
            border: `1px solid ${persona.color}`,
            color: persona.color,
          }}
        >
          {persona.label.charAt(0)}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-display font-semibold text-foreground truncate">
              {persona.label}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Active Persona
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-1">
          {!collapsed && "Menu"}
        </span>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <TooltipProvider key={item.path} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-secondary-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </nav>

      {/* Persona quick-switcher */}
      {!collapsed && (
        <div className="px-2 py-3 border-t border-border">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-2 block">
            Platforms
          </span>
          <div className="flex flex-col gap-0.5">
            {platforms.map((p) => (
              <button
                key={p.id}
                onClick={() => onPersonaChange(p.id)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-left transition-colors ${
                  activePersona === p.id
                    ? "bg-primary/10 text-primary"
                    : "text-secondary-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: p.color }}
                />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Sign Out */}
      <div className="px-2 py-3 border-t border-border">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Sign Out</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  );
}