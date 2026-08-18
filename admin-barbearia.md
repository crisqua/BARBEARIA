# Painel Barbearia — Barberaria
## Guia completo de protótipo para reprodução no VSCode com Claude Code

---

## 1. CONTEXTO DO PROJETO

Este documento descreve o protótipo funcional do **Painel da Barbearia** — uma das três entidades do sistema **Barberaria**, uma plataforma SaaS White Label Multitenant para gestão de barbearias, construída e operada pela incubadora **Desenvolva IN**.

### As 3 entidades do sistema

| Entidade | Arquivo | Público | Domínio |
|---|---|---|---|
| **Painel Master (Incubadora)** | `desenvolva-in-painel-master.jsx` | Desenvolva IN (super admin) | `admin.barberaria.app` |
| **Painel Barbearia (Admin)** | `barberos-painel-barbearia.jsx` | Dono/gestor de cada barbearia | `painel.{slug}.barberaria.app` |
| **App do Cliente Final** | `barberos-app-cliente.jsx` | Clientes das barbearias | `{slug}.barberaria.app` |

Este documento cobre exclusivamente o **Painel da Barbearia**.

---

## 2. STACK TÉCNICA DO PROTÓTIPO

```
React 18 + Vite
Linguagem: JavaScript (JSX) — sem TypeScript no protótipo
Estilização: inline styles (sem CSS externo, sem Tailwind)
Estado: useState do React (sem Redux ou Zustand)
Dependências: apenas react e react-dom
```

### Setup inicial no VSCode

```bash
# Criar projeto
npm create vite@latest painel-barbearia -- --template react
cd painel-barbearia
npm install
npm run dev

# Substituir src/App.jsx pelo conteúdo do protótipo
# Deletar src/App.css e src/index.css (não são usados)
```

---

## 3. DESIGN TOKENS (PALETA DE CORES)

Todas as cores são definidas em um objeto `T` no topo do arquivo. **Nenhuma cor é hardcoded fora deste objeto.**

```js
const T = {
  // Fundos (escuros, hierarquia de profundidade)
  bg:      "#0F0F0F",   // fundo principal da página
  surface: "#181818",   // sidebar, painéis laterais
  card:    "#1F1F1F",   // cards, tabelas, formulários

  // Acento principal (dourado — identidade da barbearia)
  gold:    "#C9A84C",   // botões primários, destaques, ícones ativos
  goldDim: "#8A6E2E",   // hover states, variação mais escura do dourado

  // Tipografia
  text:    "#F5F0E8",   // texto principal (quente, não branco puro)
  muted:   "#777777",   // labels, legendas, texto secundário

  // Estrutura
  border:  "#2A2A2A",   // bordas de cards, linhas divisórias

  // Estados semânticos
  success: "#34D399",   // status confirmado, ativo, pago
  warning: "#F5A623",   // status pendente, trial, alerta
  // danger implícito: "#F25C5C" — usado inline onde necessário
};
```

### Uso dos tokens

- **Fundo de página:** `T.bg`
- **Sidebar:** `T.surface` com `borderRight: 1px solid T.border`
- **Cards e tabelas:** `T.card` com `border: 1px solid T.border`
- **Botão primário:** `background: T.gold, color: T.bg`
- **Link/ação secundária:** `color: T.gold, cursor: pointer`
- **Texto do corpo:** `T.text`
- **Labels e subtítulos:** `T.muted`

---

## 4. COMPONENTES COMPARTILHADOS

Todos os componentes abaixo ficam no topo do arquivo, antes dos componentes de tela.

### 4.1 Badge
Pill colorido para status e categorias.
```jsx
const Badge = ({ color, children }) => (
  <span style={{
    background: color + "22",        // cor com 13% opacidade
    color,
    border: `1px solid ${color}44`,  // cor com 27% opacidade
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11, fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase"
  }}>{children}</span>
);

// Uso:
<Badge color={T.success}>ativo</Badge>
<Badge color={T.warning}>pendente</Badge>
<Badge color="#F25C5C">suspenso</Badge>
<Badge color={T.gold}>Pro</Badge>
```

### 4.2 Avatar
Iniciais do nome em círculo com acento dourado.
```jsx
const Avatar = ({ name, size = 32 }) => {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: T.gold + "22",
      border: `1.5px solid ${T.gold}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: T.gold, flexShrink: 0
    }}>{initials}</div>
  );
};

