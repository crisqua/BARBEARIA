import { useEffect, useState } from "react";
import {
  cancelAppointment,
  createAppointment,
  getAccessToken,
  getAvailability,
  getMe,
  getPublicTenant,
  listAppointments,
  listProfessionals,
  listProfessionalsForService,
  listServices,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  rescheduleAppointment,
  setAccessToken,
} from "./api/client";

// ─── TOKENS (fallback enquanto a marca do tenant carrega) ──
const DEFAULT_T = {
  bg: "#0F0F0F",
  card: "#1F1F1F",
  gold: "#C9A84C",
  text: "#F5F0E8",
  muted: "#777",
  border: "#2a2a2a",
};

function tokensFromTenant(tenant) {
  if (!tenant) return DEFAULT_T;
  return {
    ...DEFAULT_T,
    gold: tenant.primaryColor || DEFAULT_T.gold,
    bg: tenant.secondaryColor || DEFAULT_T.bg,
  };
}

const formatPrice = (cents) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const formatDuration = (minutes) => `${minutes} min`;

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function nextDays(count = 7) {
  const days = [];
  const base = new Date(nowInBarbershopTime());
  base.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d);
  }
  return days;
}

const dateKey = (d) => d.toISOString().slice(0, 10);

// Horários vêm em UTC do backend e são tratados como "hora local da barbearia"
// (sem conversão de fuso — simplificação de MVP documentada na Sprint 5), então
// formatamos sempre fixando timeZone: "UTC" pra não desalinhar com o que foi agendado.
const formatSlotTime = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

const formatSlotDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short", timeZone: "UTC" });

// "Agora" nos mesmos termos em que startsAt é armazenado: hora tratada como
// hora local da barbearia (fixo America/Sao_Paulo), sem conversão. Comparar
// startsAt direto com Date.now() (UTC real do dispositivo) desalinha pelo
// offset do fuso do usuário — ex: escondia um agendamento das 11h como "já
// passado" quando na verdade eram só 8h39 no horário local.
const nowInBarbershopTime = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
};

