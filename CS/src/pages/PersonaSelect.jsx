import React, { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, tokenStorage } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Building2, Image as ImageIcon, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";

const API_BASE_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
  ? "http://localhost:4000/api"
  : "/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
const LOGO_PLACEMENT_OPTIONS = [
  { value: "none", label: "Do not place logo" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top-center", label: "Top center" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "center", label: "Center overlay" },
];

const resolveLogoUrl = (value) => {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${API_ORIGIN}${value.startsWith("/") ? value : `/${value}`}`;
};

const createEmptyDraft = (companyName) => ({
  name: "",
  company: companyName || "",
  tagline: "",
  logoUrl: "",
  audience: "",
  voice: "",
  goals: "",
  notes: "",
  visualStyleInstructions: "",
  tuningPrompt: "",
  logoPlacement: "none",
  preserveOriginalLogo: true,
});

export default function PersonaSelect() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const token = tokenStorage.getUserToken();
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [isEditingPersona, setIsEditingPersona] = useState(false);
  const [personaError, setPersonaError] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [personaDraft, setPersonaDraft] = useState(() => createEmptyDraft(user?.company));

  const { data: userMetrics } = useQuery({
    queryKey: ["user-metrics"],
    queryFn: async () => await apiClient.get("/user/metrics", token),
    enabled: !!token,
  });

  const { data: companyPersonas = [] } = useQuery({
    queryKey: ["company-personas"],
    queryFn: async () => await apiClient.get("/company-personas", token),
    enabled: !!token,
  });

  const selectedPersona = useMemo(
    () => companyPersonas.find((persona) => persona.id === selectedPersonaId) || null,
    [companyPersonas, selectedPersonaId]
  );
  const selectedLogoPreview = useMemo(() => resolveLogoUrl(selectedPersona?.logo_url), [selectedPersona?.logo_url]);
  const draftLogoPreview = useMemo(() => resolveLogoUrl(personaDraft.logoUrl), [personaDraft.logoUrl]);
  const currentLogoPreview = draftLogoPreview || selectedLogoPreview;
  const personaLimit = userMetrics?.companyPersonaLimit;
  const canCreateMorePersonas = typeof personaLimit === "number" ? companyPersonas.length < personaLimit : true;

  const resetDraft = useCallback(() => {
    setPersonaDraft(createEmptyDraft(user?.company));
    setIsEditingPersona(false);
    setPersonaError("");
  }, [user?.company]);

  const handleDraftChange = useCallback((field, value) => {
    setPersonaDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const createPersonaMutation = useMutation({
    mutationFn: async () => await apiClient.post("/company-personas", {
      name: personaDraft.name,
      company: personaDraft.company,
      tagline: personaDraft.tagline,
      logo_url: personaDraft.logoUrl,
      audience: personaDraft.audience,
      voice: personaDraft.voice,
      goals: personaDraft.goals,
      notes: personaDraft.notes,
      visual_style_instructions: personaDraft.visualStyleInstructions,
      tuning_prompt: personaDraft.tuningPrompt,
      logo_placement: personaDraft.logoPlacement,
      preserve_original_logo: personaDraft.preserveOriginalLogo,
    }, token),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["company-personas"] });
      queryClient.invalidateQueries({ queryKey: ["user-metrics"] });
      setSelectedPersonaId(created.id);
      resetDraft();
      toast({ title: "Company persona created", duration: 1500 });
    },
    onError: (error) => {
      setPersonaError(error.message || "Unable to create persona.");
    },
  });

  const updatePersonaMutation = useMutation({
    mutationFn: async () => await apiClient.patch(`/company-personas/${selectedPersonaId}`, {
      name: personaDraft.name,
      company: personaDraft.company,
      tagline: personaDraft.tagline,
      logo_url: personaDraft.logoUrl,
      audience: personaDraft.audience,
      voice: personaDraft.voice,
      goals: personaDraft.goals,
      notes: personaDraft.notes,
      visual_style_instructions: personaDraft.visualStyleInstructions,
      tuning_prompt: personaDraft.tuningPrompt,
      logo_placement: personaDraft.logoPlacement,
      preserve_original_logo: personaDraft.preserveOriginalLogo,
    }, token),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["company-personas"] });
      setSelectedPersonaId(updated.id);
      setIsEditingPersona(false);
      setPersonaError("");
      toast({ title: "Company persona updated", duration: 1500 });
    },
    onError: (error) => {
      setPersonaError(error.message || "Unable to update persona.");
    },
  });

  const deletePersonaMutation = useMutation({
    mutationFn: async (personaId) => await apiClient.delete(`/company-personas/${personaId}`, token),
    onMutate: async (personaId) => personaId,
    onSuccess: (_data, _variables, personaId) => {
      queryClient.invalidateQueries({ queryKey: ["company-personas"] });
      queryClient.invalidateQueries({ queryKey: ["user-metrics"] });
      if (selectedPersonaId === personaId) {
        setSelectedPersonaId("");
        resetDraft();
      }
      toast({ title: "Company persona deleted", duration: 1500 });
    },
  });

  const handleStartEdit = useCallback((persona) => {
    setSelectedPersonaId(persona.id);
    setPersonaDraft({
      name: persona.name || "",
      company: persona.company || user?.company || "",
      tagline: persona.tagline || "",
      logoUrl: persona.logo_url || "",
      audience: persona.audience || "",
      voice: persona.voice || "",
      goals: persona.goals || "",
      notes: persona.notes || "",
      visualStyleInstructions: persona.visual_style_instructions || "",
      tuningPrompt: persona.tuning_prompt || "",
      logoPlacement: persona.logo_placement || "none",
      preserveOriginalLogo: persona.preserve_original_logo !== false,
    });
    setIsEditingPersona(true);
    setPersonaError("");
  }, [user?.company]);

  const handleSavePersona = useCallback(() => {
    setPersonaError("");

    if (!personaDraft.name.trim() || !personaDraft.company.trim()) {
      setPersonaError("Persona name and company are required.");
      return;
    }

    if (isEditingPersona) {
      updatePersonaMutation.mutate();
      return;
    }

    createPersonaMutation.mutate();
  }, [createPersonaMutation, isEditingPersona, personaDraft.company, personaDraft.name, updatePersonaMutation]);

  const handleLogoUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !token) {
      return;
    }

    setIsUploadingLogo(true);
    setPersonaError("");

    try {
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Unable to read logo file"));
        reader.readAsDataURL(file);
      });

      const response = await apiClient.post("/company-personas/logo", {
        fileName: file.name,
        fileData,
      }, token);

      setPersonaDraft((current) => ({
        ...current,
        logoUrl: response.logoUrl,
      }));
      toast({ title: "Logo uploaded", duration: 1500 });
    } catch (error) {
      setPersonaError(error instanceof Error ? error.message : "Unable to upload logo.");
    } finally {
      setIsUploadingLogo(false);
      event.target.value = "";
    }
  }, [token]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Company Personas</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Create and manage brand personas from the sidebar</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Build multiple company personas, edit them later, upload logos, and keep usage within your subscribed plan.
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
          {companyPersonas.length}/{userMetrics?.companyPersonaLimit ?? "-"} personas on {userMetrics?.planName ?? "Free"}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Saved personas</h2>
              <p className="text-sm text-muted-foreground">Select one to review or edit it.</p>
            </div>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={resetDraft}>
              <Plus className="mr-2 h-4 w-4" />
              New persona
            </Button>
          </div>

          <div className="grid gap-3">
            {companyPersonas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
                No company personas yet. Create your first one from the form on the right.
              </div>
            ) : (
              companyPersonas.map((persona) => {
                const logoPreview = resolveLogoUrl(persona.logo_url);
                const isSelected = selectedPersonaId === persona.id;

                return (
                  <div
                    key={persona.id}
                    className={`rounded-2xl border p-4 transition-colors ${
                      isSelected ? "border-primary/40 bg-primary/[0.05]" : "border-border/70 bg-background/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        {logoPreview ? (
                          <img src={logoPreview} alt={`${persona.name} logo`} className="h-12 w-12 rounded-xl border border-border/70 bg-background object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/70 bg-muted/30 text-muted-foreground">
                            <Building2 className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{persona.name}</p>
                            <Badge variant="outline" className="text-[10px]">{persona.company}</Badge>
                          </div>
                          {persona.tagline && <p className="mt-1 text-xs text-muted-foreground">{persona.tagline}</p>}
                          {persona.visual_style_instructions && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">Visuals: {persona.visual_style_instructions}</p>}
                          {persona.logo_placement && persona.logo_placement !== 'none' && <p className="mt-2 text-xs text-muted-foreground">Logo placement: {persona.logo_placement}</p>}
                          {persona.tuning_prompt && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">Tuning: {persona.tuning_prompt}</p>}
                          {persona.analysis && <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{persona.analysis}</p>}
                          {persona.learning_summary && <p className="mt-2 text-xs text-muted-foreground line-clamp-3">Learned: {persona.learning_summary}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(persona)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deletePersonaMutation.mutate(persona.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{isEditingPersona ? "Edit persona" : "Create persona"}</h2>
              <p className="text-sm text-muted-foreground">
                {isEditingPersona ? "Update the selected company persona." : "Add a new company persona for your team."}
              </p>
            </div>
            {currentLogoPreview && (
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/50 px-3 py-2">
                <img src={currentLogoPreview} alt="Current logo thumbnail" className="h-10 w-10 rounded-xl border border-border/70 bg-background object-cover" />
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Current logo</p>
                  <p className="text-xs text-foreground">Thumbnail visible</p>
                </div>
              </div>
            )}
            {isEditingPersona && (
              <Button type="button" variant="ghost" className="rounded-2xl" onClick={resetDraft}>
                Cancel
              </Button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input value={personaDraft.name} onChange={(event) => handleDraftChange("name", event.target.value)} placeholder="Persona name" className="h-11 rounded-2xl" />
            <Input value={personaDraft.company} onChange={(event) => handleDraftChange("company", event.target.value)} placeholder="Company name" className="h-11 rounded-2xl" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input value={personaDraft.tagline} onChange={(event) => handleDraftChange("tagline", event.target.value)} placeholder="Brand tagline" className="h-11 rounded-2xl" />
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2">
              <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-foreground">
                <span className="truncate">{personaDraft.logoUrl ? "Replace logo" : "Upload logo"}</span>
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  {isUploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {isUploadingLogo ? "Uploading" : "Choose file"}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
              {currentLogoPreview && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-2">
                  <img src={currentLogoPreview} alt="Saved logo thumbnail" className="h-12 w-12 rounded-lg border border-border/70 bg-background object-cover" />
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Current saved logo</p>
                    <p className="truncate">{personaDraft.logoUrl || selectedPersona?.logo_url}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {draftLogoPreview && (
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/50 p-3">
              <img src={draftLogoPreview} alt="Uploaded logo preview" className="h-14 w-14 rounded-xl border border-border/70 bg-background object-cover" />
              <div className="min-w-0 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Logo preview</p>
                <p className="mt-1 flex items-center gap-2 truncate">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{personaDraft.logoUrl}</span>
                </p>
              </div>
            </div>
          )}

          <Input value={personaDraft.audience} onChange={(event) => handleDraftChange("audience", event.target.value)} placeholder="Target audience" className="h-11 rounded-2xl" />
          <Input value={personaDraft.voice} onChange={(event) => handleDraftChange("voice", event.target.value)} placeholder="Voice and tone" className="h-11 rounded-2xl" />
          <Input value={personaDraft.goals} onChange={(event) => handleDraftChange("goals", event.target.value)} placeholder="Content goals" className="h-11 rounded-2xl" />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Default logo placement</p>
              <Select value={personaDraft.logoPlacement} onValueChange={(value) => handleDraftChange("logoPlacement", value)}>
                <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/70 text-sm">
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
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Logo integrity</p>
              <p className="mt-1 text-xs">When enabled, generation prompts require the exact uploaded logo to be used with no redesign, no restyling, and no modifications.</p>
              <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={personaDraft.preserveOriginalLogo}
                  onChange={(event) => handleDraftChange("preserveOriginalLogo", event.target.checked)}
                />
                Preserve the original uploaded logo exactly
              </label>
            </div>
          </div>
          <Textarea value={personaDraft.visualStyleInstructions} onChange={(event) => handleDraftChange("visualStyleInstructions", event.target.value)} placeholder="Visual style instructions: themes, palette, motifs, subject cues, composition preferences" className="min-h-28 rounded-2xl" />
          <Textarea value={personaDraft.tuningPrompt} onChange={(event) => handleDraftChange("tuningPrompt", event.target.value)} placeholder="Persistent tuning prompt: preferred hooks, banned phrases, CTA style, formatting rules, brand positioning" className="min-h-28 rounded-2xl" />
          <Textarea value={personaDraft.notes} onChange={(event) => handleDraftChange("notes", event.target.value)} placeholder="Extra brand notes for AI analysis" className="min-h-28 rounded-2xl" />

          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Learning memory</p>
                <p className="mt-1 text-xs text-muted-foreground">This is updated automatically from generated posts. Users do not edit it directly.</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{selectedPersona?.learning_count || 0} cycles</Badge>
            </div>
            <div className="mt-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground min-h-28 whitespace-pre-wrap">
              {selectedPersona?.learning_summary || "No learned preferences yet. Generate content with this persona to build memory automatically."}
            </div>
          </div>

          {selectedLogoPreview && selectedPersona && !isEditingPersona && (
            <div className="rounded-2xl border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Selected persona preview</p>
              <div className="mt-3 flex items-center gap-3">
                <img src={selectedLogoPreview} alt={`${selectedPersona.name} logo`} className="h-12 w-12 rounded-xl border border-border/70 bg-background object-cover" />
                <div className="min-w-0">
                  <p className="text-foreground">{selectedPersona.name}</p>
                  <p className="truncate">{selectedPersona.logo_url}</p>
                </div>
              </div>
            </div>
          )}

          {personaError && <p className="text-xs text-destructive">{personaError}</p>}

          <Button
            type="button"
            onClick={handleSavePersona}
            disabled={
              isEditingPersona
                ? updatePersonaMutation.isPending
                : !canCreateMorePersonas || createPersonaMutation.isPending
            }
            className="h-11 rounded-2xl"
          >
            {createPersonaMutation.isPending || updatePersonaMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {isEditingPersona ? "Save persona changes" : canCreateMorePersonas ? "Create company persona" : "Persona limit reached"}
          </Button>
        </div>
      </div>
    </div>
  );
}