// Uso:
<Avatar name="Victor Mendes" size={32} />
<Avatar name="Carlos Silva" size={28} />
```

### 4.3 Stat
Card de métrica com label, valor e subtexto opcional.
```jsx
const Stat = ({ label, value, sub }) => (
  <div style={{
    background: T.card, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 130
  }}>
    <div style={{ fontSize: 11, color: T.muted, marginBottom: 6,
      textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: T.gold, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{sub}</div>}
  </div>
);

// Uso (sempre em flex container com gap):
<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
  <Stat label="Agendamentos hoje" value="8" sub="2 pendentes" />
  <Stat label="Faturamento hoje" value="R$ 420" sub="meta: R$ 500" />
</div>
```

---

## 5. SIDEBAR — NAVEGAÇÃO PRINCIPAL

A sidebar tem **largura fixa de 240px**, ocupa **100vh**, tem overflow-y auto para menus longos, e é organizada em **seções com labels**.

### Estrutura de navegação (seções e itens)

```
[sem label]
  ⊞  Dashboard

[Operação]
  ◷  Agenda
  ◉  Clientes
  ✂  Serviços
  🧴 Produtos
  📦 Estoque & Fornecedores

[Comercial]
  🎁  Pacotes & Promoções
  🏷️  Cupons de Desconto
  ♾   Assinaturas
  👑  Clube de Clientes

[Financeiro]
  💰  Financeiro
  ◈   Comissões

[Relacionamento]
  📣  Notificar Promoções
  ⭐  Satisfação do Cliente

[sem label]
  ⚙  Configurações
```

### Comportamento do item ativo

```js
// Item ativo:
borderLeft: `2px solid ${T.gold}`
background: T.gold + "10"   // dourado 6% opacidade
color: T.gold
fontWeight: 600

// Item inativo:
borderLeft: "2px solid transparent"
background: "transparent"
color: T.muted
fontWeight: 400
```

### Rodapé da sidebar (usuário logado)
```jsx
// Avatar + nome + role no rodapé
<Avatar name="Victor Mendes" size={28} />
<div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>Victor Mendes</div>
<div style={{ fontSize: 10, color: T.muted }}>Administrador</div>
```

---

## 6. LAYOUT RAIZ

```jsx
export default function App() {
  const [page, setPage] = useState("dashboard");

  const render = () => {
    if (page === "dashboard")   return <Dashboard />;
    if (page === "agenda")      return <Agenda />;
    if (page === "clientes")    return <Clientes />;
    if (page === "comissoes")   return <Comissoes />;
    if (page === "assinaturas") return <Assinaturas />;
    if (page === "servicos")    return <Servicos />;
    if (page === "produtos")    return <Produtos />;
    if (page === "estoque")     return <Estoque />;
    if (page === "pacotes")     return <Pacotes />;
    if (page === "cupons")      return <Cupons />;
    if (page === "clube")       return <Clube />;
    if (page === "financeiro")  return <Financeiro />;
    if (page === "marketing")   return <Marketing />;
    if (page === "satisfacao")  return <Satisfacao />;
    if (page === "config")      return <Config />;
    return <Dashboard />;
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: T.bg, minHeight: "100vh", display: "flex"
    }}>
      <Sidebar active={page} setActive={setPage} />
      {render()}
    </div>
  );
}
```

---

## 7. TELAS — DESCRIÇÃO DETALHADA

### 7.1 Dashboard (`id: "dashboard"`)

**Objetivo:** visão geral rápida do dia — métricas, agenda e performance dos profissionais.

**Stats (faixa superior):**
| Label | Valor exemplo | Sub |
|---|---|---|
| Agendamentos hoje | 8 | 2 pendentes |
| Faturamento hoje | R$ 420 | meta: R$ 500 |
| Clientes este mês | 127 | +14 novos |
| Ticket médio | R$ 58 | +R$6 vs maio |

**Layout (abaixo dos stats):** `flex` com gap 20px
- **Esquerda (flex: 2):** card "Agenda de Hoje" — lista de agendamentos com hora, avatar do cliente, serviço, barbeiro e badge de status
- **Direita (flex: 1):** card "Profissionais" — lista com barra de progresso de atendimentos e comissão acumulada

**Dados de agendamentos:**
```js
[
  { hora: "14:00", cliente: "Rafael Alves",  servico: "Corte + Barba", barbeiro: "Carlos", status: "confirmado" },
  { hora: "14:45", cliente: "João Pedro",    servico: "Corte",          barbeiro: "Victor", status: "confirmado" },
  { hora: "15:30", cliente: "Marcos Lima",   servico: "Barba",          barbeiro: "Carlos", status: "pendente"   },
  { hora: "16:15", cliente: "Thiago Costa",  servico: "Corte + Barba", barbeiro: "Rafael", status: "confirmado" },
  { hora: "17:00", cliente: "Bruno Melo",    servico: "Sobrancelha",    barbeiro: "Victor", status: "concluido"  },
]
```

**Dados de profissionais (barra de progresso):**
```js
[
  { nome: "Carlos Silva",  atend: 18, comissao: "R$ 540" },
  { nome: "Victor Mendes", atend: 22, comissao: "R$ 660" },
  { nome: "Rafael Costa",  atend: 15, comissao: "R$ 450" },
]
// Barra: width = (atend / 22) * 100 + "%", background: T.gold
```

---

### 7.2 Agenda (`id: "agenda"`)

**Objetivo:** grade semanal de agendamentos por profissional.

**Layout:** tabela com horários nas linhas e profissionais nas colunas.
- Header: avatar + primeiro nome de cada barbeiro
- Linhas: horários de 09:00 a 18:00 (slots de 45min)
- Célula ocupada: card colorido com nome do cliente e serviço
- `maxHeight: 460px` com `overflowY: auto`

**Profissionais como colunas:** `["Carlos Silva", "Victor Mendes", "Rafael Costa"]`

**Agendamentos (mapa por barbeiro → horário):**
```js
{
  "Carlos Silva":  { "09:00": { c: "Marcos L.", s: "Corte+Barba", bg: T.gold }, ... },
  "Victor Mendes": { "09:45": { c: "Rafael A.", s: "Corte+Barba", bg: "#5B6FA8" }, ... },
  "Rafael Costa":  { "11:15": { c: "Felipe S.", s: "Corte",       bg: T.gold }, ... },
}
```

**Botão "Agendar"** no header direito: `background: T.gold, color: T.bg`

---

### 7.3 Clientes (`id: "clientes"`)

**Objetivo:** base de clientes com histórico de visitas e valor gasto.

**Colunas da tabela:** Cliente (avatar + nome), Visitas, Última Visita, Total Gasto, Plano

**Campo de busca** no header (direita).

**Dados de exemplo:**
```js
[
  { nome: "Rafael Alves",   visitas: 12, ultima: "11/06/2025", gasto: "R$ 780",   plano: "Black ♾" },
  { nome: "Thiago Costa",   visitas: 21, ultima: "11/06/2025", gasto: "R$ 1.365", plano: "Black ♾" },
  { nome: "Anderson Nunes", visitas: 15, ultima: "10/06/2025", gasto: "R$ 525",   plano: "Black ♾" },
  { nome: "João Pedro",     visitas:  5, ultima: "08/06/2025", gasto: "R$ 200",   plano: "—"       },
  // ...
]
```

---

### 7.4 Serviços (`id: "servicos"`)

**Objetivo:** cadastro de serviços oferecidos com preço e duração. **Totalmente editável.**

**Estado local:**
```js
const [servicos, setServicos] = useState([...]);
const [editing, setEditing] = useState(null); // null | "new" | id
const [form, setForm] = useState({ nome: "", duracao: "", preco: "" });
```

**Ações:** Novo serviço, Editar, Remover, Toggle ativo/inativo

**Formulário inline** (aparece acima da tabela quando `editing !== null`):
- Campos: Nome do serviço, Duração (texto livre ex: "45 min"), Preço (prefixo "R$")
- Botões: Salvar, Cancelar

**Colunas da tabela:** Serviço (ícone ✂ + nome), Duração, Preço, Status (toggle), Ações

**Dados iniciais:**
```js
[
  { id: 1, nome: "Corte",                   duracao: "45 min", preco: "40,00", ativo: true  },
  { id: 2, nome: "Barba",                   duracao: "30 min", preco: "35,00", ativo: true  },
  { id: 3, nome: "Corte + Barba",           duracao: "60 min", preco: "65,00", ativo: true  },
  { id: 4, nome: "Sobrancelha",             duracao: "15 min", preco: "20,00", ativo: true  },
  { id: 5, nome: "Relaxamento Facial",      duracao: "30 min", preco: "45,00", ativo: false },
  { id: 6, nome: "Pigmentação de Barba",    duracao: "40 min", preco: "55,00", ativo: true  },
]
```

---

### 7.5 Produtos (`id: "produtos"`)

**Objetivo:** catálogo de produtos vendidos na barbearia. **Totalmente editável.**

**Estado local:**
```js
const [produtos, setProdutos] = useState([...]);
const [editing, setEditing] = useState(null);
const [form, setForm] = useState({ nome: "", categoria: "Cabelo", preco: "", estoque: "" });
const categorias = ["Cabelo", "Barba", "Acessórios", "Skincare"];
```

**Stats no topo:** Produtos cadastrados, Itens em estoque (total unidades), Sem estoque (urgente)

**Colunas da tabela:** Produto (ícone 🧴 + nome), Categoria (badge), Preço, Estoque, Status (toggle), Ações

**Estoque zerado:** texto "Sem estoque" em `#F25C5C` (vermelho)

