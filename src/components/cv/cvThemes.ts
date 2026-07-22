import type { ThemeConfig } from "../../types/cv";

export interface CVTheme {
  fontFamily: string;
  headingFont: string;
  name: React.CSSProperties;
  title: React.CSSProperties;
  sectionTitle: React.CSSProperties;
  body: React.CSSProperties;
  muted: React.CSSProperties;
  card: React.CSSProperties;
  tag: React.CSSProperties;
  contactIcon: React.CSSProperties;
  divider: React.CSSProperties;
  container: React.CSSProperties;
  editInput: React.CSSProperties;
  editOverlay: string;
}

function safe(c: string, fallback: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(c) ? c : fallback;
}

export function getCVTheme(config: ThemeConfig): CVTheme {
  const pc = safe(config.primaryColor, "#1e293b");
  const ac = safe(config.accentColor, "#2563eb");
  const tc = safe(config.textColor, "#475569");
  const hf = config.headingFont || "'Inter', -apple-system, sans-serif";
  const bf = config.bodyFont || "'Inter', -apple-system, sans-serif";

  return {
    fontFamily: bf,
    headingFont: hf,
    name: { fontSize: "2rem", fontWeight: 800, color: pc, letterSpacing: "-0.025em", fontFamily: hf },
    title: { fontSize: "1.05rem", color: ac, fontWeight: 600, fontFamily: hf },
    sectionTitle: { fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: ac, fontFamily: hf },
    body: { fontSize: "0.85rem", color: tc, lineHeight: 1.6, fontFamily: bf },
    muted: { fontSize: "0.8rem", color: "#64748b", fontFamily: bf },
    card: { background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderRadius: "8px" },
    tag: { background: `${ac}15`, color: "#334155", borderRadius: "3px", fontFamily: bf },
    contactIcon: { color: "#94a3b8" },
    divider: { borderTop: "2px solid #e2e8f0", margin: "1rem 0" },
    container: { background: "#f8fafc" },
    editInput: {},
    editOverlay: "bg-blue-50/30",
  };
}
