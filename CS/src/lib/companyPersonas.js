const STORAGE_KEY = "companyPersonas";

const PLAN_LIMITS = {
  free: 1,
  pro: 5,
  enterprise: 20,
};

const DEFAULT_PERSONA_LIMIT = 1;

const normalizePlanName = (planName) => String(planName || "free").trim().toLowerCase();

const slugify = (value) =>
  String(value || "persona")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "persona";

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getStorageBucket = () => {
  if (typeof window === "undefined") {
    return {};
  }

  return safeJsonParse(window.localStorage.getItem(STORAGE_KEY), {});
};

const setStorageBucket = (value) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const getPersonaLimitForPlan = (planName) => {
  return PLAN_LIMITS[normalizePlanName(planName)] || DEFAULT_PERSONA_LIMIT;
};

export const getCompanyPersonaStorageKey = (user) => {
  const companyKey = slugify(user?.company || user?.company_name || user?.email || "company");
  const userKey = slugify(user?.id || user?.email || "user");
  return `${companyKey}:${userKey}`;
};

export const getCompanyPersonas = (user) => {
  const bucket = getStorageBucket();
  const key = getCompanyPersonaStorageKey(user);
  return Array.isArray(bucket[key]) ? bucket[key] : [];
};

export const saveCompanyPersonas = (user, personas) => {
  const bucket = getStorageBucket();
  const key = getCompanyPersonaStorageKey(user);
  bucket[key] = personas;
  setStorageBucket(bucket);
  return bucket[key];
};

export const buildPersonaAnalysis = ({ name, company, tagline, audience, voice, goals, notes }) => {
  const parts = [
    `${name} represents ${company || "the company"}.`,
    tagline ? `Brand tagline: ${tagline}.` : null,
    audience ? `Primary audience: ${audience}.` : null,
    voice ? `Voice and tone: ${voice}.` : null,
    goals ? `Content goals: ${goals}.` : null,
    notes ? `Additional guidance: ${notes}.` : null,
  ].filter(Boolean);

  return parts.join(" ");
};

export const createCompanyPersona = ({ user, values, planName }) => {
  const existing = getCompanyPersonas(user);
  const limit = getPersonaLimitForPlan(planName);

  if (existing.length >= limit) {
    throw new Error(`Your ${planName || "current"} plan allows up to ${limit} company persona${limit > 1 ? "s" : ""}.`);
  }

  const timestamp = new Date().toISOString();
  const persona = {
    id: `${slugify(values.name)}-${Date.now()}`,
    name: values.name.trim(),
    company: values.company.trim(),
    tagline: values.tagline.trim(),
    logoUrl: values.logoUrl.trim(),
    audience: values.audience.trim(),
    voice: values.voice.trim(),
    goals: values.goals.trim(),
    notes: values.notes.trim(),
    analysis: buildPersonaAnalysis(values),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  saveCompanyPersonas(user, [...existing, persona]);
  return persona;
};

export const updateCompanyPersona = ({ user, personaId, values }) => {
  const existing = getCompanyPersonas(user);
  const next = existing.map((persona) => {
    if (persona.id !== personaId) {
      return persona;
    }

    return {
      ...persona,
      ...values,
      analysis: buildPersonaAnalysis(values),
      updatedAt: new Date().toISOString(),
    };
  });

  saveCompanyPersonas(user, next);
  return next.find((persona) => persona.id === personaId) || null;
};