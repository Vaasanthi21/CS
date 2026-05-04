import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { fetchRagContext, fetchVideoStatus, generateContent, generateImageAsset, generateVideoAsset, saveToHistory } from "@/services/aiService";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from "@tanstack/react-query";
import { apiClient, tokenStorage } from "@/api/apiClient";
import PersonaSelector from "@/components/generate/PersonaSelector";
import GenerationForm from "@/components/generate/GenerationForm";
import VariantCard from "@/components/generate/VariantCard";
import VariantExpandedModal from "@/components/generate/VariantExpandedModal";
import ExportDialog from "@/components/dialogs/ExportDialog";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { platforms } from "@/lib/personas";
import { persistRefineSession } from "@/utils";

const IMAGE_STAGE_ESTIMATES_MS = {
  text: 12000,
  image: 45000,
  video: 180000,
};

const VIDEO_POLL_INTERVAL_MS = 10000;

const formatRemainingTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
};

const isImageOnlyContentType = (contentType) => {
  const normalized = String(contentType || '').trim().toLowerCase();
  return normalized === 'image' || normalized === 'image-only';
};

const isTextAndImageContentType = (contentType) => {
  const normalized = String(contentType || '').trim().toLowerCase();
  return normalized.includes('text') && normalized.includes('image');
};

const isVideoOnlyContentType = (contentType) => {
  const normalized = String(contentType || '').trim().toLowerCase();
  return normalized === 'video' || normalized === 'video-only';
};

const buildPrompt = ({ platform, params, personaContext, toneLabel, lengthLabel, topic, ragContext }) => `You are a social media content creator.

Platform: ${platform.label}
Audience style: ${platform.description}
Platform optimization goal: ${platform.optimization}
Content format: ${params.contentType}
${personaContext?.company ? `Company name: ${personaContext.company}` : ""}
${personaContext ? `Brand style analysis: ${personaContext.analysis}` : ""}
${personaContext?.tagline ? `Brand tagline: ${personaContext.tagline}` : ""}
${personaContext?.logoUrl ? `Brand logo reference: ${personaContext.logoUrl}` : ""}
${personaContext?.tuningPrompt ? `Persistent style instructions: ${personaContext.tuningPrompt}` : ""}
${personaContext?.learningSummary ? `Cross-platform brand writing memory: ${personaContext.learningSummary}` : ""}
${ragContext ? `Approved knowledge base context:\n${ragContext}` : ""}

Generate 1 polished post about:
"${topic}"

Tone: ${toneLabel}
Target length: ${lengthLabel}
${params.keywords ? `Keywords: ${params.keywords}` : ""}

Important rules:
- Use the company name only when a brand reference is needed.
- Do not mention, reveal, or invent any internal persona name in the output.
- Treat persona settings only as internal brand guidance for tone, structure, phrasing, and brand consistency across all platforms.
- Treat learned memory as cross-platform brand behavior, not as topic memory and not as platform-specific formatting rules.
- Use the approved knowledge base context as the source of truth for factual claims, product details, offers, differentiators, and constraints.
- If the approved knowledge base context does not support a factual claim, do not invent it.
- Adapt the final packaging, pacing, and formatting to ${platform.label} while keeping the same brand voice.
- Optimize the post for maximum reach, attention retention, and engagement on ${platform.label} without sounding clickbait or low quality.

Respond in JSON format:
{
  "variants": [
    { "title": "", "content": "", "word_count": 0 }
  ]
}`;

