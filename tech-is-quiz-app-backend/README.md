# TechIs Quiz API

The API and Socket.IO service stores quiz definitions in `data/quizzes.json` and user password hashes in `data/users.json`. Room sessions remain in memory and are cleared when the service restarts.

## Local setup

1. Copy `.env.example` to `.env` and `../tech-is-quiz-app-frontend/.env.example` to `../tech-is-quiz-app-frontend/.env.local`.
2. Generate a random session secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and put the same value in both environment files.
3. Install backend packages with `corepack pnpm install`.
4. Create an account: `corepack pnpm create-user -- "host@example.com" "Quiz Host" ADMIN` or use `PARTICIPANT` for players. Account creation prompts for a password; passwords must contain at least 12 characters.
5. Start the API with `corepack pnpm dev`.
6. In the frontend directory, run `corepack pnpm install` and `corepack pnpm dev`.

The frontend runs on port 3000 and the API on port 4100 by default. Configure `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` when using different origins. In production, serve both over HTTPS and use a unique, random `AUTH_SECRET`.