const Avatar = ({ name, size = 32, T }) => {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: T.gold + "22", border: `1.5px solid ${T.gold}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 700, color: T.gold, flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

const Phone = ({ children, T }) => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 24, minHeight: "100vh", background: "#080A10" }}>
    <div style={{
      width: 375, background: T.bg, borderRadius: 40,
      border: `2px solid ${T.border}`, overflow: "hidden",
      boxShadow: "0 0 60px #00000080", height: "fit-content", maxHeight: "94vh", overflowY: "auto",
    }}>
      <div style={{ background: T.bg, padding: "14px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ fontSize: 12, color: T.muted }}>9:41</span>
        <div style={{ width: 100, height: 24, background: T.card, borderRadius: 12 }} />
        <span style={{ fontSize: 12, color: T.muted }}>●●●</span>
      </div>
      {children}
    </div>
  </div>
);

const ErrorBox = ({ children, T }) => (
  <div style={{ background: "#F25C5C22", border: "1px solid #F25C5C55", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#F25C5C", marginBottom: 14 }}>
    {children}
  </div>
);

const BackHeader = ({ T, title, onBack }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
    <div onClick={onBack} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{title}</div>
  </div>
);

const PrimaryButton = ({ T, children, onClick, disabled }) => (
  <div
    onClick={disabled ? undefined : onClick}
    style={{
      background: T.gold, borderRadius: 12, padding: "16px 24px",
      textAlign: "center", fontSize: 15, fontWeight: 800, color: T.bg,
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
    }}
  >
    {children}
  </div>
);

const inputStyle = (T) => ({
  width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
  padding: "12px 14px", color: T.text, fontSize: 13, marginBottom: 12, boxSizing: "border-box",
});

// ─── AUTENTICAÇÃO ──────────────────────────────────────────

function LoginScreen({ T, onLogin, goRegister }) {
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
    <Phone T={T}>
      <div style={{ padding: "40px 24px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✂</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.gold }}>Entrar</div>
        </div>
        {error && <ErrorBox T={T}>{error}</ErrorBox>}
        <input style={inputStyle(T)} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          style={inputStyle(T)}
          placeholder="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PrimaryButton T={T} onClick={submit} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </PrimaryButton>
        <div onClick={goRegister} style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: T.muted, cursor: "pointer" }}>
          Não tem conta? <span style={{ color: T.gold, fontWeight: 700 }}>Cadastre-se</span>
        </div>
      </div>
    </Phone>
  );
}

function RegisterScreen({ T, onRegister, goLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await onRegister(name, email, password, phone);
    } catch (e) {
      setError(e.message || "Não foi possível cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Phone T={T}>
      <div style={{ padding: "40px 24px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✂</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.gold }}>Criar conta</div>
        </div>
        {error && <ErrorBox T={T}>{error}</ErrorBox>}
        <input style={inputStyle(T)} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={inputStyle(T)} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={inputStyle(T)} placeholder="Telefone (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input
          style={inputStyle(T)}
          placeholder="Senha (mín. 8 caracteres)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PrimaryButton T={T} onClick={submit} disabled={loading}>
          {loading ? "Cadastrando..." : "Criar conta"}
        </PrimaryButton>
        <div onClick={goLogin} style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: T.muted, cursor: "pointer" }}>
          Já tem conta? <span style={{ color: T.gold, fontWeight: 700 }}>Entrar</span>
        </div>
      </div>
    </Phone>
  );
}

// ─── APP ────────────────────────────────────────────────

export default function App() {
  const [tenant, setTenant] = useState(null);
  const [tenantError, setTenantError] = useState("");
  const T = tokensFromTenant(tenant);

  const [screen, setScreen] = useState(null); // null = checando sessão
  const [user, setUser] = useState(null);

  const [services, setServices] = useState([]);
  const [allProfessionals, setAllProfessionals] = useState([]);
  const [serviceProfessionals, setServiceProfessionals] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedPro, setSelectedPro] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => nextDays()[0]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [reschedulingAppointment, setReschedulingAppointment] = useState(null);

  // Telas de assinatura/loja ficam fora de navegação (seção 4 do CLAUDE.md),
  // mas o código permanece — só os states seguem existindo pra não quebrar
  // essas telas ainda presentes no arquivo.
  const [assinatura, setAssinatura] = useState(null);
  const [planoEscolhido, setPlanoEscolhido] = useState(null);

  // Marca do tenant — pública, carregada antes de qualquer login.
  useEffect(() => {
    getPublicTenant()
      .then(setTenant)
      .catch(() => setTenantError("Não foi possível carregar os dados da barbearia."));
  }, []);

  // Restaura sessão a partir do token salvo, se houver.
  useEffect(() => {
    if (!getAccessToken()) {
      setScreen("login");
      return;
    }
    getMe()
      .then((me) => {
        setUser(me);
        setScreen("home");
      })
      .catch(() => {
        setAccessToken(null);
        setScreen("login");
      });
  }, []);

  // Catálogo carregado uma vez, assim que há sessão — reutilizado em várias telas.
  useEffect(() => {
    if (!user) return;
    listServices().then((r) => setServices(r.items)).catch(() => {});
    listProfessionals().then((r) => setAllProfessionals(r.items)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (screen !== "profissional" || !selectedService) return;
    listProfessionalsForService(selectedService.id)
      .then(setServiceProfessionals)
      .catch(() => setServiceProfessionals([]));
  }, [screen, selectedService]);

  useEffect(() => {
    if (screen !== "horario" || !selectedPro || !selectedService) return;
    setSlotsLoading(true);
    setSlotsError("");
    getAvailability(selectedPro.id, selectedService.id, dateKey(selectedDate))
      .then((res) => setAvailableSlots(res.slots))
      .catch((e) => setSlotsError(e.message || "Não foi possível carregar os horários."))
      .finally(() => setSlotsLoading(false));
  }, [screen, selectedPro, selectedService, selectedDate]);

  useEffect(() => {
    if (screen !== "meus-agendamentos") return;
    listAppointments()
      .then((r) => setAppointments(r.items))
      .catch(() => {});
  }, [screen]);

  const handleLogin = async (email, password) => {
    const res = await apiLogin(email, password);
    if (res.user.role !== "cliente") {
      throw new Error("Essa conta não é de cliente. Use o painel da barbearia para acessar com um usuário admin ou barbeiro.");
    }
    setAccessToken(res.accessToken);
    const me = await getMe();
    setUser(me);
    setScreen("home");
  };

  const handleRegister = async (name, email, password, phone) => {
    const res = await apiRegister(name, email, password, phone);
    setAccessToken(res.accessToken);
    const me = await getMe();
    setUser(me);
    setScreen("home");
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // ignora falha de rede no logout — limpamos a sessão local de todo jeito
    }
    setAccessToken(null);
    setUser(null);
    setAppointments([]);
    setScreen("login");
  };

  const goHome = () => {
    setSelectedService(null);
    setSelectedPro(null);
    setSelectedSlot(null);
    setReschedulingAppointment(null);
    setBookingError("");
    setScreen("home");
  };

  const startReschedule = (appointment) => {
    const service = services.find((s) => s.id === appointment.serviceId);
    const pro = allProfessionals.find((p) => p.id === appointment.professionalId);
    setSelectedService(service || { id: appointment.serviceId });
    setSelectedPro(pro || { id: appointment.professionalId });
    setSelectedDate(nextDays()[0]);
    setSelectedSlot(null);
    setReschedulingAppointment(appointment);
    setBookingError("");
    setScreen("horario");
  };

  const confirmSlot = async () => {
    if (!selectedSlot) return;
    setBookingLoading(true);
    setBookingError("");
    try {
      if (reschedulingAppointment) {
        await rescheduleAppointment(reschedulingAppointment.id, selectedSlot);
      } else {
        await createAppointment(selectedService.id, selectedPro.id, selectedSlot);
      }
      setScreen("confirmacao");
    } catch (e) {
      setBookingError(e.message || "Não foi possível confirmar. Escolha outro horário.");
      getAvailability(selectedPro.id, selectedService.id, dateKey(selectedDate))
        .then((res) => setAvailableSlots(res.slots))
        .catch(() => {});
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancel = async (appointmentId) => {
    if (!window.confirm("Cancelar este agendamento?")) return;
    try {
      await cancelAppointment(appointmentId);
      const r = await listAppointments();
      setAppointments(r.items);
    } catch (e) {
      window.alert(e.message || "Não foi possível cancelar.");
    }
  };

  // ── CARREGANDO / ERRO DE TENANT ──
  if (tenantError) return (
    <Phone T={DEFAULT_T}>
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: DEFAULT_T.text, fontSize: 13 }}>{tenantError}</div>
      </div>
    </Phone>
  );
  if (!tenant || screen === null) return (
    <Phone T={T}>
      <div style={{ padding: 60, textAlign: "center", color: T.muted, fontSize: 13 }}>Carregando…</div>
    </Phone>
  );

  // ── LOGIN / CADASTRO ──
  if (screen === "login") return <LoginScreen T={T} onLogin={handleLogin} goRegister={() => setScreen("register")} />;
  if (screen === "register") return <RegisterScreen T={T} onRegister={handleRegister} goLogin={() => setScreen("login")} />;

  // ── HOME ──
  if (screen === "home") return (
    <Phone T={T}>
      <div style={{ padding: "20px 24px 32px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div onClick={handleLogout} style={{ fontSize: 11, color: T.muted, cursor: "pointer" }}>Sair</div>
        </div>
        <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} style={{ width: 56, height: 56, borderRadius: "50%", marginBottom: 8, objectFit: "cover" }} />
          ) : (
            <div style={{ fontSize: 40, marginBottom: 8 }}>✂</div>
          )}
          <div style={{ fontSize: 22, fontWeight: 900, color: T.gold, letterSpacing: "0.08em" }}>{tenant.name?.toUpperCase()}</div>
          {user && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Olá, {user.name}</div>}
        </div>
        <div onClick={() => setScreen("servico")} style={{
          background: T.gold, borderRadius: 12, padding: "16px 24px",
          textAlign: "center", fontSize: 16, fontWeight: 800, color: T.bg, cursor: "pointer", marginBottom: 16,
        }}>Agendar Horário</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          {[["Profissionais", "◉", "profissionais"], ["Meus Agendamentos", "◈", "meus-agendamentos"]].map(([l, i, dest]) => (
            <div key={l} onClick={() => setScreen(dest)} style={{ background: T.card, borderRadius: 10, padding: 16, border: `1px solid ${T.border}`, cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 22, color: T.gold, marginBottom: 6 }}>{i}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );

  // ── HORÁRIOS DE FUNCIONAMENTO (código mantido, fora da navegação) ──
  if (screen === "horarios") return (
    <Phone T={T}>
      <div style={{ padding: "16px 24px 32px" }}>
        <BackHeader T={T} title="Horários de Funcionamento" onBack={() => setScreen("home")} />
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
          {[
            ["Segunda-feira", "09:00 — 20:00"],
            ["Terça-feira", "09:00 — 20:00"],
            ["Quarta-feira", "09:00 — 20:00"],
            ["Quinta-feira", "09:00 — 20:00"],
            ["Sexta-feira", "09:00 — 20:00"],
            ["Sábado", "09:00 — 18:00"],
            ["Domingo", "Fechado"],
          ].map(([dia, horario], i) => (
            <div key={dia} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 18px", borderBottom: i < 6 ? `1px solid ${T.bg}` : "none",
            }}>
              <div style={{ fontSize: 13, color: T.text }}>{dia}</div>
              <div style={{ fontSize: 13, color: horario === "Fechado" ? "#F25C5C" : T.muted, fontWeight: 600 }}>{horario}</div>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );

  // ── PROFISSIONAIS (lista geral) ──
  if (screen === "profissionais") {
    const activeProfessionals = allProfessionals.filter((p) => p.active !== false);
    return (
    <Phone T={T}>
      <div style={{ padding: "16px 24px 32px" }}>
        <BackHeader T={T} title="Nossos Profissionais" onBack={() => setScreen("home")} />
        {activeProfessionals.length === 0 && (
          <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0" }}>Nenhum profissional cadastrado ainda.</div>
        )}
        {activeProfessionals.map((p) => (
          <div key={p.id} style={{
            background: T.card, border: `1.5px solid ${T.border}`,
            borderRadius: 12, padding: 16, marginBottom: 10,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <Avatar name={p.name} size={48} T={T} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{p.name}</div>
            </div>
            <div onClick={() => { setSelectedPro(p); setScreen("servico"); }} style={{
              fontSize: 11, color: T.gold, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${T.gold}55`, borderRadius: 6, padding: "4px 10px",
            }}>Agendar →</div>
          </div>
        ))}
      </div>
    </Phone>
    );
  }

  // ── MEUS AGENDAMENTOS ──
  if (screen === "meus-agendamentos") {
    const now = nowInBarbershopTime();
    const isActive = (a) =>
      a.status === "needs_reschedule" || (a.status === "scheduled" && new Date(a.startsAt).getTime() >= now);
    const upcoming = appointments
      .filter(isActive)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

    const label = (a) => {
      const svc = services.find((s) => s.id === a.serviceId);
      const pro = allProfessionals.find((p) => p.id === a.professionalId);
      return { servico: svc?.name || "Serviço", profissional: pro?.name || "Profissional", preco: svc ? formatPrice(svc.priceCents) : "" };
    };

    return (
      <Phone T={T}>
        <div style={{ padding: "16px 24px 32px" }}>
          <BackHeader T={T} title="Meus Agendamentos" onBack={() => setScreen("home")} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ativos</div>
            <div onClick={() => setScreen("meus-historicos")} style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>Meus Históricos</div>
          </div>

          {upcoming.length > 0 ? (
            upcoming.map((a) => {
              const needsReschedule = a.status === "needs_reschedule";
              const accent = needsReschedule ? "#F5A623" : T.gold;
              return (
                <div key={a.id} style={{ background: accent + "12", border: `1.5px solid ${accent}66`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{label(a).servico}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>com {label(a).profissional}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: accent }}>{label(a).preco}</div>
                  </div>
                  {needsReschedule && (
                    <div style={{ fontSize: 11, color: accent, fontWeight: 700, marginBottom: 10 }}>
                      Profissional não está mais disponível — cancele e agende com outro profissional.
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${accent}33` }}>
                    <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>
                      {formatSlotDate(a.startsAt)} · {formatSlotTime(a.startsAt)}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div onClick={() => handleCancel(a.id)} style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>Cancelar</div>
                      {!needsReschedule && (
                        <div onClick={() => startReschedule(a)} style={{ fontSize: 11, color: T.gold, border: `1px solid ${T.gold}55`, borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>Remarcar</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0 30px" }}>Nenhum agendamento futuro.</div>
          )}
        </div>
      </Phone>
    );
  }

  // ── MEUS HISTÓRICOS ──
  if (screen === "meus-historicos") {
    const now = nowInBarbershopTime();
    const historico = appointments
      .filter((a) => !(a.status === "needs_reschedule" || (a.status === "scheduled" && new Date(a.startsAt).getTime() >= now)))
      .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));

    const label = (a) => {
      const svc = services.find((s) => s.id === a.serviceId);
      const pro = allProfessionals.find((p) => p.id === a.professionalId);
      return { servico: svc?.name || "Serviço", profissional: pro?.name || "Profissional", preco: svc ? formatPrice(svc.priceCents) : "" };
    };

    return (
      <Phone T={T}>
        <div style={{ padding: "16px 24px 32px" }}>
          <BackHeader T={T} title="Meus Históricos" onBack={() => setScreen("meus-agendamentos")} />

          {historico.length > 0 ? (
            historico.map((a) => (
              <div key={a.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
                padding: "12px 14px", marginBottom: 8, opacity: a.status === "cancelled" ? 0.5 : 0.85,
              }}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{label(a).servico}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    {label(a).profissional} · {formatSlotDate(a.startsAt)} {formatSlotTime(a.startsAt)}
                    {a.status === "cancelled" ? " · cancelado" : ""}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>{label(a).preco}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0 30px" }}>Nenhum histórico ainda.</div>
          )}
        </div>
      </Phone>
    );
  }

  // ── LOJA (fora de navegação, código mantido) ──
  if (screen === "loja") {
    const produtos = [
      { nome: "Pomada Matte", categoria: "Cabelo", preco: "35,00", icon: "🧴" },
      { nome: "Óleo para Barba", categoria: "Barba", preco: "32,00", icon: "🛢️" },
    ];
    return (
      <Phone T={T}>
        <div style={{ padding: "16px 24px 32px" }}>
          <BackHeader T={T} title="Loja" onBack={() => setScreen("home")} />
          {produtos.map((p) => (
            <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 14, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 22 }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.text }}>{p.nome}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{p.categoria}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.gold }}>R$ {p.preco}</div>
            </div>
          ))}
        </div>
      </Phone>
    );
  }

  // ── PLANOS (fora de navegação, código mantido) ──
  if (screen === "planos") {
    const planos = [
      { id: "black", nome: "Plano Black", preco: "120", cortes: 4, beneficios: ["4 cortes por mês", "Prioridade no agendamento"] },
    ];
    return (
      <Phone T={T}>
        <div style={{ padding: "16px 24px 32px" }}>
          <BackHeader T={T} title="Assinar Plano" onBack={() => setScreen("home")} />
          {planos.map((p) => (
            <div key={p.id} onClick={() => { setPlanoEscolhido(p); setScreen("confirmar-plano"); }} style={{ background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: 16, cursor: "pointer" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{p.nome}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.gold }}>R$ {p.preco}/mês</div>
            </div>
          ))}
        </div>
      </Phone>
    );
  }

  if (screen === "confirmar-plano") return (
    <Phone T={T}>
      <div style={{ padding: "16px 24px 32px" }}>
        <BackHeader T={T} title="Confirmar Assinatura" onBack={() => setScreen("planos")} />
        <PrimaryButton T={T} onClick={() => {
          setAssinatura({ nome: planoEscolhido?.nome, preco: planoEscolhido?.preco, cortesTotal: planoEscolhido?.cortes, cortesRestantes: planoEscolhido?.cortes });
          setScreen("plano-confirmado");
        }}>Confirmar Assinatura</PrimaryButton>
      </div>
    </Phone>
  );

  if (screen === "plano-confirmado") return (
    <Phone T={T}>
      <div style={{ padding: "24px 24px 32px" }}>
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Assinatura ativa!</div>
        </div>
        <PrimaryButton T={T} onClick={() => setScreen("home")}>Voltar ao Início</PrimaryButton>
      </div>
    </Phone>
  );

  if (screen === "meu-plano") return (
    <Phone T={T}>
      <div style={{ padding: "16px 24px 32px" }}>
        <BackHeader T={T} title="Meu Plano" onBack={() => setScreen("home")} />
        {assinatura ? (
          <div style={{ fontSize: 13, color: T.text }}>{assinatura.nome}</div>
        ) : (
          <div onClick={() => setScreen("planos")} style={{ background: T.gold, borderRadius: 10, padding: "12px 24px", display: "inline-block", fontSize: 13, fontWeight: 800, color: T.bg, cursor: "pointer" }}>Ver planos</div>
        )}
      </div>
    </Phone>
  );

  // ── SERVIÇO ──
  if (screen === "servico") return (
    <Phone T={T}>
      <div style={{ padding: "16px 24px 32px" }}>
        <BackHeader T={T} title="Escolha o Serviço" onBack={() => setScreen("home")} />
        {services.length === 0 && (
          <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0" }}>Nenhum serviço disponível.</div>
        )}
        {services.map((s) => (
          <div key={s.id} onClick={() => { setSelectedService(s); setScreen("profissional"); }} style={{
            background: selectedService?.id === s.id ? T.gold + "18" : T.card,
            border: `1.5px solid ${selectedService?.id === s.id ? T.gold : T.border}`,
            borderRadius: 12, padding: 16, marginBottom: 10, cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{formatDuration(s.durationMinutes)}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>{formatPrice(s.priceCents)}</div>
          </div>
        ))}
      </div>
    </Phone>
  );

  // ── PROFISSIONAL ──
  if (screen === "profissional") return (
    <Phone T={T}>
      <div style={{ padding: "16px 24px 32px" }}>
        <BackHeader T={T} title="Escolha o Profissional" onBack={() => setScreen("servico")} />
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>
          {selectedService?.name} · {selectedService && formatPrice(selectedService.priceCents)}
        </div>
        {serviceProfessionals.length === 0 && (
          <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0" }}>Nenhum profissional disponível para esse serviço.</div>
        )}
        {serviceProfessionals.map((p) => (
          <div key={p.id} onClick={() => { setSelectedPro(p); setSelectedSlot(null); setScreen("horario"); }} style={{
            background: T.card, border: `1.5px solid ${T.border}`,
            borderRadius: 12, padding: 16, marginBottom: 10, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <Avatar name={p.name} size={44} T={T} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{p.name}</div>
            </div>
            <div style={{ fontSize: 18, color: T.gold }}>→</div>
          </div>
        ))}
      </div>
    </Phone>
  );

  // ── HORÁRIO ──
  if (screen === "horario") {
    const days = nextDays();
    return (
      <Phone T={T}>
        <div style={{ padding: "16px 24px 32px" }}>
          <BackHeader
            T={T}
            title={reschedulingAppointment ? "Novo Horário" : "Escolha o Horário"}
            onBack={() => setScreen(reschedulingAppointment ? "meus-agendamentos" : "profissional")}
          />
          {bookingError && <ErrorBox T={T}>{bookingError}</ErrorBox>}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
            {days.map((d) => {
              const active = dateKey(d) === dateKey(selectedDate);
              return (
                <div key={dateKey(d)} onClick={() => { setSelectedDate(d); setSelectedSlot(null); }} style={{
                  flexShrink: 0, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  background: active ? T.gold + "22" : T.card,
                  border: `1.5px solid ${active ? T.gold : T.border}`,
                  textAlign: "center", minWidth: 60,
                }}>
                  <div style={{ fontSize: 10, color: active ? T.gold : T.muted }}>{WEEKDAY_LABELS[d.getUTCDay()]}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: active ? T.gold : T.text }}>{d.getUTCDate()}</div>
                </div>
              );
            })}
          </div>

          {slotsLoading && <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0" }}>Carregando horários…</div>}
          {slotsError && <ErrorBox T={T}>{slotsError}</ErrorBox>}
          {!slotsLoading && !slotsError && availableSlots.length === 0 && (
            <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0" }}>Sem horários livres nesse dia.</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
            {availableSlots.map((iso) => (
              <div key={iso} onClick={() => setSelectedSlot(iso)} style={{
                padding: "12px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                background: selectedSlot === iso ? T.gold + "22" : T.card,
                border: `1.5px solid ${selectedSlot === iso ? T.gold : T.border}`,
                color: selectedSlot === iso ? T.gold : T.text, fontSize: 13, fontWeight: selectedSlot === iso ? 700 : 400,
              }}>{formatSlotTime(iso)}</div>
            ))}
          </div>

          {selectedSlot && (
            <PrimaryButton T={T} onClick={confirmSlot} disabled={bookingLoading}>
              {bookingLoading ? "Confirmando..." : reschedulingAppointment ? "Confirmar Remarcação" : "Confirmar Horário"}
            </PrimaryButton>
          )}
        </div>
      </Phone>
    );
  }

  // ── CONFIRMAÇÃO ──
  if (screen === "confirmacao") return (
    <Phone T={T}>
      <div style={{ padding: "24px 24px 32px" }}>
        <div style={{ textAlign: "center", padding: "28px 0 28px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: T.gold + "22", border: `2px solid ${T.gold}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 6 }}>
            {reschedulingAppointment ? "Remarcado!" : "Agendado!"}
          </div>
        </div>
        <div style={{ background: T.card, borderRadius: 14, padding: 20, border: `1px solid ${T.border}`, marginBottom: 20 }}>
          {[
            ["Serviço", selectedService?.name],
            ["Profissional", selectedPro?.name],
            ["Data", selectedSlot && formatSlotDate(selectedSlot)],
            ["Horário", selectedSlot && formatSlotTime(selectedSlot)],
            ["Valor", selectedService?.priceCents != null ? formatPrice(selectedService.priceCents) : undefined],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.bg}` }}>
              <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
              <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <PrimaryButton T={T} onClick={goHome}>Voltar ao Início</PrimaryButton>
      </div>
    </Phone>
  );

  return null;
}
