import { useState } from "react";

// ─── TOKENS (Black Blade Barber) ──────────────────────────
const T = {
  bg: "#0F0F0F",
  card: "#1F1F1F",
  gold: "#C9A84C",
  text: "#F5F0E8",
  muted: "#777",
  border: "#2a2a2a",
};

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

const Phone = ({ children }) => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 24, minHeight: "100vh", background: "#080A10" }}>
    <div style={{
      width: 375, background: T.bg, borderRadius: 40,
      border: `2px solid ${T.border}`, overflow: "hidden",
      boxShadow: "0 0 60px #00000080", height: "fit-content", maxHeight: "94vh", overflowY: "auto"
    }}>
      {/* Notch */}
      <div style={{ background: T.bg, padding: "14px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ fontSize: 12, color: T.muted }}>9:41</span>
        <div style={{ width: 100, height: 24, background: T.card, borderRadius: 12 }} />
        <span style={{ fontSize: 12, color: T.muted }}>●●●</span>
      </div>
      {children}
    </div>
  </div>
);

export default function App() {
  const [screen, setScreen] = useState("home");
  const [selectedService, setSelectedService] = useState(null);
  const [selectedPro, setSelectedPro] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [assinatura, setAssinatura] = useState(null); // null = sem plano, ou objeto com dados do plano
  const [planoEscolhido, setPlanoEscolhido] = useState(null);

  const services = [
    { name: "Corte + Barba", price: "R$ 65", duration: "60 min", icon: "✂" },
    { name: "Corte", price: "R$ 40", duration: "45 min", icon: "✂" },
    { name: "Barba", price: "R$ 35", duration: "30 min", icon: "🪒" },
    { name: "Sobrancelha", price: "R$ 20", duration: "15 min", icon: "✨" },
  ];
  const pros = ["Carlos Silva", "Diego Mendes", "Rafael Costa"];
  const slots = ["09:00", "09:45", "10:30", "14:00", "14:45", "15:30", "16:15", "17:00"];

  // ── HOME ──
  if (screen === "home") return (
    <Phone>
      <div style={{ padding: "20px 24px 32px" }}>
        <div style={{ textAlign: "center", padding: "30px 0 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✂</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.gold, letterSpacing: "0.08em" }}>BLACK BLADE</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Barber Shop · Alto da Lapa</div>
        </div>
        <div onClick={() => setScreen("servico")} style={{
          background: T.gold, borderRadius: 12, padding: "16px 24px",
          textAlign: "center", fontSize: 16, fontWeight: 800, color: T.bg, cursor: "pointer", marginBottom: 16
        }}>Agendar Horário</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          {[["Horários", "◷", "horarios"], ["Profissionais", "◉", "profissionais"], ["Meus Agendamentos", "◈", "meus-agendamentos"], ["Loja", "🧴", "loja"]].map(([l, i, dest]) => (
            <div key={l} onClick={() => setScreen(dest)} style={{ background: T.card, borderRadius: 10, padding: 16, border: `1px solid ${T.border}`, cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 22, color: T.gold, marginBottom: 6 }}>{i}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, background: T.card, borderRadius: 12, padding: 16, border: `1px solid ${T.border}` }}>
          {assinatura ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: T.gold, fontWeight: 700 }}>{assinatura.nome}</div>
                <span style={{ background: "#34D39922", color: "#34D399", border: "1px solid #34D39944", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>ATIVO</span>
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
                {assinatura.cortesRestantes} de {assinatura.cortesTotal} cortes restantes este mês
              </div>
              <div onClick={() => setScreen("meu-plano")} style={{ background: T.gold + "22", border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "8px 12px", textAlign: "center", fontSize: 12, color: T.gold, fontWeight: 600, cursor: "pointer" }}>Ver meu plano</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: T.gold, fontWeight: 700, marginBottom: 8 }}>Plano Mensal Black ♾</div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>4 cortes/mês · Prioridade no agendamento · a partir de R$ 99/mês</div>
              <div onClick={() => setScreen("planos")} style={{ background: T.gold + "22", border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "8px 12px", textAlign: "center", fontSize: 12, color: T.gold, fontWeight: 600, cursor: "pointer" }}>Assinar agora</div>
            </>
          )}
        </div>
      </div>
    </Phone>
  );

  // ── HORÁRIOS DE FUNCIONAMENTO ──
  if (screen === "horarios") return (
    <Phone>
      <div style={{ padding: "16px 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div onClick={() => setScreen("home")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Horários de Funcionamento</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
          {[
            ["Segunda-feira", "09:00 — 20:00"],
            ["Terça-feira", "09:00 — 20:00"],
            ["Quarta-feira", "09:00 — 20:00"],
            ["Quinta-feira", "09:00 — 20:00"],
            ["Sexta-feira", "09:00 — 20:00"],
            ["Sábado", "09:00 — 18:00"],
            ["Domingo", "Fechado"],
          ].map(([dia, horario], i) => {
            const hoje = dia === "Quarta-feira";
            return (
              <div key={dia} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 18px", borderBottom: i < 6 ? `1px solid ${T.bg}` : "none",
                background: hoje ? T.gold + "10" : "transparent"
              }}>
                <div style={{ fontSize: 13, color: hoje ? T.gold : T.text, fontWeight: hoje ? 700 : 500 }}>
                  {dia} {hoje && <span style={{ fontSize: 10, color: T.gold }}>· hoje</span>}
                </div>
                <div style={{ fontSize: 13, color: horario === "Fechado" ? "#F25C5C" : T.muted, fontWeight: 600 }}>{horario}</div>
              </div>
            );
          })}
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: T.gold, fontWeight: 700, marginBottom: 8 }}>📍 Endereço</div>
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
            Rua das Tesouras, 245 — Alto da Lapa<br />São Paulo, SP — 05083-000
          </div>
        </div>
      </div>
    </Phone>
  );

  // ── PROFISSIONAIS (perfil completo) ──
  if (screen === "profissionais") return (
    <Phone>
      <div style={{ padding: "16px 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div onClick={() => setScreen("home")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Nossos Profissionais</div>
        </div>
        {[
          { nome: "Carlos Silva", especialidade: "Cortes clássicos e degradê", avaliacao: 4.9, atend: "1.240" },
          { nome: "Diego Mendes", especialidade: "Barba e pigmentação", avaliacao: 5.0, atend: "1.580" },
          { nome: "Rafael Costa", especialidade: "Sobrancelha e relaxamento facial", avaliacao: 4.8, atend: "890" },
        ].map(p => (
          <div key={p.nome} style={{
            background: T.card, border: `1.5px solid ${T.border}`,
            borderRadius: 12, padding: 16, marginBottom: 10
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
              <Avatar name={p.nome} size={48} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{p.nome}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{p.especialidade}</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${T.bg}` }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ color: T.gold, fontSize: 13 }}>★</span>
                <span style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>{p.avaliacao}</span>
                <span style={{ fontSize: 11, color: T.muted }}>· {p.atend} atendimentos</span>
              </div>
              <div onClick={() => { setSelectedPro(p.nome); setScreen("servico"); }} style={{
                fontSize: 11, color: T.gold, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${T.gold}55`, borderRadius: 6, padding: "4px 10px"
              }}>Agendar →</div>
            </div>
          </div>
        ))}
      </div>
    </Phone>
  );

  // ── MEUS AGENDAMENTOS ──
  if (screen === "meus-agendamentos") return (
    <Phone>
      <div style={{ padding: "16px 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div onClick={() => setScreen("home")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Meus Agendamentos</div>
        </div>

        <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Próximo</div>
        <div style={{
          background: T.gold + "12", border: `1.5px solid ${T.gold}66`,
          borderRadius: 12, padding: 16, marginBottom: 22
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>Corte + Barba</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>com Carlos Silva</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.gold }}>R$ 65</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${T.gold}33` }}>
            <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>Qua, 11 Jun · 14:00</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>Cancelar</div>
              <div style={{ fontSize: 11, color: T.gold, border: `1px solid ${T.gold}55`, borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>Remarcar</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Histórico</div>
        {[
          { servico: "Corte", profissional: "Diego Mendes", data: "28 Mai · 15:30", preco: "R$ 40" },
          { servico: "Barba", profissional: "Carlos Silva", data: "14 Mai · 10:00", preco: "R$ 35" },
          { servico: "Corte + Barba", profissional: "Rafael Costa", data: "30 Abr · 16:45", preco: "R$ 65" },
          { servico: "Sobrancelha", profissional: "Diego Mendes", data: "12 Abr · 11:15", preco: "R$ 20" },
        ].map((h, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "12px 14px", marginBottom: 8, opacity: 0.85
          }}>
            <div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{h.servico}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{h.profissional} · {h.data}</div>
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>{h.preco}</div>
          </div>
        ))}
      </div>
    </Phone>
  );

  // ── LOJA / PRODUTOS ──
  if (screen === "loja") {
    const produtos = [
      { nome: "Pomada Matte", categoria: "Cabelo", preco: "35,00", icon: "🧴" },
      { nome: "Gel Modelador Fixação Forte", categoria: "Cabelo", preco: "28,00", icon: "🧴" },
      { nome: "Óleo para Barba", categoria: "Barba", preco: "32,00", icon: "🛢️" },
      { nome: "Balm Hidratante para Barba", categoria: "Barba", preco: "38,00", icon: "🧴" },
      { nome: "Talco Pós-Barba", categoria: "Acessórios", preco: "18,00", icon: "🧂" },
    ];
    return (
      <Phone>
        <div style={{ padding: "16px 24px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div onClick={() => setScreen("home")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Loja Black Blade</div>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Produtos selecionados pelos nossos barbeiros</div>
          {produtos.map(p => (
            <div key={p.nome} style={{
              display: "flex", alignItems: "center", gap: 14,
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
              padding: 14, marginBottom: 10
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, background: T.gold + "18",
                border: `1px solid ${T.gold}33`, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 22, flexShrink: 0
              }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{p.nome}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{p.categoria}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.gold, marginBottom: 6 }}>R$ {p.preco}</div>
                <div style={{
                  fontSize: 11, color: T.gold, border: `1px solid ${T.gold}55`,
                  borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 600
                }}>+ Adicionar</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginTop: 16 }}>
            Retirada na barbearia no dia do seu atendimento
          </div>
        </div>
      </Phone>
    );
  }

  // ── PLANOS DISPONÍVEIS ──
  if (screen === "planos") {
    const planos = [
      { id: "bronze", nome: "Plano Bronze", preco: "99", cortes: 2, beneficios: ["2 cortes por mês", "10% de desconto em produtos"] },
      { id: "black", nome: "Plano Black ♾", preco: "120", cortes: 4, destaque: true, beneficios: ["4 cortes por mês", "Prioridade no agendamento", "1 barba grátis por mês", "15% de desconto em produtos"] },
      { id: "premium", nome: "Plano Premium", preco: "180", cortes: 6, beneficios: ["6 cortes por mês", "Prioridade máxima", "Barba + sobrancelha inclusos", "20% de desconto em produtos"] },
    ];
    return (
      <Phone>
        <div style={{ padding: "16px 24px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div onClick={() => setScreen("home")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Assinar Plano</div>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>Escolha o plano ideal e economize nos seus cuidados</div>
          {planos.map(p => (
            <div key={p.id} onClick={() => { setPlanoEscolhido(p); setScreen("confirmar-plano"); }} style={{
              background: p.destaque ? T.gold + "12" : T.card,
              border: `1.5px solid ${p.destaque ? T.gold : T.border}`,
              borderRadius: 12, padding: 16, marginBottom: 12, cursor: "pointer", position: "relative"
            }}>
              {p.destaque && (
                <div style={{ position: "absolute", top: -10, right: 16, background: T.gold, color: T.bg, fontSize: 10, fontWeight: 800, borderRadius: 4, padding: "2px 8px" }}>MAIS POPULAR</div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{p.nome}</div>
                <div><span style={{ fontSize: 18, fontWeight: 900, color: T.gold }}>R$ {p.preco}</span><span style={{ fontSize: 11, color: T.muted }}>/mês</span></div>
              </div>
              {p.beneficios.map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: T.gold, fontSize: 12 }}>✓</span>
                  <span style={{ fontSize: 12, color: T.muted }}>{b}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ fontSize: 10, color: T.muted, textAlign: "center", marginTop: 8 }}>
            Cancele quando quiser, sem multa.
          </div>
        </div>
      </Phone>
    );
  }

  // ── CONFIRMAR ASSINATURA ──
  if (screen === "confirmar-plano") return (
    <Phone>
      <div style={{ padding: "16px 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div onClick={() => setScreen("planos")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Confirmar Assinatura</div>
        </div>
        <div style={{ background: T.gold + "12", border: `1.5px solid ${T.gold}66`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.gold, marginBottom: 4 }}>{planoEscolhido?.nome}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>R$ {planoEscolhido?.preco}<span style={{ fontSize: 12, color: T.muted, fontWeight: 400 }}> /mês</span></div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          {[
            ["Início da assinatura", "11/06/2025"],
            ["Próxima cobrança", "11/07/2025"],
            ["Cortes inclusos", `${planoEscolhido?.cortes}/mês`],
            ["Forma de pagamento", "Cartão •••• 4521"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.bg}` }}>
              <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
              <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div onClick={() => {
          setAssinatura({
            nome: planoEscolhido?.nome,
            preco: planoEscolhido?.preco,
            cortesTotal: planoEscolhido?.cortes,
            cortesRestantes: planoEscolhido?.cortes,
            inicio: "11/06/2025",
            proximaCobranca: "11/07/2025",
          });
          setScreen("plano-confirmado");
        }} style={{
          background: T.gold, borderRadius: 12, padding: "16px 24px",
          textAlign: "center", fontSize: 15, fontWeight: 800, color: T.bg, cursor: "pointer"
        }}>Confirmar Assinatura</div>
        <div style={{ fontSize: 10, color: T.muted, textAlign: "center", marginTop: 12 }}>
          Você pode cancelar a qualquer momento em "Meu Plano"
        </div>
      </div>
    </Phone>
  );

  // ── PLANO CONFIRMADO ──
  if (screen === "plano-confirmado") return (
    <Phone>
      <div style={{ padding: "24px 24px 32px" }}>
        <div style={{ textAlign: "center", padding: "28px 0 28px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: T.gold + "22", border: `2px solid ${T.gold}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>♾</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 6 }}>Assinatura ativa!</div>
          <div style={{ fontSize: 13, color: T.muted }}>Bem-vindo ao {assinatura?.nome}</div>
        </div>
        <div style={{ background: T.card, borderRadius: 14, padding: 20, border: `1px solid ${T.border}`, marginBottom: 20 }}>
          {[
            ["Plano", assinatura?.nome],
            ["Valor", `R$ ${assinatura?.preco}/mês`],
            ["Cortes inclusos", `${assinatura?.cortesTotal}/mês`],
            ["Próxima cobrança", assinatura?.proximaCobranca],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.bg}` }}>
              <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
              <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div onClick={() => setScreen("home")} style={{
          background: T.gold, borderRadius: 12, padding: "14px 24px",
          textAlign: "center", fontSize: 14, fontWeight: 800, color: T.bg, cursor: "pointer"
        }}>Voltar ao Início</div>
      </div>
    </Phone>
  );

  // ── MEU PLANO (consulta de assinatura ativa) ──
  if (screen === "meu-plano") {
    const usoCortes = assinatura ? assinatura.cortesTotal - assinatura.cortesRestantes : 0;
    const pct = assinatura ? (usoCortes / assinatura.cortesTotal) * 100 : 0;
    return (
      <Phone>
        <div style={{ padding: "16px 24px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div onClick={() => setScreen("home")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Meu Plano</div>
          </div>

          {assinatura ? (
            <>
              <div style={{ background: T.gold + "12", border: `1.5px solid ${T.gold}66`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.gold }}>{assinatura.nome}</div>
                  <span style={{ background: "#34D39922", color: "#34D399", border: "1px solid #34D39944", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>ATIVO</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>R$ {assinatura.preco}<span style={{ fontSize: 12, color: T.muted, fontWeight: 400 }}> /mês</span></div>
              </div>

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Cortes utilizados este mês</span>
                  <span style={{ fontSize: 12, color: T.gold, fontWeight: 700 }}>{usoCortes} de {assinatura.cortesTotal}</span>
                </div>
                <div style={{ background: T.border, borderRadius: 4, height: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: T.gold, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                  {assinatura.cortesRestantes} {assinatura.cortesRestantes === 1 ? "corte restante" : "cortes restantes"} — renova em {assinatura.proximaCobranca}
                </div>
              </div>

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Detalhes da Assinatura</div>
                {[
                  ["Assinante desde", assinatura.inicio],
                  ["Próxima cobrança", assinatura.proximaCobranca],
                  ["Forma de pagamento", "Cartão •••• 4521"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.bg}` }}>
                    <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
                    <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div onClick={() => setScreen("planos")} style={{ flex: 1, border: `1px solid ${T.gold}55`, borderRadius: 10, padding: "12px", textAlign: "center", fontSize: 12, color: T.gold, fontWeight: 700, cursor: "pointer" }}>Trocar de plano</div>
                <div onClick={() => setAssinatura(null)} style={{ flex: 1, border: `1px solid #F25C5C55`, borderRadius: 10, padding: "12px", textAlign: "center", fontSize: 12, color: "#F25C5C", fontWeight: 700, cursor: "pointer" }}>Cancelar plano</div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>♾</div>
              <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 6 }}>Você não tem um plano ativo</div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>Assine um plano e economize em cada visita</div>
              <div onClick={() => setScreen("planos")} style={{ background: T.gold, borderRadius: 10, padding: "12px 24px", display: "inline-block", fontSize: 13, fontWeight: 800, color: T.bg, cursor: "pointer" }}>Ver planos</div>
            </div>
          )}
        </div>
      </Phone>
    );
  }

  // ── SERVIÇO ──
  if (screen === "servico") return (
    <Phone>
      <div style={{ padding: "16px 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div onClick={() => setScreen("home")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Escolha o Serviço</div>
        </div>
        {services.map(s => (
          <div key={s.name} onClick={() => { setSelectedService(s); setScreen("profissional"); }} style={{
            background: selectedService?.name === s.name ? T.gold + "18" : T.card,
            border: `1.5px solid ${selectedService?.name === s.name ? T.gold : T.border}`,
            borderRadius: 12, padding: 16, marginBottom: 10, cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{s.duration}</div>
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>{s.price}</div>
          </div>
        ))}
      </div>
    </Phone>
  );

  // ── PROFISSIONAL ──
  if (screen === "profissional") return (
    <Phone>
      <div style={{ padding: "16px 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div onClick={() => setScreen("servico")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Escolha o Profissional</div>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>{selectedService?.name} · {selectedService?.price}</div>
        {pros.map(p => (
          <div key={p} onClick={() => { setSelectedPro(p); setScreen("horario"); }} style={{
            background: T.card, border: `1.5px solid ${T.border}`,
            borderRadius: 12, padding: 16, marginBottom: 10, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 14
          }}>
            <Avatar name={p} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{p}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {[1, 2, 3, 4, 5].map(s => <span key={s} style={{ color: T.gold, fontSize: 10 }}>★</span>)}
                <span style={{ fontSize: 10, color: T.muted }}>(48)</span>
              </div>
            </div>
            <div style={{ fontSize: 18, color: T.gold }}>→</div>
          </div>
        ))}
        <div style={{ background: "#1a1a1a", borderRadius: 10, padding: 14, border: `1px solid ${T.border}`, cursor: "pointer", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: T.muted }}>Sem preferência — primeiro disponível</div>
        </div>
      </div>
    </Phone>
  );

  // ── HORÁRIO ──
  if (screen === "horario") return (
    <Phone>
      <div style={{ padding: "16px 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div onClick={() => setScreen("profissional")} style={{ fontSize: 18, color: T.gold, cursor: "pointer" }}>←</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Escolha o Horário</div>
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
          {["Seg 9", "Ter 10", "Qua 11", "Qui 12", "Sex 13"].map((d, i) => (
            <div key={d} style={{
              flexShrink: 0, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
              background: i === 2 ? T.gold + "22" : T.card,
              border: `1.5px solid ${i === 2 ? T.gold : T.border}`,
              textAlign: "center", minWidth: 60
            }}>
              <div style={{ fontSize: 10, color: i === 2 ? T.gold : T.muted }}>{d.split(" ")[0]}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: i === 2 ? T.gold : T.text }}>{d.split(" ")[1]}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          {slots.map(s => (
            <div key={s} onClick={() => setSelectedSlot(s)} style={{
              padding: "12px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
              background: selectedSlot === s ? T.gold + "22" : T.card,
              border: `1.5px solid ${selectedSlot === s ? T.gold : T.border}`,
              color: selectedSlot === s ? T.gold : T.text, fontSize: 13, fontWeight: selectedSlot === s ? 700 : 400,
            }}>{s}</div>
          ))}
        </div>
        {selectedSlot && (
          <div onClick={() => setScreen("confirmacao")} style={{
            background: T.gold, borderRadius: 12, padding: "16px 24px",
            textAlign: "center", fontSize: 15, fontWeight: 800, color: T.bg, cursor: "pointer"
          }}>Confirmar Horário</div>
        )}
      </div>
    </Phone>
  );

  // ── CONFIRMAÇÃO ──
  if (screen === "confirmacao") return (
    <Phone>
      <div style={{ padding: "24px 24px 32px" }}>
        <div style={{ textAlign: "center", padding: "28px 0 28px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: T.gold + "22", border: `2px solid ${T.gold}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 6 }}>Agendado!</div>
          <div style={{ fontSize: 13, color: T.muted }}>Você receberá uma confirmação via WhatsApp</div>
        </div>
        <div style={{ background: T.card, borderRadius: 14, padding: 20, border: `1px solid ${T.border}`, marginBottom: 20 }}>
          {[
            ["Serviço", selectedService?.name || "Corte + Barba"],
            ["Profissional", selectedPro || "Carlos Silva"],
            ["Data", "Quarta-feira, 11 Jun"],
            ["Horário", selectedSlot || "14:00"],
            ["Valor", selectedService?.price || "R$ 65"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.bg}` }}>
              <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
              <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div onClick={() => { setScreen("home"); setSelectedService(null); setSelectedPro(null); setSelectedSlot(null); }} style={{
          background: T.gold, borderRadius: 12, padding: "14px 24px",
          textAlign: "center", fontSize: 14, fontWeight: 800, color: T.bg, cursor: "pointer"
        }}>Voltar ao Início</div>
      </div>
    </Phone>
  );

  return null;
}