const buildEnhancementPrompt = ({ platform, params, personaContext, toneLabel, lengthLabel, topic, currentContent, enhancementPrompt, ragContext }) => `You are improving an existing social media post.

Platform: ${platform.label}
Audience style: ${platform.description}
Platform optimization goal: ${platform.optimization}
Content format: ${params.contentType}
${personaContext?.company ? `Company name: ${personaContext.company}` : ""}
${personaContext ? `Brand style analysis: ${personaContext.analysis}` : ""}
${personaContext?.tagline ? `Brand tagline: ${personaContext.tagline}` : ""}
${personaContext?.tuningPrompt ? `Persistent style instructions: ${personaContext.tuningPrompt}` : ""}
${personaContext?.learningSummary ? `Cross-platform brand writing memory: ${personaContext.learningSummary}` : ""}
${ragContext ? `Approved knowledge base context:\n${ragContext}` : ""}

Original topic:
"${topic}"

Current post:
"""
${currentContent}
"""

Requested enhancement:
"${enhancementPrompt}"

Tone: ${toneLabel}
Target length: ${lengthLabel}
${params.keywords ? `Keywords: ${params.keywords}` : ""}

Important rules:
- Keep the same core message unless the enhancement request explicitly changes it.
- Apply the enhancement request while preserving brand voice and platform fit.
- Return only one improved version, not multiple options.
- Use the company name only when a brand reference is needed.
- Do not mention, reveal, or invent any internal persona name in the output.
- Keep factual details aligned with the approved knowledge base context. Do not invent unsupported facts.

Respond in JSON format:
{
  "variants": [
    { "title": "", "content": "", "word_count": 0 }
  ]
}`;

