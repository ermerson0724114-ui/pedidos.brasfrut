# Guia de Migração — Brasfrut para GitHub + Neon + Railway

Este guia explica como rodar o projeto Brasfrut idêntico usando:
- **GitHub** — repositório do código
- **Neon** — banco de dados PostgreSQL gratuito
- **Railway** — deploy do backend (Express + frontend estático)

> Railway substituiu o plano gratuito por um trial de $5. Alternativa 100% gratuita: **Render.com** (mesma config, free tier real). As instruções abaixo servem para ambos.

---

## 1. Criar o Repositório no GitHub

```bash
# Na sua máquina local, clone ou baixe o código do Replit
# Depois:
git init
git add .
git commit -m "Brasfrut - versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/brasfrut.git
git push -u origin main
```

### Arquivos para REMOVER antes de subir:

Apague estes arquivos que são exclusivos do Replit:
```
.replit
replit.nix
replit.md
.local/
attached_assets/
```

### Arquivo .gitignore (atualizar):
```
node_modules/
dist/
.env
*.log
```

---

## 2. Configurar o Banco de Dados (Neon)

1. Acesse https://neon.tech e crie uma conta gratuita
2. Crie um novo projeto (ex: `brasfrut`)
3. Copie a **Connection String** (formato: `postgresql://user:pass@host/dbname?sslmode=require`)
4. Guarde essa URL — será usada como `DATABASE_URL`

### Inicializar o banco:
```bash
# Na sua máquina, com o .env configurado:
DATABASE_URL="postgresql://..." npx drizzle-kit push
```

---

## 3. Arquivos de Configuração para o Deploy

### 3.1 — Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz (NÃO suba para o GitHub):
```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
SESSION_SECRET=uma-string-secreta-qualquer
NODE_ENV=production
PORT=5000
```

### 3.2 — vite.config.ts (substituir o atual)

