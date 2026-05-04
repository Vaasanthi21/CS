import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, Layers3, Wand2, Building2 } from "lucide-react";
import { platforms } from "@/lib/personas";
import { apiClient, tokenStorage } from "@/api/apiClient";

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSanitizedPersonaAnalysis = (persona) => {
  if (!persona) {
    return "";
  }

  const parts = [
    persona.company ? `Brand identity: ${persona.company}.` : null,
    persona.tagline ? `Brand tagline: ${persona.tagline}.` : null,
    persona.audience ? `Primary audience: ${persona.audience}.` : null,
    persona.voice ? `Voice and tone: ${persona.voice}.` : null,
    persona.goals ? `Content goals: ${persona.goals}.` : null,
    persona.notes ? `Additional guidance: ${persona.notes}.` : null,
    persona.visual_style_instructions ? `Visual style instructions: ${persona.visual_style_instructions}.` : null,
    persona.tuning_prompt ? `Style instructions: ${persona.tuning_prompt}.` : null,
    persona.learning_summary ? `Learned style preferences from prior generations: ${persona.learning_summary}.` : null,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  const rawAnalysis = String(persona.analysis || "").trim();
  if (!rawAnalysis) {
    return "";
  }

  const personaName = String(persona.name || "").trim();
  const companyName = String(persona.company || "the company").trim() || "the company";
  let sanitized = rawAnalysis;

  if (personaName) {
    sanitized = sanitized.replace(new RegExp(`\\b${escapeRegExp(personaName)}\\b`, "gi"), companyName);
    sanitized = sanitized.replace(new RegExp(`${escapeRegExp(personaName)}\\s+represents\\s+${escapeRegExp(companyName)}`, "gi"), `Brand identity: ${companyName}`);
  }

  return sanitized.replace(/\s+/g, " ").trim();
};

const buildCompactPersonaSummary = (persona) => {
  if (!persona) {
    return [];
  }

  return [
    persona.company ? `Company: ${persona.company}` : null,
    persona.tagline ? `Tagline: ${persona.tagline}` : null,
    persona.voice ? `Tone: ${persona.voice}` : null,
    persona.audience ? `Audience: ${persona.audience}` : null,
  ].filter(Boolean).slice(0, 3);
};

const MAX_BATCH_TOPICS = 10;
const LOGO_PLACEMENT_OPTIONS = [
  { value: 'persona-default', label: 'Use persona default' },
  { value: 'none', label: 'Do not place logo' },
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'top-center', label: 'Top center' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'center', label: 'Center overlay' },
];

const normalizeContentTypeValue = (value) =>
  String(value || "text-only")
    .trim()
    .toLowerCase()
    .replace(/\s*\+\s*/g, "-")
    .replace(/\s+/g, "-");

const toneToLabel = (value) => {
  if (value < 30) return "Formal";
  if (value < 70) return "Balanced";
  return "Casual";
};

const lengthToLabel = (value) => {
  if (value < 30) return "Short";
  if (value < 70) return "Medium";
  return "Extended";
};

