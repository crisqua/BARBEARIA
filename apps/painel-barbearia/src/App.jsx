import { useEffect, useState } from "react";
import {
  assignService,
  createProfessional,
  createService,
  createWorkingHour,
  deleteWorkingHour,
  getAccessToken,
  getMe,
  getMyTenant,
  listAppointments,
  listProfessionalServices,
  listProfessionals,
  listServices,
  listWorkingHours,
  login as apiLogin,
  logout as apiLogout,
  setAccessToken,
  unassignService,
  updateMyTenant,
  updateProfessional,
  updateService,
} from "./api/client";

// ─── TOKENS (Barberaria) ──────────────────────────
const T = {
  bg: "#0F0F0F",
  surface: "#181818",
  card: "#1F1F1F",
  gold: "#C9A84C",
  goldDim: "#8a6e2e",
  text: "#F5F0E8",
  muted: "#777",
  border: "#2a2a2a",
  success: "#34D399",
  warning: "#F5A623",
};

// ─── SHARED MICRO COMPONENTS ──────────────────────────────
const Badge = ({ color, children }) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}44`,
    borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600,
    letterSpacing: "0.04em", textTransform: "uppercase"
  }}>{children}</span>
);

const Avatar = ({ name, size = 32 }) => {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: T.gold + "22", border: `1.5px solid ${T.gold}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: T.gold, flexShrink: 0
    }}>{initials}</div>
  );
};

const Stat = ({ label, value, sub }) => (
  <div style={{
    background: T.card, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 130
  }}>
    <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: T.gold, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{sub}</div>}
  </div>
);

