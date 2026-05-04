import React from "react";
import { platforms } from "@/lib/personas";
import { Linkedin, Instagram, Facebook, Youtube, Github, Twitter, MessageCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const iconMap = {
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  github: Github,
  x: Twitter,
  threads: MessageCircle,
};

export default function PersonaSelector({ activePlatform, onSelect }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)]">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            <span className="inline-block h-px w-3 bg-muted-foreground" />
            Distribution Channels
          </p>
          <h2 className="text-xl font-semibold text-foreground">Choose where this content should publish</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Switch between professional, social, and developer-facing channels without crowding the rest of the workflow.
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {platforms.length} publishing targets
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {platforms.map((platform) => {
          const Icon = iconMap[platform.id];
          const isActive = activePlatform === platform.id;

          return (
            <TooltipProvider key={platform.id} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelect(platform.id)}
                    className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 ${
                      isActive
                        ? "border-primary/70 bg-primary/[0.08] shadow-[0_18px_40px_-28px_rgba(249,115,22,0.9)]"
                        : "border-border/70 bg-muted/20 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-px opacity-70"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${platform.color}, transparent)`,
                      }}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-background/60"
                        style={{
                          borderColor: `${platform.color}55`,
                          color: platform.color,
                        }}
                      >
                        {Icon && <Icon className="h-5 w-5" />}
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        isActive ? "bg-primary text-primary-foreground" : "bg-background/70 text-muted-foreground"
                      }`}>
                        {isActive ? "Active" : "Ready"}
                      </span>
                    </div>

                    <div
                      className="mt-4"
                    >
                      <p className="text-sm font-semibold text-foreground">{platform.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{platform.description}</p>
                    </div>

                    <div className="mt-4 flex gap-1.5">
                      {platform.dots?.map((dot, index) => (
                        <span
                          key={index}
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: dot }}
                        />
                      ))}
                    </div>
                  </button>
                </TooltipTrigger>

                <TooltipContent
                  side="bottom"
                  className="max-w-xs border-none bg-primary text-primary-foreground shadow-lg"
                >
                  <p className="mb-1 text-sm font-semibold text-primary-foreground">{platform.label}</p>
                  <p className="text-xs text-primary-foreground/90">{platform.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}