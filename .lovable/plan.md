# Fase 1 — Arquitetura e Fundação

Este plano cobre **somente a Fase 1**: definir a stack, o modelo de dados e a estrutura visual base. **Nenhuma funcionalidade do Kanban, CRUD ou IA será implementada agora** — essas vêm nas Fases 2 a 5, cada uma validada separadamente.

## 🎯 Decisões já validadas com você

| Item | Decisão |
|---|---|
| Estética | **Dark mode denso** (inspiração withmast/Linear) |
| Multi-usuário | **Cadastro aberto** com estrutura preparada para colaboração futura |
| Capacidades da IA | Ler, criar, editar/mover/concluir tarefas + sugerir priorização |
| Projetos | **Cada projeto tem seu próprio Kanban** + view "Tudo" agregada |

## 🧱 Stack Técnica

- **Frontend**: React + TanStack Start + Tailwind + shadcn/ui (já configurado)
- **Backend + DB + Auth**: Lovable Cloud (Postgres + autenticação nativa email/senha + Google + RLS)
- **IA**: Lovable AI Gateway (sem necessidade de configurar API keys)
- **Drag & Drop**: `@dnd-kit` (acessível, performático, mobile-first)
- **Mobile-first**: layout responsivo desde o início; no mobile o Kanban vira swipe horizontal entre colunas

## 🗄️ Modelo de Dados (preparado para colaboração futura)

A estrutura abaixo já permite, no futuro, compartilhar projetos entre usuários sem migração destrutiva.

**1. `profiles`** — perfil do usuário (criado automaticamente no signup via trigger)
- `id` (FK → auth.users), `display_name`, `avatar_url`, `created_at`

**2. `projects`** — projetos/categorias, cada um com seu Kanban
- `id`, `owner_id` (FK → auth.users), `name`, `color` (hex), `icon` (emoji ou lucide name), `created_at`

**3. `project_members`** *(estrutura pronta, não usada ainda)* — futura colaboração
- `project_id`, `user_id`, `role` (`owner` | `editor` | `viewer`)

**4. `tasks`** — as tarefas em si
- `id`, `project_id` (FK), `created_by` (FK), `title`, `description`, `status` (`todo` | `doing` | `done`), `position` (float, para ordenação no drag&drop), `due_date` (date), `due_time` (time), `created_at`, `updated_at`

**5. `chat_messages`** — histórico de conversa com a IA (por usuário)
- `id`, `user_id`, `role` (`user` | `assistant`), `content`, `created_at`

**Segurança (RLS)**: cada tabela com políticas que garantem que o usuário só vê/edita o que é dele (via `owner_id` ou `created_by`). Isso já protege contra vazamento mesmo quando colaboração for ativada.

## 🎨 Design System (Dark Mode Denso)

Inspirado na referência 1 (withmast):
- **Fundo**: preto profundo (`oklch(0.12 0 0)` aprox.)
- **Surfaces**: cinza muito escuro com sutil elevação
- **Texto**: branco/cinza-claro com hierarquia clara
- **Acentos**: cor primária sóbria (a definir — proponho um azul-violeta sutil) + cores vibrantes **apenas** nas tags de projeto (cada projeto tem sua cor)
- **Tipografia**: Inter (system stack) — leve e densa
- **Densidade**: cards compactos, espaçamento apertado, hierarquia por peso/tamanho de fonte (não por espaço em branco)

## 🗺️ Estrutura de Rotas (a criar nas próximas fases)

```
/                          → Landing/redirect (pública)
/login                     → Tela de login + cadastro
/_authenticated/
  ├── desk                 → "Meu Desk" (visão pessoal/hoje)
  ├── everything           → Kanban agregado de TODOS projetos
  ├── projects/$id         → Kanban de um projeto específico
  └── chat                 → Conversa com a IA
```

Sidebar fixa (esquerda) com: Meu Desk · Tudo · lista de Projetos · Chat IA · Configurações.

## 📦 O que será entregue NESTA fase (Fase 1)

✅ Apenas a **fundação**, sem features ainda:
1. Ativar Lovable Cloud (banco + auth)
2. Criar o esquema do banco com as 5 tabelas + RLS + trigger de criação de perfil
3. Configurar o tema dark denso global no `styles.css`
4. Criar a estrutura de pastas de rotas (com placeholders simples)
5. Limpar o `index.tsx` placeholder

❌ **NÃO entra nesta fase**: tela de login funcional, Kanban, drag&drop, CRUD, IA. Tudo isso vem nas próximas fases após nova validação sua.

## ➡️ Próximos passos (depois da sua aprovação desta fase)

- **Fase 2**: Tela de login/cadastro funcional + rotas protegidas + sidebar
- **Fase 3**: UI do Kanban + drag & drop entre colunas
- **Fase 4**: CRUD completo de tarefas (modal de criação/edição com prazo, hora, projeto)
- **Fase 5**: Chatbot de IA com tool-calling (ler/criar/editar tarefas via comando)

---

**Confirma essa fundação? Quer ajustar algo no modelo de dados, na paleta de cores, ou na estrutura de rotas antes de eu começar?**