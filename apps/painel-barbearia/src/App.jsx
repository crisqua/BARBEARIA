import { useState } from "react";

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

// ─── SIDEBAR ──────────────────────────────────────────────
const Sidebar = ({ active, setActive }) => {
  const sections = [
    {
      label: null,
      items: [{ id: "dashboard", icon: "⊞", label: "Dashboard" }],
    },
    {
      label: "Operação",
      items: [
        { id: "agenda", icon: "◷", label: "Agenda" },
        { id: "clientes", icon: "◉", label: "Clientes" },
        { id: "servicos", icon: "✂", label: "Serviços" },
        { id: "produtos", icon: "🧴", label: "Produtos" },
        { id: "estoque", icon: "📦", label: "Estoque & Fornecedores" },
      ],
    },
    {
      label: "Comercial",
      items: [
        { id: "pacotes", icon: "🎁", label: "Pacotes & Promoções" },
        { id: "cupons", icon: "🏷️", label: "Cupons de Desconto" },
        { id: "assinaturas", icon: "♾", label: "Assinaturas" },
        { id: "clube", icon: "👑", label: "Clube de Clientes" },
      ],
    },
    {
      label: "Financeiro",
      items: [
        { id: "financeiro", icon: "💰", label: "Financeiro" },
        { id: "comissoes", icon: "◈", label: "Comissões" },
      ],
    },
    {
      label: "Relacionamento",
      items: [
        { id: "marketing", icon: "📣", label: "Notificar Promoções" },
        { id: "satisfacao", icon: "⭐", label: "Satisfação do Cliente" },
      ],
    },
    {
      label: null,
      items: [{ id: "config", icon: "⚙", label: "Configurações" }],
    },
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name="Victor Mendes" size={28} />
          <div>
            <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>Victor Mendes</div>
            <div style={{ fontSize: 10, color: T.muted }}>Administrador</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── DASHBOARD ────────────────────────────────────────────
const Dashboard = () => (
  <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Boa tarde, Victor ✂</div>
      <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Quarta-feira, 11 de Junho de 2025</div>
    </div>
    <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
      <Stat label="Agendamentos hoje" value="8" sub="2 pendentes" />
      <Stat label="Faturamento hoje" value="R$ 420" sub="meta: R$ 500" />
      <Stat label="Clientes este mês" value="127" sub="+14 novos" />
      <Stat label="Ticket médio" value="R$ 58" sub="+R$6 vs maio" />
    </div>

    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <div style={{ flex: 2, minWidth: 300, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.text }}>
          Agenda de Hoje
        </div>
        {[
          { hora: "14:00", cliente: "Rafael Alves", servico: "Corte + Barba", barbeiro: "Carlos", status: "confirmado" },
          { hora: "14:45", cliente: "João Pedro", servico: "Corte", barbeiro: "Victor", status: "confirmado" },
          { hora: "15:30", cliente: "Marcos Lima", servico: "Barba", barbeiro: "Carlos", status: "pendente" },
          { hora: "16:15", cliente: "Thiago Costa", servico: "Corte + Barba", barbeiro: "Rafael", status: "confirmado" },
          { hora: "17:00", cliente: "Bruno Melo", servico: "Sobrancelha", barbeiro: "Victor", status: "concluido" },
        ].map((a, i) => (
          <div key={i} style={{ padding: "14px 20px", borderBottom: i < 4 ? `1px solid ${T.bg}` : "none", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 50, fontSize: 13, fontWeight: 700, color: T.gold }}>{a.hora}</div>
            <Avatar name={a.cliente} size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{a.cliente}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{a.servico} · {a.barbeiro}</div>
            </div>
            <Badge color={a.status === "confirmado" ? T.success : a.status === "pendente" ? T.warning : T.muted}>{a.status}</Badge>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 220, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, alignSelf: "start" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.text }}>Profissionais</div>
        {[
          { nome: "Carlos Silva", atend: 18, comissao: "R$ 540" },
          { nome: "Victor Mendes", atend: 22, comissao: "R$ 660" },
          { nome: "Rafael Costa", atend: 15, comissao: "R$ 450" },
        ].map((b, i) => (
          <div key={i} style={{ padding: "14px 20px", borderBottom: i < 2 ? `1px solid ${T.bg}` : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Avatar name={b.nome} size={30} />
              <div>
                <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{b.nome}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{b.atend} atendimentos</div>
              </div>
            </div>
            <div style={{ background: T.border, borderRadius: 4, height: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(b.atend / 22) * 100}%`, background: T.gold, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: T.gold, marginTop: 4, textAlign: "right" }}>{b.comissao}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── AGENDA ───────────────────────────────────────────────
const Agenda = () => {
  const horarios = ["09:00", "09:45", "10:30", "11:15", "12:00", "13:30", "14:15", "15:00", "15:45", "16:30", "17:15", "18:00"];
  const barbeiros = ["Carlos Silva", "Victor Mendes", "Rafael Costa"];
  const agendamentos = {
    "Carlos Silva": { "09:00": { c: "Marcos L.", s: "Corte+Barba", bg: T.gold }, "10:30": { c: "João P.", s: "Corte", bg: "#4A7C59" }, "14:15": { c: "Bruno M.", s: "Barba", bg: T.gold } },
    "Victor Mendes": { "09:45": { c: "Rafael A.", s: "Corte+Barba", bg: "#5B6FA8" }, "13:30": { c: "Thiago C.", s: "Corte", bg: T.gold }, "16:30": { c: "Pedro H.", s: "Sobrancelha", bg: "#4A7C59" } },
    "Rafael Costa": { "11:15": { c: "Felipe S.", s: "Corte", bg: T.gold }, "15:00": { c: "Anderson N.", s: "Barba", bg: "#5B6FA8" } },
  };
  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Agenda da Semana</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>9 – 14 Junho 2025</div>
        </div>
        <div style={{ background: T.gold, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>+ Agendar</div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ width: 70, flexShrink: 0 }} />
          {barbeiros.map(b => (
            <div key={b} style={{ flex: 1, padding: "12px 16px", borderLeft: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={b} size={26} />
              <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{b.split(" ")[0]}</span>
            </div>
          ))}
        </div>
        <div style={{ overflowY: "auto", maxHeight: 460 }}>
          {horarios.map(h => (
            <div key={h} style={{ display: "flex", borderBottom: `1px solid ${T.bg}`, minHeight: 48 }}>
              <div style={{ width: 70, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: T.muted, fontWeight: 600 }}>{h}</div>
              {barbeiros.map(b => {
                const ag = agendamentos[b]?.[h];
                return (
                  <div key={b} style={{ flex: 1, borderLeft: `1px solid ${T.bg}`, padding: 6 }}>
                    {ag && (
                      <div style={{ background: ag.bg + "22", border: `1px solid ${ag.bg}55`, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: ag.bg }}>{ag.c}</div>
                        <div style={{ fontSize: 10, color: T.muted }}>{ag.s}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── CLIENTES ─────────────────────────────────────────────
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

// ─── COMISSÕES ────────────────────────────────────────────
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

// ─── ASSINATURAS ──────────────────────────────────────────
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
const Servicos = () => {
  const [servicos, setServicos] = useState([
    { id: 1, nome: "Corte", duracao: "45 min", preco: "40,00", ativo: true },
    { id: 2, nome: "Barba", duracao: "30 min", preco: "35,00", ativo: true },
    { id: 3, nome: "Corte + Barba", duracao: "60 min", preco: "65,00", ativo: true },
    { id: 4, nome: "Sobrancelha", duracao: "15 min", preco: "20,00", ativo: true },
    { id: 5, nome: "Relaxamento Facial", duracao: "30 min", preco: "45,00", ativo: false },
    { id: 6, nome: "Pigmentação de Barba", duracao: "40 min", preco: "55,00", ativo: true },
  ]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nome: "", duracao: "", preco: "" });

  const startNew = () => { setForm({ nome: "", duracao: "", preco: "" }); setEditing("new"); };
  const startEdit = (s) => { setForm({ nome: s.nome, duracao: s.duracao, preco: s.preco }); setEditing(s.id); };

  const save = () => {
    if (editing === "new") {
      setServicos(p => [...p, { id: Date.now(), nome: form.nome, duracao: form.duracao, preco: form.preco, ativo: true }]);
    } else {
      setServicos(p => p.map(s => s.id === editing ? { ...s, ...form } : s));
    }
    setEditing(null);
  };

  const toggleAtivo = (id) => setServicos(p => p.map(s => s.id === id ? { ...s, ativo: !s.ativo } : s));
  const remove = (id) => setServicos(p => p.filter(s => s.id !== id));

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Serviços</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{servicos.length} serviços cadastrados · {servicos.filter(s => s.ativo).length} ativos</div>
        </div>
        <div onClick={startNew} style={{ background: T.gold, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>+ Novo serviço</div>
      </div>

      {/* Form inline de criação/edição */}
      {editing !== null && (
        <div style={{ background: T.card, border: `1.5px solid ${T.gold}55`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginBottom: 16 }}>
            {editing === "new" ? "Novo Serviço" : "Editar Serviço"}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nome do serviço</div>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Barba + Cabelo"
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Duração</div>
              <input value={form.duracao} onChange={e => setForm(f => ({ ...f, duracao: e.target.value }))} placeholder="Ex: 45 min"
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Preço (R$)</div>
              <div style={{ display: "flex", alignItems: "center", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0 14px" }}>
                <span style={{ fontSize: 13, color: T.muted, marginRight: 4 }}>R$</span>
                <input value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} placeholder="0,00"
                  style={{ width: "100%", background: "transparent", border: "none", padding: "10px 0", color: T.text, fontSize: 13, outline: "none" }} />
              </div>
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
              {["Serviço", "Duração", "Preço", "Status", ""].map(h => (
                <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servicos.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${T.bg}`, opacity: s.ativo ? 1 : 0.5 }}>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.text, fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>✂</span> {s.nome}
                  </div>
                </td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.muted }}>{s.duracao}</td>
                <td style={{ padding: "12px 20px", fontSize: 13, color: T.gold, fontWeight: 700 }}>R$ {s.preco}</td>
                <td style={{ padding: "12px 20px" }}>
                  <div onClick={() => toggleAtivo(s.id)} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <div style={{ width: 32, height: 18, borderRadius: 9, background: s.ativo ? T.gold : T.border, position: "relative" }}>
                      <div style={{ position: "absolute", top: 3, left: s.ativo ? 15 : 3, width: 12, height: 12, borderRadius: "50%", background: s.ativo ? T.bg : "#555", transition: "left 0.2s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: s.ativo ? T.success : T.muted }}>{s.ativo ? "Ativo" : "Inativo"}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 20px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 14, justifyContent: "flex-end" }}>
                    <span onClick={() => startEdit(s)} style={{ fontSize: 12, color: T.gold, cursor: "pointer" }}>Editar</span>
                    <span onClick={() => remove(s.id)} style={{ fontSize: 12, color: "#F25C5C", cursor: "pointer" }}>Remover</span>
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

// ─── PRODUTOS ─────────────────────────────────────────────
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

      {/* Form inline de criação/edição */}
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

// ─── ESTOQUE & FORNECEDORES ───────────────────────────────
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

// ─── PACOTES & PROMOÇÕES ──────────────────────────────────
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

// ─── CUPONS DE DESCONTO ───────────────────────────────────
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

// ─── CLUBE DE CLIENTES ────────────────────────────────────
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

// ─── FINANCEIRO ───────────────────────────────────────────
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

// ─── NOTIFICAR PROMOÇÕES (envio de mensagens) ─────────────
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

// ─── SATISFAÇÃO DO CLIENTE ─────────────────────────────────
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
const Config = () => {
  const [cor1, setCor1] = useState("#C9A84C");
  const [cor2, setCor2] = useState("#0F0F0F");
  const modules = ["Comissões", "Assinaturas", "WhatsApp/SMS", "Dashboard Avançado", "Marketing", "Estoque"];
  const [activeModules, setActiveModules] = useState(["Comissões", "Assinaturas", "WhatsApp/SMS"]);
  const toggle = m => setActiveModules(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: T.bg }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Configurações</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Identidade visual e módulos</div>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {/* Branding */}
        <div style={{ flex: 1, minWidth: 280, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 20 }}>Identidade Visual</div>
          <div style={{ background: "#111", border: `2px dashed ${T.border}`, borderRadius: 10, padding: 28, textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 36 }}>✂</div>
            <div style={{ fontSize: 13, color: T.gold, fontWeight: 800, marginTop: 8 }}>BARBERARIA</div>
            <div style={{ fontSize: 10, color: T.muted }}>Alterar logotipo</div>
          </div>
          {[["Cor Primária (Acento)", cor1, setCor1], ["Cor de Fundo", cor2, setCor2]].map(([label, val, setter]) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 8, fontWeight: 600 }}>{label}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: val, border: `1px solid ${T.border}`, cursor: "pointer" }} />
                <input value={val} onChange={e => setter(e.target.value)}
                  style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.text, fontSize: 13, outline: "none" }} />
              </div>
            </div>
          ))}
          <div style={{ background: cor2, borderRadius: 10, padding: 16, border: `1px solid ${T.border}`, marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: cor1, marginBottom: 10 }}>Preview</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ background: cor1, borderRadius: 6, padding: "6px 12px", fontSize: 11, color: cor2, fontWeight: 700, cursor: "pointer" }}>Agendar</div>
              <div style={{ border: `1px solid ${cor1}`, borderRadius: 6, padding: "6px 12px", fontSize: 11, color: cor1, cursor: "pointer" }}>Ver mais</div>
            </div>
          </div>
          <div style={{ background: T.gold, borderRadius: 8, padding: "10px", textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.bg, marginTop: 20 }}>Salvar Identidade</div>
        </div>

        {/* Módulos */}
        <div style={{ flex: 1, minWidth: 280, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>Módulos Opcionais</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>Ative as funcionalidades que sua barbearia precisa</div>
          <div style={{ background: "#1a1a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <div>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>Módulos Core — sempre ativos</div>
              <div style={{ fontSize: 11, color: T.muted }}>Agendamento · CRM Básico · Perfil do Profissional</div>
            </div>
          </div>
          {modules.map(m => {
            const on = activeModules.includes(m);
            return (
              <div key={m} onClick={() => toggle(m)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px", marginBottom: 8, borderRadius: 8, cursor: "pointer",
                border: `1px solid ${on ? T.gold + "66" : T.border}`,
                background: on ? T.gold + "0C" : T.surface,
              }}>
                <div style={{ fontSize: 13, color: on ? T.gold : T.muted, fontWeight: on ? 600 : 400 }}>{m}</div>
                <div style={{ width: 38, height: 20, borderRadius: 10, background: on ? T.gold : T.border, position: "relative" }}>
                  <div style={{ position: "absolute", top: 3, left: on ? 18 : 3, width: 14, height: 14, borderRadius: "50%", background: on ? T.bg : "#555", transition: "left 0.2s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── ROOT ─────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dashboard");

  const render = () => {
    if (page === "dashboard") return <Dashboard />;
    if (page === "agenda") return <Agenda />;
    if (page === "clientes") return <Clientes />;
    if (page === "comissoes") return <Comissoes />;
    if (page === "assinaturas") return <Assinaturas />;
    if (page === "servicos") return <Servicos />;
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
      <Sidebar active={page} setActive={setPage} />
      {render()}
    </div>
  );
}
