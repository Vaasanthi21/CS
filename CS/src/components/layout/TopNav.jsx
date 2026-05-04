import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, LogOut, Wifi } from "lucide-react";
import { getPersonaById } from "@/lib/personas";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

export default function TopNav({ activePersona, onToggleSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const persona = getPersonaById(activePersona);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/": return "Content Generation";
      case "/history": return "Content History";
      case "/refine": return "Refine Content";
      case "/settings": return "Settings";
      case "/personas": return "Choose Persona";
      default: return "Creative Studio OS";
    }
  };

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 gap-3">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8"
          onClick={onToggleSidebar}
        >
          <Menu className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-sm font-display font-bold text-foreground leading-tight">
            {getPageTitle()}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            P3 Creative Studio OS
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Persona pill */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
          style={{
            background: `${persona.color}1f`,
            border: `1px solid ${persona.color}`,
            color: persona.color,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: persona.color }}
          />
          {persona.label}
        </div>

        {/* API status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-xs text-secondary-foreground">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">Connected</span>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}