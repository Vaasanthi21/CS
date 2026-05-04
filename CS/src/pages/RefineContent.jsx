import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Download, Expand, FileText, Image as ImageIcon, Loader2, Paperclip, Send, Share2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { fetchKnowledgeSource, fetchRagContext, generateContent, generateImageAsset, ingestKnowledgeSourceFromFile, saveToHistory } from "@/services/aiService";
import { platforms } from "@/lib/personas";
import { persistRefineSession, REFINE_SESSION_STORAGE_KEY, restoreRefineSession } from "@/utils";

const toneToLabel = (value) => {
  if (value < 30) return "formal";
  if (value < 70) return "balanced";
  return "casual";
};

const lengthToLabel = (value) => {
  if (value < 30) return "short (100-150 words)";
  if (value < 70) return "medium (200-300 words)";
  return "extended (400-600 words)";
};

const buildAttachmentContext = (attachments) => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return "";
  }

  return attachments
    .map((attachment, index) => {
      const excerpt = String(attachment.content || "").slice(0, 4000).trim();
      return `Attachment ${index + 1}: ${attachment.title} (${attachment.sourceType})\n${excerpt}`;
    })
    .join("\n\n");
};

const buildRefinementPrompt = ({ platform, params, personaContext, topic, currentContent, enhancementPrompt, ragContext, conversation, attachmentContext }) => `You are refining a social media post through an iterative editing conversation.

Platform: ${platform.label}
Audience style: ${platform.description}
Platform optimization goal: ${platform.optimization}
Content format: ${params.contentType}
${personaContext?.company ? `Company name: ${personaContext.company}` : ""}
${personaContext?.analysis ? `Brand style analysis: ${personaContext.analysis}` : ""}
${personaContext?.tagline ? `Brand tagline: ${personaContext.tagline}` : ""}
${personaContext?.tuningPrompt ? `Persistent style instructions: ${personaContext.tuningPrompt}` : ""}
${personaContext?.learningSummary ? `Cross-platform brand writing memory: ${personaContext.learningSummary}` : ""}
${ragContext ? `Retrieved grounding context:\n${ragContext}` : ""}
${attachmentContext ? `Uploaded attachment context:\n${attachmentContext}` : ""}

Original topic:
"${topic}"

Current post:
"""
${currentContent}
"""

Conversation so far:
${conversation.map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.content}`).join("\n")}

Latest enhancement request:
"${enhancementPrompt}"

Tone: ${toneToLabel(params.tone)}
Target length: ${lengthToLabel(params.length)}
${params.keywords ? `Keywords: ${params.keywords}` : ""}

Rules:
- Preserve persona alignment and optimize specifically for ${platform.label}.
- Use retrieved grounding context as the factual source of truth.
- Use uploaded attachment context when it adds relevant facts, copy, or reference material.
- Do not invent unsupported facts. If the source context is missing a fact, avoid claiming it.
- Improve the post directly instead of explaining what you changed.
- Return one improved version only.

Respond in JSON format:
{
  "variants": [
    { "title": "", "content": "", "word_count": 0 }
  ]
}`;

const contentTypeNeedsImage = (contentType) => String(contentType || "").includes("image");
const contentTypeNeedsVideo = (contentType) => String(contentType || "").includes("video");

const buildRetrievalQuery = ({ params, topic, currentContent, enhancementRequest, conversation, attachments }) => {
  return [
    topic,
    params?.keywords,
    params?.contentType,
    params?.companyPersona?.company,
    params?.companyPersona?.tagline,
    currentContent,
    enhancementRequest,
    conversation.map((item) => item.content).join(" "),
    Array.isArray(attachments) ? attachments.map((attachment) => `${attachment.title} ${attachment.content}`).join(" ") : "",
    contentTypeNeedsVideo(params?.contentType) ? "video script storyboard shot list motion visual claims" : "",
    contentTypeNeedsImage(params?.contentType) ? "image visual composition product details brand assets" : "",
  ].filter(Boolean).join(" ");
};

const loadImageElement = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error(`Failed to load ${file.name}`));
  };
  image.src = objectUrl;
});

const canvasToBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        reject(new Error('Unable to compress image'));
        return;
      }

      resolve(blob);
    },
    'image/jpeg',
    quality
  );
});

const buildPreviewUrl = (file) => {
  if (!file.type?.startsWith('image/')) {
    return null;
  }

  return URL.createObjectURL(file);
};

const prepareAttachmentFile = async (file) => {
  if (!file.type?.startsWith('image/')) {
    return file;
  }

  const image = await loadImageElement(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to process image upload');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob = await canvasToBlob(canvas, 0.82);
  if (blob.size > 7 * 1024 * 1024) {
    blob = await canvasToBlob(canvas, 0.68);
  }

  if (blob.size > 7 * 1024 * 1024) {
    throw new Error('Image is too large even after compression. Please upload a smaller image.');
  }

  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.jpg`, { type: 'image/jpeg' });
};

