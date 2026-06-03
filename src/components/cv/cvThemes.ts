export interface CVTheme {
  fontFamily: string;
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

export function getCVTheme(templateId: string, accentColor: string): CVTheme {
  const ac = /^#[0-9A-Fa-f]{6}$/.test(accentColor) ? accentColor : "#2563eb";

  switch (templateId) {
    case "classic":
      return {
        fontFamily: "'Georgia', 'Times New Roman', serif",
        name: { fontSize: "1.75rem", fontWeight: 700, color: "#1a202c", fontFamily: "'Playfair Display', Georgia, serif" },
        title: { fontSize: "1rem", color: ac, fontStyle: "italic", fontWeight: 400 },
        sectionTitle: { fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: ac },
        body: { fontSize: "0.85rem", color: "#2d3748", lineHeight: 1.6 },
        muted: { fontSize: "0.8rem", color: "#4a5568" },
        card: { background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", borderRadius: "0" },
        tag: { background: "#edf2f7", color: "#2d3748", borderRadius: "3px" },
        contactIcon: { color: "#718096" },
        divider: { borderTop: "1px solid #cbd5e0", margin: "0.75rem 0" },
        container: { background: "#faf9f7" },
        editInput: {},
        editOverlay: "bg-amber-50/30",
      };
    case "minimal":
      return {
        fontFamily: "'Inter', -apple-system, sans-serif",
        name: { fontSize: "1.4rem", fontWeight: 700, color: "#0f172a" },
        title: { fontSize: "0.9rem", color: ac, fontWeight: 400 },
        sectionTitle: { fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: ac },
        body: { fontSize: "0.8rem", color: "#475569", lineHeight: 1.5 },
        muted: { fontSize: "0.75rem", color: "#94a3b8" },
        card: { background: "#fff", boxShadow: "none", borderRadius: "0" },
        tag: { background: "#f1f5f9", color: "#475569", borderRadius: "2px" },
        contactIcon: { color: "#cbd5e1" },
        divider: { borderTop: "1px solid #f1f5f9", margin: "0.5rem 0" },
        container: { background: "#fff" },
        editInput: {},
        editOverlay: "bg-slate-50/30",
      };
    default:
      // modern
      return {
        fontFamily: "'Inter', -apple-system, sans-serif",
        name: { fontSize: "2rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.025em" },
        title: { fontSize: "1.05rem", color: ac, fontWeight: 600 },
        sectionTitle: { fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: ac },
        body: { fontSize: "0.85rem", color: "#334155", lineHeight: 1.6 },
        muted: { fontSize: "0.8rem", color: "#64748b" },
        card: { background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderRadius: "8px" },
        tag: { background: `${ac}15`, color: "#334155", borderRadius: "3px" },
        contactIcon: { color: "#94a3b8" },
        divider: { borderTop: "2px solid #e2e8f0", margin: "1rem 0" },
        container: { background: "#f8fafc" },
        editInput: {},
        editOverlay: "bg-blue-50/30",
      };
  }
}