**Dados iniciais:**
```js
[
  { id: 1, nome: "Gel Modelador Fixação Forte", categoria: "Cabelo",     preco: "28,00", estoque: 14, ativo: true  },
  { id: 2, nome: "Pomada Matte",               categoria: "Cabelo",     preco: "35,00", estoque: 8,  ativo: true  },
  { id: 3, nome: "Óleo para Barba",            categoria: "Barba",      preco: "32,00", estoque: 20, ativo: true  },
  { id: 4, nome: "Balm Hidratante para Barba", categoria: "Barba",      preco: "38,00", estoque: 5,  ativo: true  },
  { id: 5, nome: "Shampoo Anticaspa",          categoria: "Cabelo",     preco: "25,00", estoque: 0,  ativo: false },
  { id: 6, nome: "Talco Pós-Barba",            categoria: "Acessórios", preco: "18,00", estoque: 30, ativo: true  },
]
```

---

### 7.6 Estoque & Fornecedores (`id: "estoque"`)

**Objetivo:** controle de inventário e cadastro de fornecedores.

**Tabs internas:** "Estoque" | "Fornecedores"
```js
const [tab, setTab] = useState("estoque");
```

**Aba Estoque — colunas:** Produto, Fornecedor, Qtd. Atual, Mínimo, Status
**Status de estoque:**
```js
const statusColor = { ok: T.success, baixo: T.warning, zerado: "#F25C5C" };
// Regra: zerado = qtd 0; baixo = qtd < minimo; ok = qtd >= minimo
```

