import { useEffect, useState } from "react";
import {
  createPlan,
  createTenant,
  createTenantPayment,
  createTenantPayout,
  getAccessToken,
  getDashboardOverview,
  getSettings,
  getTenant,
  getTenantPayments,
  getTenantStats,
  getTenantSubscription,
  getSubscriptionsOverview,
  getUsers,
  listPayouts,
  listPlans,
  listTenants,
  login as apiLogin,
  logout as apiLogout,
  setAccessToken,
  updatePlan,
  updateTenant,
  updateSettings,
  updateTenantPayment,
  updateTenantPayout,
  updateTenantSubscription,
  whoami,
} from "./api/client";

// ─── TOKENS ──────────────────────────────────────────────
const T = {
  bg:        "#080B12",
  surface:   "#0E1120",
  card:      "#131729",
  cardHover: "#181E32",
  border:    "#1E2540",
  borderHi:  "#2A3560",
  lime:      "#A3E635",
  limeDim:   "#6BA31F",
  limeSoft:  "#A3E63514",
  text:      "#F0F2FA",
  muted:     "#5A6280",
  mutedHi:   "#8892B0",
  success:   "#34D399",
  warning:   "#F5A623",
  danger:    "#F25C5C",
  info:      "#60A5FA",
};

/** Mistura um hex com branco em `percent`% — usado só pra derivar a
 * hierarquia de superfícies (surface/card/border) a partir do "Fundo"
 * escolhido, sem precisar de conversão HSL. */
function lighten(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  const mix = (c) => Math.round(c + (255 - c) * (percent / 100));
  const toHex = (c) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/**
 * Re-temeia o painel inteiro a partir das configurações da plataforma —
 * muta os tokens compartilhados em vez de introduzir Context (T é lido
 * direto por todo componente do arquivo). Só bg/acento são configuráveis
 * de propósito (ver admin-desenvolvain.md) — o resto da paleta fica fixo,
 * mas surface/card/border precisam ser DERIVADOS do bg (não só o bg em si),
 * senão Sidebar/TopBar (que usam T.surface, não T.bg) não mudam de cor.
 */
function applyTheme(settings) {
  if (!settings) return;
  T.surface = lighten(settings.bgColor, 6);
  T.card = lighten(settings.bgColor, 10);
  T.cardHover = lighten(settings.bgColor, 14);
  T.border = lighten(settings.bgColor, 18);
  T.borderHi = lighten(settings.bgColor, 24);
  T.bg = settings.bgColor;
  T.lime = settings.accentColor;
  T.limeSoft = settings.accentColor + "14";
}

// ─── MICRO COMPONENTS ────────────────────────────────────
const Badge = ({ color, children, small }) => (
  <span style={{
    background: color + "20", color, border: `1px solid ${color}40`,
    borderRadius: 4, padding: small ? "1px 6px" : "2px 8px",
    fontSize: small ? 10 : 11, fontWeight: 700,
    letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap"
  }}>{children}</span>
);

const Avatar = ({ name, size = 32, color }) => {
  const c = color || T.lime;
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: c + "18", border: `1.5px solid ${c}40`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 800, color: c, flexShrink: 0,
      letterSpacing: "-0.02em"
    }}>{initials}</div>
  );
};

const Stat = ({ label, value, sub, trend, accent }) => {
  const c = accent || T.lime;
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "18px 22px", flex: 1, minWidth: 140,
      position: "relative", overflow: "hidden"
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: c + "60", borderRadius: "12px 12px 0 0" }} />
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: c, lineHeight: 1, marginBottom: 6, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: trend === "up" ? T.success : trend === "down" ? T.danger : T.muted }}>
        {trend === "up" ? "↑ " : trend === "down" ? "↓ " : ""}{sub}
      </div>}
    </div>
  );
};

const Btn = ({ children, onClick, variant = "primary", size = "md", disabled = false }) => {
  const pad = size === "sm" ? "6px 14px" : "10px 20px";
  const fs = size === "sm" ? 12 : 13;
  const styles = {
    primary: { background: T.lime, color: T.bg, border: "none" },
    ghost:   { background: "transparent", color: T.lime, border: `1px solid ${T.lime}55` },
    danger:  { background: T.danger + "18", color: T.danger, border: `1px solid ${T.danger}44` },
  };
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      ...styles[variant], padding: pad, borderRadius: 8, fontSize: fs,
      fontWeight: 700, cursor: disabled ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6,
      opacity: disabled ? 0.6 : 1,
    }}>{children}</div>
  );
};

const ErrorBox = ({ children }) => (
  <div style={{ background: T.danger + "18", border: `1px solid ${T.danger}44`, borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: T.danger }}>
    {children}
  </div>
);