const createAttachmentDraft = (file) => ({
  localId: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
  id: null,
  title: file.name,
  sourceType: file.type?.startsWith('image/') ? 'image' : 'text',
  content: '',
  fileName: file.name,
  previewUrl: buildPreviewUrl(file),
  status: 'queued',
  progress: 0,
  error: '',
});

const attachmentStatusLabel = {
  queued: 'Queued',
  preparing: 'Preparing',
  uploading: 'Uploading',
  processing: 'OCR',
  ready: 'Ready',
  error: 'Failed',
};

const buildInitialMessages = (initialState) => {
  const seededMessages = Array.isArray(initialState?.messages) ? initialState.messages.filter(Boolean) : [];
  const generatedItem = initialState?.generatedContent || null;
  const generatedContent = generatedItem?.content;
  const generatedImage = generatedItem?.image_url || generatedItem?.image_base64;

  if (!generatedContent && !generatedImage) {
    return seededMessages;
  }

  const hasAssistantCopy = seededMessages.some(
    (message) => message?.role === "assistant"
      && String(message?.content || "").trim() === String(generatedContent || '').trim()
      && String(message?.image_url || message?.image_base64 || '').trim() === String(generatedImage || '').trim()
  );

  if (hasAssistantCopy) {
    return seededMessages;
  }

  return [{
    role: "assistant",
    content: generatedContent || '',
    image_url: generatedItem?.image_url || null,
    image_base64: generatedItem?.image_base64 || null,
    image_prompt: generatedItem?.image_prompt || null,
    image_revised_prompt: generatedItem?.image_revised_prompt || null,
    title: generatedItem?.title || null,
  }, ...seededMessages];
};

const isMeaningfulMessage = (message) => {
  if (!message) {
    return false;
  }

  const hasText = Boolean(String(message.content || '').trim());
  const hasImage = Boolean(message.image_url || message.image_base64);
  return hasText || hasImage;
};