**Aba Fornecedores:** cards com nome, categoria, contato, badge de qtd de produtos + botão "Nova fornecedor" (borda dashed)

---

### 7.7 Pacotes & Promoções (`id: "pacotes"`)

**Objetivo:** combos de serviços com preço promocional vs. original.

**Estado:** `useState` para lista e toggle ativo/inativo

**Card de pacote:**
- Nome do pacote (ex: "Combo Visual Completo")
- Descrição dos itens (ex: "Corte + Barba + Sobrancelha")
- Preço original **riscado** (`textDecoration: "line-through"`) + preço promocional em dourado grande
- Toggle ativo/inativo

**Dados iniciais:**
```js
[
  { id: 1, nome: "Combo Visual Completo", itens: "Corte + Barba + Sobrancelha",                   precoOriginal: "120,00", precoPromo: "95,00",  ativo: true  },
  { id: 2, nome: "Dia do Noivo",          itens: "Corte + Barba + Hidratação + Pigmentação",      precoOriginal: "180,00", precoPromo: "150,00", ativo: true  },
  { id: 3, nome: "Pacote 4 Cortes",       itens: "4 cortes para usar no mês",                    precoOriginal: "160,00", precoPromo: "130,00", ativo: false },
]
```

---

### 7.8 Cupons de Desconto (`id: "cupons"`)

**Objetivo:** criar e divulgar cupons com limite de usos e validade.

**Card de cupom** (borda dashed dourada):
- Código em destaque (`T.gold`, `fontWeight: 800`, `letterSpacing: "0.04em"`)
- Desconto + validade
- Usos (ex: 34/100) + badge de status

**Botão de divulgação** no final: "Enviar para todos os clientes"

