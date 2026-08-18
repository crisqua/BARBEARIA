# Barberaria — Monorepo

Sistema White Label Multitenant para Barbearias (Incubadora → Barbearia/tenant → Cliente final).
Ver `CLAUDE.md` para arquitetura, escopo do MVP e regras de segurança.

## Estrutura

```
BARBEARIA/
├── apps/
│   ├── api/                   # Backend NestJS + Prisma + PostgreSQL (RLS por tenant)
│   ├── cliente-app/           # App do cliente final (agendamento)
│   ├── painel-barbearia/      # Painel de administração da barbearia (conectado à API)
│   └── admin-desenvolvain/    # Painel master da incubadora (super_admin, conectado à API)
├── admin-barbearia.md         # Guia de reprodução do protótipo do painel-barbearia
├── admin-desenvolvain.md      # Status e plano de build (sprints) do painel master
└── README.md
```

## Como rodar localmente (VSCode)

Cada app é independente, com seu próprio `package.json`. A API precisa estar rodando (porta 3000)
para os três frontends funcionarem de verdade — ver `apps/api/README` ou `CLAUDE.md` seção 9 para
setup do backend (Postgres local, `.env`, migrations).

```bash
cd apps/api && npm install && npm run start:dev      # http://localhost:3000
cd apps/cliente-app && npm install && npm run dev     # http://localhost:5173
cd apps/painel-barbearia && npm install && npm run dev # http://localhost:5174
cd apps/admin-desenvolvain && npm install && npm run dev # http://localhost:5175
```

## Stack

- Backend: NestJS + Prisma + PostgreSQL (RLS nativo por tenant)
- Frontends: React 18 + Vite, estilização inline (tokens de cor centralizados no topo de cada `App.jsx`)
- Os três frontends já conectados à API real. `admin-desenvolvain` segue em conexão incremental por
  sprint (Sprints 1–6 concluídos + Configurações da Plataforma — ver `admin-desenvolvain.md`).