export default function RefineContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = useMemo(() => {
    if (location.state) {
      return location.state;
    }

    return restoreRefineSession();
  }, [location.state]);
  const [messages, setMessages] = useState(() => buildInitialMessages(initialState));
  const [currentContent, setCurrentContent] = useState(initialState?.generatedContent || null);
  const [promptInput, setPromptInput] = useState("");
  const [ragContext, setRagContext] = useState(initialState?.ragContext || "");
  const [attachments, setAttachments] = useState([]);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const [pendingUserMessage, setPendingUserMessage] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const fileInputRef = useRef(null);

  const attachmentUploadMutation = useMutation({
    mutationFn: async (drafts) => {
      const results = [];

      for (const draft of drafts) {
        setAttachments((current) => current.map((attachment) => (
          attachment.localId === draft.localId
            ? { ...attachment, status: 'preparing', progress: 15, error: '' }
            : attachment
        )));

        try {
          const preparedFile = await prepareAttachmentFile(draft.file);

          setAttachments((current) => current.map((attachment) => (
            attachment.localId === draft.localId
              ? { ...attachment, status: 'uploading', progress: 20 }
              : attachment
          )));

          const source = await ingestKnowledgeSourceFromFile({
            title: draft.file.name,
            fileName: preparedFile.name,
            file: preparedFile,
            source_type: draft.file.type?.startsWith("image/") ? "image" : "text",
            tags: ["refine-chat", "attachment"],
            onUploadProgress: ({ percent }) => {
              setAttachments((current) => current.map((attachment) => (
                attachment.localId === draft.localId
                  ? { ...attachment, status: 'uploading', progress: Math.max(20, Math.min(percent, 95)) }
                  : attachment
              )));
            },
          });

          if (source.ocr_status === 'processing') {
            setAttachments((current) => current.map((attachment) => (
              attachment.localId === draft.localId
                ? {
                  ...attachment,
                  id: source.id,
                  title: source.title || draft.file.name,
                  sourceType: source.source_type || (draft.file.type?.startsWith("image/") ? "image" : "text"),
                  content: source.content || '',
                  fileName: draft.file.name,
                  status: 'processing',
                  progress: 100,
                  error: '',
                }
                : attachment
            )));

            let resolvedSource = source;
            for (let attempt = 0; attempt < 20; attempt += 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 1000));
              resolvedSource = await fetchKnowledgeSource(source.id);
              if (resolvedSource.ocr_status !== 'processing') {
                break;
              }
            }

            if (resolvedSource.ocr_status === 'failed') {
              throw new Error(resolvedSource.ocr_error || 'OCR failed');
            }

            if (resolvedSource.ocr_status === 'processing') {
              throw new Error('OCR is still processing. Please try again in a moment.');
            }

            setAttachments((current) => current.map((attachment) => (
              attachment.localId === draft.localId
                ? {
                  ...attachment,
                  id: resolvedSource.id,
                  title: resolvedSource.title || draft.file.name,
                  sourceType: resolvedSource.source_type || (draft.file.type?.startsWith("image/") ? "image" : "text"),
                  content: resolvedSource.content || '',
                  fileName: draft.file.name,
                  status: 'ready',
                  progress: 100,
                  error: '',
                }
                : attachment
            )));
            results.push({ localId: draft.localId, status: 'ready' });
            continue;
          }

          setAttachments((current) => current.map((attachment) => (
            attachment.localId === draft.localId
              ? {
                ...attachment,
                id: source.id,
                title: source.title || draft.file.name,
                sourceType: source.source_type || (draft.file.type?.startsWith("image/") ? "image" : "text"),
                content: source.content || '',
                fileName: draft.file.name,
                status: 'ready',
                progress: 100,
                error: '',
              }
              : attachment
          )));
          results.push({ localId: draft.localId, status: 'ready' });
        } catch (error) {
          setAttachments((current) => current.map((attachment) => (
            attachment.localId === draft.localId
              ? { ...attachment, status: 'error', progress: 0, error: error.message || 'Upload failed' }
              : attachment
          )));
          results.push({ localId: draft.localId, status: 'error', error: error.message || 'Upload failed' });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const readyCount = results.filter((result) => result.status === 'ready').length;
      const failedCount = results.filter((result) => result.status === 'error').length;

      if (readyCount > 0) {
        toast({ title: "Files attached", description: `${readyCount} file(s) added to refinement context.`, duration: 2000 });
      }

      if (failedCount > 0) {
        toast({
          title: "Some files failed",
          description: `${failedCount} file(s) could not be processed.`,
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Attachment upload failed",
        description: error.message || "Unable to process the selected file.",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  useEffect(() => {
    return () => {
      attachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, [attachments]);

  useEffect(() => {
    if (!initialState || !currentContent) {
      return;
    }

    const persistedState = {
      ...initialState,
      generatedContent: currentContent,
      messages,
      ragContext,
    };

    persistRefineSession(persistedState);
  }, [currentContent, initialState, messages, ragContext]);

  const params = initialState?.params || null;
  const platform = useMemo(
    () => platforms.find((item) => item.id === initialState?.activePersona) || platforms[0],
    [initialState?.activePersona]
  );

  const refineMutation = useMutation({
    mutationFn: async ({ nextConversation, promptText, activeAttachments }) => {
      if (!params || !currentContent || !String(promptText || '').trim()) {
        throw new Error("Refinement context is incomplete");
      }
      const retrieval = await fetchRagContext(
        buildRetrievalQuery({
          params,
          topic: params.topic,
          currentContent: currentContent.content,
          enhancementRequest: promptText,
          conversation: nextConversation,
          attachments: activeAttachments,
        })
      );

      const prompt = buildRefinementPrompt({
        platform,
        params,
        personaContext: params.companyPersona,
        topic: params.topic,
        currentContent: currentContent.content,
        enhancementPrompt: promptText,
        ragContext: retrieval?.context || "",
        conversation: nextConversation,
        attachmentContext: buildAttachmentContext(activeAttachments),
      });

      const result = await generateContent({ prompt });
      let nextContent = result?.[0] || null;

      if (!nextContent) {
        throw new Error("No refined content returned");
      }

      if (contentTypeNeedsImage(params.contentType)) {
        const image = await generateImageAsset({
          platform,
          topic: params.topic,
          contentType: params.contentType,
          companyPersona: params.companyPersona,
          ragContext: retrieval?.context || '',
          keywords: params.keywords,
          variantTitle: nextContent.title || "",
          variantContent: nextContent.content || "",
        });

        nextContent = {
          ...nextContent,
          image_url: image.image_url || null,
          image_base64: image.image_base64 || null,
          image_prompt: image.prompt || null,
          image_revised_prompt: image.revised_prompt || null,
        };
      }

      const assistantMessage = {
        role: "assistant",
        content: nextContent.content || '',
        image_url: nextContent.image_url || null,
        image_base64: nextContent.image_base64 || null,
        image_prompt: nextContent.image_prompt || null,
        image_revised_prompt: nextContent.image_revised_prompt || null,
        title: nextContent.title || null,
      };
      const fullConversation = [...nextConversation, assistantMessage];

      await saveToHistory({
        topic: params.topic,
        persona: initialState?.activePersona,
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
        variants: [nextContent],
        refinement_messages: fullConversation,
        original_prompt: initialState?.originalPrompt ?? null,
        rag_context: retrieval?.context || "",
        status: "completed",
      });

      return {
        nextContent,
        nextConversation: fullConversation,
        ragContext: retrieval?.context || "",
      };
    },
    onSuccess: (data) => {
      setMessages(data.nextConversation);
      setCurrentContent(data.nextContent);
      setRagContext(data.ragContext || "");
      setPendingUserMessage(null);
      toast({ title: "Content refined", duration: 2000 });
    },
    onError: (error) => {
      setPendingUserMessage(null);
      toast({
        title: "Refinement failed",
        description: error.message || "Unknown error",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  if (!initialState || !params || !currentContent) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No refinement context found.</p>
            <Button onClick={() => navigate("/")}>Back to Generate</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enqueueFiles = async (files) => {
    if (files.length === 0) {
      return;
    }

    const drafts = files.map((file) => ({ file, draft: createAttachmentDraft(file) }));
    setAttachments((current) => [...current, ...drafts.map((item) => item.draft)]);
    await attachmentUploadMutation.mutateAsync(drafts);
  };

  const handleFileSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    await enqueueFiles(files);
    event.target.value = "";
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragActive(false);

    if (refineMutation.isPending || attachmentUploadMutation.isPending) {
      return;
    }

    const files = Array.from(event.dataTransfer.files || []);
    await enqueueFiles(files);
  };

  const removeAttachment = (attachmentId) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === attachmentId || attachment.localId === attachmentId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return current.filter((attachment) => attachment.id !== attachmentId && attachment.localId !== attachmentId);
    });
  };

  const handleCopyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      toast({ title: "Copied to clipboard", duration: 1500 });
      window.setTimeout(() => {
        setCopiedMessageIndex((current) => (current === index ? null : current));
      }, 1500);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again.",
        variant: "destructive",
        duration: 2500,
      });
    }
  };

  const handleShareMessage = async (content) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Creative Studio OS response",
          text: content,
        });
        return;
      }

      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied for sharing",
        description: "Native share is unavailable here, so the response was copied instead.",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Share failed",
        description: "Unable to share this response right now.",
        variant: "destructive",
        duration: 2500,
      });
    }
  };

  const handleDownloadCurrentImage = () => {
    const imageSource = currentContent?.image_url || (currentContent?.image_base64 ? `data:image/png;base64,${currentContent.image_base64}` : null);
    if (!imageSource) {
      return;
    }

    const link = document.createElement('a');
    link.href = imageSource;
    link.download = `${(currentContent?.title || 'generated_visual').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_image.png`;
    link.click();
  };

  const handleShareCurrentImage = async () => {
    const imageSource = currentContent?.image_url || (currentContent?.image_base64 ? `data:image/png;base64,${currentContent.image_base64}` : null);
    if (!imageSource) {
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: currentContent?.title || 'Generated image',
          text: currentContent?.image_revised_prompt || currentContent?.image_prompt || currentContent?.title || 'Generated image',
          url: currentContent?.image_url || undefined,
        });
        return;
      }

      await navigator.clipboard.writeText(imageSource);
      toast({
        title: 'Image link copied',
        description: 'Native share is unavailable here, so the image source was copied instead.',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Image share failed',
        description: 'Unable to share this image right now.',
        variant: 'destructive',
        duration: 2500,
      });
    }
  };

  const getMessageImageSource = (message) => message?.image_url || (message?.image_base64 ? `data:image/png;base64,${message.image_base64}` : null);

  const handleDownloadMessageImage = (message) => {
    const imageSource = getMessageImageSource(message);
    if (!imageSource) {
      return;
    }

    const link = document.createElement('a');
    link.href = imageSource;
    link.download = `${(message?.title || currentContent?.title || 'generated_visual').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_image.png`;
    link.click();
  };

  const handleShareMessageImage = async (message) => {
    const imageSource = getMessageImageSource(message);
    if (!imageSource) {
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: message?.title || currentContent?.title || 'Generated image',
          text: message?.image_revised_prompt || message?.image_prompt || message?.content || 'Generated image',
          url: message?.image_url || undefined,
        });
        return;
      }

      await navigator.clipboard.writeText(imageSource);
      toast({
        title: 'Image link copied',
        description: 'Native share is unavailable here, so the image source was copied instead.',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Image share failed',
        description: 'Unable to share this image right now.',
        variant: 'destructive',
        duration: 2500,
      });
    }
  };

  const handleSendRefinement = () => {
    const promptText = promptInput.trim();
    if (!promptText || refineMutation.isPending || attachmentUploadMutation.isPending) {
      return;
    }

    const activeAttachments = attachments.filter((attachment) => attachment.status === 'ready');
    const attachmentSummary = activeAttachments.length
      ? `\n\nAttached references:\n${activeAttachments.map((attachment) => `- ${attachment.title} (${attachment.sourceType})`).join("\n")}`
      : "";
    const nextUserMessage = { role: "user", content: `${promptText}${attachmentSummary}` };
    const nextConversation = [...messages, nextUserMessage];

    setPendingUserMessage(nextUserMessage);
    setPromptInput("");
    setAttachments((current) => current.filter((attachment) => attachment.status !== 'ready'));
    refineMutation.mutate({ nextConversation, promptText, activeAttachments });
  };

  const displayedMessages = (pendingUserMessage ? [...messages, pendingUserMessage] : messages).filter(isMeaningfulMessage);

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
      <div className="mb-6 border-b border-border/70 pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Refinement Workspace
              </div>
              <h2 className="mt-2 text-2xl font-display font-bold tracking-tight text-foreground md:text-3xl">
                Shape the post through conversation
              </h2>
            </div>
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 shrink-0 rounded-full px-4">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm">
              {platform.label}
            </div>
            <div className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm">
              {params.contentType}
            </div>
            {params.companyPersona?.name ? (
              <div className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm">
                {params.companyPersona.name}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
          <DialogContent className="max-w-5xl overflow-hidden border-border/70 bg-background/98 p-0">
            <DialogHeader className="border-b border-border/70 px-6 py-4">
              <DialogTitle className="font-display text-lg">
                {currentContent?.title || 'Generated visual'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex max-h-[80vh] items-center justify-center bg-muted/20 p-4 md:p-6">
              {(currentContent?.image_url || currentContent?.image_base64) ? (
                <img
                  src={currentContent.image_url || `data:image/png;base64,${currentContent.image_base64}`}
                  alt={currentContent.title || 'Generated visual'}
                  className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
                />
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border/70 px-6 py-4">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleShareCurrentImage}>
                <Share2 className="h-4 w-4" />
                Share image
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleDownloadCurrentImage}>
                <Download className="h-4 w-4" />
                Download image
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <CardContent className="p-0">
            <div className="border-b border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground md:px-5">
              Ask for sharper hooks, stronger CTAs, tighter structure, better platform fit, or a different tone.
            </div>

            <div className="space-y-4 bg-gradient-to-b from-background via-background to-muted/20 px-4 py-5 md:px-5">
              {displayedMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === 'assistant' && getMessageImageSource(message) && !String(message.content || '').trim() ? (
                    <div className="max-w-[88%] overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm">
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => {
                          setCurrentContent((current) => ({ ...(current || {}), ...message }));
                          setIsImageViewerOpen(true);
                        }}
                      >
                        <img
                          src={getMessageImageSource(message)}
                          alt={message.title || 'Generated visual'}
                          className="max-h-[420px] w-full object-cover"
                        />
                      </button>
                      <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-card/80 px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleShareMessageImage(message)}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          Share image
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleDownloadMessageImage(message)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download image
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setCurrentContent((current) => ({ ...(current || {}), ...message }));
                            setIsImageViewerOpen(true);
                          }}
                        >
                          <Expand className="h-3.5 w-3.5" />
                          View full image
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${message.role === "user"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-tl-md border border-border/70 bg-card text-card-foreground"
                      }`}
                    >
                      {getMessageImageSource(message) ? (
                        <div className="mb-3 overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
                          <button
                            type="button"
                            className="block w-full text-left"
                            onClick={() => {
                              setCurrentContent((current) => ({ ...(current || {}), ...message }));
                              setIsImageViewerOpen(true);
                            }}
                          >
                            <img
                              src={getMessageImageSource(message)}
                              alt={message.title || 'Generated visual'}
                              className="max-h-[420px] w-full object-cover"
                            />
                          </button>
                          <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-card/80 px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleShareMessageImage(message)}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              Share image
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleDownloadMessageImage(message)}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download image
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setCurrentContent((current) => ({ ...(current || {}), ...message }));
                                setIsImageViewerOpen(true);
                              }}
                            >
                              <Expand className="h-3.5 w-3.5" />
                              View full image
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {String(message.content || '').trim() ? (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      ) : null}
                      {message.role === "assistant" && String(message.content || '').trim() ? (
                        <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopyMessage(message.content, index)}
                          >
                            {copiedMessageIndex === index ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedMessageIndex === index ? "Copied" : "Copy"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleShareMessage(message.content)}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            Share
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}

              {refineMutation.isPending ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Generating the next reply...
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-border/70 bg-card/95 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition ${isDragActive ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!refineMutation.isPending && !attachmentUploadMutation.isPending) {
              setIsDragActive(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            const nextTarget = event.relatedTarget;
            if (nextTarget && event.currentTarget.contains(nextTarget)) {
              return;
            }
            setIsDragActive(false);
          }}
          onDrop={handleDrop}
        >
          <CardContent className="p-4 md:p-5">
            <div
              className={`mb-4 rounded-3xl border border-dashed px-4 py-4 transition ${isDragActive ? 'border-primary bg-primary/5' : 'border-border/70 bg-muted/20'}`}
            >
              <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border/70 pb-4">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <label>
                  <Paperclip className="h-4 w-4" />
                  Attach files
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.csv,.json,.pdf,.docx,image/*"
                    className="hidden"
                    onChange={handleFileSelection}
                    disabled={attachmentUploadMutation.isPending || refineMutation.isPending}
                  />
                </label>
              </Button>
              <p className="text-xs text-muted-foreground">
                Add text, PDF, DOCX, or image files to ground this refinement. Drop files anywhere in this composer. Image OCR is auto-detected and runs in the background after upload.
              </p>
              </div>

            {attachments.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-3">
                {attachments.map((attachment) => (
                  <div key={attachment.id || attachment.localId} className="flex min-w-[240px] items-center gap-3 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2">
                    {attachment.previewUrl ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.title}
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-muted-foreground">
                        {attachment.sourceType === 'image' ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="max-w-[180px] truncate text-xs font-medium text-foreground">{attachment.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] uppercase tracking-wide">
                          {attachment.sourceType}
                        </Badge>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {attachmentStatusLabel[attachment.status] || attachment.status}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/70">
                        <div
                          className={`h-full rounded-full transition-all ${attachment.status === 'error' ? 'bg-destructive' : 'bg-primary'}`}
                          style={{ width: `${attachment.progress || 0}%` }}
                        />
                      </div>
                      {attachment.error ? (
                        <p className="mt-1 text-[11px] text-destructive">{attachment.error}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id || attachment.localId)}
                      className="rounded-full text-muted-foreground transition hover:text-foreground"
                      aria-label={`Remove ${attachment.title}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            </div>

            <Textarea
              value={promptInput}
              onChange={(event) => setPromptInput(event.target.value)}
              placeholder="Tell the assistant exactly what to improve..."
              className="min-h-28 resize-none border-0 bg-transparent px-0 text-sm leading-7 shadow-none focus-visible:ring-0"
            />
            <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-muted-foreground">
                Be explicit about tone, length, hook, CTA, clarity, platform optimization, or what to use from the attached files.
              </p>
              <Button
                onClick={handleSendRefinement}
                disabled={refineMutation.isPending || attachmentUploadMutation.isPending || !promptInput.trim()}
                className="gap-2 rounded-full px-5"
              >
                {refineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {refineMutation.isPending ? "Refining" : "Send refinement"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}