**Dados iniciais:**
```js
[
  { codigo: "BEMVINDO10",   desconto: "10%",      usos: 34, limite: 100, validade: "30/06/2025", status: "ativo"   },
  { codigo: "BLACKFRIDAY",  desconto: "25%",      usos: 89, limite: 100, validade: "30/11/2025", status: "ativo"   },
  { codigo: "ANIVERSARIO5", desconto: "R$ 15,00", usos: 50, limite: 50,  validade: "15/05/2025", status: "esgotado"},
]
```

---

### 7.9 Assinaturas (`id: "assinaturas"`)

**Objetivo:** gestão de clientes com plano de assinatura recorrente.

**Stats:** Assinantes ativos, MRR de assinaturas, Em atraso

**Colunas da tabela:** Cliente (avatar + nome), Plano, Assinante desde, Próx. cobrança, Status

---

### 7.10 Clube de Clientes (`id: "clube"`)

**Objetivo:** programa de fidelidade por pontos com níveis.

**Regras do clube** (card informativo):
> A cada R$ 1,00 gasto = 1 ponto · 500 pontos = R$ 25 de desconto · Níveis: Bronze (0+), Prata (300+), Ouro (700+), Platina (1200+)

**Ranking de membros — colunas:** Cliente, Pontos, Nível (badge)

**Cores por nível:**
```js
const nivelColor = {
  Bronze:  "#A0763C",
  Prata:   "#B8BCC4",
  Ouro:    T.gold,     // #C9A84C
  Platina: "#9DD9F0",
};
```

---

### 7.11 Financeiro (`id: "financeiro"`)

**Objetivo:** fluxo de caixa completo com abas.

**Stats:** Receita Bruta, Despesas, Deduções, Lucro Líquido

**Tabs internas:**
```js
const [tab, setTab] = useState("resumo");
// "resumo" | "receitas" | "despesas" | "deducoes"
```

**Aba Resumo:** linhas de Receitas (verde) − Despesas (vermelho) − Deduções (amarelo) = Resultado

**Aba Receitas:**
```js
[
  { desc: "Atendimentos (55)",    valor: "R$ 3.300,00" },
  { desc: "Venda de produtos",    valor: "R$ 680,00"   },
  { desc: "Assinaturas (3)",      valor: "R$ 360,00"   },
]
```

**Aba Despesas:**
```js
[
  { desc: "Aluguel do salão",                valor: "R$ 2.200,00", categoria: "Fixa"     },
  { desc: "Compra de produtos (fornecedor)", valor: "R$ 540,00",   categoria: "Variável" },
  { desc: "Energia elétrica",                valor: "R$ 320,00",   categoria: "Fixa"     },
  { desc: "Comissões a pagar",               valor: "R$ 1.650,00", categoria: "Variável" },
]
```

**Aba Deduções:**
```js
[
  { desc: "Simples Nacional", valor: "R$ 410,00" },
  { desc: "Taxas de cartão",  valor: "R$ 145,00" },
]
```

---

### 7.12 Comissões (`id: "comissoes"`)

**Objetivo:** extrato de comissões por profissional no mês.

**Stats:** Total Faturado, Total em Comissões, A Pagar

**Colunas da tabela:** Profissional (avatar + nome), Atendimentos, Faturado, % Comissão (badge dourado), Valor (dourado bold)

**Dados iniciais:**
```js
[
  { nome: "Carlos Silva",  atend: 18, faturado: "R$ 1.080,00", percentual: "50%", comissao: "R$ 540" },
  { nome: "Victor Mendes", atend: 22, faturado: "R$ 1.320,00", percentual: "50%", comissao: "R$ 660" },
  { nome: "Rafael Costa",  atend: 15, faturado: "R$ 900,00",   percentual: "50%", comissao: "R$ 450" },
]
```

---

### 7.13 Notificar Promoções (`id: "marketing"`)

**Objetivo:** envio de mensagens em massa (WhatsApp/SMS) para segmentos de clientes.

**Formulário de nova mensagem:**
- Seleção de público (tabs clicáveis): Todos os clientes | Membros do clube | Inativos 30+ dias | Assinantes
- Textarea com a mensagem (editável)
- Botão "Enviar agora"

**Estado:**
```js
const [mensagem, setMensagem] = useState("🔥 Promoção especial essa semana! Corte + Barba por R$ 55. Agende já pelo app!");
const [publico, setPublico] = useState("todos");
```

