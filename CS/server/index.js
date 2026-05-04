import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'creative_studio_os';
const jwtSecret = process.env.JWT_SECRET || 'creative-studio-dev-secret';
const azureImageApiKey = process.env.AZURE_OPENAI_IMAGE_API_KEY || '';
const azureImageEndpoint = process.env.AZURE_OPENAI_IMAGE_ENDPOINT || '';
const azureImageDeployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT || 'gpt-image-2';
const azureImageApiVersion = process.env.AZURE_OPENAI_IMAGE_API_VERSION || '2024-02-01';
const azureVideoApiKey = process.env.AZURE_OPENAI_VIDEO_API_KEY || '';
const azureVideoEndpoint = process.env.AZURE_OPENAI_VIDEO_ENDPOINT || '';
const azureVideoModel = process.env.AZURE_OPENAI_VIDEO_MODEL || 'sora-2';
const azureVideoPollIntervalMs = Number(process.env.AZURE_OPENAI_VIDEO_POLL_INTERVAL_MS || 5000);
const azureVideoPollTimeoutMs = Number(process.env.AZURE_OPENAI_VIDEO_POLL_TIMEOUT_MS || 180000);
const azureVideoDownloadVariant = process.env.AZURE_OPENAI_VIDEO_DOWNLOAD_VARIANT || 'video';

const uploadsDir = path.join(__dirname, 'uploads');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(uploadsDir));

const createToken = (payload) => jwt.sign(payload, jwtSecret, { expiresIn: '7d' });
const nowIso = () => new Date().toISOString();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const superAdminEmail = normalizeEmail(process.env.SUPERADMIN_EMAIL);

const sanitizeUser = (user) => ({
  id: user.id || user._id?.toString?.() || user._id,
  email: user.email,
  full_name: user.full_name || '',
  company: user.company || '',
  role: user.role || 'user',
  status: user.status || 'active',
  plan_id: user.plan_id || null,
  plan_name: user.plan_name || null,
  created_at: user.created_at,
});

const sanitizeCompanyPersona = (persona) => ({
  id: persona.id || persona._id?.toString?.() || persona._id,
  user_id: persona.user_id,
  company: persona.company || '',
  name: persona.name || '',
  tagline: persona.tagline || '',
  logo_url: persona.logo_url || '',
  logo_placement: persona.logo_placement || 'none',
  preserve_original_logo: persona.preserve_original_logo !== false,
  audience: persona.audience || '',
  voice: persona.voice || '',
  goals: persona.goals || '',
  notes: persona.notes || '',
  visual_style_instructions: persona.visual_style_instructions || '',
  tuning_prompt: persona.tuning_prompt || '',
  learning_summary: persona.learning_summary || '',
  learning_count: Number(persona.learning_count || 0),
  analysis: persona.analysis || '',
  created_at: persona.created_at,
  updated_at: persona.updated_at,
});

const getPersonaLimitForPlan = (planName) => {
  switch (String(planName || 'free').trim().toLowerCase()) {
    case 'enterprise':
      return 20;
    case 'pro':
      return 5;
    default:
      return 1;
  }
};

const buildPersonaAnalysis = ({ company, tagline, audience, voice, goals, notes, visual_style_instructions, tuning_prompt, learning_summary }) => {
  return [
    `Brand identity: ${company || 'the company'}.`,
    tagline ? `Brand tagline: ${tagline}.` : null,
    audience ? `Primary audience: ${audience}.` : null,
    voice ? `Voice and tone: ${voice}.` : null,
    goals ? `Content goals: ${goals}.` : null,
    notes ? `Additional guidance: ${notes}.` : null,
    visual_style_instructions ? `Visual style instructions: ${visual_style_instructions}.` : null,
    tuning_prompt ? `Cross-platform brand style instructions: ${tuning_prompt}.` : null,
    learning_summary ? `Cross-platform learned writing preferences from prior generations: ${learning_summary}.` : null,
  ].filter(Boolean).join(' ');
};

const average = (values) => {
  const items = Array.isArray(values) ? values.filter((value) => Number.isFinite(value)) : [];
  if (items.length === 0) {
    return 0;
  }

  return items.reduce((total, value) => total + value, 0) / items.length;
};

const countMatches = (value, pattern) => {
  const matches = String(value || '').match(pattern);
  return matches ? matches.length : 0;
};

