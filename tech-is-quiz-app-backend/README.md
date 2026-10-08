# TechIs Quiz API

The API and Socket.IO service uses PostgreSQL for users, quizzes, rooms, teams, participants, and submissions. Live room state remains in memory for low-latency Socket.IO gameplay and is persisted as it changes.

## Local setup

1. Copy `.env.example` to `.env` and `../tech-is-quiz-app-frontend/.env.example` to `../tech-is-quiz-app-frontend/.env.local`.
2. Start PostgreSQL with `corepack pnpm db:up`, or configure an existing PostgreSQL instance in `DATABASE_URL`.
3. Generate a random session secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and put the same value in both environment files.
4. Install backend packages with `corepack pnpm install`.
5. Apply the schema with `corepack pnpm migrate:postgres`.
6. Import existing JSON users and quizzes once with `corepack pnpm migrate:json`.
7. Create additional accounts with `corepack pnpm create-user -- "host@example.com" "Quiz Host" ADMIN` or use `PARTICIPANT` for players. Account creation prompts for a password; passwords must contain at least 12 characters.
8. Start the API with `corepack pnpm dev`.
9. In the frontend directory, run `corepack pnpm install` and `corepack pnpm dev`.

The frontend runs on port 3000 and the API on port 4100 by default. Configure `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` when using different origins. In production, serve both over HTTPS and use a unique, random `AUTH_SECRET`.