**Histórico de envios** abaixo do formulário (tabela simples: título, público, enviados, data)

---

### 7.14 Satisfação do Cliente (`id: "satisfacao"`)

**Objetivo:** visualização de avaliações e NPS.

**Stats:** Nota média, Avaliações totais, NPS

**Cards de avaliação:**
- Avatar + nome do cliente
- Estrelas (1-5): `★` preenchidas em `T.gold`, vazias em `T.border`
- Texto do comentário
- Data

---

### 7.15 Configurações (`id: "config"`)

**Objetivo:** identidade visual (cores, logo) e ativação de módulos.

**Layout:** dois cards lado a lado

**Card Identidade Visual:**
- Área de upload de logo (borda dashed + ícone ✂)
- Seletor de Cor Primária: preview quadrado + input hex editável
- Seletor de Cor de Fundo: preview quadrado + input hex editável
- **Preview ao vivo** do tema (atualiza conforme o usuário digita)
- Botão "Salvar Identidade"

**Card Módulos Opcionais:**
- Banner informativo dos módulos Core (sempre ativos)
- Lista de 6 módulos com toggle on/off:
  - Comissões / Assinaturas / WhatsApp/SMS / Dashboard Avançado / Marketing / Estoque
- Toggle dourado quando ativo, cinza quando inativo

---

## 8. PADRÕES DE IMPLEMENTAÇÃO

### Toggle On/Off reutilizável
```jsx
// Estado: on = boolean
<div onClick={() => toggle(id)} style={{
  width: 38, height: 20, borderRadius: 10,
  background: on ? T.gold : T.border, position: "relative"
}}>
  <div style={{
    position: "absolute", top: 3,
    left: on ? 18 : 3,          // move: 3px inativo → 18px ativo
    width: 14, height: 14,
    borderRadius: "50%",
    background: on ? T.bg : "#555",
    transition: "left 0.2s"
  }} />
</div>
```

### Formulário inline de CRUD
Padrão usado em Serviços e Produtos:
```js
// Estado
const [editing, setEditing] = useState(null); // null | "new" | id_do_item
const [form, setForm] = useState({ campo1: "", campo2: "" });

// Funções
const startNew  = () => { setForm({ campo1: "", campo2: "" }); setEditing("new"); };
const startEdit = (item) => { setForm({ campo1: item.campo1, campo2: item.campo2 }); setEditing(item.id); };
const save = () => {
  if (editing === "new") {
    setItems(p => [...p, { id: Date.now(), ...form, ativo: true }]);
  } else {
    setItems(p => p.map(x => x.id === editing ? { ...x, ...form } : x));
  }
  setEditing(null);
};

// Renderização do form (aparece se editing !== null)
{editing !== null && (
  <div style={{ background: T.card, border: `1.5px solid ${T.gold}55`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
    {/* campos + botões Salvar / Cancelar */}
  </div>
)}
```

### Tabs internas de módulos
Padrão usado em Estoque e Financeiro:
```jsx
const [tab, setTab] = useState("aba1");

// Tab bar
<div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
  {[["aba1", "Label 1"], ["aba2", "Label 2"]].map(([id, label]) => (
    <div key={id} onClick={() => setTab(id)} style={{
      padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600,
      color: tab === id ? T.gold : T.muted,
      borderBottom: tab === id ? `2px solid ${T.gold}` : "2px solid transparent",
    }}>{label}</div>
  ))}
</div>

// Conteúdo condicional
{tab === "aba1" && <div>...</div>}
{tab === "aba2" && <div>...</div>}
```

### Preview de tema ao vivo (Configurações)
```jsx
const [cor1, setCor1] = useState("#C9A84C");
const [cor2, setCor2] = useState("#0F0F0F");

// Preview — renderiza com as cores dos estados
<div style={{ background: cor2, borderRadius: 10, padding: 16 }}>
  <div style={{ fontSize: 14, fontWeight: 800, color: cor1 }}>BARBERARIA</div>
  <div style={{ background: cor1, color: cor2, padding: "6px 14px", borderRadius: 6 }}>Agendar</div>
</div>
```

---

## 9. PROMPT PARA CLAUDE CODE (VSCode)

Cole este prompt no Claude Code para gerar o protótipo completo:

---

