# Brasfrut — Sistema de Pedidos

Aplicativo web mobile-first para gerenciamento de pedidos de frutos/polpas da empresa Brasfrut.

## Arquitetura

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Roteamento**: Wouter v3
- **Estado**: Zustand (somente auth), TanStack Query (dados do servidor)
- **Gráficos**: Recharts
- **Toasts**: shadcn/ui Toaster

## Persistência de Dados

Todos os dados são persistidos no PostgreSQL (Neon) via API REST:
- Tabelas: `settings`, `employees`, `groups`, `subgroups`, `products`, `cycles`, `orders`, `order_items`, `audit_logs`
- ORM: Drizzle com conexão via `NEON_DATABASE_URL` (prioridade) ou `DATABASE_URL` (fallback)
- Database: Neon PostgreSQL (sa-east-1) — `server/db.ts` usa `pg.Pool` com SSL para Neon
- Frontend usa TanStack Query para cache e sincronização (staleTime: 30s)

Somente a sessão de autenticação usa Zustand + localStorage (`brasfrut_auth`).

## Ciclo Automático

- Dia 15 ao último dia do mês = ABERTO
- Dia 1 ao 14 = FECHADO
- Endpoint `GET /api/cycle/current` auto-cria e retorna o ciclo ativo
- Override: admin pode forçar abertura/fechamento via toggle no dashboard
  - Ao forçar abertura (dia 1-14), dialog pergunta o mês de referência:
    - **Mês anterior** (postergando prazo): pedidos entram no ciclo do mês anterior
    - **Mês atual** (antecipando abertura): pedidos entram no ciclo do mês atual
  - Settings usados: `cycleOverride` (force_open/force_closed/"") e `cycleOverrideMonth` (previous/current/"")
  - API retorna `overrideTarget`: "previous" | "current" | null

## Selfie Verification

- Funcionários devem tirar uma selfie no primeiro acesso (criação de senha)
- Usa FaceDetector API do navegador (Chrome/Edge) com fallback quando indisponível
- Foto armazenada como base64 JPEG na coluna `selfie_photo` da tabela `employees`
- `GET /api/employees` exclui selfie_photo do payload (performance)
- `GET /api/employees/:id/selfie` retorna a foto (somente admin, requer `Authorization: Bearer admin-token`)
- Admin pode visualizar a foto de cada funcionário via botão câmera (roxo) na lista de funcionários
- Componente: `client/src/components/SelfieCapture.tsx` — guia oval, indicador de face, captura via canvas
- Express body limit: 10MB (para suportar base64 das selfies)

## API Endpoints

- `GET/PATCH /api/settings` — Configurações (companyName, adminPassword, recoveryEmail, logoUrl)
- `POST /api/auth/login` — Login admin/funcionário
- `POST /api/auth/recover` — Recuperação de senha admin
- `POST /api/auth/search-by-name` — Busca funcionários por nome (fuzzy match, retorna até 15 resultados)
- `POST /api/auth/create-password` — Primeiro acesso do funcionário (com selfiePhoto obrigatória)
- `GET/POST/PATCH/DELETE /api/employees` — CRUD de funcionários (GET exclui selfie_photo)
- `GET /api/employees/:id/selfie` — Foto de verificação (admin-only)
- `POST /api/employees/bulk` — Importação em lote (CSV)
- `GET/POST/PATCH/DELETE /api/groups` — CRUD de grupos (retorna subgrupos aninhados)
- `PATCH /api/groups/reorder` — Reordenar grupos
- `POST/PATCH/DELETE /api/subgroups` — CRUD de subgrupos
- `PATCH /api/subgroups/reorder` — Reordenar subgrupos
- `GET/POST/PATCH/DELETE /api/products` — CRUD de produtos
- `PATCH /api/products/reorder` — Reordenar produtos
- `GET /api/cycle/current` — Ciclo atual (auto-criado)
- `GET/POST/PATCH /api/orders` — CRUD de pedidos (com items)
- `GET /api/audit-logs` — Log de auditoria (logins, pedidos criados/editados/excluídos, bloqueios)

## Autenticação

- **Admin**: usuário `admin` / senha `admin123` (alterável em Configurações)
- **Funcionário**: matrícula cadastrada pelo admin, primeiro acesso cria a senha
- **Recuperação de senha**: admin digita email de recuperação (`ermerson0724114@gmail.com`), senha é exibida na tela. Funcionários devem contatar o administrador para recuperar senha.
- **Busca por nome**: funcionários que não sabem a matrícula podem buscar pelo nome completo. Sistema faz fuzzy match e exibe resultados para seleção.

## Estrutura de Páginas

### Funcionário (rota `/dashboard`)
- **Dashboard** `/dashboard` — Status do pedido, total, prazo, gráfico de histórico 12 meses (barras azul cobalto)
- **Pedido** `/pedido` — Seleção de produtos por grupo/subgrupo com limites, subtotais por grupo, termo de aceite. Pedido confirmado mostra tela de resumo com opções Editar/Excluir. Após confirmar, redireciona ao dashboard.
- **Histórico** `/historico` — Listagem de pedidos anteriores com navegação por setas < Mês/Ano >

### Admin (rota `/admin`)
- **Dashboard** `/admin` — Cards de stats, gráfico anual (barras azul cobalto)
- **Funcionários** `/admin/funcionarios` — CRUD, importação CSV (com campo admissão), alterar senha, desbloquear, filtro por setor (multi-select), lista em ordem alfabética
- **Grupos & Produtos** `/admin/grupos` — Grupos colapsáveis com produtos inline, subgrupos, reordenação via setas, CRUD completo, botão ativar/desativar produto individual
- **Pedidos** `/admin/pedidos` — Visualização e edição de pedidos com navegação por setas < Mês/Ano >
- **Logs** `/admin/logs` — Log de auditoria com prova digital (ID, data/hora, IP, valor, referência, detalhes)
- **Configurações** `/admin/config` — Alterar senha admin, logo da empresa, nome da empresa, orçamento, email de recuperação

## Design

- Cores: Verde escuro (`green-900`) como cor primária, azul cobalto (#3b82f6) para gráficos
- Layout mobile-first, max-width 2xl centralizado
- Bottom navigation bar fixa (3 abas para funcionário, 7 para admin)
- Modais bottom-sheet para formulários
- Grupos/subgrupos/produtos: reordenáveis com setas cima/baixo

## Arquivos Principais

```
shared/schema.ts              # Drizzle schema + tipos (com sort_order em groups, subgroups, products)
server/db.ts                   # Conexão PostgreSQL
server/storage.ts              # DatabaseStorage (CRUD, sorted queries)
server/routes.ts               # Rotas REST API (incluindo reorder endpoints)
client/src/
├── lib/
│   ├── store.ts               # Zustand auth store
│   ├── queryClient.ts         # TanStack Query config
│   └── mockData.ts            # Constantes MONTHS
├── pages/
│   ├── LoginPage.tsx          # Login com selfie capture no primeiro acesso
│   ├── employee/
│   │   ├── EmployeeLayout.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── OrderPage.tsx
│   │   └── HistoryPage.tsx
│   └── admin/
│       ├── AdminLayout.tsx
│       ├── AdminDashboard.tsx
│       ├── AdminEmployees.tsx
│       ├── AdminGroups.tsx     # Grupos + Produtos unificados, colapsáveis, reordenáveis
│       ├── AdminOrders.tsx
│       ├── AdminLogs.tsx       # Log de auditoria
│       └── AdminSettings.tsx
└── App.tsx
```