export default function GenerationForm({ activePersona, onGenerate, isGenerating, user, planName }) {
  const [mode, setMode] = useState("single");
  const [topic, setTopic] = useState("");
  const [batchTopics, setBatchTopics] = useState("");
  const [tone, setTone] = useState([50]);
  const [length, setLength] = useState([50]);
  const [keywords, setKeywords] = useState("");
  const [logoPlacement, setLogoPlacement] = useState("persona-default");
  const [useOriginalLogo, setUseOriginalLogo] = useState(true);
  const [selectedCompanyPersonaId, setSelectedCompanyPersonaId] = useState("");
  const token = tokenStorage.getUserToken();

  const activePlatform = useMemo(
    () => platforms.find((platform) => platform.id === activePersona) || platforms[0],
    [activePersona]
  );

  const availableContentTypes = useMemo(() => {
    const types = activePlatform?.contentTypes || ["Text Only"];
    return types.map((label) => ({
      label,
      value: normalizeContentTypeValue(label),
    }));
  }, [activePlatform]);

  const [contentType, setContentType] = useState(availableContentTypes[0]?.value || "text-only");
  const { data: companyPersonas = [] } = useQuery({
    queryKey: ["company-personas"],
    queryFn: async () => {
      if (!token) {
        return [];
      }

      return await apiClient.get('/company-personas', token);
    },
    enabled: !!token,
  });
  const selectedCompanyPersona = useMemo(
    () => {
      const persona = companyPersonas.find((item) => item.id === selectedCompanyPersonaId);
      if (!persona) {
        return null;
      }

      return {
        ...persona,
        logoUrl: persona.logo_url || "",
        visualStyleInstructions: persona.visual_style_instructions || "",
        tuningPrompt: persona.tuning_prompt || "",
        learningSummary: persona.learning_summary || "",
        logoPlacement: persona.logo_placement || "none",
        preserveOriginalLogo: persona.preserve_original_logo !== false,
        analysis: buildSanitizedPersonaAnalysis(persona),
      };
    },
    [companyPersonas, selectedCompanyPersonaId]
  );
  const compactPersonaSummary = useMemo(
    () => buildCompactPersonaSummary(selectedCompanyPersona),
    [selectedCompanyPersona]
  );

  useEffect(() => {
    setSelectedCompanyPersonaId((current) => {
      if (current && companyPersonas.some((persona) => persona.id === current)) {
        return current;
      }

      return companyPersonas[0]?.id || "";
    });
  }, [companyPersonas]);

  useEffect(() => {
    const nextValue = availableContentTypes[0]?.value || "text-only";
    setContentType((current) =>
      availableContentTypes.some((option) => option.value === current) ? current : nextValue
    );
  }, [availableContentTypes]);

  const batchLines = useMemo(
    () =>
      batchTopics
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [batchTopics]
  );

  const batchOverLimit = batchLines.length > MAX_BATCH_TOPICS;
  const charCount = topic.length;
  const toneLabel = toneToLabel(tone[0]);
  const lengthLabel = lengthToLabel(length[0]);

  const isValid =
    mode === "single"
      ? topic.trim().length > 0 && Boolean(contentType)
      : batchLines.length > 0 && !batchOverLimit && Boolean(contentType);

  const personaLimit = user?.companyPersonaLimit || undefined;

  const handleSubmit = useCallback(() => {
    if (!isValid || isGenerating) {
      return;
    }

    onGenerate({
      mode,
      topic: topic.trim(),
      topics: batchLines,
      contentType,
      tone: tone[0],
      length: length[0],
      keywords: keywords.trim(),
      logoPlacement,
      useOriginalLogo,
      companyPersona: selectedCompanyPersona,
    });
  }, [batchLines, contentType, isGenerating, isValid, keywords, length, logoPlacement, mode, onGenerate, selectedCompanyPersona, tone, topic, useOriginalLogo]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmit]);

  return (
    <div className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            <span className="inline-block h-px w-3 bg-muted-foreground" />
            Creative Brief
          </p>
          <h2 className="text-xl font-semibold text-foreground">Build the content request before you generate</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep the workflow focused: choose the output mode, define the brief, and tune the voice for {activePlatform?.label}.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Mode</p>
            <p className="mt-2 text-sm font-medium text-foreground">{mode === "single" ? "Single post" : "Batch campaign"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "single"
                ? "Generate three polished variants for one topic."
                : `Queue up to ${MAX_BATCH_TOPICS} topics and process them in sequence.`}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Output</p>
            <p className="mt-2 text-sm font-medium text-foreground">{availableContentTypes.find((item) => item.value === contentType)?.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">Platform-aware formats keep the brief aligned with the selected channel.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-3xl border border-border/70 bg-background/40 p-5">
          <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Building2 className="h-4 w-4 text-primary" />
                  Company personas
                </p>
                <p className="text-sm text-muted-foreground">
                  Select the company persona to apply to this generation. Create and edit personas from the Company Personas page in the sidebar.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                {companyPersonas.length}/{user?.companyPersonaLimit ?? "-"} personas on {planName}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Active company persona</Label>
                <Select value={selectedCompanyPersonaId} onValueChange={setSelectedCompanyPersonaId}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/70 text-sm">
                    <SelectValue placeholder="Select a company persona" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyPersonas.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        Create your first persona
                      </SelectItem>
                    ) : (
                      companyPersonas.map((persona) => (
                        <SelectItem key={persona.id} value={persona.id}>
                          {persona.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedCompanyPersona && (
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">{selectedCompanyPersona.name}</p>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {compactPersonaSummary.map((item) => (
                        <p key={item} className="text-xs text-foreground/90">{item}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
              <Layers3 className="h-4 w-4 text-primary" />
              Workflow mode
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                  mode === "single"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Single Post
              </button>
              <button
                type="button"
                onClick={() => setMode("batch")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                  mode === "batch"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Batch Generation
              </button>
            </div>
          </div>

          {mode === "single" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Topic</Label>
                <span className={`text-[10px] ${charCount > 450 ? "text-destructive" : "text-muted-foreground"}`}>
                  {charCount}/500
                </span>
              </div>
              <Textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value.slice(0, 500))}
                placeholder="Describe the post idea, campaign angle, or announcement you want to turn into content."
                className="min-h-36 rounded-2xl border-border/70 bg-muted/30 text-sm placeholder:text-muted-foreground"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Batch topics</Label>
                <span className={`text-[10px] ${batchOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                  {batchLines.length}/{MAX_BATCH_TOPICS}
                </span>
              </div>
              <Textarea
                value={batchTopics}
                onChange={(event) => setBatchTopics(event.target.value)}
                placeholder={`Add one topic per line.\n\nExample:\nLaunch update for our product roadmap\nGitHub release notes for v2.1\nRecruiting post for frontend engineers`}
                className="min-h-40 rounded-2xl border-border/70 bg-muted/30 text-sm placeholder:text-muted-foreground"
              />
              {batchOverLimit && (
                <p className="text-xs text-destructive">
                  Remove {batchLines.length - MAX_BATCH_TOPICS} topic{batchLines.length - MAX_BATCH_TOPICS > 1 ? "s" : ""} to continue.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Content type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/30 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableContentTypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Keywords</Label>
              <Input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="AI, release notes, hiring, open source"
                className="h-11 rounded-2xl border-border/70 bg-muted/30 text-sm placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Logo placement</Label>
              <Select value={logoPlacement} onValueChange={setLogoPlacement}>
                <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/30 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGO_PLACEMENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Logo integrity</p>
              <label className="mt-2 flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={useOriginalLogo}
                  onChange={(event) => setUseOriginalLogo(event.target.checked)}
                  className="mt-0.5"
                />
                <span>Use the exact uploaded logo with no redesign or changes when a logo is placed.</span>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-border/70 bg-background/40 p-5">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
              <Wand2 className="h-4 w-4 text-primary" />
              Voice controls
            </p>
            <p className="text-sm text-muted-foreground">
              Tune the tone and length before generation so the first result is strong enough to refine instead of regenerate.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Tone</Label>
              <span className="text-sm font-medium text-foreground">{toneLabel}</span>
            </div>
            <Slider value={tone} onValueChange={setTone} max={100} step={1} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Formal</span>
              <span>Casual</span>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Length</Label>
              <span className="text-sm font-medium text-foreground">{lengthLabel}</span>
            </div>
            <Slider value={length} onValueChange={setLength} max={100} step={1} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Short</span>
              <span>Extended</span>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">Shortcut</p>
            <p className="mt-2 text-sm text-foreground">Press Ctrl/Cmd + Enter to generate from anywhere in this brief.</p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!isValid || isGenerating}
            className="h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "batch" ? "Generating batch" : "Generating content"}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {mode === "batch" ? "Start batch generation" : "Generate content"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}