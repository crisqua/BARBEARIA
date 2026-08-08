# Barberaria — Protótipos

Monorepo com os protótipos interativos do sistema White Label Multitenant para Barbearias.

## Estrutura

```
BARBEARIA/
├── apps/
│   ├── cliente-app/         # App do cliente final (agendamento, planos, loja)
│   └── painel-barbearia/    # Painel de administração da barbearia
└── README.md
```

## Como rodar localmente (VSCode)

Cada app é independente, com seu próprio `package.json`. Abra o terminal integrado do VSCode dentro da pasta do app que quiser rodar:

```bash
cd apps/cliente-app
npm install
npm run dev
```

```bash
cd apps/painel-barbearia
npm install
npm run dev
```

- **App Cliente** roda por padrão em `http://localhost:5173`
- **Painel Barbearia** roda por padrão em `http://localhost:5174`

## Stack dos protótipos

- React 18 + Vite
- Estilização inline (tokens de cor centralizados no topo de cada `App.jsx`)
- Estes são protótipos de interface (mock/estático) — ainda não conectados a um backend real.

## Próximos passos

Ver documentação de arquitetura técnica e plano de projeto no repositório de documentação do produto (não incluído neste repo de protótipos).