```
Você é um desenvolvedor React sênior. Gere um protótipo funcional completo do Painel Admin de uma Barbearia chamada "Barberaria" como um único arquivo React (JSX).

CONTEXTO DO PRODUTO:
- Sistema SaaS White Label Multitenant para barbearias
- Usuário logado: Victor Mendes (Administrador)
- Este painel é para o dono/gestor da barbearia

STACK:
- React 18 com hooks (useState)
- Inline styles apenas (sem CSS externo, sem Tailwind, sem styled-components)
- Arquivo único: tudo em App.jsx
- Sem TypeScript

DESIGN TOKENS (use exatamente estes valores — objeto T no topo):
bg: "#0F0F0F" | surface: "#181818" | card: "#1F1F1F"
gold: "#C9A84C" | goldDim: "#8A6E2E" | text: "#F5F0E8"
muted: "#777" | border: "#2A2A2A" | success: "#34D399"
warning: "#F5A623" | danger: "#F25C5C"

COMPONENTES COMPARTILHADOS (implementar todos):
- Badge({ color, children }) — pill com cor e borda semitransparente
- Avatar({ name, size=32 }) — círculo com iniciais em dourado
- Stat({ label, value, sub }) — card de métrica

LAYOUT RAIZ:
- Sidebar (240px, fixa, 100vh) + área de conteúdo (flex: 1, overflowY: auto)
- Sidebar com seções categorizadas (labels em uppercase, 10px)
- Usuário logado no rodapé da sidebar

MENU LATERAL (15 itens em 5 seções):
[sem label]: Dashboard
[Operação]: Agenda, Clientes, Serviços, Produtos, Estoque & Fornecedores
[Comercial]: Pacotes & Promoções, Cupons de Desconto, Assinaturas, Clube de Clientes
[Financeiro]: Financeiro, Comissões
[Relacionamento]: Notificar Promoções, Satisfação do Cliente
[sem label]: Configurações

TELAS A IMPLEMENTAR (todas em uma única tela de scroll, sem modal):

1. DASHBOARD — stats (agendamentos hoje, faturamento, clientes, ticket médio), lista de agenda do dia (hora + avatar + serviço + status), ranking de barbeiros com barra de progresso

2. AGENDA — grade semanal com 3 barbeiros como colunas, horários nas linhas, cards coloridos nos slots ocupados

3. CLIENTES — tabela com avatar, visitas, última visita, gasto total, plano de assinatura; campo de busca no header

4. SERVIÇOS — tabela editável (CRUD inline): nome, duração, preço (prefixo R$), toggle ativo/inativo, remover. Formulário abre acima da tabela ao clicar em "Novo serviço" ou "Editar"

5. PRODUTOS — igual a Serviços mas com campo de categoria (select) e quantidade em estoque. Estoque zero exibe "Sem estoque" em vermelho. Stats no topo

6. ESTOQUE & FORNECEDORES — tabs internas: aba Estoque (tabela com status ok/baixo/zerado), aba Fornecedores (cards com nome, contato, categoria)

7. PACOTES & PROMOÇÕES — cards com preço original riscado + preço promocional em dourado, toggle ativo/inativo

8. CUPONS DE DESCONTO — cards com borda dashed dourada, código em destaque, contador de usos, badge de status, botão de divulgação em massa

9. ASSINATURAS — stats + tabela de clientes assinantes com próxima data de cobrança

10. CLUBE DE CLIENTES — regras em card informativo, ranking de membros com pontos e nível (Bronze/Prata/Ouro/Platina)

11. FINANCEIRO — stats (receita, despesas, deduções, lucro), tabs: Resumo / Receitas / Despesas / Deduções. Resumo mostra soma com sinal (+/-) e cor semântica

12. COMISSÕES — stats + tabela com % de comissão (badge dourado) e valor total por barbeiro

13. NOTIFICAR PROMOÇÕES — formulário com seleção de público (4 segmentos como tabs clicáveis), textarea editável, histórico de envios anteriores

14. SATISFAÇÃO DO CLIENTE — stats (nota média, total de avaliações, NPS), cards de avaliação com estrelas e comentário

15. CONFIGURAÇÕES — dois cards: (a) Identidade Visual com upload de logo, pickers de cor primária e cor de fundo com preview ao vivo do tema; (b) Módulos Opcionais com toggles on/off para 6 módulos

PADRÕES OBRIGATÓRIOS:
- Toggle on/off: pill 38x20px, bolinhas movem com transition "left 0.2s", dourado quando ativo
- CRUD inline: estado editing = null | "new" | id; form aparece em card com borda dourada acima da tabela
- Tabs internas: borderBottom dourado no item ativo, cor muted nos inativos
- Todas as telas têm padding: 32px e overflowY: auto
- Botões primários: background T.gold, color T.bg, borderRadius 8px
- Botões ghost/ação: color T.gold, border 1px solid T.gold + "55"
- Nenhum dado hardcoded fora de array declarado no topo de cada componente
- Sem bibliotecas externas além do React
```