const summarizeGeneratedVariants = (variants) => {
  const items = Array.isArray(variants) ? variants : [];
  if (items.length === 0) {
    return '';
  }

  const contents = items
    .map((variant) => String(variant?.content || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (contents.length === 0) {
    return '';
  }

  const sentenceGroups = contents.map((content) => content.split(/(?<=[.!?])\s+/).filter(Boolean));
  const sentenceLengths = sentenceGroups.flat().map((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length);
  const firstSentences = sentenceGroups.map((sentences) => sentences[0] || '');
  const paragraphCounts = contents.map((content) => content.split(/\n\s*\n/).filter(Boolean).length || 1);
  const lineCounts = contents.map((content) => content.split(/\n/).filter(Boolean).length || 1);
  const emojiTotal = contents.reduce((count, content) => count + countMatches(content, /[\u{1F300}-\u{1FAFF}]/gu), 0);
  const hashtagTotal = contents.reduce((count, content) => count + countMatches(content, /(^|\s)#[\p{L}\p{N}_]+/gu), 0);
  const exclamationTotal = contents.reduce((count, content) => count + countMatches(content, /!/g), 0);
  const questionHookCount = firstSentences.filter((sentence) => sentence.includes('?')).length;
  const ctaCount = contents.filter((content) => /\b(apply|join|learn more|discover|explore|contact|dm|message us|get started|sign up|book a demo|try it|read more|follow)\b/i.test(content)).length;
  const listStyleCount = contents.filter((content) => /[:\-]\s+[A-Z0-9]/.test(content) || /\n\s*[-*•]/.test(content)).length;
  const shortSentenceRatio = sentenceLengths.length ? sentenceLengths.filter((length) => length <= 10).length / sentenceLengths.length : 0;
  const longSentenceRatio = sentenceLengths.length ? sentenceLengths.filter((length) => length >= 20).length / sentenceLengths.length : 0;
  const averageWordCount = Math.round(items.reduce((total, variant) => total + Number(variant?.word_count || 0), 0) / items.length);
  const averageSentenceLength = Math.round(average(sentenceLengths));
  const averageParagraphCount = average(paragraphCounts);
  const averageLineCount = average(lineCounts);

  const styleSignals = [
    averageWordCount ? `Cross-platform preferred length: about ${averageWordCount} words before platform-specific adaptation.` : null,
    averageSentenceLength && averageSentenceLength <= 11 ? 'Sentence rhythm: prefers crisp, compact sentences.' : null,
    averageSentenceLength >= 18 ? 'Sentence rhythm: allows longer, more developed sentences when needed.' : null,
    shortSentenceRatio >= 0.6 ? 'Readability preference: keeps copy punchy and easy to scan.' : null,
    longSentenceRatio >= 0.35 ? 'Readability preference: mixes in fuller explanatory sentences for depth.' : null,
    questionHookCount >= Math.ceil(items.length / 2) ? 'Opening preference: often starts with a curiosity-driven or question-based hook.' : null,
    ctaCount >= Math.ceil(items.length / 2) ? 'Closing preference: usually ends with a direct call to action.' : null,
    listStyleCount >= Math.ceil(items.length / 2) ? 'Structure preference: often breaks ideas into list-like or segmented sections.' : null,
    averageParagraphCount >= 2 ? 'Layout preference: favors multi-paragraph flow over one dense block.' : null,
    averageLineCount >= 4 ? 'Formatting preference: uses visible line breaks to improve readability.' : null,
    emojiTotal > 0 ? 'Tone marker: may use light emoji emphasis when it suits the platform and audience.' : null,
    hashtagTotal >= items.length ? 'Packaging preference: often leaves room for hashtags when the platform supports them.' : null,
    exclamationTotal >= items.length ? 'Punctuation style: uses energetic emphasis sparingly through exclamation marks.' : null,
    'Memory rule: preserve reusable brand voice and writing behavior, but avoid storing temporary campaign facts, names, offers, locations, or topic-specific details.',
  ].filter(Boolean);

  return styleSignals.join(' ');
};

const mergeLearningSummary = (existingSummary, nextSummary) => {
  const current = String(existingSummary || '').trim();
  const incoming = String(nextSummary || '').trim();

  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  return `${incoming} ${current}`.slice(0, 1600).trim();
};

const buildVideoPrompt = ({ platform, topic, companyPersona, contentType, ragContext, keywords, variantTitle, variantContent }) => {
  const persona = companyPersona || {};
  const normalizedPlatform = String(platform?.label || platform?.id || '').trim().toLowerCase();
  const requestedLogoPlacement = String(persona.logoPlacementOverride || persona.logo_placement || 'none').trim().toLowerCase();
  const preserveOriginalLogo = persona.useOriginalLogo !== false && persona.preserve_original_logo !== false;
  const motionPreset = {
    linkedin: 'Professional motion design, polished transitions, restrained camera movement, premium B2B brand feel.',
    instagram: 'Scroll-stopping motion, stylish pacing, visually rich scenes, creator-native energy.',
    facebook: 'Clear storytelling, broad-audience readability, emotionally accessible pacing.',
    youtube: 'Cinematic framing, strong opening hook, thumbnail-worthy hero moments, landscape-first composition.',
    github: 'Product-focused technical clarity, interface-led storytelling, clean developer aesthetic.',
    x: 'Fast hook, concise visual beats, high-contrast motion, immediate clarity.',
    threads: 'Conversational, modern, expressive motion with soft editorial polish.',
  }[String(platform?.id || '').toLowerCase()] || 'Platform-native social video pacing with a clear focal point and modern motion design.';

  const platformFormatPreset = {
    linkedin: 'Format for LinkedIn feed performance: professional, insight-led, credibility-first, concise, and built for silent autoplay with immediate business relevance.',
    instagram: 'Format for Instagram performance: visually magnetic, emotionally clear, trend-aware, fast to understand, and built for retention in a crowded mobile feed.',
    facebook: 'Format for Facebook performance: relatable, story-forward, broad-audience friendly, emotionally legible, and easy to follow without context.',
    youtube: 'Format for YouTube performance: cinematic, hook-first, curiosity-driven, thumbnail-aware, and structured to sustain attention across a slightly longer watch window.',
    github: 'Format for GitHub/developer audiences: product-authentic, technically credible, interface-aware, and focused on clarity over hype.',
    x: 'Format for X performance: immediate hook, compressed storytelling, high signal density, and one sharp takeaway that lands instantly.',
    'x / twitter': 'Format for X performance: immediate hook, compressed storytelling, high signal density, and one sharp takeaway that lands instantly.',
    threads: 'Format for Threads performance: conversational, culturally current, human, expressive, and socially native rather than ad-like.',
  };

  const platformHookPreset = {
    linkedin: 'Opening beat: start with a business pain point, market shift, hiring challenge, or outcome-driven hook in the first visual moment.',
    instagram: 'Opening beat: start with the most visually arresting scene or transformation moment in the first second.',
    facebook: 'Opening beat: start with a relatable human situation or emotionally clear scenario that invites immediate recognition.',
    youtube: 'Opening beat: start with a cinematic hero frame or curiosity gap that makes the viewer want the next beat.',
    github: 'Opening beat: start with the product, workflow, interface, or technical problem being solved.',
    x: 'Opening beat: start with the single strongest visual claim or contrast immediately.',
    'x / twitter': 'Opening beat: start with the single strongest visual claim or contrast immediately.',
    threads: 'Opening beat: start with a human, expressive, socially current moment that feels native to conversation culture.',
  };

  const platformPacingPreset = {
    linkedin: 'Pacing: measured and polished, with clean transitions and enough dwell time for credibility and comprehension.',
    instagram: 'Pacing: brisk, stylish, and retention-oriented, with visually distinct beats and no dead air.',
    facebook: 'Pacing: clear and accessible, with smooth narrative progression and emotionally readable transitions.',
    youtube: 'Pacing: cinematic and deliberate, balancing hook, development, and payoff with strong visual escalation.',
    github: 'Pacing: efficient and precise, prioritizing clarity of workflow, product value, and technical trust.',
    x: 'Pacing: very fast and compressed, with immediate clarity and minimal setup.',
    'x / twitter': 'Pacing: very fast and compressed, with immediate clarity and minimal setup.',
    threads: 'Pacing: natural, expressive, and socially fluid, with modern editorial rhythm.',
  };

  const platformCompositionPreset = {
    linkedin: 'Composition: polished editorial framing, premium business aesthetics, restrained motion, and clean hierarchy.',
    instagram: 'Composition: premium art direction, layered depth, tactile detail, and a strong focal centerpiece.',
    facebook: 'Composition: approachable human-centered framing with clear context and warm readability.',
    youtube: 'Composition: cinematic widescreen framing, bold focal separation, and thumbnail-worthy hero moments.',
    github: 'Composition: interface-led or product-led framing with technical authenticity and minimal visual noise.',
    x: 'Composition: compact, high-contrast, minimal-clutter framing built around one sharp idea.',
    'x / twitter': 'Composition: compact, high-contrast, minimal-clutter framing built around one sharp idea.',
    threads: 'Composition: expressive, contemporary, human-centered framing with social-native energy.',
  };

  const platformAspectRatioPreset = {
    linkedin: 'Preferred framing: 4:5 or square-safe composition for feed visibility and mobile-safe cropping.',
    instagram: 'Preferred framing: 4:5 portrait-first composition that still crops cleanly for square contexts.',
    facebook: 'Preferred framing: 4:5 or 1.91:1 depending on story clarity, always optimized for mobile readability.',
    youtube: 'Preferred framing: 16:9 cinematic composition with strong center-weighted subject placement.',
    github: 'Preferred framing: 16:9 or square depending on product showcase needs, with UI-safe margins.',
    x: 'Preferred framing: 16:9 or square with immediate readability and strong in-feed contrast.',
    'x / twitter': 'Preferred framing: 16:9 or square with immediate readability and strong in-feed contrast.',
    threads: 'Preferred framing: 4:5 portrait or square with intimate, scroll-native composition.',
  };

  const platformCtaPreset = {
    linkedin: 'Closing beat: end on a credible business outcome, hiring signal, product value, or professional call to action.',
    instagram: 'Closing beat: end on a memorable visual payoff or emotionally satisfying branded moment that invites saves and shares.',
    facebook: 'Closing beat: end on a clear takeaway, community-friendly invitation, or emotionally resonant brand moment.',
    youtube: 'Closing beat: end on a strong payoff frame that reinforces the core promise and leaves a memorable final image.',
    github: 'Closing beat: end on product proof, workflow clarity, or a technically credible value moment.',
    x: 'Closing beat: end on the sharpest takeaway or branded proof point with no wasted motion.',
    'x / twitter': 'Closing beat: end on the sharpest takeaway or branded proof point with no wasted motion.',
    threads: 'Closing beat: end on a human, socially resonant, conversation-worthy final moment.',
  };

  const platformKey = Object.keys(platformFormatPreset).find((key) => key === normalizedPlatform) || normalizedPlatform;
  const formatPreset = platformFormatPreset[platformKey] || 'Format for native social performance with strong hook, clarity, retention, and shareability.';
  const hookPreset = platformHookPreset[platformKey] || 'Opening beat: start with the strongest visual hook immediately.';
  const pacingPreset = platformPacingPreset[platformKey] || 'Pacing: keep the video concise, visually distinct, and retention-oriented.';
  const compositionPreset = platformCompositionPreset[platformKey] || 'Composition: use a clear focal point, strong hierarchy, and polished modern framing.';
  const aspectRatioPreset = platformAspectRatioPreset[platformKey] || 'Preferred framing: choose a platform-native aspect ratio with safe mobile composition.';
  const ctaPreset = platformCtaPreset[platformKey] || 'Closing beat: end on a memorable branded payoff or clear value moment.';

  return [
    'Create a short, high-quality social video concept and production-ready video prompt.',
    platform ? `Target platform: ${platform.label}.` : null,
    platform?.optimization ? `Platform optimization: ${platform.optimization}` : null,
    formatPreset,
    hookPreset,
    motionPreset,
    pacingPreset,
    compositionPreset,
    aspectRatioPreset,
    ctaPreset,
    contentType ? `Content format: ${contentType}.` : null,
    persona.company ? `Brand/company: ${persona.company}.` : null,
    persona.tagline ? `Brand tagline: ${persona.tagline}.` : null,
    persona.logo_url ? `Official uploaded logo asset: ${persona.logo_url}.` : null,
    requestedLogoPlacement !== 'none' && persona.logo_url ? `Place the official uploaded logo at: ${requestedLogoPlacement}.` : null,
    requestedLogoPlacement !== 'none' && preserveOriginalLogo && persona.logo_url ? 'Use the exact uploaded logo asset with 100% fidelity. Do not redraw it, restyle it, simplify it, recolor it, reinterpret it, regenerate it, or alter its proportions in any way.' : null,
    persona.voice ? `Brand tone: ${persona.voice}.` : null,
    persona.audience ? `Audience: ${persona.audience}.` : null,
    persona.goals ? `Brand goals: ${persona.goals}.` : null,
    persona.analysis ? `Brand style analysis: ${persona.analysis}.` : null,
    persona.notes ? `Additional brand notes: ${persona.notes}.` : null,
    persona.visual_style_instructions ? `Visual style instructions: ${persona.visual_style_instructions}. Treat these as high-priority requirements for palette, motifs, subject matter, scene styling, and composition.` : null,
    persona.tuning_prompt ? `Persistent brand instructions: ${persona.tuning_prompt}.` : null,
    persona.learning_summary ? `Cross-platform brand memory: ${persona.learning_summary}.` : null,
    topic ? `Video topic: ${topic}.` : null,
    keywords ? `Priority keywords and concepts: ${keywords}.` : null,
    variantTitle ? `Associated post title or angle: ${variantTitle}.` : null,
    variantContent ? `Associated post copy or script direction: ${variantContent}.` : null,
    ragContext ? `Approved knowledge base context for factual grounding and scene cues:\n${ragContext}` : null,
    'Use the approved knowledge base context to decide what the video should literally show, say, imply, and prioritize.',
    'Extract concrete scene material from the knowledge context when available: product details, audience pain points, differentiators, workflow steps, proof points, offers, constraints, and domain language.',
    'If the knowledge context contains multiple useful facts, prioritize the ones most relevant to the target platform and the strongest opening hook.',
    'Translate the persona into casting, wardrobe, environment, lighting, motion language, editing rhythm, and brand-safe styling.',
    'Translate the platform optimization goal into the first 1 to 3 seconds, the pacing of the middle beats, and the final branded payoff.',
    'Align the video with the associated post angle so the copy and video feel like one campaign asset rather than disconnected outputs.',
    'Prefer a clear three-part structure: hook, development, payoff.',
    'Make the scenes specific and distinctive rather than generic stock-video moments.',
    'If on-screen text is used, keep it minimal, highly readable, and secondary to the visual story.',
    requestedLogoPlacement !== 'none' && persona.logo_url ? 'Treat logo placement as a compositing requirement, not a creative reinterpretation request.' : null,
    requestedLogoPlacement !== 'none' && persona.logo_url ? 'Keep the logo clean, readable, unobstructed, and placed in the requested position with safe margins.' : null,
    'The video must feel native to the target platform and aligned with the brand voice.',
    'Use the approved knowledge base context as the source of truth for claims, product details, differentiators, and audience cues.',
    'If the approved knowledge base context does not support a factual detail, do not invent it.',
    'Translate the persona into scenes, motion, lighting, styling, pacing, and camera direction rather than mentioning persona internals.',
    'Prefer a concise social-video structure with a strong opening hook, a clear middle beat, and a memorable closing visual.',
    'Avoid cluttered scenes, unreadable text overlays, and generic stock-video aesthetics.',
  ].filter(Boolean).join(' ');
};

const normalizeAzureVideoEndpoint = (value) => String(value || '').replace(/\/+$/, '');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const extractAzureVideoUrl = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload.video_url
    || payload.url
    || payload.output?.video_url
    || payload.output?.url
    || payload.output?.download_url
    || payload.output?.downloadUrl
    || payload.result?.video_url
    || payload.result?.url
    || payload.result?.download_url
    || payload.result?.downloadUrl
    || payload.data?.video_url
    || payload.data?.url
    || payload.data?.download_url
    || payload.data?.downloadUrl
    || payload.response?.video_url
    || payload.response?.url
    || payload.artifact?.url
    || payload.source?.url
    || payload.file?.url
    || payload.content?.url
    || (Array.isArray(payload.generations) ? payload.generations.find((item) => item?.url || item?.video_url || item?.download_url)?.url : null)
    || (Array.isArray(payload.generations) ? payload.generations.find((item) => item?.url || item?.video_url || item?.download_url)?.video_url : null)
    || (Array.isArray(payload.generations) ? payload.generations.find((item) => item?.url || item?.video_url || item?.download_url)?.download_url : null)
    || (Array.isArray(payload.output) ? payload.output.find((item) => item?.url || item?.video_url || item?.download_url)?.url : null)
    || (Array.isArray(payload.output) ? payload.output.find((item) => item?.url || item?.video_url || item?.download_url)?.video_url : null)
    || (Array.isArray(payload.output) ? payload.output.find((item) => item?.url || item?.video_url || item?.download_url)?.download_url : null)
    || (Array.isArray(payload.data) ? payload.data.find((item) => item?.url || item?.video_url || item?.download_url)?.url : null)
    || (Array.isArray(payload.data) ? payload.data.find((item) => item?.url || item?.video_url || item?.download_url)?.video_url : null)
    || (Array.isArray(payload.data) ? payload.data.find((item) => item?.url || item?.video_url || item?.download_url)?.download_url : null)
    || null;
};

const extractAzureVideoId = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload.id || payload.video_id || payload.operation_id || payload.job_id || payload.data?.id || null;
};

const normalizeAzureVideoStatus = (payload) => {
  const rawStatus = String(
    payload?.status
      || payload?.state
      || payload?.job_status
      || payload?.data?.status
      || payload?.data?.state
      || ''
  ).trim().toLowerCase();

  if (!rawStatus) {
    return extractAzureVideoUrl(payload) ? 'completed' : 'submitted';
  }

  if (['succeeded', 'success', 'completed', 'complete', 'done'].includes(rawStatus)) {
    return 'completed';
  }

  if (['failed', 'error', 'cancelled', 'canceled', 'rejected'].includes(rawStatus)) {
    return 'failed';
  }

  if (['running', 'processing', 'queued', 'pending', 'submitted', 'in_progress', 'notstarted'].includes(rawStatus)) {
    return 'processing';
  }

  return rawStatus;
};

const buildAzureVideoStatusUrl = (endpoint, payload) => {
  const operationLocation = payload?.operation_location || payload?.operationLocation || payload?.headers?.operation_location || payload?.headers?.operationLocation;
  if (operationLocation) {
    return operationLocation;
  }

  const videoId = extractAzureVideoId(payload);
  if (!videoId) {
    return null;
  }

  return `${normalizeAzureVideoEndpoint(endpoint)}/${encodeURIComponent(videoId)}`;
};

const fetchAzureVideoStatus = async ({ statusUrl }) => {
  const response = await fetch(statusUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'api-key': azureVideoApiKey,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Azure video status error: ${response.status} ${response.statusText}`);
  }

  return data;
};

const downloadAzureVideoContent = async ({ videoId, variant = azureVideoDownloadVariant }) => {
  const downloadUrl = `${normalizeAzureVideoEndpoint(azureVideoEndpoint)}/${encodeURIComponent(videoId)}/content?variant=${encodeURIComponent(variant)}`;
  const response = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      'api-key': azureVideoApiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `Azure video download error: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const saveAzureVideoAsset = async ({ videoId, variant = azureVideoDownloadVariant }) => {
  await ensureUploadsDir();
  const fileName = `${videoId}-${variant}.mp4`;
  const filePath = path.join(uploadsDir, fileName);

  try {
    await fs.access(filePath);
    return `/uploads/${fileName}`;
  } catch {
    const buffer = await downloadAzureVideoContent({ videoId, variant });
    await fs.writeFile(filePath, buffer);
    return `/uploads/${fileName}`;
  }
};

const normalizeAzureVideoResult = async ({ payload, statusUrl = null }) => {
  const videoUrl = extractAzureVideoUrl(payload);
  const normalizedStatus = normalizeAzureVideoStatus(payload);
  const videoId = extractAzureVideoId(payload);
  let resolvedVideoUrl = videoUrl;

  if (!resolvedVideoUrl && normalizedStatus === 'completed' && videoId) {
    try {
      resolvedVideoUrl = await saveAzureVideoAsset({ videoId });
    } catch (error) {
      console.warn('Azure video download pending or unavailable:', error.message || error);
    }
  }

  return {
    video_url: resolvedVideoUrl,
    video_id: videoId,
    status: normalizedStatus === 'completed' && !resolvedVideoUrl ? 'processing' : normalizedStatus,
    status_url: statusUrl,
    provider_response: payload,
  };
};

const generateVideoWithAzure = async ({ prompt }) => {
  if (!azureVideoApiKey || !azureVideoEndpoint) {
    throw new Error('Azure video generation is not configured. Set AZURE_OPENAI_VIDEO_API_KEY and AZURE_OPENAI_VIDEO_ENDPOINT in the server environment.');
  }

  const response = await fetch(normalizeAzureVideoEndpoint(azureVideoEndpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': azureVideoApiKey,
    },
    body: JSON.stringify({
      model: azureVideoModel,
      prompt,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Azure video API error: ${response.status} ${response.statusText}`);
  }

  const initialStatusUrl = response.headers.get('operation-location') || response.headers.get('Operation-Location') || buildAzureVideoStatusUrl(azureVideoEndpoint, data);
  let normalized = await normalizeAzureVideoResult({ payload: data, statusUrl: initialStatusUrl });

  if (normalized.video_url || normalized.status === 'failed' || !normalized.status_url) {
    return normalized;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < azureVideoPollTimeoutMs) {
    await sleep(azureVideoPollIntervalMs);
    const statusPayload = await fetchAzureVideoStatus({ statusUrl: normalized.status_url });
    normalized = await normalizeAzureVideoResult({ payload: statusPayload, statusUrl: normalized.status_url });

    if (normalized.video_url || normalized.status === 'completed' || normalized.status === 'failed') {
      return normalized;
    }
  }

  return {
    ...normalized,
    status: normalized.video_url ? 'completed' : 'processing',
  };
};

const getAzureVideoStatusById = async ({ videoId }) => {
  if (!azureVideoApiKey || !azureVideoEndpoint) {
    throw new Error('Azure video generation is not configured. Set AZURE_OPENAI_VIDEO_API_KEY and AZURE_OPENAI_VIDEO_ENDPOINT in the server environment.');
  }

  if (!String(videoId || '').trim()) {
    throw new Error('Video id is required');
  }

  const statusUrl = `${normalizeAzureVideoEndpoint(azureVideoEndpoint)}/${encodeURIComponent(String(videoId).trim())}`;
  const payload = await fetchAzureVideoStatus({ statusUrl });
  return await normalizeAzureVideoResult({ payload, statusUrl });
};

const ensureUploadsDir = async () => {
  await fs.mkdir(uploadsDir, { recursive: true });
};

let ocrWorkerPromise = null;
const ocrResultCache = new Map();
const activeOcrJobs = new Map();
const OCR_CACHE_LIMIT = 100;
const OCR_LANGUAGE_ALLOWLIST = new Set(['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'nld']);
const OCR_AUTO_LANGUAGE = 'eng+spa+fra+deu+ita+por+nld';
const parsePdf = pdfParse.default || pdfParse;

const setOcrCache = (key, value) => {
  if (!key) {
    return;
  }

  if (ocrResultCache.has(key)) {
    ocrResultCache.delete(key);
  }

  ocrResultCache.set(key, value);

  if (ocrResultCache.size > OCR_CACHE_LIMIT) {
    const oldestKey = ocrResultCache.keys().next().value;
    if (oldestKey) {
      ocrResultCache.delete(oldestKey);
    }
  }
};

const getOcrCacheKey = ({ buffer, languages }) => `${languages}::${crypto.createHash('sha1').update(buffer).digest('hex')}`;

const normalizeOcrLanguages = (value) => {
  if (!String(value || '').trim()) {
    return OCR_AUTO_LANGUAGE;
  }

  const requested = String(value || 'eng')
    .split(/[+,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => OCR_LANGUAGE_ALLOWLIST.has(item));

  return requested.length > 0 ? Array.from(new Set(requested)).join('+') : OCR_AUTO_LANGUAGE;
};

const getOcrWorker = async () => {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      return new Map();
    })();
  }

  return ocrWorkerPromise;
};

const getOcrWorkerForLanguage = async (languages) => {
  const workers = await getOcrWorker();
  if (!workers.has(languages)) {
    workers.set(languages, (async () => {
      const worker = await createWorker(languages);
      return worker;
    })());
  }

  return workers.get(languages);
};

const parseDataUrlImage = (value) => {
  const match = String(value || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
};

const saveLogoUpload = async (logoFile) => {
  const parsed = parseDataUrlImage(logoFile);
  if (!parsed) {
    throw new Error('Invalid logo file payload');
  }

  const extension = parsed.mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const fileName = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  await ensureUploadsDir();
  await fs.writeFile(path.join(uploadsDir, fileName), parsed.buffer);
  return `/uploads/${fileName}`;
};

const parseDataUrlFile = (value) => {
  const match = String(value || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
};

const extractTextFromBuffer = async ({ buffer, mimeType, fileName, ocrLanguages = OCR_AUTO_LANGUAGE }) => {
  const normalizedMimeType = String(mimeType || '').toLowerCase();
  const normalizedFileName = String(fileName || '').toLowerCase();
  const isTextLike = normalizedMimeType.startsWith('text/')
    || normalizedMimeType.includes('json')
    || normalizedMimeType.includes('xml')
    || normalizedFileName.endsWith('.md')
    || normalizedFileName.endsWith('.txt')
    || normalizedFileName.endsWith('.csv')
    || normalizedFileName.endsWith('.json');

  const isPdf = normalizedMimeType === 'application/pdf' || normalizedFileName.endsWith('.pdf');
  const isDocx = normalizedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || normalizedFileName.endsWith('.docx');
  const isImage = normalizedMimeType.startsWith('image/')
    || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(normalizedFileName);

  if (isTextLike) {
    return buffer.toString('utf8').replace(/\u0000/g, '').trim();
  }

  if (isPdf) {
    const parsed = await parsePdf(buffer);
    return String(parsed?.text || '').replace(/\u0000/g, '').trim();
  }

  if (isDocx) {
    const parsed = await mammoth.extractRawText({ buffer });
    return String(parsed?.value || '').replace(/\u0000/g, '').trim();
  }

  if (isImage) {
    const cacheKey = getOcrCacheKey({ buffer, languages: ocrLanguages });
    if (ocrResultCache.has(cacheKey)) {
      return ocrResultCache.get(cacheKey);
    }

    const worker = await getOcrWorkerForLanguage(ocrLanguages);
    const result = await worker.recognize(buffer);
    const text = String(result?.data?.text || '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
    setOcrCache(cacheKey, text);
    return text;
  }

  throw new Error('Unsupported file type. Upload txt, md, csv, json, pdf, docx, or image files.');
};

const extractTextFromUrl = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CreativeStudioOS/1.0',
      Accept: 'text/html, text/plain, application/json;q=0.9, */*;q=0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '',
    content: bodyText,
  };
};

const buildImagePrompt = ({
  platform,
  topic,
  companyPersona,
  contentType,
  ragContext,
  keywords,
  variantTitle,
  variantContent,
}) => {
  const persona = companyPersona || {};
  const normalizedPlatform = String(platform?.label || '').trim().toLowerCase();
  const requestedLogoPlacement = String(persona.logoPlacementOverride || persona.logo_placement || 'none').trim().toLowerCase();
  const preserveOriginalLogo = persona.useOriginalLogo !== false && persona.preserve_original_logo !== false;

  const platformVisualOptimization = {
    linkedin: 'Design for professional credibility, clean hierarchy, restrained polish, business relevance, and feed-stopping clarity without looking like a generic corporate template.',
    instagram: 'Design for thumb-stopping visual impact, strong focal point, emotionally clear storytelling, premium composition, and save/share appeal.',
    facebook: 'Design for approachable community-friendly storytelling, clear context, relatable visuals, and easy comprehension in a busy feed.',
    youtube: 'Design for high-contrast thumbnail-style clarity, bold focal hierarchy, curiosity, and immediate topic recognition at small sizes.',
    github: 'Design for technical clarity, product authenticity, interface realism, and developer trust over hype or glossy stock aesthetics.',
    'x / twitter': 'Design for fast-scanning impact, concise visual messaging, strong contrast, and a single sharp idea that reads instantly in-feed.',
    threads: 'Design for conversational, culture-aware, human visuals that feel current, expressive, and community-native rather than overproduced.',
  };

  const platformCompositionHints = {
    linkedin: 'Prefer structured layouts, editorial spacing, subtle brand integration, and professional visual metaphors.',
    instagram: 'Prefer bold composition, premium lighting, layered depth, and a visually memorable centerpiece.',
    facebook: 'Prefer warm, relatable scenes or campaign visuals with clear subject emphasis and accessible composition.',
    youtube: 'Prefer one dominant subject, strong separation, high readability, and thumbnail-friendly framing.',
    github: 'Prefer product/UI-led compositions, diagrams, code-adjacent motifs, and minimal but precise visual storytelling.',
    'x / twitter': 'Prefer minimal clutter, strong contrast, and a compact visual idea that lands immediately.',
    threads: 'Prefer expressive, modern, human-centered compositions with natural energy and social-native tone.',
  };

  const platformAspectRatioPresets = {
    linkedin: 'Preferred aspect ratio: 4:5 or square for feed visibility, with safe margins for mobile cropping.',
    instagram: 'Preferred aspect ratio: 4:5 portrait for feed dominance, with composition that still crops cleanly to square.',
    facebook: 'Preferred aspect ratio: 4:5 or 1.91:1 depending on storytelling scene, keeping the subject readable on mobile.',
    youtube: 'Preferred aspect ratio: 16:9 thumbnail framing with strong center-weighted composition and edge-safe subject placement.',
    github: 'Preferred aspect ratio: 16:9 or square depending on product showcase needs, with clean UI-safe framing.',
    'x / twitter': 'Preferred aspect ratio: 16:9 or square with immediate readability and strong in-feed contrast.',
    threads: 'Preferred aspect ratio: 4:5 portrait or square with intimate, scroll-native framing.',
  };

  const platformFramingPresets = {
    linkedin: 'Framing: polished editorial crop, balanced whitespace, clear hierarchy, and restrained premium business aesthetics.',
    instagram: 'Framing: immersive close-to-mid composition, premium focal depth, and visually rich layering that feels save-worthy.',
    facebook: 'Framing: approachable human-centered crop with clear context and emotionally legible storytelling.',
    youtube: 'Framing: bold thumbnail crop, oversized focal subject, high separation, and instant topic recognition at small size.',
    github: 'Framing: product-led or interface-led crop with precise detail, technical authenticity, and minimal visual noise.',
    'x / twitter': 'Framing: compact, high-signal crop built around one sharp visual idea with minimal distraction.',
    threads: 'Framing: conversational, expressive crop with natural energy and a less corporate feel.',
  };

  const platformCreativeStylePresets = {
    linkedin: 'Creative style preset: executive editorial, polished brand campaign, subtle gradients, refined lighting, premium but credible.',
    instagram: 'Creative style preset: premium lifestyle-commercial, art-directed, cinematic lighting, tactile detail, trend-aware but not generic.',
    facebook: 'Creative style preset: relatable campaign storytelling, warm realism, community-friendly polish, accessible and trustworthy.',
    youtube: 'Creative style preset: high-contrast thumbnail drama, bold lighting, expressive subject emphasis, curiosity-driven visual tension.',
    github: 'Creative style preset: modern technical product storytelling, clean UI realism, diagrammatic clarity, understated sophistication.',
    'x / twitter': 'Creative style preset: minimal, sharp, high-contrast, idea-first creative with fast-scanning impact.',
    threads: 'Creative style preset: contemporary social-native storytelling, human, expressive, culturally current, lightly editorial.',
  };

  const platformKey = Object.keys(platformVisualOptimization).find((key) => key === normalizedPlatform) || normalizedPlatform;
  const visualOptimization = platformVisualOptimization[platformKey] || 'Design for native platform fit, strong attention capture, clarity, and shareability.';
  const compositionHint = platformCompositionHints[platformKey] || 'Use a clear focal point, strong hierarchy, and polished modern composition.';
  const aspectRatioPreset = platformAspectRatioPresets[platformKey] || 'Preferred aspect ratio: choose a feed-native crop with safe margins and strong mobile readability.';
  const framingPreset = platformFramingPresets[platformKey] || 'Framing: use a clear focal crop, strong hierarchy, and mobile-safe composition.';
  const creativeStylePreset = platformCreativeStylePresets[platformKey] || 'Creative style preset: polished modern social creative with distinctive brand fit.';

  return [
    'Create a high-quality social media visual concept and production-ready image prompt.',
    platform ? `Target platform: ${platform.label}.` : null,
    platform?.optimization ? `Platform optimization: ${platform.optimization}` : null,
    visualOptimization,
    compositionHint,
    aspectRatioPreset,
    framingPreset,
    creativeStylePreset,
    contentType ? `Content format: ${contentType}.` : null,
    persona.company ? `Brand/company: ${persona.company}.` : null,
    persona.tagline ? `Brand tagline: ${persona.tagline}.` : null,
    persona.logo_url ? `Official uploaded logo asset: ${persona.logo_url}.` : null,
    requestedLogoPlacement !== 'none' && persona.logo_url ? `Place the official uploaded logo at: ${requestedLogoPlacement}.` : null,
    requestedLogoPlacement !== 'none' && preserveOriginalLogo && persona.logo_url ? 'Use the exact uploaded logo asset with 100% fidelity. Do not redraw it, restyle it, simplify it, recolor it, reinterpret it, regenerate it, or alter its proportions in any way.' : null,
    persona.voice ? `Brand tone: ${persona.voice}.` : null,
    persona.audience ? `Audience: ${persona.audience}.` : null,
    persona.goals ? `Brand goals: ${persona.goals}.` : null,
    persona.analysis ? `Brand style analysis: ${persona.analysis}.` : null,
    persona.notes ? `Additional brand notes: ${persona.notes}.` : null,
    persona.visual_style_instructions ? `Explicit visual directives from persona: ${persona.visual_style_instructions}. Treat these as high-priority requirements for subject matter, wording cues inside the concept, palette, and overall art direction.` : null,
    persona.tuning_prompt ? `Visual style guidance: ${persona.tuning_prompt}.` : null,
    persona.tuning_prompt ? `Persistent visual tuning instructions: ${persona.tuning_prompt}. Treat these as high-priority creative constraints.` : null,
    persona.learning_summary ? `Cross-platform brand memory: ${persona.learning_summary}.` : null,
    topic ? `Post topic: ${topic}.` : null,
    keywords ? `Priority keywords and concepts: ${keywords}.` : null,
    variantTitle ? `Associated post title or angle: ${variantTitle}.` : null,
    variantContent ? `Associated post copy to visually align with: ${variantContent}.` : null,
    ragContext ? `Approved knowledge base context for factual grounding and visual cues:\n${ragContext}` : null,
    'The image must match the brand voice, feel native to the target platform, and be optimized for attention, clarity, and shareability.',
    'Use the approved knowledge base context as the source of truth for product details, differentiators, claims, offers, audience cues, and visual references.',
    'If the approved knowledge base context does not support a factual detail, do not invent it.',
    'Translate the brand persona into visual direction, art direction, composition, mood, color behavior, and styling rather than mentioning persona internals.',
    'When persona visual style instructions or tuning instructions specify themes, keywords, palette, or visual motifs, reflect them directly in the generated concept unless they conflict with factual grounding or platform fit.',
    'Align the visual with the associated post angle so the image and copy feel like one campaign asset.',
    'Make the concept specific, distinctive, and conversion-aware rather than generic.',
    'Honor the platform aspect ratio, framing, and creative-style preset unless the topic strongly requires a better native variation.',
    'Do not include any persona name in the image or prompt.',
    requestedLogoPlacement !== 'none' && persona.logo_url ? 'Treat logo placement as a compositing requirement, not a request to artistically reinterpret the logo.' : null,
    requestedLogoPlacement !== 'none' && persona.logo_url ? 'Keep the logo clean, readable, unobstructed, and placed in the requested position with safe margins.' : null,
    'Do not generate visible text-heavy posters unless the concept truly requires minimal readable text.',
    'Avoid cluttered layouts, unreadable text, and generic stock-photo aesthetics.',
    'Prefer a polished, modern, high-performing social creative style with a clear focal point and strong visual hierarchy.',
  ].filter(Boolean).join(' ');
};

const normalizeKnowledgeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const tokenizeKnowledge = (value) => {
  const matches = normalizeKnowledgeText(value).toLowerCase().match(/[a-z0-9]{2,}/g);
  return matches ? Array.from(new Set(matches)) : [];
};

const buildKnowledgeChunks = (content) => {
  const normalized = String(content || '').replace(/\r/g, '').trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const sourceUnits = paragraphs.length > 0 ? paragraphs : [normalized];
  const chunks = [];

  sourceUnits.forEach((unit) => {
    const sentences = unit.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length <= 3) {
      chunks.push(unit);
      return;
    }

    for (let index = 0; index < sentences.length; index += 3) {
      chunks.push(sentences.slice(index, index + 3).join(' ').trim());
    }
  });

  return chunks
    .map((chunk, index) => ({
      id: `${index + 1}`,
      text: chunk,
      tokens: tokenizeKnowledge(chunk),
    }))
    .filter((chunk) => chunk.text.length > 0);
};

const scoreKnowledgeChunk = (chunk, queryTokens) => {
  if (!chunk || !Array.isArray(chunk.tokens) || queryTokens.length === 0) {
    return 0;
  }

  const tokenSet = new Set(chunk.tokens);
  return queryTokens.reduce((score, token) => score + (tokenSet.has(token) ? 1 : 0), 0);
};

const buildRagContext = ({ knowledgeItems, query, limit = 4 }) => {
  const queryTokens = tokenizeKnowledge(query);
  const scored = [];

  (Array.isArray(knowledgeItems) ? knowledgeItems : []).forEach((item) => {
    (item.chunks || []).forEach((chunk) => {
      const score = scoreKnowledgeChunk(chunk, queryTokens);
      if (score > 0) {
        scored.push({
          sourceId: item.id || item._id?.toString?.() || '',
          sourceTitle: item.title || 'Knowledge Source',
          sourceType: item.source_type || 'text',
          text: chunk.text,
          score,
        });
      }
    });
  });

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item, index) => `[Source ${index + 1}: ${item.sourceTitle} | ${item.sourceType}] ${item.text}`)
    .join('\n');
};

const selectAzureImageSize = ({ platform, contentType }) => {
  const normalizedPlatform = String(platform?.label || '').trim().toLowerCase();
  const normalizedContentType = String(contentType || '').trim().toLowerCase();
  const isImageOnly = normalizedContentType === 'image' || normalizedContentType === 'image-only';
  const isTextAndImage = normalizedContentType.includes('text') && normalizedContentType.includes('image');

  const platformSizePresets = {
    linkedin: isImageOnly ? '1024x1792' : '1024x1024',
    instagram: '1024x1792',
    facebook: isImageOnly ? '1792x1024' : '1024x1024',
    youtube: '1792x1024',
    github: isTextAndImage ? '1024x1024' : '1792x1024',
    'x / twitter': isTextAndImage ? '1024x1024' : '1792x1024',
    threads: '1024x1792',
  };

  return platformSizePresets[normalizedPlatform] || '1024x1024';
};

const generateImageWithAzure = async ({ prompt, size = '1024x1024' }) => {
  if (!azureImageApiKey || !azureImageEndpoint) {
    throw new Error('Azure image generation is not configured on the server.');
  }

  const baseEndpoint = azureImageEndpoint.replace(/\/$/, '');
  const requestUrl = `${baseEndpoint}/openai/deployments/${azureImageDeployment}/images/generations?api-version=${azureImageApiVersion}`;

  const requestImage = async (body) => {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': azureImageApiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  let requestBody = {
    prompt,
    size,
    quality: 'high',
  };

  let { response, data } = await requestImage(requestBody);

  if (!response.ok && /quality/i.test(String(data?.error?.message || ''))) {
    requestBody = {
      prompt,
      size,
    };
    ({ response, data } = await requestImage(requestBody));
  }

  if (!response.ok && /size|resolution|dimensions/i.test(String(data?.error?.message || '')) && size !== '1024x1024') {
    requestBody = {
      prompt,
      size: '1024x1024',
      quality: 'high',
    };
    ({ response, data } = await requestImage(requestBody));

    if (!response.ok && /quality/i.test(String(data?.error?.message || ''))) {
      requestBody = {
        prompt,
        size: '1024x1024',
      };
      ({ response, data } = await requestImage(requestBody));
    }
  }

  if (!response.ok) {
    throw new Error(data.error?.message || `Azure image API error: ${response.status} ${response.statusText}`);
  }

  const image = Array.isArray(data.data) ? data.data[0] : null;
  const imageUrl = image?.url || null;
  const b64Json = image?.b64_json || null;

  if (!imageUrl && !b64Json) {
    throw new Error('Azure image API returned no image payload.');
  }

  return {
    image_url: imageUrl,
    image_base64: b64Json,
    revised_prompt: data?.data?.[0]?.revised_prompt || prompt,
  };
};

const createMongoStore = (db) => ({
  type: 'mongo',
  async init() {
    const users = db.collection('users');

    if (!superAdminEmail) {
      console.warn('SUPERADMIN_EMAIL is not set; superadmin login will remain unavailable until configured.');
      return;
    }

    const existingAdmin = await users.findOne({ email: superAdminEmail, role: 'superadmin' });
    if (!existingAdmin) {
      console.warn(`Super admin user ${superAdminEmail} was not found in MongoDB; superadmin login will remain unavailable until seeded.`);
    }
  },
  async getHealth() {
    return { ok: true, users: await db.collection('users').countDocuments(), mode: 'mongo' };
  },
  async findUserByEmail(email) {
    return await db.collection('users').findOne({ email: normalizeEmail(email) });
  },
  async findUserById(id) {
    return await db.collection('users').findOne({ _id: new ObjectId(id) });
  },
  async insertUser(user) {
    const result = await db.collection('users').insertOne(user);
    return await db.collection('users').findOne({ _id: result.insertedId });
  },
  async countUsers() {
    return await db.collection('users').countDocuments();
  },
  async listUsers(filter = {}) {
    const rows = await db.collection('users').find({}).toArray();
    return typeof filter === 'function' ? rows.filter(filter) : rows.filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value));
  },
  async listPlans() {
    return await db.collection('plans').find({}).sort({ created_at: 1 }).toArray();
  },
  async findPlanByName(name) {
    return await db.collection('plans').findOne({ name });
  },
  async listHistory(filter = {}) {
    const rows = await db.collection('content_history').find({}).sort({ created_date: -1 }).toArray();
    return typeof filter === 'function' ? rows.filter(filter) : rows.filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value));
  },
  async insertHistory(entry) {
    const result = await db.collection('content_history').insertOne(entry);
    return await db.collection('content_history').findOne({ _id: result.insertedId });
  },
  async updateHistoryStatus(id, userId) {
    await db.collection('content_history').updateOne(
      { _id: new ObjectId(id), user_id: userId },
      { $set: { status: 'deleted', deleted_at: nowIso() } }
    );
    return await db.collection('content_history').findOne({ _id: new ObjectId(id) });
  },
  async listCompanyPersonas(userId) {
    return await db.collection('company_personas').find({ user_id: userId }).sort({ created_at: -1 }).toArray();
  },
  async countCompanyPersonas(userId) {
    return await db.collection('company_personas').countDocuments({ user_id: userId });
  },
  async findCompanyPersonaById(id, userId) {
    return await db.collection('company_personas').findOne({ _id: new ObjectId(id), user_id: userId });
  },
  async insertCompanyPersona(persona) {
    const result = await db.collection('company_personas').insertOne(persona);
    return await db.collection('company_personas').findOne({ _id: result.insertedId });
  },
  async updateCompanyPersona(id, userId, updates) {
    await db.collection('company_personas').updateOne(
      { _id: new ObjectId(id), user_id: userId },
      { $set: updates }
    );
    return await db.collection('company_personas').findOne({ _id: new ObjectId(id), user_id: userId });
  },
  async deleteCompanyPersona(id, userId) {
    const result = await db.collection('company_personas').deleteOne({ _id: new ObjectId(id), user_id: userId });
    return result.deletedCount > 0;
  },
  async listKnowledgeSources(userId) {
    return await db.collection('knowledge_sources').find({ user_id: userId }).sort({ updated_at: -1 }).toArray();
  },
  async findKnowledgeSourceById(id, userId) {
    return await db.collection('knowledge_sources').findOne({ _id: new ObjectId(id), user_id: userId });
  },
  async insertKnowledgeSource(source) {
    const result = await db.collection('knowledge_sources').insertOne(source);
    return await db.collection('knowledge_sources').findOne({ _id: result.insertedId });
  },
  async updateKnowledgeSource(id, userId, updates) {
    await db.collection('knowledge_sources').updateOne(
      { _id: new ObjectId(id), user_id: userId },
      { $set: updates }
    );
    return await db.collection('knowledge_sources').findOne({ _id: new ObjectId(id), user_id: userId });
  },
  async deleteKnowledgeSource(id, userId) {
    const result = await db.collection('knowledge_sources').deleteOne({ _id: new ObjectId(id), user_id: userId });
    return result.deletedCount > 0;
  },
});

let store = null;

const authRequired = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await store.findUserById(decoded.sub);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid session' });
  }
};

const superAdminRequired = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ message: 'Super admin access required' });
    }

    req.superAdmin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid session' });
  }
};

app.get('/api/health', async (_req, res) => {
  const health = await store.getHealth();
  res.json(health);
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName, company } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password || !fullName || !company) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const existing = await store.findUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ message: 'User already registered' });
  }

  const freePlan = await store.findPlanByName('Free');
  if (!freePlan) {
    return res.status(500).json({ message: 'Default Free plan is missing in MongoDB' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const created_at = nowIso();
  const insertedUser = await store.insertUser({
    email: normalizedEmail,
    full_name: fullName,
    company,
    role: 'user',
    status: 'active',
    password_hash,
    created_at,
    plan_id: freePlan.id || freePlan._id?.toString?.() || null,
    plan_name: freePlan.name,
  });

  const user = insertedUser?._id ? insertedUser : (await store.findUserByEmail(normalizedEmail));
  const token = createToken({ sub: user.id || user._id.toString(), role: user.role, email: user.email });
  res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const user = await store.findUserByEmail(normalizedEmail);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const isValid = await bcrypt.compare(password || '', user.password_hash || '');
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = createToken({ sub: user.id || user._id.toString(), role: user.role, email: user.email });
  res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/auth/session', authRequired, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.get('/api/user/metrics', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const rows = await store.listHistory(
    (row) => String(row.user_id) === String(userId),
    'created_date'
  );

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const generationsThisMonth = rows.filter(
    (row) => new Date(row.created_date) >= thisMonthStart
  ).length;
  const companyPersonaCount = await store.countCompanyPersonas(userId);
  const planName = req.user.plan_name || 'Free';

  res.json({
    generationsThisMonth,
    totalGenerations: rows.length,
    planName,
    planId: req.user.plan_id || null,
    companyPersonaCount,
    companyPersonaLimit: getPersonaLimitForPlan(planName),
  });
});

app.get('/api/company-personas', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const rows = await store.listCompanyPersonas(userId);
  res.json(rows.map(sanitizeCompanyPersona));
});

app.post('/api/company-personas/logo', authRequired, async (req, res) => {
  const { fileName, fileData } = req.body || {};

  if (!fileName || !fileData) {
    return res.status(400).json({ message: 'Logo file is required' });
  }

  try {
    const logoUrl = await saveLogoUpload(fileData);
    res.status(201).json({ logoUrl, fileName });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to upload logo' });
  }
});

app.post('/api/company-personas', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const { name, company, tagline, logo_url, logo_placement, preserve_original_logo, audience, voice, goals, notes, visual_style_instructions, tuning_prompt } = req.body || {};

  if (!name || !company) {
    return res.status(400).json({ message: 'Persona name and company are required' });
  }

  const existingCount = await store.countCompanyPersonas(userId);
  const planName = req.user.plan_name || 'Free';
  const personaLimit = getPersonaLimitForPlan(planName);
  if (existingCount >= personaLimit) {
    return res.status(403).json({ message: `Your ${planName} plan allows up to ${personaLimit} company persona${personaLimit > 1 ? 's' : ''}.` });
  }

  const timestamp = nowIso();
  const persona = await store.insertCompanyPersona({
    user_id: userId,
    company: String(company).trim(),
    name: String(name).trim(),
    tagline: String(tagline || '').trim(),
    logo_url: String(logo_url || '').trim(),
    logo_placement: String(logo_placement || 'none').trim() || 'none',
    preserve_original_logo: preserve_original_logo !== false,
    audience: String(audience || '').trim(),
    voice: String(voice || '').trim(),
    goals: String(goals || '').trim(),
    notes: String(notes || '').trim(),
    visual_style_instructions: String(visual_style_instructions || '').trim(),
    tuning_prompt: String(tuning_prompt || '').trim(),
    learning_summary: '',
    learning_count: 0,
    analysis: buildPersonaAnalysis({ name, company, tagline, audience, voice, goals, notes, visual_style_instructions, tuning_prompt }),
    created_at: timestamp,
    updated_at: timestamp,
  });

  res.status(201).json(sanitizeCompanyPersona(persona));
});

app.patch('/api/company-personas/:id', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const existing = await store.findCompanyPersonaById(req.params.id, userId);

  if (!existing) {
    return res.status(404).json({ message: 'Company persona not found' });
  }

  const nextValues = {
    name: String(req.body.name ?? existing.name).trim(),
    company: String(req.body.company ?? existing.company).trim(),
    tagline: String(req.body.tagline ?? existing.tagline).trim(),
    logo_url: String(req.body.logo_url ?? existing.logo_url).trim(),
    logo_placement: String(req.body.logo_placement ?? existing.logo_placement ?? 'none').trim() || 'none',
    preserve_original_logo: req.body.preserve_original_logo !== undefined ? req.body.preserve_original_logo !== false : existing.preserve_original_logo !== false,
    audience: String(req.body.audience ?? existing.audience).trim(),
    voice: String(req.body.voice ?? existing.voice).trim(),
    goals: String(req.body.goals ?? existing.goals).trim(),
    notes: String(req.body.notes ?? existing.notes).trim(),
    visual_style_instructions: String(req.body.visual_style_instructions ?? existing.visual_style_instructions).trim(),
    tuning_prompt: String(req.body.tuning_prompt ?? existing.tuning_prompt).trim(),
    learning_summary: String(req.body.learning_summary ?? existing.learning_summary).trim(),
    learning_count: Number(req.body.learning_count ?? existing.learning_count ?? 0),
  };

  const updated = await store.updateCompanyPersona(req.params.id, userId, {
    ...nextValues,
    analysis: buildPersonaAnalysis(nextValues),
    updated_at: nowIso(),
  });

  res.json(sanitizeCompanyPersona(updated));
});

app.delete('/api/company-personas/:id', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const deleted = await store.deleteCompanyPersona(req.params.id, userId);

  if (!deleted) {
    return res.status(404).json({ message: 'Company persona not found' });
  }

  res.json({ ok: true });
});

app.post('/api/company-personas/:id/learn', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const existing = await store.findCompanyPersonaById(req.params.id, userId);

  if (!existing) {
    return res.status(404).json({ message: 'Company persona not found' });
  }

  const generatedSummary = summarizeGeneratedVariants(req.body?.variants);
  const manualFeedback = String(req.body?.feedback || '').trim();
  const nextLearningSummary = mergeLearningSummary(
    existing.learning_summary,
    [manualFeedback, generatedSummary].filter(Boolean).join(' ')
  );

  const nextValues = {
    name: existing.name,
    company: existing.company,
    tagline: existing.tagline,
    logo_url: existing.logo_url,
    logo_placement: existing.logo_placement || 'none',
    preserve_original_logo: existing.preserve_original_logo !== false,
    audience: existing.audience,
    voice: existing.voice,
    goals: existing.goals,
    notes: existing.notes,
    visual_style_instructions: existing.visual_style_instructions || '',
    tuning_prompt: existing.tuning_prompt || '',
    learning_summary: nextLearningSummary,
    learning_count: Number(existing.learning_count || 0) + 1,
  };

  const updated = await store.updateCompanyPersona(req.params.id, userId, {
    ...nextValues,
    analysis: buildPersonaAnalysis(nextValues),
    updated_at: nowIso(),
  });

  res.json(sanitizeCompanyPersona(updated));
});

app.post('/api/generate-image', authRequired, async (req, res) => {
  try {
    const platform = req.body?.platform || null;
    const topic = String(req.body?.topic || '').trim();
    const contentType = String(req.body?.contentType || '').trim();
    const companyPersona = req.body?.companyPersona || null;
    const logoPlacement = String(req.body?.logoPlacement || '').trim();
    const useOriginalLogo = req.body?.useOriginalLogo !== false;
    const ragContext = String(req.body?.ragContext || '').trim();
    const keywords = String(req.body?.keywords || '').trim();
    const variantTitle = String(req.body?.variantTitle || '').trim();
    const variantContent = String(req.body?.variantContent || '').trim();

    if (!topic) {
      return res.status(400).json({ message: 'Topic is required for image generation' });
    }

    const prompt = buildImagePrompt({
      platform,
      topic,
      companyPersona: companyPersona ? {
        ...companyPersona,
        logoPlacementOverride: logoPlacement === 'persona-default' ? (companyPersona.logo_placement || 'none') : (logoPlacement || companyPersona.logo_placement || 'none'),
        useOriginalLogo,
      } : null,
      contentType,
      ragContext,
      keywords,
      variantTitle,
      variantContent,
    });

    const size = selectAzureImageSize({ platform, contentType });

    const image = await generateImageWithAzure({ prompt, size });
    res.json({
      prompt,
      size,
      ...image,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Image generation failed' });
  }
});

app.post('/api/generate-video', authRequired, async (req, res) => {
  try {
    const platform = req.body?.platform || null;
    const topic = String(req.body?.topic || '').trim();
    const contentType = String(req.body?.contentType || '').trim();
    const companyPersona = req.body?.companyPersona || null;
    const logoPlacement = String(req.body?.logoPlacement || '').trim();
    const useOriginalLogo = req.body?.useOriginalLogo !== false;
    const ragContext = String(req.body?.ragContext || '').trim();
    const keywords = String(req.body?.keywords || '').trim();
    const variantTitle = String(req.body?.variantTitle || '').trim();
    const variantContent = String(req.body?.variantContent || '').trim();

    if (!topic) {
      return res.status(400).json({ message: 'Topic is required for video generation' });
    }

    const prompt = buildVideoPrompt({
      platform,
      topic,
      companyPersona: companyPersona ? {
        ...companyPersona,
        logoPlacementOverride: logoPlacement === 'persona-default' ? (companyPersona.logo_placement || 'none') : (logoPlacement || companyPersona.logo_placement || 'none'),
        useOriginalLogo,
      } : null,
      contentType,
      ragContext,
      keywords,
      variantTitle,
      variantContent,
    });

    const video = await generateVideoWithAzure({ prompt });
    res.json({ prompt, ...video });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Video generation failed' });
  }
});

app.get('/api/video-status/:id', authRequired, async (req, res) => {
  try {
    const result = await getAzureVideoStatusById({ videoId: req.params.id });
    res.json(result);
  } catch (error) {
    console.error('Video status error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch video status' });
  }
});

app.get('/api/knowledge-sources', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const rows = await store.listKnowledgeSources(userId);
  res.json(rows.map((row) => ({ ...row, id: row.id || row._id?.toString?.() })));
});

app.get('/api/knowledge-sources/:id', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const source = await store.findKnowledgeSourceById(req.params.id, userId);

  if (!source) {
    return res.status(404).json({ message: 'Knowledge source not found' });
  }

  res.json({ ...source, id: source.id || source._id?.toString?.() });
});

app.post('/api/knowledge-sources', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const title = String(req.body?.title || '').trim();
  const content = String(req.body?.content || '').trim();
  const sourceType = String(req.body?.source_type || 'text').trim() || 'text';
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : [];

  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required' });
  }

  const timestamp = nowIso();
  const source = await store.insertKnowledgeSource({
    user_id: userId,
    title,
    content,
    source_type: sourceType,
    tags,
    chunks: buildKnowledgeChunks(content),
    created_at: timestamp,
    updated_at: timestamp,
  });

  res.status(201).json({ ...source, id: source.id || source._id?.toString?.() });
});

app.post('/api/knowledge-sources/ingest-url', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const url = String(req.body?.url || '').trim();
  const sourceType = String(req.body?.source_type || 'text').trim() || 'text';
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : [];

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  try {
    const extracted = await extractTextFromUrl(url);
    if (!extracted.content) {
      return res.status(400).json({ message: 'No readable content found at the URL' });
    }

    const timestamp = nowIso();
    const source = await store.insertKnowledgeSource({
      user_id: userId,
      title: String(req.body?.title || extracted.title || url).trim(),
      content: extracted.content,
      source_type: sourceType,
      tags,
      source_url: url,
      ingestion_method: 'url',
      chunks: buildKnowledgeChunks(extracted.content),
      created_at: timestamp,
      updated_at: timestamp,
    });

    res.status(201).json({ ...source, id: source.id || source._id?.toString?.() });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to ingest URL' });
  }
});

app.post('/api/knowledge-sources/ingest-file', authRequired, upload.single('file'), async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const fileName = String(req.body?.fileName || req.file?.originalname || '').trim();
  const sourceType = String(req.body?.source_type || 'text').trim() || 'text';
  const ocrLanguages = normalizeOcrLanguages(req.body?.ocr_languages);
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : typeof req.body?.tags === 'string'
      ? req.body.tags.split(',').map((tag) => String(tag || '').trim()).filter(Boolean)
    : [];

  if (!fileName || !req.file) {
    return res.status(400).json({ message: 'File upload is required' });
  }

  try {
    const timestamp = nowIso();
    const isImage = req.file.mimetype?.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(fileName);
    const initialContent = isImage ? '' : await extractTextFromBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName,
      ocrLanguages,
    });

    if (!isImage && !initialContent) {
      return res.status(400).json({ message: 'No readable content found in the uploaded file' });
    }

    const source = await store.insertKnowledgeSource({
      user_id: userId,
      title: String(req.body?.title || fileName).trim(),
      content: initialContent,
      source_type: sourceType,
      tags,
      source_file_name: fileName,
      ingestion_method: 'file',
      chunks: buildKnowledgeChunks(initialContent),
      ocr_status: isImage ? 'processing' : 'completed',
      ocr_languages: isImage ? ocrLanguages : null,
      created_at: timestamp,
      updated_at: timestamp,
    });

    const sourceId = source.id || source._id?.toString?.();

    if (isImage && sourceId) {
      const jobKey = `${userId}:${sourceId}`;
      if (!activeOcrJobs.has(jobKey)) {
        activeOcrJobs.set(jobKey, (async () => {
          try {
            const content = await extractTextFromBuffer({
              buffer: req.file.buffer,
              mimeType: req.file.mimetype,
              fileName,
              ocrLanguages,
            });

            await store.updateKnowledgeSource(sourceId, userId, {
              content,
              chunks: buildKnowledgeChunks(content),
              ocr_status: content ? 'completed' : 'empty',
              updated_at: nowIso(),
            });
          } catch (error) {
            await store.updateKnowledgeSource(sourceId, userId, {
              ocr_status: 'failed',
              ocr_error: error.message || 'OCR failed',
              updated_at: nowIso(),
            });
          } finally {
            activeOcrJobs.delete(jobKey);
          }
        })());
      }
    }

    res.status(201).json({ ...source, id: source.id || source._id?.toString?.() });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to ingest file' });
  }
});

app.patch('/api/knowledge-sources/:id', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const existing = await store.findKnowledgeSourceById(req.params.id, userId);

  if (!existing) {
    return res.status(404).json({ message: 'Knowledge source not found' });
  }

  const title = String(req.body?.title ?? existing.title).trim();
  const content = String(req.body?.content ?? existing.content).trim();
  const sourceType = String(req.body?.source_type ?? existing.source_type ?? 'text').trim() || 'text';
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : Array.isArray(existing.tags)
    ? existing.tags
    : [];

  const updated = await store.updateKnowledgeSource(req.params.id, userId, {
    title,
    content,
    source_type: sourceType,
    tags,
    chunks: buildKnowledgeChunks(content),
    updated_at: nowIso(),
  });

  res.json({ ...updated, id: updated.id || updated._id?.toString?.() });
});

app.delete('/api/knowledge-sources/:id', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const deleted = await store.deleteKnowledgeSource(req.params.id, userId);

  if (!deleted) {
    return res.status(404).json({ message: 'Knowledge source not found' });
  }

  res.json({ ok: true });
});

app.post('/api/rag/context', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const query = String(req.body?.query || '').trim();

  if (!query) {
    return res.status(400).json({ message: 'Query is required' });
  }

  const knowledgeItems = await store.listKnowledgeSources(userId);
  const context = buildRagContext({ knowledgeItems, query, limit: 6 });
  res.json({ context, count: context ? context.split('\n').length : 0 });
});

app.get('/api/history', authRequired, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const userId = req.user.id || req.user._id.toString();
  const rows = await store.listHistory(
    (row) => String(row.user_id) === String(userId),
    'created_date'
  );

  res.json(rows.slice(0, limit).map((row) => ({ ...row, id: row.id || row._id?.toString?.() })));
});

app.post('/api/history', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const payload = {
    ...req.body,
    user_id: userId,
    user_name: req.user.full_name || req.user.email,
    user_email: req.user.email,
    created_date: nowIso(),
    status: req.body.status || 'completed',
  };

  const row = await store.insertHistory(payload);
  res.status(201).json({ ...row, id: row.id || row._id?.toString?.() });
});

app.patch('/api/history/:id/delete', authRequired, async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  await store.updateHistoryStatus(req.params.id, userId);
  res.json({ ok: true });
});

app.get('/api/superadmin/metrics', superAdminRequired, async (_req, res) => {
  const users = await store.listUsers((user) => user.role !== 'superadmin');
  const rows = await store.listHistory();
  res.json({ users, rows });
});

app.get('/api/superadmin/plans', superAdminRequired, async (_req, res) => {
  const plans = await store.listPlans();
  res.json(plans.map((plan) => ({ ...plan, id: plan.id || plan._id?.toString?.() })));
});

const tryStartMongo = async () => {
  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(dbName);
  store = createMongoStore(db);
  await store.init();
  return client;
};

const start = async () => {
  await tryStartMongo();
  const server = app.listen(port, () => {
    console.log(`Mongo API listening on http://localhost:${port}`);
    console.log(`Using MongoDB at ${mongoUri}`);
    console.log(`\n✓ MongoDB connected successfully!`);
    console.log(`✓ Open MongoDB Compass and connect to: ${mongoUri}`);
    console.log(`✓ Or visit http://localhost:${port} in your browser\n`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Set PORT to a free port before starting the server.`);
      process.exit(1);
    }

    console.error('Failed to start HTTP server', error);
    process.exit(1);
  });
};

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