const ErrorBox = ({ children }) => (
  <div style={{ background: "#F25C5C22", border: "1px solid #F25C5C55", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#F25C5C", marginBottom: 14 }}>
    {children}
  </div>
);

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{children}</div>
);

const fieldStyle = {
  width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
  padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box",
};

const thStyle = { padding: "12px 20px", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" };

const ToggleSwitch = ({ on, onClick, labelOn = "Ativo", labelOff = "Inativo" }) => (
  <div onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
    <div style={{ width: 32, height: 18, borderRadius: 9, background: on ? T.gold : T.border, position: "relative" }}>
      <div style={{ position: "absolute", top: 3, left: on ? 15 : 3, width: 12, height: 12, borderRadius: "50%", background: on ? T.bg : "#555", transition: "left 0.2s" }} />
    </div>
    <span style={{ fontSize: 11, color: on ? T.success : T.muted }}>{on ? labelOn : labelOff}</span>
  </div>
);

const formatPrice = (cents) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_FULL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function nextDays(count = 7) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    d.setUTCHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

const dateKey = (d) => d.toISOString().slice(0, 10);

// Horários vêm em UTC do backend e são tratados como "hora local da barbearia"
// (sem conversão de fuso — mesma simplificação de MVP da Sprint 5).
const formatSlotTime = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

const STATUS_LABEL = { scheduled: "agendado", completed: "concluído", cancelled: "cancelado" };
const STATUS_COLOR = { scheduled: T.gold, completed: T.success, cancelled: "#F25C5C" };

// ─── LOGIN ─────────────────────────────────────────────────
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
          <div style={{ width: 44, height: 44, borderRadius: 10, background: T.gold + "22", border: `1.5px solid ${T.gold}55`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 20 }}>✂</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.gold, letterSpacing: "0.06em" }}>PAINEL DA BARBEARIA</div>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div style={{ marginBottom: 14 }}>
          <FieldLabel>E-mail</FieldLabel>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 22 }}>
          <FieldLabel>Senha</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={fieldStyle}
          />
        </div>
        <div onClick={loading ? undefined : submit} style={{ background: T.gold, borderRadius: 8, padding: "12px", textAlign: "center", fontSize: 13, fontWeight: 700, color: T.bg, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Entrando..." : "Entrar"}
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────
const Sidebar = ({ active, setActive, user, onLogout }) => {
  const sections = [
    { label: null, items: [{ id: "dashboard", icon: "⊞", label: "Dashboard" }] },
    {
      label: "Operação",
      items: [
        { id: "agenda", icon: "◷", label: "Agenda" },
        { id: "profissionais", icon: "◉", label: "Profissionais" },
        { id: "servicos", icon: "✂", label: "Serviços" },
      ],
    },
    { label: null, items: [{ id: "config", icon: "⚙", label: "Configurações" }] },
  ];
  return (
    <div style={{
      width: 240, background: T.surface, borderRight: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0,
      height: "100vh", overflowY: "auto"
    }}>
      <div style={{ padding: "0 20px 24px" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: T.gold + "22",
          border: `1.5px solid ${T.gold}55`, display: "flex", alignItems: "center",
          justifyContent: "center", marginBottom: 10, fontSize: 18
        }}>✂</div>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 800, letterSpacing: "0.08em" }}>BARBERARIA</div>
        <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>Barber Shop · Painel</div>
      </div>
      <div style={{ flex: 1 }}>
        {sections.map((sec, si) => (
          <div key={si} style={{ marginBottom: 4 }}>
            {sec.label && (
              <div style={{ padding: "14px 20px 6px", fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{sec.label}</div>
            )}
            {sec.items.map(i => (
              <div key={i.id} onClick={() => setActive(i.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 20px",
                cursor: "pointer", borderLeft: active === i.id ? `2px solid ${T.gold}` : "2px solid transparent",
                background: active === i.id ? T.gold + "10" : "transparent",
                color: active === i.id ? T.gold : T.muted,
                fontSize: 13, fontWeight: active === i.id ? 600 : 400,
              }}>
                <span style={{ fontSize: 14, width: 16, textAlign: "center" }}>{i.icon}</span> {i.label}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Avatar name={user?.name || "Admin"} size={28} />
          <div>
            <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: T.muted }}>Administrador</div>
          </div>
        </div>
        <div onClick={onLogout} style={{ fontSize: 11, color: T.muted, cursor: "pointer" }}>Sair</div>
      </div>
    </div>
  );
};

// ─── DASHBOARD ────────────────────────────────────────────
function Dashboard() {
  const [appointments, setAppointments] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 24 * 60 * 60_000);
    Promise.all([
      listAppointments({ from: from.toISOString(), to: to.toISOString() }),
      listProfessionals(),
      listServices(),
    ])
      .then(([apptRes, profRes, svcRes]) => {
        setAppointments(apptRes.items);
        setProfessionals(profRes.items);
        setServices(svcRes.items);
      })
      .finally(() => setLoading(false));
  }, []);

  const proName = (id) => professionals.find((p) => p.id === id)?.name || "—";
  const svcName = (id) => services.find((s) => s.id === id)?.name || "—";
  const sorted = [...appointments].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Dashboard</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4, textTransform: "capitalize" }}>{hoje}</div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <Stat label="Agendamentos hoje" value={String(appointments.length)} sub={`${appointments.filter((a) => a.status === "scheduled").length} agendados`} />
        <Stat label="Profissionais ativos" value={String(professionals.length)} />
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.text }}>
          Agenda de Hoje
        </div>
        {loading && <div style={{ padding: 20, fontSize: 12, color: T.muted }}>Carregando…</div>}
        {!loading && sorted.length === 0 && <div style={{ padding: 20, fontSize: 12, color: T.muted }}>Nenhum agendamento hoje.</div>}
        {sorted.map((a, i) => (
          <div key={a.id} style={{ padding: "14px 20px", borderBottom: i < sorted.length - 1 ? `1px solid ${T.bg}` : "none", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 50, fontSize: 13, fontWeight: 700, color: T.gold }}>{formatSlotTime(a.startsAt)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{svcName(a.serviceId)}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{proName(a.professionalId)}</div>
            </div>
            <Badge color={STATUS_COLOR[a.status]}>{STATUS_LABEL[a.status]}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AGENDA (navegável por dia, colunas por profissional) ──
function Agenda() {
  const [professionals, setProfessionals] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => nextDays()[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listProfessionals(), listServices()]).then(([p, s]) => {
      setProfessionals(p.items);
      setServices(s.items);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const from = new Date(`${dateKey(selectedDate)}T00:00:00.000Z`);
    const to = new Date(from.getTime() + 24 * 60 * 60_000);
    listAppointments({ from: from.toISOString(), to: to.toISOString() })
      .then((r) => setAppointments(r.items))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const svcName = (id) => services.find((s) => s.id === id)?.name || "—";
  const days = nextDays(14);

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Agenda</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{professionals.length} profissionais</div>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 24, paddingBottom: 4 }}>
        {days.map((d) => {
          const active = dateKey(d) === dateKey(selectedDate);
          return (
            <div key={dateKey(d)} onClick={() => setSelectedDate(d)} style={{
              flexShrink: 0, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
              background: active ? T.gold + "22" : T.card,
              border: `1.5px solid ${active ? T.gold : T.border}`,
              textAlign: "center", minWidth: 56,
            }}>
              <div style={{ fontSize: 10, color: active ? T.gold : T.muted }}>{WEEKDAY_LABELS[d.getUTCDay()]}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: active ? T.gold : T.text }}>{d.getUTCDate()}</div>
            </div>
          );
        })}
      </div>

      {professionals.length === 0 ? (
        <div style={{ fontSize: 12, color: T.muted }}>Nenhum profissional cadastrado ainda.</div>
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {professionals.map((p) => {
            const items = appointments
              .filter((a) => a.professionalId === p.id)
              .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
            return (
              <div key={p.id} style={{ flex: 1, minWidth: 240, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.name} size={26} />
                  <span style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{p.name}</span>
                </div>
                {loading && <div style={{ padding: 14, fontSize: 12, color: T.muted }}>Carregando…</div>}
                {!loading && items.length === 0 && <div style={{ padding: 14, fontSize: 12, color: T.muted }}>Sem agendamentos.</div>}
                {!loading && items.map((a, i) => (
                  <div key={a.id} style={{ padding: "10px 16px", borderBottom: i < items.length - 1 ? `1px solid ${T.bg}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: T.gold, fontWeight: 700 }}>{formatSlotTime(a.startsAt)}</span>
                      <Badge color={STATUS_COLOR[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: T.text, marginTop: 2 }}>{svcName(a.serviceId)}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CLIENTES (fora de navegação, código mantido) ─────────
const Clientes = () => {
  const clientes = [
    { nome: "Rafael Alves", visitas: 12, ultima: "11/06/2025", gasto: "R$ 780", plano: "Black ♾" },
    { nome: "João Pedro", visitas: 5, ultima: "08/06/2025", gasto: "R$ 200", plano: "—" },
    { nome: "Marcos Lima", visitas: 9, ultima: "11/06/2025", gasto: "R$ 540", plano: "—" },
    { nome: "Thiago Costa", visitas: 21, ultima: "11/06/2025", gasto: "R$ 1.365", plano: "Black ♾" },
    { nome: "Bruno Melo", visitas: 3, ultima: "11/06/2025", gasto: "R$ 60", plano: "—" },
    { nome: "Felipe Souza", visitas: 7, ultima: "05/06/2025", gasto: "R$ 280", plano: "—" },
    { nome: "Anderson Nunes", visitas: 15, ultima: "10/06/2025", gasto: "R$ 525", plano: "Black ♾" },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Clientes</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>127 clientes cadastrados</div>
        </div>
        <input placeholder="Buscar cliente..." style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: "10px 16px", color: T.text, fontSize: 13, outline: "none", width: 220
        }} />
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Cliente", "Visitas", "Última Visita", "Total Gasto", "Plano"].map(h => (
                <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clientes.map((c, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.bg}`, cursor: "pointer" }}>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={c.nome} size={28} />
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{c.nome}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.muted }}>{c.visitas}</td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.muted }}>{c.ultima}</td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.text, fontWeight: 600 }}>{c.gasto}</td>
                <td style={{ padding: "12px 20px" }}>
                  {c.plano !== "—" ? <Badge color={T.gold}>{c.plano}</Badge> : <span style={{ fontSize: 12, color: T.muted }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── COMISSÕES (fora de navegação, código mantido) ────────
const Comissoes = () => {
  const dados = [
    { nome: "Carlos Silva", atend: 18, faturado: "R$ 1.080", percentual: "50%", comissao: "R$ 540" },
    { nome: "Victor Mendes", atend: 22, faturado: "R$ 1.320", percentual: "50%", comissao: "R$ 660" },
    { nome: "Rafael Costa", atend: 15, faturado: "R$ 900", percentual: "50%", comissao: "R$ 450" },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Comissões</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Junho 2025 · Fechamento dia 30</div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <Stat label="Total Faturado" value="R$ 3.300" sub="55 atendimentos" />
        <Stat label="Total em Comissões" value="R$ 1.650" sub="50% médio" />
        <Stat label="A Pagar" value="R$ 1.650" sub="vence em 19 dias" />
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Extrato por Profissional</div>
          <div style={{ fontSize: 12, color: T.gold, cursor: "pointer" }}>Configurar regras</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Profissional", "Atendimentos", "Faturado", "% Comissão", "Valor"].map(h => (
                <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map((d, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.bg}` }}>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={d.nome} size={28} />
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{d.nome}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.muted }}>{d.atend}</td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.text }}>{d.faturado}</td>
                <td style={{ padding: "12px 20px" }}><Badge color={T.gold}>{d.percentual}</Badge></td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.gold, fontWeight: 700 }}>{d.comissao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── ASSINATURAS (fora de navegação, código mantido) ──────
const Assinaturas = () => {
  const assinantes = [
    { nome: "Rafael Alves", plano: "Black ♾", desde: "Jan/2025", status: "ativo", proxima: "10/07/2025" },
    { nome: "Thiago Costa", plano: "Black ♾", desde: "Mar/2025", status: "ativo", proxima: "15/07/2025" },
    { nome: "Anderson Nunes", plano: "Black ♾", desde: "Fev/2025", status: "atrasado", proxima: "05/06/2025" },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Assinaturas</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Plano Black ♾ · R$ 120/mês</div>
        </div>
        <div style={{ background: T.gold, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>+ Novo plano</div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <Stat label="Assinantes ativos" value="3" sub="de 127 clientes" />
        <Stat label="MRR Assinaturas" value="R$ 360" sub="recorrente" />
        <Stat label="Em atraso" value="1" sub="enviar cobrança" />
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Cliente", "Plano", "Assinante desde", "Próx. cobrança", "Status"].map(h => (
                <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assinantes.map((a, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.bg}` }}>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={a.nome} size={28} />
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{a.nome}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 20px" }}><Badge color={T.gold}>{a.plano}</Badge></td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.muted }}>{a.desde}</td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.text }}>{a.proxima}</td>
                <td style={{ padding: "12px 20px" }}>
                  <Badge color={a.status === "ativo" ? T.success : T.warning}>{a.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── SERVIÇOS ─────────────────────────────────────────────
function Servicos() {
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | id
  const [form, setForm] = useState({ name: "", durationMinutes: "", priceReais: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => listServices().then((r) => setServicos(r.items)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const startNew = () => { setForm({ name: "", durationMinutes: "", priceReais: "" }); setError(""); setEditing("new"); };
  const startEdit = (s) => {
    setForm({ name: s.name, durationMinutes: String(s.durationMinutes), priceReais: (s.priceCents / 100).toFixed(2).replace(".", ",") });
    setError("");
    setEditing(s.id);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const priceCents = Math.round(parseFloat(form.priceReais.replace(",", ".")) * 100);
      const durationMinutes = parseInt(form.durationMinutes, 10);
      if (!form.name || Number.isNaN(priceCents) || Number.isNaN(durationMinutes)) {
        throw new Error("Preencha nome, duração e preço corretamente.");
      }
      if (editing === "new") {
        await createService({ name: form.name, priceCents, durationMinutes });
      } else {
        await updateService(editing, { name: form.name, priceCents, durationMinutes });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (s) => {
    await updateService(s.id, { active: !s.active });
    load();
  };

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Serviços</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{servicos.length} serviços cadastrados · {servicos.filter((s) => s.active).length} ativos</div>
        </div>
        <div onClick={startNew} style={{ background: T.gold, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>+ Novo serviço</div>
      </div>

      {editing !== null && (
        <div style={{ background: T.card, border: `1.5px solid ${T.gold}55`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginBottom: 16 }}>
            {editing === "new" ? "Novo Serviço" : "Editar Serviço"}
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <FieldLabel>Nome do serviço</FieldLabel>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Barba + Cabelo" style={fieldStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <FieldLabel>Duração (min)</FieldLabel>
              <input value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value.replace(/\D/g, "") }))} placeholder="45" style={fieldStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <FieldLabel>Preço (R$)</FieldLabel>
              <input value={form.priceReais} onChange={(e) => setForm((f) => ({ ...f, priceReais: e.target.value }))} placeholder="0,00" style={fieldStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div onClick={saving ? undefined : save} style={{ background: T.gold, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Salvando..." : "Salvar"}</div>
            <div onClick={() => setEditing(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: T.muted, cursor: "pointer" }}>Cancelar</div>
          </div>
        </div>
      )}

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 20, fontSize: 12, color: T.muted }}>Carregando…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Serviço", "Duração", "Preço", "Status", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {servicos.map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${T.bg}`, opacity: s.active ? 1 : 0.5 }}>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: T.text, fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>✂</span> {s.name}
                    </div>
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: T.muted }}>{s.durationMinutes} min</td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: T.gold, fontWeight: 700 }}>{formatPrice(s.priceCents)}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <ToggleSwitch on={s.active} onClick={() => toggleAtivo(s)} />
                  </td>
                  <td style={{ padding: "12px 20px", textAlign: "right" }}>
                    <span onClick={() => startEdit(s)} style={{ fontSize: 12, color: T.gold, cursor: "pointer" }}>Editar</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── PROFISSIONAIS ──────────────────────────────────────────
function ProfissionalDetalhe({ professional, allServices }) {
  const [myServices, setMyServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingHour, setAddingHour] = useState(false);
  const [hourForm, setHourForm] = useState({ weekday: 1, startTime: "09:00", endTime: "18:00" });
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([listProfessionalServices(professional.id), listWorkingHours(professional.id)])
      .then(([svcs, wh]) => { setMyServices(svcs); setHours(wh); })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, [professional.id]);

  const hasService = (id) => myServices.some((s) => s.id === id);

  const toggleService = async (serviceId) => {
    setError("");
    try {
      if (hasService(serviceId)) {
        await unassignService(professional.id, serviceId);
      } else {
        await assignService(professional.id, serviceId);
      }
      load();
    } catch (e) {
      setError(e.message || "Não foi possível atualizar.");
    }
  };

  const addHour = async () => {
    setError("");
    try {
      await createWorkingHour(professional.id, {
        weekday: Number(hourForm.weekday),
        startTime: hourForm.startTime,
        endTime: hourForm.endTime,
      });
      setAddingHour(false);
      load();
    } catch (e) {
      setError(e.message || "Não foi possível adicionar o horário.");
    }
  };

  const removeHour = async (id) => {
    await deleteWorkingHour(professional.id, id);
    load();
  };

  if (loading) return <div style={{ padding: 16, fontSize: 12, color: T.muted, borderTop: `1px solid ${T.border}` }}>Carregando…</div>;

  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
      {error && <div style={{ width: "100%" }}><ErrorBox>{error}</ErrorBox></div>}

      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Serviços que realiza</div>
        {allServices.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>Nenhum serviço cadastrado ainda.</div>}
        {allServices.map((s) => (
          <div key={s.id} onClick={() => toggleService(s.id)} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 10px", marginBottom: 6, borderRadius: 6, cursor: "pointer",
            border: `1px solid ${hasService(s.id) ? T.gold + "55" : T.border}`,
            background: hasService(s.id) ? T.gold + "0C" : "transparent",
          }}>
            <span style={{ fontSize: 12, color: hasService(s.id) ? T.gold : T.muted }}>{s.name}</span>
            <span style={{ fontSize: 11, color: hasService(s.id) ? T.gold : T.muted }}>{hasService(s.id) ? "✓ associado" : "adicionar"}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Horário de trabalho</div>
          <span onClick={() => setAddingHour((a) => !a)} style={{ fontSize: 11, color: T.gold, cursor: "pointer" }}>+ Adicionar</span>
        </div>
        {addingHour && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <select value={hourForm.weekday} onChange={(e) => setHourForm((f) => ({ ...f, weekday: e.target.value }))} style={{ ...fieldStyle, width: 120 }}>
              {WEEKDAY_FULL.map((w, i) => <option key={i} value={i}>{w}</option>)}
            </select>
            <input value={hourForm.startTime} onChange={(e) => setHourForm((f) => ({ ...f, startTime: e.target.value }))} placeholder="09:00" style={{ ...fieldStyle, width: 70 }} />
            <input value={hourForm.endTime} onChange={(e) => setHourForm((f) => ({ ...f, endTime: e.target.value }))} placeholder="18:00" style={{ ...fieldStyle, width: 70 }} />
            <div onClick={addHour} style={{ background: T.gold, borderRadius: 6, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: T.bg, cursor: "pointer" }}>Salvar</div>
          </div>
        )}
        {hours.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>Nenhum horário cadastrado.</div>}
        {hours.map((h) => (
          <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", marginBottom: 6, background: T.surface, borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: T.text }}>{WEEKDAY_FULL[h.weekday]} · {h.startTime}–{h.endTime}</span>
            <span onClick={() => removeHour(h.id)} style={{ fontSize: 11, color: "#F25C5C", cursor: "pointer" }}>Remover</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Profissionais() {
  const [profissionais, setProfissionais] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | id
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);

  const load = () =>
    Promise.all([listProfessionals(), listServices()])
      .then(([p, s]) => { setProfissionais(p.items); setServices(s.items); })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const startNew = () => { setForm({ name: "", email: "", phone: "", password: "" }); setError(""); setEditing("new"); };
  const startEdit = (p) => { setForm({ name: p.name, email: p.email, phone: p.phone || "", password: "" }); setError(""); setEditing(p.id); };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (editing === "new") {
        await createProfessional({ name: form.name, email: form.email, phone: form.phone || undefined, password: form.password });
      } else {
        await updateProfessional(editing, { name: form.name, phone: form.phone || undefined });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Profissionais</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{profissionais.length} profissionais cadastrados</div>
        </div>
        <div onClick={startNew} style={{ background: T.gold, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>+ Novo profissional</div>
      </div>

      {editing !== null && (
        <div style={{ background: T.card, border: `1.5px solid ${T.gold}55`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginBottom: 16 }}>
            {editing === "new" ? "Novo Profissional" : "Editar Profissional"}
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <FieldLabel>Nome</FieldLabel>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={fieldStyle} />
            </div>
            {editing === "new" && (
              <div style={{ flex: 1, minWidth: 180 }}>
                <FieldLabel>E-mail</FieldLabel>
                <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={fieldStyle} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 140 }}>
              <FieldLabel>Telefone</FieldLabel>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={fieldStyle} />
            </div>
            {editing === "new" && (
              <div style={{ flex: 1, minWidth: 140 }}>
                <FieldLabel>Senha inicial</FieldLabel>
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} style={fieldStyle} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div onClick={saving ? undefined : save} style={{ background: T.gold, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Salvando..." : "Salvar"}</div>
            <div onClick={() => setEditing(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: T.muted, cursor: "pointer" }}>Cancelar</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: T.muted }}>Carregando…</div>
      ) : profissionais.length === 0 ? (
        <div style={{ fontSize: 12, color: T.muted }}>Nenhum profissional cadastrado ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {profissionais.map((p) => (
            <div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar name={p.name} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{p.email}{p.phone ? ` · ${p.phone}` : ""}</div>
                </div>
                <span onClick={() => startEdit(p)} style={{ fontSize: 12, color: T.gold, cursor: "pointer" }}>Editar</span>
                <span onClick={() => setExpanded(expanded === p.id ? null : p.id)} style={{ fontSize: 12, color: T.muted, cursor: "pointer" }}>
                  {expanded === p.id ? "Fechar ▲" : "Detalhes ▼"}
                </span>
              </div>
              {expanded === p.id && <ProfissionalDetalhe professional={p} allServices={services} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PRODUTOS (fora de navegação, código mantido) ─────────
const Produtos = () => {
  const [produtos, setProdutos] = useState([
    { id: 1, nome: "Gel Modelador Fixação Forte", categoria: "Cabelo", preco: "28,00", estoque: 14, ativo: true },
    { id: 2, nome: "Pomada Matte", categoria: "Cabelo", preco: "35,00", estoque: 8, ativo: true },
    { id: 3, nome: "Óleo para Barba", categoria: "Barba", preco: "32,00", estoque: 20, ativo: true },
    { id: 4, nome: "Balm Hidratante para Barba", categoria: "Barba", preco: "38,00", estoque: 5, ativo: true },
    { id: 5, nome: "Shampoo Anticaspa", categoria: "Cabelo", preco: "25,00", estoque: 0, ativo: false },
    { id: 6, nome: "Talco Pós-Barba", categoria: "Acessórios", preco: "18,00", estoque: 30, ativo: true },
  ]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nome: "", categoria: "Cabelo", preco: "", estoque: "" });

  const categorias = ["Cabelo", "Barba", "Acessórios", "Skincare"];

  const startNew = () => { setForm({ nome: "", categoria: "Cabelo", preco: "", estoque: "" }); setEditing("new"); };
  const startEdit = (p) => { setForm({ nome: p.nome, categoria: p.categoria, preco: p.preco, estoque: String(p.estoque) }); setEditing(p.id); };

  const save = () => {
    if (editing === "new") {
      setProdutos(p => [...p, { id: Date.now(), nome: form.nome, categoria: form.categoria, preco: form.preco, estoque: Number(form.estoque) || 0, ativo: true }]);
    } else {
      setProdutos(p => p.map(x => x.id === editing ? { ...x, nome: form.nome, categoria: form.categoria, preco: form.preco, estoque: Number(form.estoque) || 0 } : x));
    }
    setEditing(null);
  };

  const toggleAtivo = (id) => setProdutos(p => p.map(x => x.id === id ? { ...x, ativo: !x.ativo } : x));
  const remove = (id) => setProdutos(p => p.filter(x => x.id !== id));

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Venda de Produtos</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{produtos.length} produtos · {produtos.filter(p => p.estoque === 0).length} sem estoque</div>
        </div>
        <div onClick={startNew} style={{ background: T.gold, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>+ Novo produto</div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Produtos cadastrados" value={String(produtos.length)} sub={`${produtos.filter(p => p.ativo).length} ativos`} />
        <Stat label="Itens em estoque" value={String(produtos.reduce((a, p) => a + p.estoque, 0))} sub="total de unidades" />
        <Stat label="Sem estoque" value={String(produtos.filter(p => p.estoque === 0).length)} sub="repor urgente" />
      </div>

      {editing !== null && (
        <div style={{ background: T.card, border: `1.5px solid ${T.gold}55`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginBottom: 16 }}>
            {editing === "new" ? "Novo Produto" : "Editar Produto"}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nome do produto</div>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Pomada Matte"
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Categoria</div>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Preço (R$)</div>
              <div style={{ display: "flex", alignItems: "center", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0 14px" }}>
                <span style={{ fontSize: 13, color: T.muted, marginRight: 4 }}>R$</span>
                <input value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} placeholder="0,00"
                  style={{ width: "100%", background: "transparent", border: "none", padding: "10px 0", color: T.text, fontSize: 13, outline: "none" }} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Estoque</div>
              <input value={form.estoque} onChange={e => setForm(f => ({ ...f, estoque: e.target.value.replace(/\D/g, "") }))} placeholder="0"
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div onClick={save} style={{ background: T.gold, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>Salvar</div>
            <div onClick={() => setEditing(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: T.muted, cursor: "pointer" }}>Cancelar</div>
          </div>
        </div>
      )}

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Produto", "Categoria", "Preço", "Estoque", "Status", ""].map(h => (
                <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {produtos.map(p => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${T.bg}`, opacity: p.ativo ? 1 : 0.5 }}>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.text, fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>🧴</span> {p.nome}
                  </div>
                </td>
                <td style={{ padding: "12px 20px" }}><Badge color={T.gold}>{p.categoria}</Badge></td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.gold, fontWeight: 700 }}>R$ {p.preco}</td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: p.estoque === 0 ? "#F25C5C" : T.muted, fontWeight: p.estoque === 0 ? 700 : 400 }}>
                  {p.estoque === 0 ? "Sem estoque" : `${p.estoque} un.`}
                </td>
                <td style={{ padding: "12px 20px" }}>
                  <div onClick={() => toggleAtivo(p.id)} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <div style={{ width: 32, height: 18, borderRadius: 9, background: p.ativo ? T.gold : T.border, position: "relative" }}>
                      <div style={{ position: "absolute", top: 3, left: p.ativo ? 15 : 3, width: 12, height: 12, borderRadius: "50%", background: p.ativo ? T.bg : "#555", transition: "left 0.2s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: p.ativo ? T.success : T.muted }}>{p.ativo ? "Ativo" : "Inativo"}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 20px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 14, justifyContent: "flex-end" }}>
                    <span onClick={() => startEdit(p)} style={{ fontSize: 12, color: T.gold, cursor: "pointer" }}>Editar</span>
                    <span onClick={() => remove(p.id)} style={{ fontSize: 12, color: "#F25C5C", cursor: "pointer" }}>Remover</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── ESTOQUE & FORNECEDORES (fora de navegação, código mantido) ──
const Estoque = () => {
  const [tab, setTab] = useState("estoque");
  const itensEstoque = [
    { nome: "Pomada Matte", fornecedor: "Distribel Cosméticos", qtd: 8, minimo: 5, status: "ok" },
    { nome: "Óleo para Barba", fornecedor: "Barber Supply BR", qtd: 20, minimo: 8, status: "ok" },
    { nome: "Balm Hidratante para Barba", fornecedor: "Barber Supply BR", qtd: 5, minimo: 6, status: "baixo" },
    { nome: "Shampoo Anticaspa", fornecedor: "Distribel Cosméticos", qtd: 0, minimo: 5, status: "zerado" },
    { nome: "Talco Pós-Barba", fornecedor: "Casa do Barbeiro", qtd: 30, minimo: 10, status: "ok" },
    { nome: "Lâminas de Navalha", fornecedor: "Casa do Barbeiro", qtd: 12, minimo: 15, status: "baixo" },
  ];
  const fornecedores = [
    { nome: "Distribel Cosméticos", contato: "(11) 4002-8922", categoria: "Cosméticos", produtos: 2 },
    { nome: "Barber Supply BR", contato: "(11) 3344-5566", categoria: "Cabelo & Barba", produtos: 2 },
    { nome: "Casa do Barbeiro", contato: "(11) 9888-7766", categoria: "Acessórios", produtos: 2 },
  ];
  const statusColor = { ok: T.success, baixo: T.warning, zerado: "#F25C5C" };
  const statusLabel = { ok: "Normal", baixo: "Estoque baixo", zerado: "Zerado" };

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Estoque & Fornecedores</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Controle de inventário e parceiros</div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Itens cadastrados" value="6" sub="3 fornecedores" />
        <Stat label="Estoque baixo" value="2" sub="repor em breve" />
        <Stat label="Zerados" value="1" sub="ação urgente" />
      </div>
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
        {[["estoque", "Estoque"], ["fornecedores", "Fornecedores"]].map(([id, label]) => (
          <div key={id} onClick={() => setTab(id)} style={{
            padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            color: tab === id ? T.gold : T.muted,
            borderBottom: tab === id ? `2px solid ${T.gold}` : "2px solid transparent",
          }}>{label}</div>
        ))}
      </div>

      {tab === "estoque" ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Produto", "Fornecedor", "Qtd. Atual", "Mínimo", "Status"].map(h => (
                  <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itensEstoque.map((it, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.bg}` }}>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: T.text, fontWeight: 600 }}>{it.nome}</td>
                  <td style={{ padding: "12px 20px", fontSize: 12, color: T.muted }}>{it.fornecedor}</td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: T.text }}>{it.qtd} un.</td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: T.muted }}>{it.minimo} un.</td>
                  <td style={{ padding: "12px 20px" }}><Badge color={statusColor[it.status]}>{statusLabel[it.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fornecedores.map((f, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{f.nome}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{f.categoria} · {f.contato}</div>
              </div>
              <Badge color={T.gold}>{f.produtos} produtos</Badge>
            </div>
          ))}
          <div style={{ border: `1.5px dashed ${T.border}`, borderRadius: 12, padding: 16, textAlign: "center", color: T.gold, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Novo fornecedor</div>
        </div>
      )}
    </div>
  );
};

// ─── PACOTES & PROMOÇÕES (fora de navegação, código mantido) ──
const Pacotes = () => {
  const [pacotes, setPacotes] = useState([
    { id: 1, nome: "Combo Visual Completo", itens: "Corte + Barba + Sobrancelha", precoOriginal: "120,00", precoPromo: "95,00", ativo: true },
    { id: 2, nome: "Dia do Noivo", itens: "Corte + Barba + Hidratação + Pigmentação", precoOriginal: "180,00", precoPromo: "150,00", ativo: true },
    { id: 3, nome: "Pacote 4 Cortes", itens: "4 cortes para usar no mês", precoOriginal: "160,00", precoPromo: "130,00", ativo: false },
  ]);
  const toggleAtivo = (id) => setPacotes(p => p.map(x => x.id === id ? { ...x, ativo: !x.ativo } : x));

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Pacotes & Promoções</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Combine serviços e ofereça condições especiais</div>
        </div>
        <div style={{ background: T.gold, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>+ Novo pacote</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {pacotes.map(p => (
          <div key={p.id} style={{
            background: T.card, border: `1.5px solid ${p.ativo ? T.gold + "44" : T.border}`,
            borderRadius: 12, padding: 20, opacity: p.ativo ? 1 : 0.55
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 15, color: T.text, fontWeight: 700, marginBottom: 4 }}>{p.nome}</div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>{p.itens}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 12, color: T.muted, textDecoration: "line-through" }}>R$ {p.precoOriginal}</span>
                  <span style={{ fontSize: 18, color: T.gold, fontWeight: 800 }}>R$ {p.precoPromo}</span>
                </div>
              </div>
              <div onClick={() => toggleAtivo(p.id)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <div style={{ width: 32, height: 18, borderRadius: 9, background: p.ativo ? T.gold : T.border, position: "relative" }}>
                  <div style={{ position: "absolute", top: 3, left: p.ativo ? 15 : 3, width: 12, height: 12, borderRadius: "50%", background: p.ativo ? T.bg : "#555" }} />
                </div>
                <span style={{ fontSize: 11, color: p.ativo ? T.success : T.muted }}>{p.ativo ? "Ativo" : "Inativo"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── CUPONS DE DESCONTO (fora de navegação, código mantido) ──
const Cupons = () => {
  const cupons = [
    { codigo: "BEMVINDO10", desconto: "10%", usos: 34, limite: 100, validade: "30/06/2025", status: "ativo" },
    { codigo: "BLACKFRIDAY", desconto: "25%", usos: 89, limite: 100, validade: "30/11/2025", status: "ativo" },
    { codigo: "ANIVERSARIO5", desconto: "R$ 15,00", usos: 50, limite: 50, validade: "15/05/2025", status: "esgotado" },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Cupons de Desconto</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Crie e divulgue cupons para seus clientes</div>
        </div>
        <div style={{ background: T.gold, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>+ Novo cupom</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cupons.map((c, i) => (
          <div key={i} style={{
            background: T.card, border: `1.5px dashed ${T.gold}66`, borderRadius: 12,
            padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: c.status === "esgotado" ? 0.5 : 1
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 18 }}>🏷️</div>
              <div>
                <div style={{ fontSize: 14, color: T.gold, fontWeight: 800, letterSpacing: "0.04em" }}>{c.codigo}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Desconto de {c.desconto} · válido até {c.validade}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{c.usos}/{c.limite} usos</div>
              <Badge color={c.status === "ativo" ? T.success : "#F25C5C"}>{c.status}</Badge>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 12, color: T.gold, fontWeight: 700, marginBottom: 8 }}>📣 Divulgar cupom</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Envie o cupom ativo para sua base de clientes via WhatsApp/SMS</div>
        <div style={{ background: T.gold + "22", border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "8px 16px", display: "inline-block", fontSize: 12, color: T.gold, fontWeight: 600, cursor: "pointer" }}>Enviar para todos os clientes</div>
      </div>
    </div>
  );
};

// ─── CLUBE DE CLIENTES (fora de navegação, código mantido) ──
const Clube = () => {
  const membros = [
    { nome: "Rafael Alves", pontos: 480, nivel: "Ouro" },
    { nome: "Thiago Costa", pontos: 1240, nivel: "Platina" },
    { nome: "Anderson Nunes", pontos: 320, nivel: "Prata" },
    { nome: "Marcos Lima", pontos: 95, nivel: "Bronze" },
  ];
  const nivelColor = { Bronze: "#A0763C", Prata: "#B8BCC4", Ouro: T.gold, Platina: "#9DD9F0" };
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Clube de Clientes</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Programa de fidelidade por pontos</div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Membros ativos" value="48" sub="de 127 clientes" />
        <Stat label="Pontos distribuídos" value="12.4k" sub="este mês" />
        <Stat label="Resgates" value="6" sub="este mês" />
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Regras do clube</div>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
          A cada R$ 1,00 gasto = 1 ponto · 500 pontos = R$ 25 de desconto · Níveis: Bronze (0+), Prata (300+), Ouro (700+), Platina (1200+)
        </div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.text }}>Ranking de Membros</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Cliente", "Pontos", "Nível"].map(h => (
                <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {membros.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.bg}` }}>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={m.nome} size={28} />
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{m.nome}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.text, fontWeight: 700 }}>{m.pontos} pts</td>
                <td style={{ padding: "12px 20px" }}><Badge color={nivelColor[m.nivel]}>{m.nivel}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── FINANCEIRO (fora de navegação, código mantido) ────────
const Financeiro = () => {
  const [tab, setTab] = useState("resumo");
  const receitas = [
    { desc: "Atendimentos (55)", valor: "R$ 3.300,00" },
    { desc: "Venda de produtos", valor: "R$ 680,00" },
    { desc: "Assinaturas (3)", valor: "R$ 360,00" },
  ];
  const despesas = [
    { desc: "Aluguel do salão", valor: "R$ 2.200,00", categoria: "Fixa" },
    { desc: "Compra de produtos (fornecedor)", valor: "R$ 540,00", categoria: "Variável" },
    { desc: "Energia elétrica", valor: "R$ 320,00", categoria: "Fixa" },
    { desc: "Comissões a pagar", valor: "R$ 1.650,00", categoria: "Variável" },
  ];
  const deducoes = [
    { desc: "Simples Nacional", valor: "R$ 410,00" },
    { desc: "Taxas de cartão", valor: "R$ 145,00" },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Financeiro</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Junho 2025 · Fluxo de caixa</div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Receita Bruta" value="R$ 4.340" sub="+9% vs maio" />
        <Stat label="Despesas" value="R$ 4.710" sub="fixas + variáveis" />
        <Stat label="Deduções" value="R$ 555" sub="impostos e taxas" />
        <Stat label="Lucro Líquido" value="-R$ 925" sub="atenção este mês" />
      </div>
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
        {[["resumo", "Resumo"], ["receitas", "Receitas"], ["despesas", "Despesas"], ["deducoes", "Deduções"]].map(([id, label]) => (
          <div key={id} onClick={() => setTab(id)} style={{
            padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            color: tab === id ? T.gold : T.muted,
            borderBottom: tab === id ? `2px solid ${T.gold}` : "2px solid transparent",
          }}>{label}</div>
        ))}
      </div>

      {tab === "resumo" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.bg}` }}>
            <span style={{ fontSize: 13, color: T.success, fontWeight: 600 }}>+ Total de Receitas</span>
            <span style={{ fontSize: 13, color: T.success, fontWeight: 700 }}>R$ 4.340,00</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.bg}` }}>
            <span style={{ fontSize: 13, color: "#F25C5C", fontWeight: 600 }}>− Total de Despesas</span>
            <span style={{ fontSize: 13, color: "#F25C5C", fontWeight: 700 }}>R$ 4.710,00</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.bg}` }}>
            <span style={{ fontSize: 13, color: T.warning, fontWeight: 600 }}>− Deduções e Taxas</span>
            <span style={{ fontSize: 13, color: T.warning, fontWeight: 700 }}>R$ 555,00</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 0", marginTop: 8 }}>
            <span style={{ fontSize: 14, color: T.text, fontWeight: 800 }}>Resultado do mês</span>
            <span style={{ fontSize: 16, color: "#F25C5C", fontWeight: 800 }}>− R$ 925,00</span>
          </div>
        </div>
      )}

      {tab === "receitas" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          {receitas.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < receitas.length - 1 ? `1px solid ${T.bg}` : "none" }}>
              <span style={{ fontSize: 13, color: T.text }}>{r.desc}</span>
              <span style={{ fontSize: 13, color: T.success, fontWeight: 700 }}>{r.valor}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "despesas" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          {despesas.map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: i < despesas.length - 1 ? `1px solid ${T.bg}` : "none" }}>
              <div>
                <span style={{ fontSize: 13, color: T.text }}>{d.desc}</span>
                <Badge color={T.muted}>{d.categoria}</Badge>
              </div>
              <span style={{ fontSize: 13, color: "#F25C5C", fontWeight: 700 }}>{d.valor}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "deducoes" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          {deducoes.map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < deducoes.length - 1 ? `1px solid ${T.bg}` : "none" }}>
              <span style={{ fontSize: 13, color: T.text }}>{d.desc}</span>
              <span style={{ fontSize: 13, color: T.warning, fontWeight: 700 }}>{d.valor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── NOTIFICAR PROMOÇÕES (fora de navegação, código mantido) ─
const Marketing = () => {
  const [mensagem, setMensagem] = useState("🔥 Promoção especial essa semana! Corte + Barba por R$ 55. Agende já pelo app!");
  const [publico, setPublico] = useState("todos");
  const envios = [
    { titulo: "Promoção Dia dos Pais", publico: "Todos os clientes", enviados: 127, data: "08/06/2025" },
    { titulo: "Lembrete clube de fidelidade", publico: "Membros do clube", enviados: 48, data: "01/06/2025" },
    { titulo: "Cupom Black Friday", publico: "Clientes inativos 30+ dias", enviados: 22, data: "25/05/2025" },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Notificar Promoções</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Envie mensagens via WhatsApp/SMS para seus clientes</div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>Nova mensagem</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Público</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[["todos", "Todos os clientes"], ["clube", "Membros do clube"], ["inativos", "Inativos 30+ dias"], ["assinantes", "Assinantes"]].map(([id, label]) => (
              <div key={id} onClick={() => setPublico(id)} style={{
                padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                border: `1.5px solid ${publico === id ? T.gold : T.border}`,
                background: publico === id ? T.gold + "12" : T.surface,
                color: publico === id ? T.gold : T.muted, fontWeight: publico === id ? 600 : 400
              }}>{label}</div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mensagem</div>
          <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={4}
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", color: T.text, fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
        <div style={{ background: T.gold, borderRadius: 8, padding: "10px 20px", display: "inline-block", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>Enviar agora</div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.text }}>Histórico de Envios</div>
        {envios.map((e, i) => (
          <div key={i} style={{ padding: "14px 20px", borderBottom: i < envios.length - 1 ? `1px solid ${T.bg}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{e.titulo}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{e.publico} · {e.data}</div>
            </div>
            <Badge color={T.gold}>{e.enviados} enviados</Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── SATISFAÇÃO DO CLIENTE (fora de navegação, código mantido) ─
const Satisfacao = () => {
  const avaliacoes = [
    { cliente: "Rafael Alves", nota: 5, comentario: "Excelente atendimento, Carlos é fera!", data: "11/06/2025" },
    { cliente: "João Pedro", nota: 4, comentario: "Bom corte, só achei a espera um pouco longa.", data: "08/06/2025" },
    { cliente: "Marcos Lima", nota: 5, comentario: "Sempre saio satisfeito, ambiente top.", data: "05/06/2025" },
    { cliente: "Bruno Melo", nota: 3, comentario: "Atendimento ok, esperava mais cuidado no acabamento.", data: "01/06/2025" },
  ];
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Satisfação do Cliente</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Avaliações e feedback dos atendimentos</div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Stat label="Nota média" value="4.6" sub="de 5.0 estrelas" />
        <Stat label="Avaliações" value="112" sub="este mês" />
        <Stat label="NPS" value="78" sub="excelente" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {avaliacoes.map((a, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={a.cliente} size={28} />
                <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{a.cliente}</span>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ color: n <= a.nota ? T.gold : T.border, fontSize: 13 }}>★</span>)}
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>{a.comentario}</div>
            <div style={{ fontSize: 11, color: T.muted, opacity: 0.7 }}>{a.data}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── CONFIGURAÇÕES ────────────────────────────────────────
function Config() {
  const [tenant, setTenant] = useState(null);
  const [cor1, setCor1] = useState("#C9A84C");
  const [cor2, setCor2] = useState("#0F0F0F");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyTenant().then((t) => {
      setTenant(t);
      setCor1(t.primaryColor);
      setCor2(t.secondaryColor);
      setLogoUrl(t.logoUrl || "");
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await updateMyTenant({ primaryColor: cor1, secondaryColor: cor2, ...(logoUrl ? { logoUrl } : {}) });
      setTenant(updated);
      setSaved(true);
    } catch (e) {
      setError(e.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Configurações</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Identidade visual da barbearia</div>
      </div>
      <div style={{ maxWidth: 420, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 20 }}>Identidade Visual</div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Nome da barbearia</FieldLabel>
          <div style={{ fontSize: 13, color: T.text }}>{tenant?.name}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Logo (URL)</FieldLabel>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" style={fieldStyle} />
        </div>
        {[["Cor Primária (Acento)", cor1, setCor1], ["Cor de Fundo", cor2, setCor2]].map(([label, val, setter]) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <FieldLabel>{label}</FieldLabel>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: val, border: `1px solid ${T.border}` }} />
              <input value={val} onChange={(e) => setter(e.target.value)} style={fieldStyle} />
            </div>
          </div>
        ))}
        <div style={{ background: cor2, borderRadius: 10, padding: 16, border: `1px solid ${T.border}`, marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: cor1, marginBottom: 10 }}>Preview</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ background: cor1, borderRadius: 6, padding: "6px 12px", fontSize: 11, color: cor2, fontWeight: 700 }}>Agendar</div>
            <div style={{ border: `1px solid ${cor1}`, borderRadius: 6, padding: "6px 12px", fontSize: 11, color: cor1 }}>Ver mais</div>
          </div>
        </div>
        <div onClick={saving ? undefined : save} style={{ background: T.gold, borderRadius: 8, padding: "10px", textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.bg, marginTop: 20, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Salvando..." : saved ? "Salvo ✓" : "Salvar Identidade"}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(null); // null = checando sessão | "login" | "app"
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    if (!getAccessToken()) {
      setScreen("login");
      return;
    }
    getMe()
      .then((me) => {
        if (me.role !== "admin") {
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
    if (res.user.role !== "admin") {
      throw new Error("Esse painel é só para administradores da barbearia.");
    }
    setAccessToken(res.accessToken);
    const me = await getMe();
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
    if (page === "dashboard") return <Dashboard />;
    if (page === "agenda") return <Agenda />;
    if (page === "clientes") return <Clientes />;
    if (page === "comissoes") return <Comissoes />;
    if (page === "assinaturas") return <Assinaturas />;
    if (page === "servicos") return <Servicos />;
    if (page === "profissionais") return <Profissionais />;
    if (page === "produtos") return <Produtos />;
    if (page === "estoque") return <Estoque />;
    if (page === "pacotes") return <Pacotes />;
    if (page === "cupons") return <Cupons />;
    if (page === "clube") return <Clube />;
    if (page === "financeiro") return <Financeiro />;
    if (page === "marketing") return <Marketing />;
    if (page === "satisfacao") return <Satisfacao />;
    if (page === "config") return <Config />;
    return <Dashboard />;
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: T.bg, minHeight: "100vh", display: "flex" }}>
      <Sidebar active={page} setActive={setPage} user={user} onLogout={handleLogout} />
      {render()}
    </div>
  );
}