const Input = ({ label, value, onChange, placeholder, type = "text", error }) => (
  <div>
    {label && (
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}{error && <span style={{ color: T.danger }}> *</span>}
      </div>
    )}
    <input value={value} onChange={onChange} placeholder={placeholder} type={type}
      style={{ width: "100%", background: T.surface, border: `1px solid ${error ? T.danger : T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
    {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 5 }}>{error}</div>}
  </div>
);

const Select = ({ label, value, onChange, options, error, disabled = false }) => (
  <div>
    {label && (
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}{error && <span style={{ color: T.danger }}> *</span>}
      </div>
    )}
    <select value={value} onChange={onChange} disabled={disabled}
      style={{ width: "100%", background: T.surface, border: `1px solid ${error ? T.danger : T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", opacity: disabled ? 0.6 : 1 }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 5 }}>{error}</div>}
  </div>
);

// Card usado como alternativa à linha de tabela no celular — mesmo cartão
// visual em qualquer tela que precise de uma versão empilhada.
const MobileCard = ({ children }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
    {children}
  </div>
);

// Abaixo do breakpoint, troca a tabela por `mobileRows` (lista de MobileCard)
// quando informado — evita depender só de scroll horizontal pra alcançar
// coluna cortada. Telas que ainda não passaram por esse tratamento caem no
// scroll horizontal de sempre (overflowX), que já é estritamente melhor que
// cortar a coluna.
const Table = ({ cols, rows, mobileRows }) => {
  const isMobile = useIsMobile();

  if (isMobile && mobileRows) {
    return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{mobileRows}</div>;
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {cols.map(c => (
              <th key={c} style={{ padding: "11px 20px", textAlign: "left", fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
};

const TRow = ({ cells, last }) => (
  <tr style={{ borderBottom: last ? "none" : `1px solid ${T.border}22`, cursor: "pointer" }}>
    {cells.map((c, i) => (
      <td key={i} style={{ padding: "13px 20px" }}>{c}</td>
    ))}
  </tr>
);

// ─── LOGIN ───────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (e) {
      setError(e.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ width: 360, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: T.lime + "18", border: `1.5px solid ${T.lime}50`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 20 }}>✂</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: T.lime, letterSpacing: "0.06em" }}>DESENVOLVA IN</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Painel Master · Incubadora</div>
        </div>
        {error && <div style={{ marginBottom: 14 }}><ErrorBox>{error}</ErrorBox></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
          <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Senha</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>
        </div>
        <div onClick={loading ? undefined : submit} style={{ background: T.lime, borderRadius: 8, padding: "12px", textAlign: "center", fontSize: 13, fontWeight: 800, color: T.bg, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Entrando..." : "Entrar"}
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────
const NAV = [
  { section: null, items: [{ id: "dashboard", icon: "⊞", label: "Dashboard" }] },
  {
    section: "Gestão",
    items: [
      { id: "barbearias", icon: "◉", label: "Barbearias" },
      { id: "onboarding", icon: "+", label: "Nova Barbearia" },
      { id: "planos", icon: "💳", label: "Planos & Preços" },
      { id: "assinaturas", icon: "♾", label: "Assinaturas" },
    ],
  },
  {
    section: "Financeiro",
    items: [
      { id: "financeiro", icon: "💰", label: "Financeiro" },
      { id: "repasses", icon: "🔁", label: "Repasses" },
    ],
  },
  {
    section: "Plataforma",
    items: [
      { id: "suporte", icon: "💬", label: "Suporte" },
      { id: "releases", icon: "⚡", label: "Releases" },
    ],
  },
  { section: null, items: [{ id: "config", icon: "⚙", label: "Configurações" }] },
];

// Abaixo do breakpoint, a sidebar fixa não cabe — vira menu retrátil
// (hambúrguer), aberto por cima do conteúdo em vez de dividir a largura
// da tela com ele. Mesma técnica usada no painel-barbearia e cliente-app.
function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return isMobile;
}

const Sidebar = ({ active, setActive, user, onLogout, isMobile, open, onClose }) => {
  // No celular, escolher uma página fecha o menu — igual qualquer drawer mobile.
  const selectPage = (id) => {
    setActive(id);
    if (isMobile) onClose?.();
  };

  if (isMobile && !open) return null;

  return (
    <>
      {isMobile && (
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "#000000AA", zIndex: 40 }}
        />
      )}
      <div style={{
        width: isMobile ? "min(260px, 82vw)" : 236,
        background: T.surface, borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column", flexShrink: 0,
        height: "100vh", overflowY: "auto",
        ...(isMobile
          ? { position: "fixed", top: 0, left: 0, zIndex: 50, boxShadow: "4px 0 24px #00000080" }
          : {}),
      }}>
        {/* Marca */}
        <div style={{ padding: "28px 22px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.lime + "18", border: `1.5px solid ${T.lime}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✂</div>
            <div>
              <div style={{ fontSize: 13, color: T.lime, fontWeight: 900, letterSpacing: "0.06em" }}>DESENVOLVA IN</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>Painel Master · Incubadora</div>
            </div>
          </div>
          {isMobile && (
            <span onClick={onClose} style={{ fontSize: 16, color: T.muted, cursor: "pointer", padding: 4 }}>✕</span>
          )}
        </div>

        <div style={{ flex: 1 }}>
          {NAV.map((sec, si) => (
            <div key={si}>
              {sec.section && (
                <div style={{ padding: "14px 22px 6px", fontSize: 10, color: T.text, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{sec.section}</div>
              )}
              {sec.items.map(item => {
                const on = active === item.id;
                return (
                  <div key={item.id} onClick={() => selectPage(item.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 22px",
                    cursor: "pointer",
                    borderLeft: on ? `2px solid ${T.lime}` : "2px solid transparent",
                    background: on ? T.limeSoft : "transparent",
                    color: on ? T.lime : T.text, fontSize: 13, fontWeight: on ? 600 : 400,
                    transition: "all 0.12s"
                  }}>
                    <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                    {item.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: "20px 22px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Avatar name={user?.email || "Super Admin"} size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
              <div style={{ fontSize: 10, color: T.muted }}>Super Admin</div>
            </div>
          </div>
          <div onClick={onLogout} style={{ fontSize: 11, color: T.muted, cursor: "pointer" }}>Sair</div>
        </div>
      </div>
    </>
  );
};

// ────────────────────────────────────────────────────────
// TELA: DASHBOARD
// ────────────────────────────────────────────────────────
/**
 * Fatias de um gráfico de pizza SVG (raio 80, viewBox 200x200) a partir de
 * [{planCode, planName, count}]. Caso especial: 1 única fatia preenchendo
 * 100% vira círculo cheio — um arco SVG entre ângulo inicial e final
 * idênticos (volta completa) não desenha nada.
 */
function buildPieSlices(data) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return [];
  const palette = [T.lime, T.info, T.mutedHi, T.warning, T.danger];

  if (data.length === 1) {
    return [{ ...data[0], color: palette[0], fullCircle: true }];
  }

  let angle = 0;
  const toPoint = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [100 + 80 * Math.cos(rad), 100 + 80 * Math.sin(rad)];
  };

  return data.map((d, i) => {
    const startAngle = angle;
    const endAngle = angle + (d.count / total) * 360;
    angle = endAngle;
    const [x1, y1] = toPoint(startAngle);
    const [x2, y2] = toPoint(endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const path = `M100,100 L${x1.toFixed(2)},${y1.toFixed(2)} A80,80 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    return { ...d, color: palette[i % palette.length], path };
  });
}

const Dashboard = ({ setActive }) => {
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardOverview(), listTenants()])
      .then(([ov, tenantsRes]) => {
        setOverview(ov);
        setTenants(
          [...tenantsRes.items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const slices = overview ? buildPieSlices(overview.tenantsByPlan) : [];
  const totalBarbearias = overview ? overview.tenantsByPlan.reduce((sum, p) => sum + p.count, 0) : 0;

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text, letterSpacing: "-0.02em" }}>Visão Geral</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Plataforma Barberaria</div>
        </div>
        <Btn variant="ghost" size="sm" onClick={() => setActive("usuarios")}>Ir para Barbearias →</Btn>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <Stat
          label="Barbearias"
          value={overview ? String(overview.tenants.total) : "…"}
          sub={overview ? `${overview.tenants.active} ativas · ${overview.tenants.suspended} suspensas` : undefined}
        />
        <Stat label="MRR (assinaturas ativas)" value={overview ? formatMoney(overview.mrrCents) : "…"} />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {/* Barbearias por Plano */}
        <div style={{ flex: 1, minWidth: 320, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Barbearias por Plano</div>
          {loading ? (
            <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
          ) : slices.length === 0 ? (
            <div style={{ fontSize: 12, color: T.muted }}>Nenhuma barbearia com assinatura ainda.</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <svg width={200} height={200} viewBox="0 0 200 200" role="img" aria-label="Gráfico de pizza: distribuição de barbearias por plano">
                {slices.map((s) =>
                  s.fullCircle ? (
                    <circle key={s.planCode} cx={100} cy={100} r={80} fill={s.color} />
                  ) : (
                    <path key={s.planCode} d={s.path} fill={s.color} />
                  ),
                )}
                <circle cx={100} cy={100} r={46} fill={T.card} />
                <text x={100} y={96} textAnchor="middle" fill={T.text} fontSize={22} fontWeight={900}>{totalBarbearias}</text>
                <text x={100} y={114} textAnchor="middle" fill={T.muted} fontSize={10}>barbearias</text>
              </svg>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {slices.map((s) => (
                  <div key={s.planCode} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.text }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
                    {s.planName} — {s.count}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabela de barbearias */}
        <div style={{ flex: 2, minWidth: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Barbearias mais recentes</div>
            <Btn variant="ghost" size="sm" onClick={() => setActive("onboarding")}>+ Nova</Btn>
          </div>
          {loading ? (
            <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
          ) : (
            <Table
              cols={["Barbearia", "Identificador", "Criada em", "Status"]}
              rows={tenants.map((t, i) => {
                const badge = statusBadge(t.status);
                return (
                  <TRow key={t.id} last={i === tenants.length - 1} cells={[
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={t.name} size={28} />
                      <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.name}</div>
                    </div>,
                    <span style={{ fontSize: 13, color: T.muted }}>{t.slug}</span>,
                    <span style={{ fontSize: 13, color: T.muted }}>{formatDate(t.createdAt)}</span>,
                    <Badge color={badge.color}>{badge.label}</Badge>,
                  ]} />
                );
              })}
              mobileRows={tenants.map((t) => {
                const badge = statusBadge(t.status);
                return (
                  <MobileCard key={t.id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={t.name} size={28} />
                        <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.name}</span>
                      </div>
                      <Badge color={badge.color}>{badge.label}</Badge>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.muted }}>
                      <span>{t.slug}</span>
                      <span>{formatDate(t.createdAt)}</span>
                    </div>
                  </MobileCard>
                );
              })}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: BARBEARIAS (gestão detalhada)
// ────────────────────────────────────────────────────────
const formatDate = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const formatMoney = (cents) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const statusBadge = (status) => ({
  color: status === "active" ? T.success : T.danger,
  label: status === "active" ? "ativo" : "suspenso",
});

const Barbearias = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [busca, setBusca] = useState("");
  const [acting, setActing] = useState(false);

  const load = () =>
    listTenants()
      .then((res) => setTenants(res.items))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selecionada) { setDetalhe(null); return; }
    getTenant(selecionada).then(setDetalhe);
  }, [selecionada]);

  const toggleStatus = async () => {
    if (!detalhe) return;
    setActing(true);
    try {
      const novoStatus = detalhe.status === "active" ? "suspended" : "active";
      const atualizado = await updateTenant(detalhe.id, { status: novoStatus });
      setDetalhe(atualizado);
      await load();
    } finally {
      setActing(false);
    }
  };

  const filtrados = tenants.filter((t) => t.name.toLowerCase().includes(busca.trim().toLowerCase()));

  if (selecionada) {
    if (!detalhe) {
      return <div style={{ padding: 32, color: T.muted, fontSize: 12 }}>Carregando…</div>;
    }
    const badge = statusBadge(detalhe.status);
    return (
      <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div onClick={() => setSelecionada(null)} style={{ fontSize: 13, color: T.lime, cursor: "pointer" }}>← Barbearias</div>
          <span style={{ color: T.muted }}>/</span>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{detalhe.name}</div>
        </div>
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <Stat label="MRR" value="—" sub="chega no Sprint 6" />
          <Stat label="Agendamentos" value="—" sub="chega no Sprint 2" />
          <Stat label="Barbeiros" value="—" sub="chega no Sprint 2" />
          <Stat label="Status" value={badge.label} accent={badge.color} />
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>Dados da barbearia</div>
            {[
              ["Identificador", `${detalhe.slug}.barberaria.app`],
              ["Plano", "— (Sprint 4)"],
              ["Status", badge.label],
              ["Criada em", formatDate(detalhe.createdAt)],
              ["Cor primária", detalhe.primaryColor || "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.border}22` }}>
                <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
                <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
            <div title="Chega no Sprint 7" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.45, cursor: "not-allowed" }}>
              <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>Acessar como admin</span>
              <span style={{ color: T.muted, fontSize: 11 }}>em breve</span>
            </div>
            <div title="Chega no Sprint 4/5" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.45, cursor: "not-allowed" }}>
              <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>Alterar plano</span>
              <span style={{ color: T.muted, fontSize: 11 }}>em breve</span>
            </div>
            <div onClick={acting ? undefined : toggleStatus} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: acting ? "default" : "pointer", opacity: acting ? 0.6 : 1 }}>
              <span style={{ fontSize: 13, color: T.danger, fontWeight: 600 }}>{detalhe.status === "active" ? "Suspender acesso" : "Reativar acesso"}</span>
              <span style={{ color: T.muted, fontSize: 16 }}>→</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Barbearias</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{tenants.length} instâncias · {tenants.filter(t => t.status === "active").length} ativas</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", color: T.text, fontSize: 13, outline: "none", width: 200 }} />
        </div>
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div style={{ fontSize: 12, color: T.muted }}>Nenhuma barbearia cadastrada ainda.</div>
      ) : (
        <Table
          cols={["Barbearia", "Identificador", "Criada em", "Status", ""]}
          rows={filtrados.map((t, i) => {
            const badge = statusBadge(t.status);
            return (
              <TRow key={t.id} last={i === filtrados.length - 1} cells={[
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={t.name} size={30} />
                  <div>
                    <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>{t.slug}.barberaria.app</div>
                  </div>
                </div>,
                <span style={{ fontSize: 13, color: T.muted }}>{t.slug}</span>,
                <span style={{ fontSize: 13, color: T.muted }}>{formatDate(t.createdAt)}</span>,
                <Badge color={badge.color}>{badge.label}</Badge>,
                <span onClick={() => setSelecionada(t.id)} style={{ fontSize: 12, color: T.lime, cursor: "pointer", fontWeight: 600 }}>Ver detalhes</span>,
              ]} />
            );
          })}
          mobileRows={filtrados.map((t) => {
            const badge = statusBadge(t.status);
            return (
              <MobileCard key={t.id}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={t.name} size={30} />
                    <div>
                      <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: T.muted }}>{t.slug}.barberaria.app</div>
                    </div>
                  </div>
                  <Badge color={badge.color}>{badge.label}</Badge>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>Criada em {formatDate(t.createdAt)}</div>
                <span onClick={() => setSelecionada(t.id)} style={{ fontSize: 12, color: T.lime, cursor: "pointer", fontWeight: 600 }}>Ver detalhes</span>
              </MobileCard>
            );
          })}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: ONBOARDING (nova barbearia)
// ────────────────────────────────────────────────────────
const LOGO_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/** Todo campo do passo 1 é obrigatório — e-mail precisa seguir o padrão
 * nome@dominio.tld. Usado tanto pra bloquear avanço de tela quanto pra
 * mostrar a mensagem certa embaixo de cada campo. */
function getStep1Errors(form, planosDisponiveis) {
  const errors = {};
  if (!form.nome.trim()) errors.nome = "Obrigatório.";
  if (!form.slug.trim()) errors.slug = "Obrigatório.";
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug) || form.slug.length < 2) {
    errors.slug = "Minúsculo, alfanumérico, com hífens entre segmentos.";
  }
  if (!form.adminNome.trim()) errors.adminNome = "Obrigatório.";
  if (!form.contato.trim()) errors.contato = "Obrigatório.";
  else if (!EMAIL_REGEX.test(form.contato)) errors.contato = "E-mail inválido — use o formato nome@dominio.com.";
  if (!form.adminSenha) errors.adminSenha = "Obrigatório.";
  else if (form.adminSenha.length < 8) errors.adminSenha = "Mínimo 8 caracteres.";
  if (planosDisponiveis && !form.planId) errors.planId = "Escolha um plano.";
  return errors;
}

function getStep2Errors(form) {
  const errors = {};
  if (!HEX_COLOR_REGEX.test(form.cor1)) errors.cor1 = "Cor inválida — formato #RRGGBB.";
  if (!HEX_COLOR_REGEX.test(form.cor2)) errors.cor2 = "Cor inválida — formato #RRGGBB.";
  return errors;
}

const Onboarding = ({ setActive }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nome: "", slug: "", planId: "", cor1: "#C9A84C", cor2: "#0F0F0F", contato: "", adminNome: "", adminSenha: "" });
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [logoError, setLogoError] = useState("");
  const [attempted, setAttempted] = useState({});
  const STEPS = ["Dados", "Identidade", "Módulos", "Confirmar"];

  const stepErrors = {
    1: getStep1Errors(form, planos.length > 0),
    2: getStep2Errors(form),
    3: {},
    4: {},
  };
  const isStepValid = (n) => Object.keys(stepErrors[n] || {}).length === 0;
  const canReachStep = (n) => {
    for (let s = 1; s < n; s += 1) if (!isStepValid(s)) return false;
    return true;
  };

  const goToStep = (target) => {
    if (target <= step) { setStep(target); return; }
    if (canReachStep(target)) {
      setStep(target);
    } else {
      setAttempted((a) => ({ ...a, [step]: true }));
    }
  };

  useEffect(() => {
    if (!logoFile) { setLogoPreviewUrl(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError("");
    if (!LOGO_ACCEPTED_TYPES.includes(file.type)) {
      setLogoError("Formato não suportado — use PNG, JPG/JPEG ou SVG.");
      e.target.value = "";
      return;
    }
    if (file.size > LOGO_MAX_SIZE_BYTES) {
      setLogoError("Arquivo muito grande (máximo 2MB).");
      e.target.value = "";
      return;
    }
    setLogoFile(file);
  };

  useEffect(() => {
    listPlans()
      .then((res) => {
        const ativos = res.items.filter((p) => p.active);
        setPlanos(ativos);
        if (ativos.length > 0) setForm((f) => ({ ...f, planId: ativos[0].id }));
      })
      .finally(() => setLoadingPlanos(false));
  }, []);

  const planoEscolhido = planos.find((p) => p.id === form.planId);

  const criarBarbearia = async () => {
    setError("");
    if (!isStepValid(1) || !isStepValid(2)) {
      setError("Existem campos obrigatórios não preenchidos — volte e confira os passos anteriores.");
      return;
    }
    setSaving(true);
    try {
      await createTenant({
        slug: form.slug,
        name: form.nome,
        primaryColor: form.cor1 || undefined,
        secondaryColor: form.cor2 || undefined,
        admin: { name: form.adminNome, email: form.contato, password: form.adminSenha },
        planId: form.planId,
      });
      setActive("barbearias");
    } catch (e) {
      setError(e.message || "Não foi possível criar a barbearia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Nova Barbearia</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Provisionar nova instância White Label</div>
      </div>

      {/* Step bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
        {STEPS.map((s, i) => {
          const reachable = canReachStep(i + 1);
          return (
            <div key={s} onClick={() => goToStep(i + 1)} style={{
              flex: 1, padding: "12px 16px", textAlign: "center", cursor: reachable ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600,
              borderRight: i < 3 ? `1px solid ${T.border}` : "none",
              background: step === i + 1 ? T.lime + "14" : "transparent",
              color: step > i + 1 ? T.success : step === i + 1 ? T.lime : reachable ? T.muted : T.muted + "77",
            }}>
              {step > i + 1 ? "✓ " : `0${i + 1}. `}{s}
            </div>
          );
        })}
      </div>

      <div style={{ maxWidth: 640 }}>
        {step === 1 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
            <Input label="Nome da barbearia" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Barberaria"
              error={attempted[1] ? stepErrors[1].nome : undefined} />
            <div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Slug (URL){attempted[1] && stepErrors[1].slug && <span style={{ color: T.danger }}> *</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", background: T.surface, border: `1px solid ${attempted[1] && stepErrors[1].slug ? T.danger : T.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: T.border, fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>barberaria.app/</div>
                <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="nomedabarbearia" style={{ flex: 1, background: "transparent", border: "none", padding: "10px 14px", color: T.text, fontSize: 13, outline: "none" }} />
              </div>
              {attempted[1] && stepErrors[1].slug && <div style={{ fontSize: 11, color: T.danger, marginTop: 5 }}>{stepErrors[1].slug}</div>}
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Input label="Nome do administrador" value={form.adminNome} onChange={e => setForm(f => ({ ...f, adminNome: e.target.value }))} placeholder="Ex: Victor Mendes"
                  error={attempted[1] ? stepErrors[1].adminNome : undefined} />
              </div>
              <div style={{ flex: 1 }}>
                <Input label="E-mail do administrador" value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="admin@barbearia.com"
                  error={attempted[1] ? stepErrors[1].contato : undefined} />
              </div>
            </div>
            <Input label="Senha inicial do administrador" type="password" value={form.adminSenha} onChange={e => setForm(f => ({ ...f, adminSenha: e.target.value }))} placeholder="mínimo 8 caracteres"
              error={attempted[1] ? stepErrors[1].adminSenha : undefined} />
            {loadingPlanos ? (
              <div style={{ fontSize: 12, color: T.muted }}>Carregando planos…</div>
            ) : planos.length === 0 ? (
              <ErrorBox>Nenhum plano ativo cadastrado ainda — cadastre em Planos & Preços antes de criar uma barbearia.</ErrorBox>
            ) : (
              <Select label="Plano inicial" value={form.planId} onChange={e => setForm(f => ({ ...f, planId: e.target.value }))}
                options={planos.map((p) => ({ value: p.id, label: `${p.name} — ${p.priceCents != null ? `R$ ${(p.priceCents / 100).toFixed(2).replace(".", ",")}/mês` : "negociado"}` }))}
                error={attempted[1] ? stepErrors[1].planId : undefined} />
            )}
          </div>
        )}

        {step === 2 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            <label style={{ background: T.surface, border: `2px dashed ${T.border}`, borderRadius: 10, padding: 32, textAlign: "center", cursor: "pointer", display: "block" }}>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoChange}
                style={{ display: "none" }}
              />
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Preview do logotipo" style={{ maxHeight: 56, maxWidth: "100%", marginBottom: 8, borderRadius: 6 }} />
              ) : (
                <div style={{ fontSize: 32, marginBottom: 8 }}>✂</div>
              )}
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>{logoFile ? logoFile.name : "Logotipo da barbearia"}</div>
              <div style={{ fontSize: 11, color: T.lime }}>{logoFile ? "Trocar arquivo" : "Selecionar arquivo (PNG, JPG ou SVG)"}</div>
              {logoError && <div style={{ fontSize: 11, color: T.danger, marginTop: 8 }}>{logoError}</div>}
            </label>
            {logoFile && (
              <div style={{ fontSize: 11, color: T.muted, marginTop: -12 }}>
                O upload de verdade (armazenamento na nuvem) ainda não está implementado — por enquanto isso só confirma o arquivo antes de criar a barbearia.
              </div>
            )}
            <div style={{ display: "flex", gap: 16 }}>
              {[["Cor primária", "cor1"], ["Cor de fundo", "cor2"]].map(([label, key]) => {
                const fieldError = attempted[2] ? stepErrors[2][key] : undefined;
                return (
                  <div key={key} style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {label}{fieldError && <span style={{ color: T.danger }}> *</span>}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(form[key]) ? form[key] : "#000000"}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width: 36, height: 36, borderRadius: 6, border: `1px solid ${T.border}`, flexShrink: 0, cursor: "pointer", padding: 0, background: "transparent" }}
                      />
                      <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ flex: 1, background: T.surface, border: `1px solid ${fieldError ? T.danger : T.border}`, borderRadius: 8, padding: "10px 12px", color: T.text, fontSize: 13, outline: "none" }} />
                    </div>
                    {fieldError && <div style={{ fontSize: 11, color: T.danger, marginTop: 5 }}>{fieldError}</div>}
                  </div>
                );
              })}
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Preview do tema</div>
              <div style={{ background: form.cor2, borderRadius: 10, padding: 20, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: form.cor1, marginBottom: 10, letterSpacing: "0.06em" }}>{form.nome || "NOME DA BARBEARIA"}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ background: form.cor1, borderRadius: 6, padding: "7px 16px", fontSize: 12, color: form.cor2, fontWeight: 700, cursor: "pointer" }}>Agendar</div>
                  <div style={{ border: `1px solid ${form.cor1}`, borderRadius: 6, padding: "7px 16px", fontSize: 12, color: form.cor1, cursor: "pointer" }}>Serviços</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28 }}>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>
              Módulos incluídos no plano {planoEscolhido ? <Badge color={T.lime}>{planoEscolhido.name}</Badge> : "—"}
            </div>
            <div style={{ background: T.surface, borderRadius: 8, padding: 12, marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
              <span>ℹ</span>
              <div style={{ fontSize: 12, color: T.mutedHi }}>
                O módulo vem do plano escolhido no passo 1 — pra mudar, ajuste o plano em <strong style={{ color: T.text }}>Planos & Preços</strong>.
                Core sempre ativo: <strong style={{ color: T.text }}>{PLAN_CORE_MODULES.join(" · ")}</strong>.
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[...PLAN_CORE_MODULES, ...(planoEscolhido?.modules || [])].map((m) => (
                <div key={m} style={{
                  padding: "12px 14px", borderRadius: 10,
                  border: `1.5px solid ${T.lime}`, background: T.limeSoft,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 12, color: T.lime, fontWeight: 600 }}>{m}</span>
                  <span style={{ color: T.lime, fontSize: 14 }}>✓</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: T.surface, borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Resumo</div>
              {[
                ["Nome", form.nome || "—"],
                ["URL", `${form.slug || "—"}.barberaria.app`],
                ["Plano", planoEscolhido?.name || "—"],
                ["Admin", `${form.adminNome || "—"} · ${form.contato || "—"}`],
                ["Módulos ativos", `${PLAN_CORE_MODULES.length + (planoEscolhido?.modules?.length || 0)} módulos`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.border}22` }}>
                  <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
                  <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <div onClick={saving ? undefined : criarBarbearia} style={{ background: T.lime, borderRadius: 8, padding: "12px 20px", textAlign: "center", cursor: saving ? "default" : "pointer", fontSize: 14, fontWeight: 800, color: T.bg, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Criando..." : "Criar Barbearia"}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <Btn variant="ghost" size="sm" onClick={() => goToStep(Math.max(1, step - 1))}>← Anterior</Btn>
          {step < 4 && <Btn size="sm" onClick={() => goToStep(step + 1)}>Próximo →</Btn>}
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: PLANOS & PREÇOS
// ────────────────────────────────────────────────────────
const PLAN_CODES = ["trial", "pro", "enterprise"];
const PLAN_COLOR = { trial: T.muted, pro: T.lime, enterprise: T.warning };
const PLAN_CORE_MODULES = ["Agendamento", "CRM Básico"];
const PLAN_OPTIONAL_MODULES = ["Comissões", "Assinaturas", "Clube de Clientes", "Venda de Produtos", "Dashboard Avançado", "WhatsApp/SMS", "Marketing", "Estoque"];

const emptyPlanForm = { code: "", name: "", priceReais: "", limitLabel: "", modules: [], active: true };

const Planos = () => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | id
  const [form, setForm] = useState(emptyPlanForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    listPlans()
      .then((res) => setPlanos(res.items))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const codigosDisponiveis = PLAN_CODES.filter((c) => !planos.some((p) => p.code === c));

  const startNew = () => {
    setForm({ ...emptyPlanForm, code: codigosDisponiveis[0] || "" });
    setError("");
    setEditing("new");
  };
  const startEdit = (p) => {
    setForm({
      code: p.code,
      name: p.name,
      priceReais: p.priceCents != null ? (p.priceCents / 100).toFixed(2).replace(".", ",") : "",
      limitLabel: p.limitLabel || "",
      modules: p.modules || [],
      active: p.active,
    });
    setError("");
    setEditing(p.id);
  };

  const toggleModulo = (m) =>
    setForm((f) => ({ ...f, modules: f.modules.includes(m) ? f.modules.filter((x) => x !== m) : [...f.modules, m] }));

  const save = async () => {
    setError("");
    if (!form.name || form.name.length < 2) { setError("Nome é obrigatório."); return; }
    let priceCents;
    if (form.priceReais.trim() !== "") {
      priceCents = Math.round(parseFloat(form.priceReais.replace(",", ".")) * 100);
      if (Number.isNaN(priceCents) || priceCents < 0) { setError("Preço inválido."); return; }
    }

    setSaving(true);
    try {
      if (editing === "new") {
        await createPlan({ code: form.code, name: form.name, priceCents, limitLabel: form.limitLabel || undefined, modules: form.modules, active: form.active });
      } else {
        await updatePlan(editing, { name: form.name, priceCents: priceCents ?? null, limitLabel: form.limitLabel || undefined, modules: form.modules, active: form.active });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const planosOrdenados = [...planos].sort((a, b) => PLAN_CODES.indexOf(a.code) - PLAN_CODES.indexOf(b.code));

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Planos & Preços</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Estrutura comercial da plataforma</div>
        </div>
        {codigosDisponiveis.length > 0 ? (
          <Btn size="sm" onClick={startNew}>+ Novo plano</Btn>
        ) : (
          <span style={{ fontSize: 11, color: T.muted }}>Os 3 planos já foram cadastrados</span>
        )}
      </div>

      {editing !== null && (
        <div style={{ background: T.card, border: `1.5px solid ${T.lime}55`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.lime, marginBottom: 16 }}>
            {editing === "new" ? "Novo Plano" : `Editar Plano · ${form.code}`}
          </div>
          {error && <div style={{ marginBottom: 14 }}><ErrorBox>{error}</ErrorBox></div>}
          <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
            {editing === "new" && (
              <div style={{ flex: 1, minWidth: 160 }}>
                <Select
                  label="Código"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  options={codigosDisponiveis.map((c) => ({ value: c, label: c }))}
                />
              </div>
            )}
            <div style={{ flex: 2, minWidth: 200 }}>
              <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Pro" />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Input label="Preço mensal (R$, vazio = negociado)" value={form.priceReais} onChange={(e) => setForm((f) => ({ ...f, priceReais: e.target.value }))} placeholder="299,00" />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Input label="Limite (texto livre)" value={form.limitLabel} onChange={(e) => setForm((f) => ({ ...f, limitLabel: e.target.value }))} placeholder="até 10 barbeiros" />
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Módulos incluídos <span style={{ color: T.mutedHi, textTransform: "none", fontWeight: 400 }}>(Agendamento e CRM Básico são sempre incluídos)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            {PLAN_OPTIONAL_MODULES.map((m) => {
              const on = form.modules.includes(m);
              return (
                <div key={m} onClick={() => toggleModulo(m)} style={{
                  padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${on ? T.lime : T.border}`,
                  background: on ? T.limeSoft : T.surface,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 12, color: on ? T.lime : T.muted, fontWeight: on ? 600 : 400 }}>{m}</span>
                  <div style={{ width: 30, height: 16, borderRadius: 8, background: on ? T.lime : T.border, position: "relative", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: on ? T.bg : T.muted }} />
                  </div>
                </div>
              );
            })}
          </div>

          {editing !== "new" && (
            <div onClick={() => setForm((f) => ({ ...f, active: !f.active }))} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 18 }}>
              <div style={{ width: 32, height: 18, borderRadius: 9, background: form.active ? T.lime : T.border, position: "relative" }}>
                <div style={{ position: "absolute", top: 3, left: form.active ? 15 : 3, width: 12, height: 12, borderRadius: "50%", background: form.active ? T.bg : "#555", transition: "left 0.2s" }} />
              </div>
              <span style={{ fontSize: 12, color: form.active ? T.success : T.muted }}>{form.active ? "Ativo" : "Inativo"}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <div onClick={saving ? undefined : save} style={{ background: T.lime, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Salvando..." : "Salvar"}</div>
            <div onClick={() => setEditing(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: T.muted, cursor: "pointer" }}>Cancelar</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 28 }}>Carregando…</div>
      ) : planosOrdenados.length === 0 ? (
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 28 }}>Nenhum plano cadastrado ainda.</div>
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          {planosOrdenados.map((p) => {
            const cor = PLAN_COLOR[p.code] || T.mutedHi;
            return (
              <div key={p.id} onClick={() => startEdit(p)} style={{
                flex: 1, minWidth: 190, background: T.card, border: `1.5px solid ${p.code === "pro" ? cor : T.border}`,
                borderRadius: 14, padding: 20, position: "relative", overflow: "hidden", cursor: "pointer", opacity: p.active ? 1 : 0.5,
              }}>
                {p.code === "pro" && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: cor }} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: cor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.name}</div>
                  {!p.active && <Badge color={T.muted} small>inativo</Badge>}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: T.text, marginBottom: 4 }}>{p.priceCents != null ? `R$ ${(p.priceCents / 100).toFixed(2).replace(".", ",")}` : "Negociado"}</div>
                {p.priceCents != null && <div style={{ fontSize: 11, color: T.muted, marginBottom: 14 }}>/mês por barbearia</div>}
                <div style={{ fontSize: 12, color: T.mutedHi, marginBottom: 6 }}>• {p.limitLabel || "sem limite definido"}</div>
                <div style={{ fontSize: 12, color: T.mutedHi }}>• {p.modules.length + PLAN_CORE_MODULES.length} módulos incluídos</div>
              </div>
            );
          })}
        </div>
      )}

      {planosOrdenados.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>Comparativo de módulos por plano</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  <th style={{ padding: "8px 0", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Módulo</th>
                  {planosOrdenados.map((p) => <th key={p.id} style={{ padding: "8px 16px", fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...PLAN_CORE_MODULES.map((m) => [m, true]), ...PLAN_OPTIONAL_MODULES.map((m) => [m, false])].map(([mod, sempreOn]) => (
                  <tr key={mod} style={{ borderBottom: `1px solid ${T.border}22` }}>
                    <td style={{ padding: "10px 0", fontSize: 13, color: T.text }}>{mod}</td>
                    {planosOrdenados.map((p) => {
                      const on = sempreOn || (p.modules || []).includes(mod);
                      return (
                        <td key={p.id} style={{ padding: "10px 16px", textAlign: "center", fontSize: 14 }}>
                          {on ? <span style={{ color: T.success }}>✓</span> : <span style={{ color: T.muted }}>✕</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: FINANCEIRO (por barbearia — Sprint 8, admin-desenvolvain.md)
// ────────────────────────────────────────────────────────
const emptyPaymentForm = { valorReais: "", period: "", status: "pending" };

const MONTH_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_OPTIONS = MONTH_FULL.map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

/** Mesmo padrão do passo 1 do Onboarding (getStep1Errors) — valida por campo em
 * vez de parar no primeiro erro, pra marcar todos os campos faltando de uma vez. */
function getPaymentFormErrors(form) {
  const errors = {};
  if (!form.valorReais.trim()) {
    errors.valorReais = "Obrigatório.";
  } else {
    const amountCents = Math.round(parseFloat(form.valorReais.replace(",", ".")) * 100);
    if (Number.isNaN(amountCents) || amountCents <= 0) errors.valorReais = "Valor inválido.";
  }
  if (!form.period.trim()) errors.period = "Obrigatório.";
  else if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.period)) errors.period = "Formato AAAA-MM (ex: 2026-08).";
  if (!form.status) errors.status = "Obrigatório.";
  return errors;
}

const Financeiro = ({ tenantId, setTenantId, setActive, setAssinaturasTenantId }) => {
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPaymentForm);
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");

  useEffect(() => { listTenants().then((res) => setTenants(res.items)); }, []);

  const load = (id) => getTenantPayments(id, { pageSize: 100 }).then((res) => setPayments(res.items));

  useEffect(() => {
    if (!tenantId) {
      setPayments([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    setShowForm(false);
    setFilterMonth("");
    setFilterYear("");
    load(tenantId)
      .catch((err) => setError(err.message || "Não foi possível carregar os pagamentos dessa barbearia."))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const selectedTenant = tenants.find((t) => t.id === tenantId);
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1].map((y) => ({ value: String(y), label: String(y) }));

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = `${MONTH_FULL[now.getMonth()]} de ${now.getFullYear()}`;
  const currentMonthPayments = payments.filter((p) => p.period === currentPeriod);
  const pagoEsteMes = currentMonthPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountCents, 0);
  const pendenteEsteMes = currentMonthPayments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amountCents, 0);

  const hasPeriodFilter = Boolean(filterMonth && filterYear);
  const selectedPeriod = hasPeriodFilter ? `${filterYear}-${filterMonth}` : "";
  const sortedPayments = [...payments].sort((a, b) => b.period.localeCompare(a.period));
  const filteredPayments = hasPeriodFilter ? sortedPayments.filter((p) => p.period === selectedPeriod) : sortedPayments.slice(0, 3);
  const periodSummary = hasPeriodFilter
    ? {
        pago: filteredPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountCents, 0),
        pendente: filteredPayments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amountCents, 0),
      }
    : null;

  const limparFiltro = () => { setFilterMonth(""); setFilterYear(""); };

  const paymentFormErrors = getPaymentFormErrors(form);

  const abrirForm = () => { setForm(emptyPaymentForm); setAttempted(false); setFormError(""); setShowForm(true); };

  const registrar = async () => {
    setAttempted(true);
    setFormError("");
    if (Object.keys(paymentFormErrors).length > 0) return;

    const amountCents = Math.round(parseFloat(form.valorReais.replace(",", ".")) * 100);

    setSaving(true);
    try {
      await createTenantPayment(tenantId, { amountCents, period: form.period, status: form.status });
      setShowForm(false);
      await load(tenantId);
    } catch (e) {
      setFormError(e.message || "Não foi possível registrar.");
    } finally {
      setSaving(false);
    }
  };

  const marcarPago = async (payment) => {
    setActingId(payment.id);
    try {
      await updateTenantPayment(tenantId, payment.id, { status: "paid" });
      await load(tenantId);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Financeiro</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Escolha uma barbearia pra ver os pagamentos dela</div>
        </div>
        <Select
          value={tenantId ?? ""}
          onChange={(e) => setTenantId(e.target.value)}
          options={[{ value: "", label: "Selecione uma barbearia…" }, ...tenants.map((t) => ({ value: t.id, label: t.name }))]}
        />
      </div>

      {!tenantId ? (
        <div style={{ background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12, padding: 60, textAlign: "center", color: T.muted, fontSize: 13 }}>
          Selecione uma barbearia acima pra ver o financeiro dela.
        </div>
      ) : error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : loading ? (
        <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => { setAssinaturasTenantId(tenantId); setActive("assinaturas"); }}
            >
              Ver assinatura desta barbearia →
            </Btn>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Este mês ({currentMonthLabel}) — {selectedTenant?.name}</div>
              <Btn size="sm" onClick={abrirForm}>+ Registrar pagamento</Btn>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Stat label="Pago este mês" value={formatMoney(pagoEsteMes)} accent={T.success} />
              <Stat label="Pendente este mês" value={formatMoney(pendenteEsteMes)} accent={pendenteEsteMes > 0 ? T.danger : T.success} />
            </div>
          </div>

          {showForm && (
            <div style={{ background: T.card, border: `1.5px solid ${T.lime}55`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.lime, marginBottom: 16 }}>Registrar pagamento</div>
              {formError && <div style={{ marginBottom: 14 }}><ErrorBox>{formError}</ErrorBox></div>}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <Input label="Valor (R$)" value={form.valorReais} onChange={(e) => setForm((f) => ({ ...f, valorReais: e.target.value }))} placeholder="299,00"
                    error={attempted ? paymentFormErrors.valorReais : undefined} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <Input label="Período (AAAA-MM)" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder="2026-08"
                    error={attempted ? paymentFormErrors.period : undefined} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    options={[{ value: "pending", label: "Pendente" }, { value: "paid", label: "Pago" }]}
                    error={attempted ? paymentFormErrors.status : undefined} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div onClick={saving ? undefined : registrar} style={{ background: T.lime, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Salvando..." : "Registrar"}</div>
                <div onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: T.muted, cursor: "pointer" }}>Cancelar</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Histórico de pagamentos</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>
                {hasPeriodFilter ? `Mostrando ${MONTH_FULL[parseInt(filterMonth, 10) - 1]} de ${filterYear}` : "Mostrando os 3 meses mais recentes — pra ver mais pra trás, escolha o mês/ano ao lado"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
                options={[{ value: "", label: "Mês" }, ...MONTH_OPTIONS]} />
              <Select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
                options={[{ value: "", label: "Ano" }, ...yearOptions]} />
              {hasPeriodFilter && (
                <Btn variant="ghost" size="sm" onClick={limparFiltro}>Limpar</Btn>
              )}
            </div>
          </div>

          {periodSummary && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 24, fontSize: 12.5 }}>
              <span style={{ color: T.muted }}>Resumo do período:</span>
              <span style={{ color: T.success, fontWeight: 600 }}>Pago: {formatMoney(periodSummary.pago)}</span>
              <span style={{ color: periodSummary.pendente > 0 ? T.danger : T.muted, fontWeight: 600 }}>Pendente: {formatMoney(periodSummary.pendente)}</span>
            </div>
          )}

          {filteredPayments.length === 0 ? (
            <div style={{ fontSize: 12, color: T.muted }}>
              {hasPeriodFilter ? "Nenhum pagamento nesse período." : "Nenhum pagamento registrado ainda."}
            </div>
          ) : (
            <Table
              cols={["Valor", "Período", "Status", ""]}
              rows={filteredPayments.map((p, i) => (
                <TRow key={p.id} last={i === filteredPayments.length - 1} cells={[
                  <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{formatMoney(p.amountCents)}</span>,
                  <span style={{ fontSize: 13, color: T.muted }}>{p.period}</span>,
                  <Badge color={p.status === "paid" ? T.success : T.warning}>{p.status === "paid" ? "pago" : "pendente"}</Badge>,
                  p.status === "pending" ? (
                    <span onClick={actingId === p.id ? undefined : () => marcarPago(p)} style={{ fontSize: 12, color: T.lime, cursor: actingId === p.id ? "default" : "pointer" }}>Marcar como pago</span>
                  ) : null,
                ]} />
              ))}
              mobileRows={filteredPayments.map((p) => (
                <MobileCard key={p.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{formatMoney(p.amountCents)}</span>
                    <Badge color={p.status === "paid" ? T.success : T.warning}>{p.status === "paid" ? "pago" : "pendente"}</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                    <span style={{ color: T.muted }}>{p.period}</span>
                  </div>
                  {p.status === "pending" && (
                    <span onClick={actingId === p.id ? undefined : () => marcarPago(p)} style={{ fontSize: 12, color: T.lime, cursor: actingId === p.id ? "default" : "pointer" }}>Marcar como pago</span>
                  )}
                </MobileCard>
              ))}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: USUÁRIOS
// ────────────────────────────────────────────────────────
const roleColor = { super_admin: T.lime, admin: T.info, barbeiro: T.warning, cliente: T.mutedHi };

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const monthLabel = (ym) => MONTH_ABBR[parseInt(ym.split("-")[1], 10) - 1];

/** Barras de um gráfico SVG (altura máx 120) a partir de monthlyAppointments: [{month: "2026-05", count}]. */
function buildBars(monthlyAppointments) {
  const max = Math.max(...monthlyAppointments.map((m) => m.count), 1);
  const chartH = 120;
  const gap = 14;
  const barW = 36;
  return monthlyAppointments.map((m, i) => {
    const h = Math.round((m.count / max) * chartH);
    return {
      key: m.month,
      label: monthLabel(m.month),
      x: 10 + i * (barW + gap),
      y: 140 - h,
      h,
      labelX: 10 + i * (barW + gap) + barW / 2,
    };
  });
}

const USUARIOS_PAGE_SIZE = 10;

const Usuarios = ({ setActive, setFinanceiroTenantId, setAssinaturasTenantId }) => {
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [stats, setStats] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    listTenants().then((res) => setTenants(res.items));
  }, []);

  useEffect(() => {
    if (!tenantId) {
      setStats(null);
      setUsuarios([]);
      setError("");
      return;
    }
    // Não usa uma flag "loading" separada de propósito — entre o clique que
    // muda tenantId e esse efeito rodar, o componente ainda renderiza pelo
    // menos uma vez com tenantId já setado mas stats ainda no valor antigo
    // (null, se for a primeira seleção). Uma flag "loading" setada só aqui
    // dentro do efeito chega tarde demais pra esse primeiro render — a tela
    // já tentaria usar stats.algumCampo com stats null e quebraria. Em vez
    // disso o próprio "stats ainda não existe" decide mostrar "Carregando…"
    // (ver o JSX abaixo), que é verdade em qualquer um dos dois casos.
    setStats(null);
    setError("");
    setBusca("");
    setPage(1);
    // pageSize máximo que o backend aceita (seção 8.4 do CLAUDE.md, paginação
    // obrigatória) — busca e paginação da lista aqui são client-side (mesmo
    // padrão da busca em Barbearias), então barbearias com mais de 100
    // usuários cadastrados não mostram todos ainda. Aceitável por enquanto,
    // registrado como limite conhecido.
    Promise.all([getTenantStats(tenantId), getUsers({ tenantId, pageSize: 100 })])
      .then(([statsRes, usersRes]) => {
        setStats(statsRes);
        setUsuarios(usersRes.items);
      })
      .catch((err) => setError(err.message || "Não foi possível carregar os dados dessa barbearia."));
  }, [tenantId]);

  const filtrados = usuarios.filter((u) => u.name.toLowerCase().includes(busca.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtrados.length / USUARIOS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageUsuarios = filtrados.slice((currentPage - 1) * USUARIOS_PAGE_SIZE, currentPage * USUARIOS_PAGE_SIZE);
  const bars = stats ? buildBars(stats.monthlyAppointments) : [];
  const selectedTenant = tenants.find((t) => t.id === tenantId);

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Usuários</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Escolha uma barbearia pra ver os usuários e a operação dela</div>
        </div>
        <Select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          options={[
            { value: "", label: "Selecione uma barbearia…" },
            ...tenants.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
      </div>

      {!tenantId ? (
        <div style={{ background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12, padding: 60, textAlign: "center", color: T.muted, fontSize: 13 }}>
          Selecione uma barbearia acima pra ver agendamentos, profissionais, clientes e usuários dela.
        </div>
      ) : error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : !stats ? (
        <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
      ) : (
        <div>
          <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => { setFinanceiroTenantId(tenantId); setActive("financeiro"); }}
            >
              Ver financeiro desta barbearia →
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => { setAssinaturasTenantId(tenantId); setActive("assinaturas"); }}
            >
              Ver assinatura desta barbearia →
            </Btn>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            <Stat label="Agendamentos este mês" value={String(stats.appointmentsThisMonth)} />
            <Stat
              label="Profissionais"
              value={String(stats.professionalsActive + stats.professionalsInactive)}
              sub={`${stats.professionalsActive} ativos · ${stats.professionalsInactive} inativos`}
            />
            <Stat label="Clientes cadastrados" value={String(stats.clientsCount)} />
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {/* Gráfico 6 meses */}
            <div style={{ flex: 1, minWidth: 320, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Agendamentos — últimos 6 meses</div>
              <svg width="100%" height={160} viewBox="0 0 320 160" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Gráfico de barras de agendamentos nos últimos 6 meses">
                {bars.map((b) => (
                  <g key={b.key}>
                    <rect x={b.x} y={b.y} width={36} height={b.h} rx={4} fill={T.lime} />
                    <text x={b.labelX} y={150} textAnchor="middle" fill={T.muted} fontSize={11}>{b.label}</text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Usuários */}
            <div style={{ flex: 2, minWidth: 360 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Usuários de {selectedTenant?.name}</div>
                <input
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setPage(1); }}
                  placeholder="Buscar por nome…"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.text, fontSize: 12.5, minWidth: 200, outline: "none" }}
                />
              </div>

              {pageUsuarios.length === 0 ? (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "24px 18px", textAlign: "center", color: T.muted, fontSize: 12.5 }}>
                  {busca ? `Nenhum usuário encontrado pra "${busca}".` : "Nenhum usuário cadastrado ainda."}
                </div>
              ) : (
                <Table
                  cols={["Usuário", "Role", "Status"]}
                  rows={pageUsuarios.map((u, i) => (
                    <TRow key={u.id} last={i === pageUsuarios.length - 1} cells={[
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={u.name} size={28} color={roleColor[u.role]} />
                        <div>
                          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 10, color: T.muted }}>{u.email}</div>
                        </div>
                      </div>,
                      <Badge color={roleColor[u.role]}>{u.role}</Badge>,
                      <Badge color={u.active !== false ? T.success : T.danger}>{u.active !== false ? "ativo" : "inativo"}</Badge>,
                    ]} />
                  ))}
                  mobileRows={pageUsuarios.map((u) => (
                    <MobileCard key={u.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={u.name} size={32} color={roleColor[u.role]} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Badge color={roleColor[u.role]}>{u.role}</Badge>
                        <Badge color={u.active !== false ? T.success : T.danger}>{u.active !== false ? "ativo" : "inativo"}</Badge>
                      </div>
                    </MobileCard>
                  ))}
                />
              )}

              {/* Paginação */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                <span style={{ fontSize: 11.5, color: T.muted }}>
                  {filtrados.length === 0 ? "0 resultados" : `Página ${currentPage} de ${totalPages} · ${filtrados.length} usuário${filtrados.length === 1 ? "" : "s"}`}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>← Anterior</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima →</Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: SUPORTE
// ────────────────────────────────────────────────────────
const Suporte = () => {
  const tickets = [
    { id: "#001", barbearia: "Corte Fino", assunto: "Agenda não sincroniza", prioridade: "alta", status: "aberto", data: "10/06/2025" },
    { id: "#002", barbearia: "Barberaria", assunto: "Dúvida sobre comissões", prioridade: "media", status: "respondido", data: "09/06/2025" },
    { id: "#003", barbearia: "Dom Barbeiro", assunto: "Alterar logo", prioridade: "baixa", status: "resolvido", data: "07/06/2025" },
    { id: "#004", barbearia: "Studio Cuts", assunto: "Primeiro acesso — dúvidas gerais", prioridade: "media", status: "aberto", data: "11/06/2025" },
  ];
  const prioColor = { alta: T.danger, media: T.warning, baixa: T.muted };
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Suporte</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Chamados das barbearias</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Badge color={T.danger}>2 abertos</Badge>
          <Badge color={T.warning}>1 respondido</Badge>
        </div>
      </div>
      <Table
        cols={["ID", "Barbearia", "Assunto", "Prioridade", "Status", "Data"]}
        rows={tickets.map((t, i) => (
          <TRow key={i} last={i === tickets.length - 1} cells={[
            <span style={{ fontSize: 12, color: T.muted, fontFamily: "monospace" }}>{t.id}</span>,
            <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.barbearia}</span>,
            <span style={{ fontSize: 13, color: T.text }}>{t.assunto}</span>,
            <Badge color={prioColor[t.prioridade]}>{t.prioridade}</Badge>,
            <Badge color={t.status === "aberto" ? T.danger : t.status === "respondido" ? T.warning : T.success}>{t.status}</Badge>,
            <span style={{ fontSize: 12, color: T.muted }}>{t.data}</span>,
          ]} />
        ))}
        mobileRows={tickets.map((t, i) => (
          <MobileCard key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: T.muted, fontFamily: "monospace" }}>{t.id}</span>
              <Badge color={t.status === "aberto" ? T.danger : t.status === "respondido" ? T.warning : T.success}>{t.status}</Badge>
            </div>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.barbearia}</div>
            <div style={{ fontSize: 13, color: T.text }}>{t.assunto}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Badge color={prioColor[t.prioridade]}>{t.prioridade}</Badge>
              <span style={{ fontSize: 12, color: T.muted }}>{t.data}</span>
            </div>
          </MobileCard>
        ))}
      />
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: RELEASES
// ────────────────────────────────────────────────────────
const Releases = () => {
  const releases = [
    { versao: "v1.4.0", data: "10/06/2025", status: "publicado", itens: ["Módulo de Estoque lançado", "Correção de bug na agenda (conflito de horário)", "Melhoria de performance no dashboard"] },
    { versao: "v1.3.1", data: "28/05/2025", status: "publicado", itens: ["Hotfix: erro ao salvar comissões", "Melhoria no upload de logotipo"] },
    { versao: "v1.3.0", data: "15/05/2025", status: "publicado", itens: ["Clube de Clientes (pontos e níveis)", "Cupons de desconto", "Notificações por WhatsApp"] },
    { versao: "v1.5.0", data: "Previsto Jul/2025", status: "planejado", itens: ["App mobile nativo (iOS/Android)", "Domínio próprio automatizado", "Módulo NPS"] },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Releases</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Histórico de versões da plataforma</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {releases.map((r, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${r.status === "planejado" ? T.warning + "55" : T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: r.status === "planejado" ? T.warning : T.lime, fontFamily: "monospace" }}>{r.versao}</span>
                <Badge color={r.status === "publicado" ? T.success : T.warning}>{r.status}</Badge>
              </div>
              <span style={{ fontSize: 12, color: T.muted }}>{r.data}</span>
            </div>
            {r.itens.map((item, j) => (
              <div key={j} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                <span style={{ color: r.status === "planejado" ? T.warning : T.lime, fontSize: 12, marginTop: 1 }}>•</span>
                <span style={{ fontSize: 13, color: T.mutedHi }}>{item}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: ASSINATURAS (por barbearia — Sprint 9, admin-desenvolvain.md)
// ────────────────────────────────────────────────────────
const Assinaturas = ({ tenantId, setTenantId }) => {
  const [tenants, setTenants] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [overview, setOverview] = useState(null);
  // undefined = ainda não buscou pra esse tenantId | null = buscou, confirmado sem assinatura (404) |
  // objeto = assinatura carregada. Mesmo padrão de `stats` em Usuários — nunca uma flag "loading"
  // separada, que já causou um bug real de corrida de render nessa mesma tela de admin.
  const [subscription, setSubscription] = useState(undefined);
  const [error, setError] = useState("");
  const [novoPlanoId, setNovoPlanoId] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    Promise.all([listTenants(), listPlans(), getSubscriptionsOverview()]).then(([tenantsRes, plansRes, overviewRes]) => {
      setTenants(tenantsRes.items);
      setPlanos(plansRes.items.filter((p) => p.active));
      setOverview(overviewRes);
    });
  }, []);

  const reloadOverview = () => getSubscriptionsOverview().then(setOverview);

  useEffect(() => {
    setSubscription(undefined);
    setError("");
    setNovoPlanoId("");
    if (!tenantId) return;
    getTenantSubscription(tenantId)
      .then((sub) => setSubscription(sub))
      .catch((err) => {
        if (err.status === 404) setSubscription(null);
        else setError(err.message || "Não foi possível carregar a assinatura dessa barbearia.");
      });
  }, [tenantId]);

  const selectedTenant = tenants.find((t) => t.id === tenantId);

  const criarAssinatura = async () => {
    if (!novoPlanoId) return;
    setActing(true);
    try {
      const sub = await updateTenantSubscription(tenantId, { planId: novoPlanoId });
      setSubscription(sub);
      await reloadOverview();
    } finally {
      setActing(false);
    }
  };

  const trocarPlano = async (planId) => {
    setActing(true);
    try {
      const sub = await updateTenantSubscription(tenantId, { planId });
      setSubscription(sub);
      await reloadOverview();
    } finally {
      setActing(false);
    }
  };

  const toggleStatus = async () => {
    setActing(true);
    try {
      const sub = await updateTenantSubscription(tenantId, { status: subscription.status === "active" ? "cancelled" : "active" });
      setSubscription(sub);
      await reloadOverview();
    } finally {
      setActing(false);
    }
  };

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Assinaturas</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Veja e altere o plano de uma barbearia</div>
        </div>
        <Select
          value={tenantId ?? ""}
          onChange={(e) => setTenantId(e.target.value)}
          options={[{ value: "", label: "Selecione uma barbearia…" }, ...tenants.map((t) => ({ value: t.id, label: t.name }))]}
        />
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <Stat label="Ativas" value={overview ? String(overview.activeCount) : "…"} />
        <Stat label="Canceladas" value={overview ? String(overview.cancelledCount) : "…"} accent={T.danger} />
        <Stat label="Sem assinatura" value={overview ? String(overview.noneCount) : "…"} accent={T.warning} />
        <Stat label="MRR" value={overview ? formatMoney(overview.mrrCents) : "…"} />
      </div>

      {!tenantId ? (
        <div style={{ background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12, padding: 60, textAlign: "center", color: T.muted, fontSize: 13 }}>
          Selecione uma barbearia acima pra ver e alterar o plano dela.
        </div>
      ) : error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : subscription === undefined ? (
        <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
      ) : subscription === null ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, color: T.text, marginBottom: 14 }}>
            <strong>{selectedTenant?.name}</strong> ainda não tem assinatura.
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Select label="Plano" value={novoPlanoId} onChange={(e) => setNovoPlanoId(e.target.value)}
              options={[{ value: "", label: "Selecione…" }, ...planos.map((p) => ({ value: p.id, label: p.name }))]} />
            <Btn size="sm" onClick={criarAssinatura} disabled={!novoPlanoId || acting}>{acting ? "Criando..." : "Criar assinatura"}</Btn>
          </div>
        </div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Plano atual</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{subscription.plan.name}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Status</div>
              <Badge color={subscription.status === "active" ? T.success : T.danger}>{subscription.status === "active" ? "ativo" : "cancelado"}</Badge>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Assinante desde</div>
              <div style={{ fontSize: 13, color: T.text }}>{formatDate(subscription.startedAt)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Select label="Trocar plano" value={subscription.planId} disabled={acting} onChange={(e) => trocarPlano(e.target.value)}
              options={planos.map((p) => ({ value: p.id, label: p.name }))} />
            <Btn size="sm" variant={subscription.status === "active" ? "danger" : "primary"} onClick={toggleStatus} disabled={acting}>
              {acting ? "Salvando..." : subscription.status === "active" ? "Cancelar assinatura" : "Reativar assinatura"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: CONFIGURAÇÕES
// ────────────────────────────────────────────────────────
const COLOR_HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const Config = ({ onThemeChange }) => {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => setForm({
        domain: s.domain,
        supportEmail: s.supportEmail,
        webhookUrl: s.webhookUrl,
        defaultTrialDays: String(s.defaultTrialDays),
        bgColor: s.bgColor,
        accentColor: s.accentColor,
      }))
      .finally(() => setLoading(false));
  }, []);

  const salvar = async () => {
    setError("");
    setSaved(false);
    if (!COLOR_HEX_RE.test(form.bgColor) || !COLOR_HEX_RE.test(form.accentColor)) {
      setError("Cores devem estar no formato hex #RRGGBB.");
      return;
    }
    const defaultTrialDays = parseInt(form.defaultTrialDays, 10);
    if (Number.isNaN(defaultTrialDays) || defaultTrialDays < 1) {
      setError("Trial padrão deve ser um número de dias válido.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateSettings({ ...form, defaultTrialDays });
      onThemeChange?.(updated);
      setSaved(true);
    } catch (e) {
      setError(e.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return <div style={{ padding: 32, color: T.muted, fontSize: 12 }}>Carregando…</div>;
  }

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Configurações da Plataforma</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Parâmetros globais da Desenvolva IN</div>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Domínio base" value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} />
          <Input label="E-mail de suporte" value={form.supportEmail} onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))} />
          <Input label="Webhook de pagamentos" value={form.webhookUrl} onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))} />
          <Input label="Trial padrão (dias)" value={form.defaultTrialDays} onChange={(e) => setForm((f) => ({ ...f, defaultTrialDays: e.target.value }))} />
        </div>
        <div style={{ flex: 1, minWidth: 280, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 16 }}>Identidade da Plataforma</div>
          {error && <div style={{ marginBottom: 14 }}><ErrorBox>{error}</ErrorBox></div>}

          {/* Preview ao vivo — reflete o form antes de salvar */}
          <div style={{ background: form.bgColor, borderRadius: 10, padding: 20, border: `1px solid ${T.border}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: form.accentColor, letterSpacing: "0.06em" }}>✂ DESENVOLVA IN</div>
            <div style={{ fontSize: 10, color: T.mutedHi, marginTop: 2, marginBottom: 12 }}>Painel Master · Incubadora</div>
            <div style={{ background: form.accentColor, color: form.bgColor, borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 700, display: "inline-block" }}>Botão de exemplo</div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            {[["Fundo", "bgColor"], ["Acento", "accentColor"]].map(([label, key]) => (
              <div key={key} style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600 }}>{label}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="color"
                    value={COLOR_HEX_RE.test(form[key]) ? form[key] : "#000000"}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: "pointer", padding: 0, background: "transparent" }}
                  />
                  <input
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ width: 90, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: "monospace", outline: "none" }}
                  />
                </div>
              </div>
            ))}
          </div>

          {saved && <div style={{ fontSize: 11, color: T.success, marginBottom: 10 }}>✓ Configurações salvas.</div>}
          <div onClick={saving ? undefined : salvar} style={{ background: T.lime, borderRadius: 8, padding: "10px 16px", textAlign: "center", cursor: saving ? "default" : "pointer", fontSize: 13, fontWeight: 700, color: T.bg, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando..." : "Salvar configurações"}
          </div>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: REPASSES
// ────────────────────────────────────────────────────────
const emptyPayoutForm = { tenantId: "", period: "", grossReais: "", feePct: "" };

const Repasses = () => {
  const [payouts, setPayouts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPayoutForm);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([listPayouts(), listTenants()]).then(([payoutsRes, tenantsRes]) => {
      setPayouts(payoutsRes.items);
      setTenants(tenantsRes.items);
    });

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const abrirForm = () => { setForm(emptyPayoutForm); setError(""); setShowForm(true); };

  const grossCentsPreview = Math.round(parseFloat((form.grossReais || "0").replace(",", ".")) * 100) || 0;
  const feePctPreview = parseFloat((form.feePct || "0").replace(",", ".")) || 0;
  const netCentsPreview = Math.round(grossCentsPreview * (1 - feePctPreview / 100));

  const registrar = async () => {
    setError("");
    if (!form.tenantId) { setError("Escolha uma barbearia."); return; }
    if (!form.period || form.period.length < 2) { setError("Informe o período (ex: Agosto 2026)."); return; }
    if (grossCentsPreview <= 0) { setError("Receita bruta inválida."); return; }
    if (feePctPreview < 0 || feePctPreview > 100) { setError("Taxa deve estar entre 0 e 100."); return; }

    setSaving(true);
    try {
      await createTenantPayout(form.tenantId, { period: form.period, grossRevenueCents: grossCentsPreview, feePct: feePctPreview });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e.message || "Não foi possível registrar.");
    } finally {
      setSaving(false);
    }
  };

  const marcarPago = async (payout) => {
    setActingId(payout.id);
    try {
      await updateTenantPayout(payout.tenantId, payout.id, { status: "paid" });
      await load();
    } finally {
      setActingId(null);
    }
  };

  const totalBruto = payouts.reduce((s, p) => s + p.grossRevenueCents, 0);
  const totalFee = payouts.reduce((s, p) => s + (p.grossRevenueCents - p.netCents), 0);
  const aRepassar = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.netCents, 0);

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Repasses</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Registro manual de repasse de receita às barbearias</div>
        </div>
        <Btn size="sm" onClick={abrirForm}>+ Registrar repasse</Btn>
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Total bruto registrado" value={formatMoney(totalBruto)} />
        <Stat label="Fee acumulado" value={formatMoney(totalFee)} />
        <Stat label="A repassar (pendente)" value={formatMoney(aRepassar)} accent={aRepassar > 0 ? T.warning : T.success} />
      </div>

      {showForm && (
        <div style={{ background: T.card, border: `1.5px solid ${T.lime}55`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.lime, marginBottom: 16 }}>Registrar repasse</div>
          {error && <div style={{ marginBottom: 14 }}><ErrorBox>{error}</ErrorBox></div>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <Select label="Barbearia" value={form.tenantId} onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                options={[{ value: "", label: "Selecione…" }, ...tenants.map((t) => ({ value: t.id, label: t.name }))]} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Input label="Período" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder="Agosto 2026" />
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <Input label="Receita bruta (R$)" value={form.grossReais} onChange={(e) => setForm((f) => ({ ...f, grossReais: e.target.value }))} placeholder="4.340,00" />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <Input label="Taxa (%)" value={form.feePct} onChange={(e) => setForm((f) => ({ ...f, feePct: e.target.value }))} placeholder="15" />
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>
            Líquido calculado: <strong style={{ color: T.lime }}>{formatMoney(netCentsPreview)}</strong>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div onClick={saving ? undefined : registrar} style={{ background: T.lime, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Salvando..." : "Registrar"}</div>
            <div onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: T.muted, cursor: "pointer" }}>Cancelar</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
      ) : payouts.length === 0 ? (
        <div style={{ fontSize: 12, color: T.muted }}>Nenhum repasse registrado ainda.</div>
      ) : (
        <Table
          cols={["Barbearia", "Período", "Receita bruta", "Taxa", "Repasse líquido", "Status", ""]}
          rows={payouts.map((p, i) => (
            <TRow key={p.id} last={i === payouts.length - 1} cells={[
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={p.tenantName} size={28} />
                <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{p.tenantName}</span>
              </div>,
              <span style={{ fontSize: 12, color: T.muted }}>{p.period}</span>,
              <span style={{ fontSize: 13, color: T.text }}>{formatMoney(p.grossRevenueCents)}</span>,
              <Badge color={T.mutedHi}>{p.feePct}%</Badge>,
              <span style={{ fontSize: 13, color: T.lime, fontWeight: 700 }}>{formatMoney(p.netCents)}</span>,
              <Badge color={p.status === "paid" ? T.success : T.warning}>{p.status === "paid" ? "pago" : "pendente"}</Badge>,
              p.status === "pending" ? (
                <span onClick={actingId === p.id ? undefined : () => marcarPago(p)} style={{ fontSize: 12, color: T.lime, cursor: actingId === p.id ? "default" : "pointer" }}>Marcar como pago</span>
              ) : null,
            ]} />
          ))}
          mobileRows={payouts.map((p) => (
            <MobileCard key={p.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.tenantName} size={28} />
                  <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{p.tenantName}</span>
                </div>
                <Badge color={p.status === "paid" ? T.success : T.warning}>{p.status === "paid" ? "pago" : "pendente"}</Badge>
              </div>
              <div style={{ fontSize: 12, color: T.muted }}>{p.period}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ color: T.text }}>Bruto: {formatMoney(p.grossRevenueCents)}</span>
                <Badge color={T.mutedHi}>{p.feePct}%</Badge>
              </div>
              <div style={{ fontSize: 13, color: T.lime, fontWeight: 700 }}>Líquido: {formatMoney(p.netCents)}</div>
              {p.status === "pending" && (
                <span onClick={actingId === p.id ? undefined : () => marcarPago(p)} style={{ fontSize: 12, color: T.lime, cursor: actingId === p.id ? "default" : "pointer" }}>Marcar como pago</span>
              )}
            </MobileCard>
          ))}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────
// ROOT
// ────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(null); // null = checando sessão | "login" | "app"
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  // Barbearia selecionada ao navegar de Usuários/Financeiro pra outra tela (Sprint 8/9,
  // admin-desenvolvain.md) — state levantado aqui porque os componentes são irmãos, sem relação
  // pai/filho direta. Uma chave por destino (não uma só compartilhada) de propósito: escolher uma
  // barbearia pensando em "ver o financeiro" não deveria pré-popular "ver a assinatura" sozinho.
  const [financeiroTenantId, setFinanceiroTenantId] = useState(null);
  const [assinaturasTenantId, setAssinaturasTenantId] = useState(null);
  const [, setThemeTick] = useState(0); // força re-render depois de applyTheme mutar T
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      setScreen("login");
      return;
    }
    whoami()
      .then((me) => {
        if (me.role !== "super_admin") {
          setAccessToken(null);
          setScreen("login");
          return;
        }
        setUser(me);
        setScreen("app");
        // Tema não bloqueia o boot — se falhar, fica no padrão.
        getSettings().then((s) => { applyTheme(s); setThemeTick((t) => t + 1); }).catch(() => {});
      })
      .catch(() => {
        setAccessToken(null);
        setScreen("login");
      });
  }, []);

  const handleThemeChange = (settings) => {
    applyTheme(settings);
    setThemeTick((t) => t + 1);
  };

  const handleLogin = async (email, password) => {
    const res = await apiLogin(email, password);
    if (res.user.role !== "super_admin") {
      throw new Error("Esse painel é só para o Super Admin da incubadora.");
    }
    setAccessToken(res.accessToken);
    const me = await whoami();
    setUser(me);
    setScreen("app");
    getSettings().then((s) => { applyTheme(s); setThemeTick((t) => t + 1); }).catch(() => {});
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // segue com o logout local mesmo se a chamada de rede falhar
    }
    setAccessToken(null);
    setUser(null);
    setScreen("login");
  };

  if (screen === null) {
    return <div style={{ minHeight: "100vh", background: T.bg }} />;
  }
  if (screen === "login") {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const render = () => {
    if (page === "dashboard")   return <Dashboard setActive={setPage} />;
    if (page === "barbearias")  return <Barbearias />;
    if (page === "onboarding")  return <Onboarding setActive={setPage} />;
    if (page === "planos")      return <Planos />;
    if (page === "assinaturas") return <Assinaturas tenantId={assinaturasTenantId} setTenantId={setAssinaturasTenantId} />;
    if (page === "financeiro")  return <Financeiro tenantId={financeiroTenantId} setTenantId={setFinanceiroTenantId} setActive={setPage} setAssinaturasTenantId={setAssinaturasTenantId} />;
    if (page === "repasses")    return <Repasses />;
    if (page === "usuarios")    return <Usuarios setActive={setPage} setFinanceiroTenantId={setFinanceiroTenantId} setAssinaturasTenantId={setAssinaturasTenantId} />;
    if (page === "suporte")     return <Suporte />;
    if (page === "releases")    return <Releases />;
    if (page === "config")      return <Config onThemeChange={handleThemeChange} />;
    return <Dashboard setActive={setPage} />;
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: T.bg, minHeight: "100vh", display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        active={page} setActive={setPage} user={user} onLogout={handleLogout}
        isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
      />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: isMobile ? "12px 16px" : "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8,
                  width: 34, height: 34, color: T.text, fontSize: 15, cursor: "pointer", flexShrink: 0,
                }}
              >☰</button>
            )}
            <div style={{ fontSize: 12, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {!isMobile && <>Desenvolva IN <span style={{ color: T.border, margin: "0 6px" }}>›</span></>}
              <span style={{ color: T.mutedHi, textTransform: "capitalize" }}>{page}</span>
            </div>
          </div>
          {!isMobile && (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Badge color={T.success} small>Sistema operacional</Badge>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.success }} />
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex" }}>
          {render()}
        </div>
      </div>
    </div>
  );
}
