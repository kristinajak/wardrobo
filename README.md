# Wardrobo

Wardrobo explores an AI-assisted wardrobe experience where users can describe clothing in natural language and receive relevant suggestions. The project is built with Next.js, Tailwind CSS, TypeScript, Prisma, and PostgreSQL.

## Architecture Snapshot

- **Frontend (Next.js SPA)** handles browsing, natural-language prompts, upload UI, and local state for filters/recommendations.
- **Backend API routes** expose CRUD for clothes, orchestrate GPT calls, and proxy all data access.
- **Primary datastore (PostgreSQL + Prisma)** stores canonical clothing items with structured metadata (colors, tags, owner, upload paths).
- **Search layer** combines standard filtering with future semantic search via embeddings (pgvector or external vector store).
- **AI orchestration** converts free-form prompts into structured filters, performs semantic search, and logs feedback for iteration.

## Local Development

### Prerequisites

- Node.js 18+
- npm (bundled with Node) or pnpm/yarn
- Docker Desktop (for the local PostgreSQL instance)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the database (requires Docker):
   ```bash
   docker compose up -d
   ```
3. Copy `.env.example` to `.env` (ensure `DATABASE_URL` points at the local database, e.g. `postgresql://postgres:postgres@localhost:5432/wardrobo?schema=public`).
4. Apply the initial Prisma migration:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Launch the Next.js dev server:
   ```bash
   npm run dev
   ```
6. Visit `http://localhost:3000`.

### AI Query Endpoint

- Set `OPENAI_API_KEY` in your environment to enable AI-powered queries.
- POST `/api/ai/query` with JSON `{ "prompt": string, "page"?: number, "perPage"?: number, "category"?: string | null, "color"?: string | null }`.
- Returns the same `{ data, meta }` shape as `/api/clothes`.
- The UI has a "Use AI" toggle that will send the search text as a prompt.

### Useful Commands

- `docker compose logs -f postgres` – inspect database logs.
- `npx prisma studio` – open Prisma Studio to inspect/edit data.
- `npm run lint` – run linting.

## Next Steps

- Add API routes for listing/filtering clothing items.
- Prototype an OpenAI prompt to translate natural-language requests into structured filters.
- Introduce embeddings + vector search once the core flow is stable.