Substituir para remover plugins exclusivos do Replit:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
```

### 3.3 — package.json scripts (verificar)

Os scripts já estão corretos:
```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "tsx script/build.ts",
    "start": "NODE_ENV=production node dist/index.cjs",
    "db:push": "drizzle-kit push"
  }
}
```

### 3.4 — Remover devDependencies do Replit

Remova estas dependências que são exclusivas do Replit:
```bash
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-dev-banner @replit/vite-plugin-runtime-error-modal
```

### 3.5 — server/vite.ts (substituir)

Remova referências ao Replit:

```typescript
import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import fs from "fs";
import path from "path";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const vite = await createViteServer({
    configFile: path.resolve(__dirname, "..", "vite.config.ts"),
    server: {
      middlewareMode: true,
      hmr: { server, path: "/vite-hmr" },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
```

### 3.6 — server/db.ts (adicionar SSL para Neon)

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
```

---

## 4. Deploy no Railway

### 4.1 — Criar conta e projeto

1. Acesse https://railway.app e faça login com GitHub
2. Clique em **"New Project"** → **"Deploy from GitHub Repo"**
3. Selecione o repositório `brasfrut`

### 4.2 — Configurar variáveis de ambiente no Railway

No painel do Railway, vá em **Variables** e adicione:
```
DATABASE_URL = (cola a URL do Neon aqui)
SESSION_SECRET = uma-string-secreta-qualquer
NODE_ENV = production
PORT = 5000
```

### 4.3 — Configurar build e start

No Railway, vá em **Settings** → **Build & Deploy**:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Watch Paths**: deixe vazio

### 4.4 — Gerar domínio

Em **Settings** → **Networking** → **Generate Domain**
Seu app ficará acessível em `https://brasfrut-production.up.railway.app` (ou similar).

---

## 5. Alternativa: Deploy no Render.com (100% gratuito)

Se preferir um free tier permanente:

1. Acesse https://render.com e faça login com GitHub
2. Clique em **"New Web Service"**
3. Conecte o repositório `brasfrut`
4. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Environment**: `Node`
5. Adicione as variáveis de ambiente (mesmas do Railway)
6. Escolha o plano **Free**

> Nota: o plano free do Render hiberna após 15min de inatividade. O primeiro acesso pode demorar ~30s para "acordar".

---

## 6. Alternativa: Frontend na Vercel + Backend no Railway/Render

Se quiser separar frontend e backend:

### 6.1 — Frontend (Vercel)

Crie um `vercel.json` na raiz:
```json
{
  "buildCommand": "cd client && npx vite build --outDir ../dist/public",
  "outputDirectory": "dist/public",
  "framework": null,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://SEU-BACKEND.railway.app/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

E crie `client/.env.production`:
```
VITE_API_URL=https://SEU-BACKEND.railway.app
```

Depois, no `client/src/lib/queryClient.ts`, altere a `apiRequest` para usar:
```typescript
const BASE = import.meta.env.VITE_API_URL || "";
// use `${BASE}/api/...` nas chamadas
```

### 6.2 — Backend (Railway/Render)

Mesmo processo da seção 4 ou 5, mas adicione CORS no `server/index.ts`:
```typescript
import cors from "cors";
app.use(cors({ origin: "https://SEU-FRONTEND.vercel.app", credentials: true }));
```

Instale o pacote:
```bash
npm install cors @types/cors
```

> **Recomendação**: A opção mais simples é manter tudo junto (seção 4 ou 5), sem separar frontend/backend. Menos configuração, menos problemas.

---

## 7. Inicializar o Banco no Neon

Depois de configurar o `DATABASE_URL`, rode localmente:

```bash
# Instalar dependências
npm install

# Criar as tabelas no Neon
npm run db:push

# Testar localmente
npm run dev
```

O app vai rodar em `http://localhost:5000`.

Credenciais padrão:
- **Admin**: usuário `admin`, senha `admin123`
- **Funcionários**: criados pelo admin, senha criada no primeiro acesso

---

## 8. Checklist Final

- [ ] Código no GitHub (sem arquivos do Replit)
- [ ] Banco criado no Neon
- [ ] `DATABASE_URL` configurada no Neon
- [ ] Tabelas criadas com `npm run db:push`
- [ ] Plugins do Replit removidos do `vite.config.ts`
- [ ] `server/db.ts` com SSL habilitado
- [ ] Deploy no Railway/Render com variáveis configuradas
- [ ] Domínio gerado e app acessível
- [ ] Testar login admin
- [ ] Testar criação de funcionário
- [ ] Testar pedido completo

---

## Resumo da Stack

| Serviço | Função | Custo |
|---------|--------|-------|
| GitHub | Repositório do código | Gratuito |
| Neon | Banco PostgreSQL | Gratuito (0.5GB) |
| Railway | Backend + Frontend | Trial $5/mês |
| Render (alternativa) | Backend + Frontend | Gratuito (hiberna) |
| Vercel (opcional) | Frontend separado | Gratuito |

---

## Estrutura do Projeto

```
brasfrut/
├── client/                 # Frontend React
│   ├── index.html
│   ├── public/favicon.png
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── components/ui/  # shadcn/ui (47 componentes)
│       ├── hooks/
│       ├── lib/
│       └── pages/
│           ├── LoginPage.tsx
│           ├── employee/   # Dashboard, Pedido, Histórico
│           └── admin/      # Dashboard, Funcionários, Grupos, Pedidos, Config
├── server/                 # Backend Express
│   ├── index.ts           # Entry point
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Database operations
│   ├── db.ts              # PostgreSQL connection
│   ├── vite.ts            # Dev server
│   └── static.ts          # Production static files
├── shared/
│   └── schema.ts          # Database schema (Drizzle ORM)
├── script/
│   └── build.ts           # Build script
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── tailwind.config.ts
└── postcss.config.js
```
