export const platforms = [
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Professional thought leadership and business updates",
    optimization: "Prioritize a strong first-line hook, clear professional value, easy-to-scan formatting, credibility, and a comment-worthy closing that encourages discussion without sounding spammy.",
    icon: "linkedin",
    color: "#0A66C2",
    dots: ["#0A66C2", "#4F9CF9", "#9CC9FF"],
    contentTypes: ["Text Only", "Image", "Video", "Text + Image", "Text + Video"],
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "Visual storytelling with caption-led engagement",
    optimization: "Prioritize visual-first storytelling, emotionally clear hooks, short punchy caption flow, save/share value, and a natural CTA that encourages comments, shares, or DMs.",
    icon: "instagram",
    color: "#E1306C",
    dots: ["#E1306C", "#F77737", "#FCAF45"],
    contentTypes: ["Text Only", "Image", "Video", "Text + Image", "Text + Video"],
  },
  {
    id: "facebook",
    label: "Facebook",
    description: "Community updates, campaigns, and conversational posts",
    optimization: "Prioritize relatable storytelling, community-friendly tone, clear context, conversational readability, and engagement prompts that invite reactions and comments.",
    icon: "facebook",
    color: "#1877F2",
    dots: ["#1877F2", "#5FA8FF", "#A8D1FF"],
    contentTypes: ["Text Only", "Image", "Video", "Text + Image", "Text + Video"],
  },
  {
    id: "youtube",
    label: "YouTube",
    description: "Video-first publishing with titles, hooks, and descriptions",
    optimization: "Prioritize curiosity-driven hooks, strong title and description framing, retention-focused opening lines, keyword relevance, and clear viewer action prompts.",
    icon: "youtube",
    color: "#FF0000",
    dots: ["#FF0000", "#FF6666", "#FFB3B3"],
    contentTypes: ["Text Only", "Image", "Video", "Text + Image", "Text + Video"],
  },
  {
    id: "github",
    label: "GitHub",
    description: "Technical launch notes, changelogs, and developer updates",
    optimization: "Prioritize technical clarity, concrete value, concise release communication, scannable structure, and developer trust over hype.",
    icon: "github",
    color: "#E5E7EB",
    dots: ["#E5E7EB", "#9CA3AF", "#6B7280"],
    contentTypes: ["Text Only", "Image", "Text + Image"],
  },
  {
    id: "x",
    label: "X / Twitter",
    description: "Short-form announcements, threads, and live commentary",
    optimization: "Prioritize fast hook density, concise phrasing, repost-worthy insight, thread-friendly momentum, and high signal in the first line.",
    icon: "twitter",
    color: "#F5F5F5",
    dots: ["#F5F5F5", "#A3A3A3", "#525252"],
    contentTypes: ["Text Only", "Image", "Video", "Text + Image"],
  },
  {
    id: "threads",
    label: "Threads",
    description: "Conversational micro-posts and community storytelling",
    optimization: "Prioritize conversational warmth, opinion-led hooks, natural flow, community resonance, and replies over polished corporate language.",
    icon: "message-circle",
    color: "#F8FAFC",
    dots: ["#F8FAFC", "#CBD5E1", "#64748B"],
    contentTypes: ["Text Only", "Image", "Text + Image"],
  },
];

// Backward compatibility for old files still using PERSONAS
export const PERSONAS = platforms;

export function getPersonaById(id) {
  return platforms.find((platform) => platform.id === id) || platforms[0];
}