export default function Generate() {
  const { activePersona, setActivePersona } = useOutletContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const token = tokenStorage.getUserToken();
  const platform = useMemo(
    () => platforms.find((item) => item.id === activePersona) || platforms[0],
    [activePersona]
  );

  const learnFromGeneration = async (companyPersona, variants, topic) => {
    if (!companyPersona?.id || !token || !Array.isArray(variants) || variants.length === 0) {
      return;
    }

    try {
      await apiClient.post(`/company-personas/${companyPersona.id}/learn`, {
        topic,
        variants,
        feedback: companyPersona.tuningPrompt
          ? `Keep reinforcing these writing style preferences only: ${companyPersona.tuningPrompt}`
          : "",
      }, token);
    } catch (error) {
      console.warn('Persona learning update failed:', error);
    }
  };

  const { data: userMetrics } = useQuery({
    queryKey: ["user-metrics"],
    queryFn: async () => {
      const token = tokenStorage.getUserToken();
      if (!token) {
        return null;
      }

      return await apiClient.get('/user/metrics', token);
    },
    enabled: !!user,
  });
  const enrichedUser = useMemo(() => ({
    ...user,
    companyPersonaLimit: userMetrics?.companyPersonaLimit,
    companyPersonaCount: userMetrics?.companyPersonaCount,
  }), [user, userMetrics]);

  const [generatedContent, setGeneratedContent] = useState(null);
  const [lastGenerationParams, setLastGenerationParams] = useState(null);
  const [lastRagContext, setLastRagContext] = useState("");
  const [lastOriginalPrompt, setLastOriginalPrompt] = useState("");
  const [batchItems, setBatchItems] = useState([]);
  const cancelRef = useRef(false);
  const [expandedVariant, setExpandedVariant] = useState(null);
  const [exportVariant, setExportVariant] = useState(null);
  const [generationStage, setGenerationStage] = useState('idle');
  const videoPollingRef = useRef(new Set());

  const openRefinePage = (content) => {
    if (!content || !lastGenerationParams) {
      return;
    }

    const refineState = {
      activePersona,
      params: lastGenerationParams,
      generatedContent: content,
      ragContext: lastRagContext,
      originalPrompt: lastOriginalPrompt,
      messages: [
        {
          role: 'assistant',
          content: content.content || '',
          image_url: content.image_url || null,
          image_base64: content.image_base64 || null,
          image_prompt: content.image_prompt || null,
          image_revised_prompt: content.image_revised_prompt || null,
          title: content.title || null,
        },
      ],
    };

    persistRefineSession(refineState);
    navigate('/refine', { state: refineState });
  };
  const [stageStartedAt, setStageStartedAt] = useState(null);
  const [stageElapsedMs, setStageElapsedMs] = useState(0);

  const contentTypeNeedsImage = (contentType) => String(contentType || '').includes('image');
  const contentTypeNeedsVideo = (contentType) => String(contentType || '').includes('video');
  const contentTypeNeedsText = (contentType) => !isImageOnlyContentType(contentType) && !isVideoOnlyContentType(contentType);

  const mergeVideoStatusIntoVariant = (variant, statusResult) => {
    if (!variant || !statusResult) {
      return variant;
    }

    return {
      ...variant,
      video_url: statusResult.video_url || variant.video_url || null,
      video_id: statusResult.video_id || variant.video_id || null,
      video_status: statusResult.status || variant.video_status || null,
      video_prompt: variant.video_prompt || statusResult.prompt || null,
    };
  };

  const pollVideoVariantStatus = async (variant) => {
    const videoId = String(variant?.video_id || '').trim();
    if (!videoId || videoPollingRef.current.has(videoId)) {
      return;
    }

    videoPollingRef.current.add(videoId);

    try {
      const statusResult = await fetchVideoStatus(videoId);
      setGeneratedContent((current) => {
        if (!current || String(current.video_id || '').trim() !== videoId) {
          return current;
        }

        return mergeVideoStatusIntoVariant(current, statusResult);
      });
    } catch (error) {
      console.warn('Video status polling failed:', error);
    } finally {
      videoPollingRef.current.delete(videoId);
    }
  };

  const setActiveGenerationStage = (stage) => {
    setGenerationStage(stage);
    setStageStartedAt(stage === 'idle' ? null : Date.now());
    setStageElapsedMs(0);
  };

  const buildRetrievalQuery = ({ params, topic, currentContent, enhancementRequest }) => {
    return [
      topic,
      params?.keywords,
      params?.contentType,
      params?.companyPersona?.company,
      params?.companyPersona?.tagline,
      currentContent,
      enhancementRequest,
      contentTypeNeedsVideo(params?.contentType) ? 'video script storyboard shot list motion visual claims' : '',
      contentTypeNeedsImage(params?.contentType) ? 'image visual composition product details brand assets' : '',
    ].filter(Boolean).join(' ');
  };

  const attachImagesToVariants = async (items, params, topic, ragContext = '') => {
    if (!contentTypeNeedsImage(params.contentType) || !Array.isArray(items) || items.length === 0) {
      return items;
    }

    setActiveGenerationStage('image');

    const enriched = await Promise.all(
      items.map(async (variant) => {
        const image = await generateImageAsset({
          platform,
          topic,
          contentType: params.contentType,
          companyPersona: params.companyPersona,
          ragContext,
          keywords: params.keywords,
          variantTitle: variant.title || '',
          variantContent: variant.content || '',
        });

        return {
          ...variant,
          image_url: image.image_url || null,
          image_base64: image.image_base64 || null,
          image_prompt: image.prompt || null,
          image_revised_prompt: image.revised_prompt || null,
        };
      })
    );

    return enriched;
  };

  const attachVideosToVariants = async (items, params, topic, ragContext = '') => {
    if (!contentTypeNeedsVideo(params.contentType) || !Array.isArray(items) || items.length === 0) {
      return items;
    }

    setActiveGenerationStage('video');

    const enriched = await Promise.all(
      items.map(async (variant) => {
        const video = await generateVideoAsset({
          platform,
          topic,
          contentType: params.contentType,
          companyPersona: params.companyPersona,
          ragContext,
          keywords: params.keywords,
          variantTitle: variant.title || '',
          variantContent: variant.content || '',
        });

        return {
          ...variant,
          video_url: video.video_url || null,
          video_id: video.video_id || null,
          video_status: video.status || null,
          video_prompt: video.prompt || null,
        };
      })
    );

    return enriched;
  };

  const buildMediaOnlyVariants = (contentType) => {
    if (contentTypeNeedsVideo(contentType)) {
      return [{
        title: `${platform.label} video concept`,
        content: '',
        word_count: 0,
      }];
    }

    return [{
      title: `${platform.label} image concept`,
      content: '',
      word_count: 0,
    }];
  };

  const generateMutation = useMutation({
    mutationFn: async (params) => {
      setActiveGenerationStage(contentTypeNeedsText(params.contentType) ? 'text' : 'image');

      const toneLabel =
        params.tone < 30 ? "formal" : params.tone < 70 ? "balanced" : "casual";

      const lengthLabel =
        params.length < 30
          ? "short (100-150 words)"
          : params.length < 70
          ? "medium (200-300 words)"
          : "extended (400-600 words)";

      // 🔥 SINGLE MODE
      if (params.mode === "single") {
        const retrieval = await fetchRagContext(buildRetrievalQuery({ params, topic: params.topic }));
        const prompt = contentTypeNeedsText(params.contentType)
          ? buildPrompt({
              platform,
              params,
              personaContext: params.companyPersona,
              toneLabel,
              lengthLabel,
              topic: params.topic,
              ragContext: retrieval?.context || '',
            })
          : '';

        const result = contentTypeNeedsText(params.contentType)
          ? await generateContent({ prompt })
          : buildMediaOnlyVariants(params.contentType);

        const withImages = await attachImagesToVariants(result, params, params.topic, retrieval?.context || '');
        const enrichedResult = await attachVideosToVariants(withImages, params, params.topic, retrieval?.context || '');
        
        await saveToHistory({
          topic: params.topic,
          persona: activePersona,
          persona_label: platform.label,
          company_persona_id: params.companyPersona?.id ?? null,
          company_persona_name: params.companyPersona?.name ?? null,
          company_persona_analysis: params.companyPersona?.analysis ?? null,
          company_tagline: params.companyPersona?.tagline ?? null,
          company_logo_url: params.companyPersona?.logoUrl ?? null,
          company_persona_notes: params.companyPersona?.notes ?? null,
          company_persona_visual_style_instructions: params.companyPersona?.visualStyleInstructions ?? params.companyPersona?.visual_style_instructions ?? null,
          company_persona_tuning_prompt: params.companyPersona?.tuningPrompt ?? null,
          company_persona_learning_summary: params.companyPersona?.learningSummary ?? null,
          content_type: params.contentType,
          tone: params.tone,
          length: params.length,
          keywords: params.keywords,
          variants: enrichedResult,
          original_prompt: prompt,
          rag_context: retrieval?.context || '',
          status: "completed",
          user_id: user?.id ?? null,
          user_name: user?.full_name || user?.email || null,
          user_email: user?.email ?? null,
        });

        await learnFromGeneration(params.companyPersona, enrichedResult, params.topic);

        return {
          primary: enrichedResult[0] || null,
          params,
          ragContext: retrieval?.context || '',
          originalPrompt: prompt,
        };
      }

      // 🔥 BATCH MODE (UPDATED)
      if (params.mode === "batch") {
        cancelRef.current = false;
        const initialItems = params.topics.map((t) => ({
          topic: t,
          status: "pending",
          variants: [],
        }));

        setBatchItems(initialItems);

        const allResults = [];

        for (let i = 0; i < params.topics.length; i++) {
          if (cancelRef.current) {
            setBatchItems((prev) =>
              prev.map((item, idx) =>
                idx >= i && item.status === "pending"
                  ? { ...item, status: "cancelled" }
                  : item
              )
            );
            break;
          }

          const topic = params.topics[i];

          // mark processing
          setBatchItems((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: "processing" } : item
            )
          );

          try {
            const retrieval = await fetchRagContext(buildRetrievalQuery({ params, topic }));
            const prompt = contentTypeNeedsText(params.contentType)
              ? buildPrompt({
                  platform,
                  params,
                  personaContext: params.companyPersona,
                  toneLabel,
                  lengthLabel,
                  topic,
                  ragContext: retrieval?.context || '',
                })
              : '';

            const result = contentTypeNeedsText(params.contentType)
              ? await generateContent({ prompt })
              : buildMediaOnlyVariants(params.contentType);

            const withImages = await attachImagesToVariants(result, params, topic, retrieval?.context || '');
            const enrichedResult = await attachVideosToVariants(withImages, params, topic, retrieval?.context || '');
            
            // mark completed
            setBatchItems((prev) =>
              prev.map((item, idx) =>
                idx === i
                  ? { ...item, status: "completed", variants: enrichedResult }
                  : item
              )
            );

            allResults.push(...enrichedResult);

            // ✅ SAVE EACH TOPIC TO HISTORY
            await saveToHistory({
              topic,
              persona: activePersona,
              persona_label: platform.label,
              company_persona_id: params.companyPersona?.id ?? null,
              company_persona_name: params.companyPersona?.name ?? null,
              company_persona_analysis: params.companyPersona?.analysis ?? null,
              company_tagline: params.companyPersona?.tagline ?? null,
              company_logo_url: params.companyPersona?.logoUrl ?? null,
              company_persona_notes: params.companyPersona?.notes ?? null,
              company_persona_visual_style_instructions: params.companyPersona?.visualStyleInstructions ?? params.companyPersona?.visual_style_instructions ?? null,
              company_persona_tuning_prompt: params.companyPersona?.tuningPrompt ?? null,
              company_persona_learning_summary: params.companyPersona?.learningSummary ?? null,
              content_type: params.contentType,
              tone: params.tone,
              length: params.length,
              keywords: params.keywords,
              variants: enrichedResult,
              original_prompt: prompt,
              rag_context: retrieval?.context || '',
              status: "completed",
              user_id: user?.id ?? null,
              user_name: user?.full_name || user?.email || null,
              user_email: user?.email ?? null,
            });

            await learnFromGeneration(params.companyPersona, enrichedResult, topic);
          } catch (err) {
            setBatchItems((prev) =>
              prev.map((item, idx) =>
                idx === i ? { ...item, status: "failed" } : item
              )
            );
          }
        }

        return {
          primary: allResults[0] || null,
          params,
          ragContext: '',
          originalPrompt: '',
        };
      }
    },

    onSuccess: (data) => {
      setGeneratedContent(data?.primary || null);
      setLastGenerationParams(data?.params || null);
      setLastRagContext(data?.ragContext || '');
      setLastOriginalPrompt(data?.originalPrompt || '');
      setActiveGenerationStage('idle');
      toast({
         title: "Content generated successfully!",
         duration: 3000 
      });
    },

    onError: (error) => {
      setActiveGenerationStage('idle');
      let errorMessage = error.message || "Unknown error";

      if (error.message?.includes("API key")) {
        errorMessage = "AI API key not configured.";
      }

      toast({
        title: "Generation failed",
        description: errorMessage,
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  useEffect(() => {
    if (!generateMutation.isPending || generationStage === 'idle' || !stageStartedAt) {
      setStageElapsedMs(0);
      return undefined;
    }

    const updateElapsed = () => {
      setStageElapsedMs(Date.now() - stageStartedAt);
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [generateMutation.isPending, generationStage, stageStartedAt]);

  useEffect(() => {
    const videoId = String(generatedContent?.video_id || '').trim();
    const videoStatus = String(generatedContent?.video_status || '').trim().toLowerCase();
    const shouldPoll = Boolean(videoId) && (videoStatus === 'queued' || videoStatus === 'processing') && !generatedContent?.video_url;

    if (!shouldPoll) {
      return undefined;
    }

    pollVideoVariantStatus(generatedContent);
    const intervalId = window.setInterval(() => {
      pollVideoVariantStatus(generatedContent);
    }, VIDEO_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [generatedContent]);

  const currentStageEstimateMs = IMAGE_STAGE_ESTIMATES_MS[generationStage] || 15000;
  const stageProgressValue = generateMutation.isPending
    ? Math.min(96, Math.max(8, Math.round((stageElapsedMs / currentStageEstimateMs) * 100)))
    : 0;
  const estimatedRemainingMs = Math.max(0, currentStageEstimateMs - stageElapsedMs);
  const stageStatusTitle = generationStage === 'image'
    ? 'Generating image'
    : generationStage === 'video'
    ? 'Generating video'
    : generationStage === 'text'
    ? 'Generating text'
    : 'Preparing content';
  const stageStatusDescription = generationStage === 'image'
    ? 'This is an estimate based on recent image generation time. The image will appear automatically when the provider finishes.'
    : generationStage === 'video'
    ? 'Video generation is asynchronous. The preview will update automatically when the provider finishes processing.'
    : generationStage === 'text'
    ? 'Text is being prepared first. If this format includes an image, image generation starts immediately after text is ready.'
    : 'Preparing your request.';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <PersonaSelector
        activePlatform={activePersona}
        onSelect={setActivePersona}
      />

      <GenerationForm
        activePersona={activePersona}
        onGenerate={(params) => generateMutation.mutate(params)}
        isGenerating={generateMutation.isPending}
        user={enrichedUser}
        planName={userMetrics?.planName ?? "Free"}
      />

      {/* 🔴 Cancel Button */}
      {generateMutation.isPending && batchItems.length > 0 && (
        <div className="flex justify-end">
          <button
          type="button"
          onClick={() => {
            cancelRef.current = true;
          }}
          className="px-4 py-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 🔵 Batch Progress */}
      {batchItems.length > 0 && (
        <div className="space-y-2">
          {batchItems.map((item, idx) => (
            <div key={idx} className="text-sm border p-2 rounded">
              <strong>{item.topic}</strong> — {item.status}
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {generateMutation.isPending && (
        <div className="bg-card border border-border rounded-lg p-6 md:p-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{stageStatusTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stageStatusDescription}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight text-foreground">{stageProgressValue}%</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Estimated progress</p>
              </div>
            </div>

            <div className="space-y-2">
              <Progress value={stageProgressValue} className="h-2.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Elapsed: {formatRemainingTime(stageElapsedMs)}</span>
                <span>
                  {estimatedRemainingMs > 0
                    ? `About ${formatRemainingTime(estimatedRemainingMs)} remaining`
                    : 'Finalizing result...'}
                </span>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 md:grid-cols-3">
              <div className={`rounded-xl border px-3 py-3 ${generationStage === 'text' ? 'border-primary/50 bg-primary/5' : 'border-border/70 bg-background/60'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step 1</p>
                <p className="mt-1 text-sm font-medium text-foreground">Prepare prompt</p>
                <p className="mt-1 text-xs text-muted-foreground">Build platform and persona-aware instructions.</p>
              </div>
              <div className={`rounded-xl border px-3 py-3 ${generationStage === 'image' ? 'border-primary/50 bg-primary/5' : 'border-border/70 bg-background/60'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step 2</p>
                <p className="mt-1 text-sm font-medium text-foreground">Generate image</p>
                <p className="mt-1 text-xs text-muted-foreground">Wait for the image provider to finish rendering.</p>
              </div>
              <div className={`rounded-xl border px-3 py-3 ${stageProgressValue >= 92 ? 'border-primary/50 bg-primary/5' : 'border-border/70 bg-background/60'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step 3</p>
                <p className="mt-1 text-sm font-medium text-foreground">Finalize result</p>
                <p className="mt-1 text-xs text-muted-foreground">Attach the finished asset and render it below.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {generatedContent && !generateMutation.isPending && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            Generated Content
          </p>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <VariantCard
              variant={generatedContent}
              index={0}
              onExpand={setExpandedVariant}
              onExport={setExportVariant}
              onEnhance={() => openRefinePage(generatedContent)}
            />

            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Enhance Content
                </p>
                <h3 className="mt-2 text-sm font-semibold text-foreground">Open the refinement page for chat-based enhancement</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Review the original prompt, current output, persona, and platform context, then refine the post through an iterative chat flow.
                </p>
              </div>

              {lastRagContext ? (
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">RAG grounding active</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground line-clamp-6 whitespace-pre-line">
                    {lastRagContext}
                  </p>
                </div>
              ) : null}

              <Button
                onClick={() => openRefinePage(generatedContent)}
                disabled={!generatedContent}
                className="h-11 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Open refinement page
                </>
              </Button>
            </div>
          </div>
        </div>
      )}

      <VariantExpandedModal
        variant={expandedVariant}
        open={!!expandedVariant}
        onClose={() => setExpandedVariant(null)}
        onExport={setExportVariant}
      />

      <ExportDialog
        variant={exportVariant}
        open={!!exportVariant}
        onClose={() => setExportVariant(null)}
      />
    </div>
  );
}