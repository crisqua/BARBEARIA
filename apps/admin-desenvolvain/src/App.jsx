import { useEffect, useState } from "react";
import {
  createTenant,
  getAccessToken,
  getDashboardOverview,
  getTenant,
  getUsers,
  listTenants,
  login as apiLogin,
  logout as apiLogout,
  setAccessToken,
  updateTenant,
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

const Btn = ({ children, onClick, variant = "primary", size = "md" }) => {
  const pad = size === "sm" ? "6px 14px" : "10px 20px";
  const fs = size === "sm" ? 12 : 13;
  const styles = {
    primary: { background: T.lime, color: T.bg, border: "none" },
    ghost:   { background: "transparent", color: T.lime, border: `1px solid ${T.lime}55` },
    danger:  { background: T.danger + "18", color: T.danger, border: `1px solid ${T.danger}44` },
  };
  return (
    <div onClick={onClick} style={{
      ...styles[variant], padding: pad, borderRadius: 8, fontSize: fs,
      fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
    }}>{children}</div>
  );
};

const ErrorBox = ({ children }) => (
  <div style={{ background: T.danger + "18", border: `1px solid ${T.danger}44`, borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: T.danger }}>
    {children}
  </div>
);

const Input = ({ label, value, onChange, placeholder, type = "text" }) => (
  <div>
    {label && <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
    <input value={value} onChange={onChange} placeholder={placeholder} type={type}
      style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div>
    {label && <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
    <select value={value} onChange={onChange}
      style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Table = ({ cols, rows }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
      { id: "financeiro", icon: "💰", label: "Receita & MRR" },
      { id: "repasses", icon: "🔁", label: "Repasses" },
    ],
  },
  {
    section: "Plataforma",
    items: [
      { id: "usuarios", icon: "👥", label: "Usuários" },
      { id: "suporte", icon: "💬", label: "Suporte" },
      { id: "releases", icon: "⚡", label: "Releases" },
    ],
  },
  { section: null, items: [{ id: "config", icon: "⚙", label: "Configurações" }] },
];

const Sidebar = ({ active, setActive, user, onLogout }) => (
  <div style={{
    width: 236, background: T.surface, borderRight: `1px solid ${T.border}`,
    display: "flex", flexDirection: "column", flexShrink: 0,
    height: "100vh", overflowY: "auto"
  }}>
    {/* Marca */}
    <div style={{ padding: "28px 22px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.lime + "18", border: `1.5px solid ${T.lime}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✂</div>
        <div>
          <div style={{ fontSize: 13, color: T.lime, fontWeight: 900, letterSpacing: "0.06em" }}>DESENVOLVA IN</div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>Painel Master · Incubadora</div>
        </div>
      </div>
    </div>

    <div style={{ flex: 1 }}>
      {NAV.map((sec, si) => (
        <div key={si}>
          {sec.section && (
            <div style={{ padding: "14px 22px 6px", fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{sec.section}</div>
          )}
          {sec.items.map(item => {
            const on = active === item.id;
            return (
              <div key={item.id} onClick={() => setActive(item.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 22px",
                cursor: "pointer",
                borderLeft: on ? `2px solid ${T.lime}` : "2px solid transparent",
                background: on ? T.limeSoft : "transparent",
                color: on ? T.lime : T.muted, fontSize: 13, fontWeight: on ? 600 : 400,
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
);

// ────────────────────────────────────────────────────────
// TELA: DASHBOARD
// ────────────────────────────────────────────────────────
// Dado de exemplo — vira real só se investirmos numa tabela de auditoria (fora
// do escopo do plano de sprints atual, ver admin-desenvolvain.md seção 7).
const atividadesExemplo = [
  { acao: "Nova barbearia criada", detalhe: "Studio Cuts", tempo: "há 2h" },
  { acao: "Plano atualizado", detalhe: "Dom Barbeiro → Pro", tempo: "há 5h" },
  { acao: "Trial expirado", detalhe: "Vintage Barber", tempo: "há 1d" },
  { acao: "Pagamento recebido", detalhe: "Barberaria · R$ 299", tempo: "há 2d" },
  { acao: "Suporte aberto", detalhe: "Corte Fino → agenda", tempo: "há 2d" },
];

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

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text, letterSpacing: "-0.02em" }}>Visão Geral</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Plataforma Barberaria</div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <Stat label="MRR Total" value="—" sub="chega no Sprint 6" />
        <Stat
          label="Barbearias"
          value={overview ? String(overview.tenants.total) : "…"}
          sub={overview ? `${overview.tenants.active} ativas · ${overview.tenants.suspended} suspensas` : undefined}
        />
        <Stat label="Barbeiros na rede" value={overview ? String(overview.barbersActive) : "…"} />
        <Stat label="Agendamentos/mês" value={overview ? String(overview.appointmentsThisMonth) : "…"} sub="em toda a rede" />
        <Stat label="Churn" value="—" sub="chega no Sprint 6" />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {/* Tabela de barbearias */}
        <div style={{ flex: 3, minWidth: 340 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Barbearias mais recentes</div>
            <Btn variant="ghost" size="sm" onClick={() => setActive("onboarding")}>+ Nova</Btn>
          </div>
          {loading ? (
            <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
          ) : (
            <Table
              cols={["Barbearia", "Slug", "Criada em", "Status"]}
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
            />
          )}
        </div>

        {/* Atividade recente */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Atividade recente</div>
            <Badge color={T.mutedHi} small>exemplo</Badge>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            {atividadesExemplo.map((a, i) => (
              <div key={i} style={{ padding: "12px 16px", borderBottom: i < atividadesExemplo.length - 1 ? `1px solid ${T.border}22` : "none" }}>
                <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{a.acao}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: T.lime }}>{a.detalhe}</span>
                  <span style={{ fontSize: 11, color: T.muted }}>{a.tempo}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: BARBEARIAS (gestão detalhada)
// ────────────────────────────────────────────────────────
const formatDate = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

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
              ["Slug", `${detalhe.slug}.barberaria.app`],
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
          cols={["Barbearia", "Slug", "Criada em", "Status", ""]}
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
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: ONBOARDING (nova barbearia)
// ────────────────────────────────────────────────────────
const Onboarding = ({ setActive }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nome: "", slug: "", plano: "pro", cor1: "#C9A84C", cor2: "#0F0F0F", contato: "", adminNome: "", adminSenha: "", modulos: ["Agendamento", "CRM Básico"] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const modulos = ["Comissões", "Assinaturas", "Clube de Clientes", "Venda de Produtos", "Dashboard Avançado", "WhatsApp/SMS", "Marketing", "Estoque"];
  const toggleMod = m => setForm(f => ({ ...f, modulos: f.modulos.includes(m) ? f.modulos.filter(x => x !== m) : [...f.modulos, m] }));
  const STEPS = ["Dados", "Identidade", "Módulos", "Confirmar"];

  const criarBarbearia = async () => {
    setError("");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug) || form.slug.length < 2) {
      setError("Slug deve ser minúsculo, alfanumérico, com hífens entre segmentos.");
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
        {STEPS.map((s, i) => (
          <div key={s} onClick={() => setStep(i + 1)} style={{
            flex: 1, padding: "12px 16px", textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: 600,
            borderRight: i < 3 ? `1px solid ${T.border}` : "none",
            background: step === i + 1 ? T.lime + "14" : "transparent",
            color: step > i + 1 ? T.success : step === i + 1 ? T.lime : T.muted,
          }}>
            {step > i + 1 ? "✓ " : `0${i + 1}. `}{s}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 640 }}>
        {step === 1 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
            <Input label="Nome da barbearia" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Barberaria" />
            <div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Slug (URL)</div>
              <div style={{ display: "flex", alignItems: "center", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: T.border, fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>barberaria.app/</div>
                <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="nomedabarbearia" style={{ flex: 1, background: "transparent", border: "none", padding: "10px 14px", color: T.text, fontSize: 13, outline: "none" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Input label="Nome do administrador" value={form.adminNome} onChange={e => setForm(f => ({ ...f, adminNome: e.target.value }))} placeholder="Ex: Victor Mendes" />
              </div>
              <div style={{ flex: 1 }}>
                <Input label="E-mail do administrador" value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="admin@barbearia.com" />
              </div>
            </div>
            <Input label="Senha inicial do administrador" type="password" value={form.adminSenha} onChange={e => setForm(f => ({ ...f, adminSenha: e.target.value }))} placeholder="mínimo 8 caracteres" />
            <Select label="Plano inicial" value={form.plano} onChange={e => setForm(f => ({ ...f, plano: e.target.value }))}
              options={[{ value: "trial", label: "Trial (14 dias grátis)" }, { value: "starter", label: "Starter — R$ 99/mês" }, { value: "pro", label: "Pro — R$ 299/mês" }, { value: "enterprise", label: "Enterprise — Negociado" }]} />
          </div>
        )}

        {step === 2 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: T.surface, border: `2px dashed ${T.border}`, borderRadius: 10, padding: 32, textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✂</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>Logotipo da barbearia</div>
              <div style={{ fontSize: 11, color: T.lime }}>Selecionar arquivo (PNG/SVG)</div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {[["Cor primária", "cor1"], ["Cor de fundo", "cor2"]].map(([label, key]) => (
                <div key={key} style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 6, background: form[key], border: `1px solid ${T.border}`, flexShrink: 0 }} />
                    <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.text, fontSize: 13, outline: "none" }} />
                  </div>
                </div>
              ))}
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
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>Módulos incluídos no plano <Badge color={T.lime}>{form.plano}</Badge></div>
            <div style={{ background: T.surface, borderRadius: 8, padding: 12, marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
              <span>ℹ</span>
              <div style={{ fontSize: 12, color: T.mutedHi }}>Core sempre ativo: <strong style={{ color: T.text }}>Agendamento · CRM Básico · Perfil do Profissional</strong></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {modulos.map(m => {
                const on = form.modulos.includes(m);
                return (
                  <div key={m} onClick={() => toggleMod(m)} style={{
                    padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                    border: `1.5px solid ${on ? T.lime : T.border}`,
                    background: on ? T.limeSoft : T.surface,
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span style={{ fontSize: 12, color: on ? T.lime : T.muted, fontWeight: on ? 600 : 400 }}>{m}</span>
                    <div style={{ width: 30, height: 16, borderRadius: 8, background: on ? T.lime : T.border, position: "relative", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: on ? T.bg : T.muted }} />
                    </div>
                  </div>
                );
              })}
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
                ["Plano", form.plano],
                ["Admin", `${form.adminNome || "—"} · ${form.contato || "—"}`],
                ["Módulos ativos", `${form.modulos.length + 3} módulos`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.border}22` }}>
                  <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
                  <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <div style={{ fontSize: 11, color: T.muted }}>Módulos e plano ainda não são persistidos de verdade — chegam nos Sprints 4/5.</div>
            <div onClick={saving ? undefined : criarBarbearia} style={{ background: T.lime, borderRadius: 8, padding: "12px 20px", textAlign: "center", cursor: saving ? "default" : "pointer", fontSize: 14, fontWeight: 800, color: T.bg, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Criando..." : "Criar Barbearia"}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <Btn variant="ghost" size="sm" onClick={() => setStep(s => Math.max(1, s - 1))}>← Anterior</Btn>
          {step < 4 && <Btn size="sm" onClick={() => setStep(s => s + 1)}>Próximo →</Btn>}
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: PLANOS & PREÇOS
// ────────────────────────────────────────────────────────
const Planos = () => {
  const planos = [
    { id: "trial", nome: "Trial", preco: 0, barbearias: 0, limite: "14 dias", cor: T.muted },
    { id: "starter", nome: "Starter", preco: 99, barbearias: 2, limite: "até 2 barbeiros", cor: T.info },
    { id: "pro", nome: "Pro", preco: 299, barbearias: 3, limite: "até 10 barbeiros", cor: T.lime, destaque: true },
    { id: "enterprise", nome: "Enterprise", preco: null, barbearias: 2, limite: "ilimitado", cor: T.warning },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Planos & Preços</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Estrutura comercial da plataforma</div>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        {planos.map(p => (
          <div key={p.id} style={{
            flex: 1, minWidth: 190, background: T.card, border: `1.5px solid ${p.destaque ? p.cor : T.border}`,
            borderRadius: 14, padding: 20, position: "relative", overflow: "hidden"
          }}>
            {p.destaque && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: p.cor }} />}
            <div style={{ fontSize: 13, fontWeight: 800, color: p.cor, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.nome}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: T.text, marginBottom: 4 }}>{p.preco !== null ? `R$ ${p.preco}` : "Negociado"}</div>
            {p.preco !== null && <div style={{ fontSize: 11, color: T.muted, marginBottom: 14 }}>/mês por barbearia</div>}
            <div style={{ fontSize: 12, color: T.mutedHi, marginBottom: 6 }}>• {p.limite}</div>
            <div style={{ fontSize: 12, color: T.mutedHi }}>• {p.barbearias} barbearias ativas</div>
          </div>
        ))}
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>Comparativo de módulos por plano</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: "8px 0", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Módulo</th>
              {["Trial", "Starter", "Pro", "Enterprise"].map(p => <th key={p} style={{ padding: "8px 16px", fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              ["Agendamento", true, true, true, true],
              ["CRM Básico", true, true, true, true],
              ["Comissões", false, true, true, true],
              ["Assinaturas", false, false, true, true],
              ["WhatsApp/SMS", false, false, true, true],
              ["Dashboard Avançado", false, false, true, true],
              ["Estoque", false, false, true, true],
              ["Marketing", false, false, false, true],
            ].map(([mod, ...vals]) => (
              <tr key={mod} style={{ borderBottom: `1px solid ${T.border}22` }}>
                <td style={{ padding: "10px 0", fontSize: 13, color: T.text }}>{mod}</td>
                {vals.map((v, i) => <td key={i} style={{ padding: "10px 16px", textAlign: "center", fontSize: 14 }}>{v ? <span style={{ color: T.success }}>✓</span> : <span style={{ color: T.muted }}>✕</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: FINANCEIRO / MRR
// ────────────────────────────────────────────────────────
const Financeiro = () => {
  const [tab, setTab] = useState("mrr");
  const receitas = [
    { tenant: "Barberaria", plano: "Pro", valor: "R$ 299,00", data: "01/06/2025", status: "pago" },
    { tenant: "Corte Fino", plano: "Starter", valor: "R$ 99,00", data: "03/06/2025", status: "pago" },
    { tenant: "Dom Barbeiro", plano: "Pro", valor: "R$ 299,00", data: "05/06/2025", status: "pago" },
    { tenant: "Studio Cuts", plano: "Trial", valor: "—", data: "—", status: "trial" },
    { tenant: "Vintage Barber", plano: "Starter", valor: "R$ 99,00", data: "10/05/2025", status: "inadimplente" },
  ];
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
  const mrr =    [199,   199,   298,   398,   697,  796];
  const max = Math.max(...mrr);

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Receita & MRR</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Acompanhamento financeiro da plataforma</div>
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <Stat label="MRR Atual" value="R$ 796" sub="+14% vs mai" trend="up" />
        <Stat label="ARR Projetado" value="R$ 9.552" sub="anualizado" />
        <Stat label="Inadimplentes" value="1" sub="R$ 99 em aberto" accent={T.danger} />
        <Stat label="Trials ativos" value="1" sub="conversão pendente" accent={T.warning} />
      </div>
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
        {[["mrr", "Evolução MRR"], ["pagamentos", "Pagamentos"]].map(([id, label]) => (
          <div key={id} onClick={() => setTab(id)} style={{ padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: tab === id ? T.lime : T.muted, borderBottom: tab === id ? `2px solid ${T.lime}` : "2px solid transparent" }}>{label}</div>
        ))}
      </div>

      {tab === "mrr" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 20 }}>MRR Mensal — 2025</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160 }}>
            {meses.map((m, i) => (
              <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, color: T.lime, fontWeight: 700 }}>R${mrr[i]}</div>
                <div style={{ width: "100%", background: i === meses.length - 1 ? T.lime : T.lime + "50", borderRadius: "6px 6px 0 0", height: `${(mrr[i] / max) * 120}px` }} />
                <div style={{ fontSize: 11, color: T.muted }}>{m}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "pagamentos" && (
        <Table
          cols={["Barbearia", "Plano", "Valor", "Data", "Status"]}
          rows={receitas.map((r, i) => (
            <TRow key={i} last={i === receitas.length - 1} cells={[
              <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{r.tenant}</span>,
              <Badge color={r.plano === "Pro" ? T.lime : T.mutedHi}>{r.plano}</Badge>,
              <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{r.valor}</span>,
              <span style={{ fontSize: 13, color: T.muted }}>{r.data}</span>,
              <Badge color={r.status === "pago" ? T.success : r.status === "trial" ? T.warning : T.danger}>{r.status}</Badge>,
            ]} />
          ))}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: USUÁRIOS
// ────────────────────────────────────────────────────────
const roleColor = { super_admin: T.lime, admin: T.info, barbeiro: T.warning, cliente: T.mutedHi };

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFiltro, setRoleFiltro] = useState("");

  useEffect(() => {
    setLoading(true);
    getUsers(roleFiltro ? { role: roleFiltro } : {})
      .then((res) => setUsuarios(res.items))
      .finally(() => setLoading(false));
  }, [roleFiltro]);

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Usuários</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{usuarios.length} usuários {roleFiltro ? `(${roleFiltro})` : "em toda a plataforma"}</div>
        </div>
        <Select
          value={roleFiltro}
          onChange={(e) => setRoleFiltro(e.target.value)}
          options={[
            { value: "", label: "Todos os papéis" },
            { value: "super_admin", label: "Super Admin" },
            { value: "admin", label: "Admin" },
            { value: "barbeiro", label: "Barbeiro" },
            { value: "cliente", label: "Cliente" },
          ]}
        />
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
      ) : (
        <Table
          cols={["Usuário", "Role", "Barbearia", "Status"]}
          rows={usuarios.map((u, i) => (
            <TRow key={u.id} last={i === usuarios.length - 1} cells={[
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={u.name} size={28} color={roleColor[u.role]} />
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>{u.email}</div>
                </div>
              </div>,
              <Badge color={roleColor[u.role]}>{u.role}</Badge>,
              <span style={{ fontSize: 13, color: T.muted }}>{u.tenantName || "—"}</span>,
              <Badge color={u.active !== false ? T.success : T.danger}>{u.active !== false ? "ativo" : "inativo"}</Badge>,
            ]} />
          ))}
        />
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
// TELA: ASSINATURAS
// ────────────────────────────────────────────────────────
const Assinaturas = () => {
  const assinaturas = [
    { barbearia: "Barberaria", plano: "Pro", valor: "R$ 299", ciclo: "mensal", inicio: "Jan/2025", proxima: "01/07/2025", status: "ativo" },
    { barbearia: "Corte Fino", plano: "Starter", valor: "R$ 99", ciclo: "mensal", inicio: "Mar/2025", proxima: "03/07/2025", status: "ativo" },
    { barbearia: "Dom Barbeiro", plano: "Pro", valor: "R$ 299", ciclo: "mensal", inicio: "Fev/2025", proxima: "05/07/2025", status: "ativo" },
    { barbearia: "Vintage Barber", plano: "Starter", valor: "R$ 99", ciclo: "mensal", inicio: "Nov/2024", proxima: "10/05/2025", status: "inadimplente" },
    { barbearia: "Studio Cuts", plano: "Trial", valor: "—", ciclo: "trial", inicio: "Jun/2025", proxima: "24/06/2025", status: "trial" },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Assinaturas</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Controle de contratos e cobranças</div>
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Assinaturas ativas" value="3" sub="pagantes" />
        <Stat label="MRR" value="R$ 697" sub="recorrente confirmado" />
        <Stat label="Inadimplentes" value="1" sub="cobrar urgente" accent={T.danger} />
        <Stat label="Trials" value="1" sub="vence em 13 dias" accent={T.warning} />
      </div>
      <Table
        cols={["Barbearia", "Plano", "Valor", "Ciclo", "Próxima cobrança", "Status"]}
        rows={assinaturas.map((a, i) => (
          <TRow key={i} last={i === assinaturas.length - 1} cells={[
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={a.barbearia} size={28} />
              <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{a.barbearia}</span>
            </div>,
            <Badge color={a.plano === "Pro" ? T.lime : a.plano === "Trial" ? T.warning : T.mutedHi}>{a.plano}</Badge>,
            <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{a.valor}</span>,
            <span style={{ fontSize: 12, color: T.muted }}>{a.ciclo}</span>,
            <span style={{ fontSize: 13, color: T.muted }}>{a.proxima}</span>,
            <Badge color={a.status === "ativo" ? T.success : a.status === "trial" ? T.warning : T.danger}>{a.status}</Badge>,
          ]} />
        ))}
      />
    </div>
  );
};

// ────────────────────────────────────────────────────────
// TELA: CONFIGURAÇÕES
// ────────────────────────────────────────────────────────
const Config = () => (
  <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Configurações da Plataforma</div>
      <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Parâmetros globais da Desenvolva IN</div>
    </div>
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 14 }}>
        {[["Domínio base", "barberaria.app"], ["E-mail de suporte", "suporte@desenvolvain.com"], ["Webhook de pagamentos", "https://api.barberaria.app/webhooks/pay"], ["Trial padrão", "14 dias"]].map(([label, val]) => (
          <div key={label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 280, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 16 }}>Identidade da Plataforma</div>
        <div style={{ background: T.bg, borderRadius: 10, padding: 20, border: `1px solid ${T.border}`, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: T.lime, letterSpacing: "0.06em" }}>✂ DESENVOLVA IN</div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>Painel Master · Incubadora</div>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {[["Fundo", "#080B12"], ["Acento", "#A3E635"]].map(([label, hex]) => (
            <div key={label} style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600 }}>{label}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: `1px solid ${T.border}` }} />
                <span style={{ fontSize: 12, color: T.text, fontFamily: "monospace" }}>{hex}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: T.lime, borderRadius: 8, padding: "10px 16px", textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.bg }}>Salvar configurações</div>
      </div>
    </div>
  </div>
);

// ────────────────────────────────────────────────────────
// TELA: REPASSES
// ────────────────────────────────────────────────────────
const Repasses = () => {
  const repasses = [
    { barbearia: "Barberaria", periodo: "Maio 2025", receita: "R$ 4.340", taxa: "15%", repasse: "R$ 3.689", status: "pago" },
    { barbearia: "Dom Barbeiro", periodo: "Maio 2025", receita: "R$ 3.100", taxa: "15%", repasse: "R$ 2.635", status: "pago" },
    { barbearia: "Corte Fino", periodo: "Maio 2025", receita: "R$ 1.800", taxa: "15%", repasse: "R$ 1.530", status: "pendente" },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>Repasses</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Controle de repasse de receita às barbearias (fee da plataforma)</div>
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Total recebido" value="R$ 9.240" sub="Maio 2025" />
        <Stat label="Fee da plataforma" value="R$ 1.386" sub="15% médio" />
        <Stat label="A repassar" value="R$ 1.530" sub="Corte Fino pendente" accent={T.warning} />
      </div>
      <Table
        cols={["Barbearia", "Período", "Receita bruta", "Taxa", "Repasse líquido", "Status"]}
        rows={repasses.map((r, i) => (
          <TRow key={i} last={i === repasses.length - 1} cells={[
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={r.barbearia} size={28} />
              <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{r.barbearia}</span>
            </div>,
            <span style={{ fontSize: 12, color: T.muted }}>{r.periodo}</span>,
            <span style={{ fontSize: 13, color: T.text }}>{r.receita}</span>,
            <Badge color={T.mutedHi}>{r.taxa}</Badge>,
            <span style={{ fontSize: 13, color: T.lime, fontWeight: 700 }}>{r.repasse}</span>,
            <Badge color={r.status === "pago" ? T.success : T.warning}>{r.status}</Badge>,
          ]} />
        ))}
      />
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
      })
      .catch(() => {
        setAccessToken(null);
        setScreen("login");
      });
  }, []);

  const handleLogin = async (email, password) => {
    const res = await apiLogin(email, password);
    if (res.user.role !== "super_admin") {
      throw new Error("Esse painel é só para o Super Admin da incubadora.");
    }
    setAccessToken(res.accessToken);
    const me = await whoami();
    setUser(me);
    setScreen("app");
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
    if (page === "assinaturas") return <Assinaturas />;
    if (page === "financeiro")  return <Financeiro />;
    if (page === "repasses")    return <Repasses />;
    if (page === "usuarios")    return <Usuarios />;
    if (page === "suporte")     return <Suporte />;
    if (page === "releases")    return <Releases />;
    if (page === "config")      return <Config />;
    return <Dashboard setActive={setPage} />;
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: T.bg, minHeight: "100vh", display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar active={page} setActive={setPage} user={user} onLogout={handleLogout} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: T.muted }}>
            Desenvolva IN <span style={{ color: T.border, margin: "0 6px" }}>›</span>
            <span style={{ color: T.mutedHi, textTransform: "capitalize" }}>{page}</span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Badge color={T.success} small>Sistema operacional</Badge>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.success }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex" }}>
          {render()}
        </div>
      </div>
    </div>
  );
}
