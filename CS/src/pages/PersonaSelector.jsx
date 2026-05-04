import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { PERSONAS } from "@/lib/personas";
import { GraduationCap, Youtube, Briefcase, Building2 } from "lucide-react";

const iconMap = { GraduationCap, Youtube, Briefcase, Building2 };

export default function PersonaSelect() {
  const navigate = useNavigate();
  const { setActivePersona } = useOutletContext();

  const handleSelect = (id) => {
    setActivePersona(id);
    navigate("/");
  };

  return (
    <div className="flex items-center justify-center min-h-full p-6">
      <div className="w-full max-w-2xl flex flex-col items-center gap-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            Choose <span className="text-primary">Persona</span>
          </h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Every output locks to that brand's complete style guide.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {PERSONAS.map((p) => {
            const Icon = iconMap[p.icon];
            return (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className="flex flex-col gap-3 p-5 bg-card border border-border rounded-lg text-left hover:bg-muted hover:border-muted-foreground/30 hover:-translate-y-0.5 transition-all duration-150"
              >
                <div
                  className="w-10 h-10 rounded-md border flex items-center justify-center"
                  style={{ borderColor: p.color, color: p.color }}
                >
                  {Icon && <Icon className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">{p.label}</p>
                  <p className="text-xs text-secondary-foreground mt-0.5">{p.description}</p>
                </div>
                <div className="flex gap-1.5">
                  {p.dots.map((dot, i) => (
                    <span key={i} className="w-2 h-2 rounded-full" style={{ background: dot }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}