---

## 10. ARQUIVOS DO PROJETO

### Estrutura de arquivos gerados neste protótipo

```
/
├── barberos-painel-barbearia.jsx   ← este arquivo (painel da barbearia)
├── barberos-app-cliente.jsx        ← app do cliente final (mobile)
└── desenvolva-in-painel-master.jsx ← painel master da Desenvolva IN
```

### Para rodar cada um no VSCode

```bash
# 1. Criar projeto Vite
npm create vite@latest nome-do-app -- --template react
cd nome-do-app
npm install

# 2. Substituir src/App.jsx pelo conteúdo do arquivo .jsx desejado

# 3. Limpar imports desnecessários no src/main.jsx:
# Remover: import './index.css'
# Manter: import React from 'react' e import App from './App'

# 4. Rodar
npm run dev
# Acesse: http://localhost:5173
```

---

## 11. DADOS FICTÍCIOS USADOS NO PROTÓTIPO

### Barbearia
- **Nome:** Barberaria
- **Slug:** barberaria.barberaria.app

### Profissionais
| Nome | Especialidade |
|---|---|
| Carlos Silva | Cortes clássicos e degradê |
| Victor Mendes | Administrador / Barba e pigmentação |
| Rafael Costa | Sobrancelha e relaxamento facial |

### Serviços e preços
| Serviço | Duração | Preço |
|---|---|---|
| Corte | 45 min | R$ 40 |
| Barba | 30 min | R$ 35 |
| Corte + Barba | 60 min | R$ 65 |
| Sobrancelha | 15 min | R$ 20 |
| Relaxamento Facial | 30 min | R$ 45 |
| Pigmentação de Barba | 40 min | R$ 55 |

### Produtos
| Produto | Categoria | Preço | Estoque |
|---|---|---|---|
| Gel Modelador Fixação Forte | Cabelo | R$ 28 | 14 un |
| Pomada Matte | Cabelo | R$ 35 | 8 un |
| Óleo para Barba | Barba | R$ 32 | 20 un |
| Balm Hidratante para Barba | Barba | R$ 38 | 5 un |
| Shampoo Anticaspa | Cabelo | R$ 25 | 0 un (zerado) |
| Talco Pós-Barba | Acessórios | R$ 18 | 30 un |

### Planos de assinatura (clientes)
| Plano | Preço | Benefícios |
|---|---|---|
| Bronze | R$ 99/mês | 2 cortes/mês, 10% desconto em produtos |
| Black ♾ | R$ 120/mês | 4 cortes/mês, prioridade, 1 barba grátis, 15% em produtos |
| Premium | R$ 180/mês | 6 cortes/mês, prioridade máxima, barba+sobrancelha incluso |

---

## 12. PRÓXIMOS PASSOS (MVP REAL)

Este protótipo é **apenas visual (frontend)** — sem backend, sem persistência. Para evoluir para produção:

1. **Sprint 1:** Infra base + PostgreSQL + RLS + CI/CD
2. **Sprint 2:** Auth JWT + RBAC (roles: super_admin, admin, barbeiro, cliente)
3. **Sprint 3:** Módulo `tenants` (provisionamento + branding via Redis cache)
4. **Sprint 4:** CRUD de serviços + profissionais + horários
5. **Sprint 5:** Módulo de agendamentos (anti-double-booking via índice único condicional)
6. **Sprint 6:** Conectar este frontend ao backend real (substituir dados fake por chamadas à API)

**Stack de produção:**
- Backend: NestJS + Prisma + PostgreSQL (AWS RDS)
- Frontend: React + Vite (este protótipo como base)
- Infra: Terraform + AWS
- Cache: Redis (config de tenant)
- Auth: JWT 15min + refresh token httpOnly

---

*Documento gerado em Junho/2025 — Projeto Barberaria / Desenvolva IN*
