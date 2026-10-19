# 🚀 Amiro SEO App (Northline)
[English](README.en.md) | [فارسی](README.md)
> **Public-site audits. Scores only count data that was actually collected.**  
> A free-first technical SEO auditor that crawls a site, explains every finding, and generates an offline-ready report. Paid SEO APIs stay **optional** — nothing is filled in when a provider is disconnected.

<p align="left">
  <a href="https://github.com/iamirama/amiro_seo_app"><img src="https://img.shields.io/github/stars/iamirama/amiro_seo_app?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/iamirama/amiro_seo_app/network/members"><img src="https://img.shields.io/github/forks/iamirama/amiro_seo_app?style=social" alt="GitHub forks"></a>
  <a href="https://github.com/iamirama/amiro_seo_app/blob/main/LICENSE"><img src="https://img.shields.io/github/license/iamirama/amiro_seo_app" alt="License"></a>
  <a href="https://seoscan-seven.vercel.app/"><img src="https://img.shields.io/badge/Live%20Demo-Northline-0ea5e9?style=flat-square&logo=vercel" alt="Live Demo"></a>
</p>

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-000?logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Drizzle%20ORM-C5F74F?logo=drizzle&logoColor=black" alt="Drizzle ORM">
  <img src="https://img.shields.io/badge/Better%20Auth-000?logo=auth0&logoColor=white" alt="Better Auth">
  <img src="https://img.shields.io/badge/TanStack%20Router-FF4154?logo=reactrouter&logoColor=white" alt="TanStack Router">
  <img src="https://img.shields.io/badge/Radix%20UI-161618?logo=radixui&logoColor=white" alt="Radix UI">
</p>

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [🛠 Tech Stack](#-tech-stack)
- [🏗 Architecture Overview](#-architecture-overview)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running Locally](#running-locally)
- [📜 Available Scripts](#-available-scripts)
- [📁 Project Structure](#-project-structure)
- [☁️ Deployment](#️-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

- 🔍 **Deep Technical Audits** – Crawls any public URL and checks **400+ on-page factors** (meta tags, headings, images, structured data, performance signals, security headers, broken links, and more).
- 🧠 **AI-Powered Fix Suggestions** – Uses a configurable LLM provider (e.g., OpenAI) to generate actionable recommendations for every issue found. *Bring your own key; no hidden infrastructure costs.*
- 📊 **Scoring That Tells the Truth** – Scores are computed **only from data that was actually collected**. If a paid API is not connected, the related factors are marked as *unknown* rather than falsely penalised.
- 🔌 **Optional Paid-API Integrations** – Plug in Ahrefs, Semrush, Moz, Majestic, or similar providers. When connected, their data enriches the audit; when disconnected, the audit still works flawlessly with free-first data.
- 📄 **Offline-Ready Reports** – Download the full audit as a **self-contained HTML or PDF file** that can be shared, archived, and opened without an internet connection.
- 🔐 **User Accounts & History** – Authenticated users can save audits, revisit past reports, and manage API credentials per project.
- ⚙️ **Settings & Provider Management** – A dedicated settings page lets you store API keys securely and choose which providers to enable.
- 🌙 **Modern UI/UX** – Built with Radix UI primitives, Tailwind CSS, and a polished design system (CMDK command palette, responsive tables, dark-mode ready).

> **Live Demo:** [https://seoscan-seven.vercel.app/](https://seoscan-seven.vercel.app/)  
> The demo shows the core audit flow without requiring a sign-up.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Next.js](https://nextjs.org/) (App Router) + [TanStack Router](https://tanstack.com/router) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| **State / Data Fetching** | [TanStack Query](https://tanstack.com/query) + [TanStack Table](https://tanstack.com/table) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) via [Drizzle ORM](https://orm.drizzle.team/) (with optional [PGlite](https://pglite.dev/) for local/embedded use) |
| **Authentication** | [Better Auth](https://better-auth.com/) |
| **Validation** | [Zod](https://zod.dev/) |
| **Forms** | [React Hook Form](https://react-hook-form.com/) |
| **SEO Crawling** | [Cheerio](https://cheerio.js.org/) + custom HTML parsing engine |
| **Charts / Visualisation** | [D3.js](https://d3js.org/) (via `d3-scale`, `d3-shape`, etc.) |
| **CLI / Utilities** | [CMDK](https://cmdk.paco.me/), [date-fns](https://date-fns.org/), [clsx](https://github.com/lukeed/clsx) |
| **Testing** | [Vitest](https://vitest.dev/) |
| **Linting / Formatting** | [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) |
| **Deployment** | [Vercel](https://vercel.com/) |

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Next.js / React)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Audit UI   │  │  Settings   │  │  Report Viewer  │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │  (TanStack Query / Router)
┌──────────────────────────▼──────────────────────────────┐
│                 Server (Next.js API / RPC)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Audit      │  │  Auth       │  │  Provider       │  │
│  │  Engine     │  │  (Better)   │  │  Connectors     │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                   │           │
│  ┌──────▼────────────────▼───────────────────▼────────┐  │
│  │              Drizzle ORM (PostgreSQL)              │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- **Audit Engine** – Fetches the target URL, parses the DOM with Cheerio, runs a suite of rule-based checks, and optionally enriches findings with external APIs.
- **Provider Connectors** – Isolated modules for each paid SEO API. They are **opt-in** and degrade gracefully when credentials are missing.
- **Report Serializer** – Transforms the audit result into a standalone HTML document with inline CSS and images, so it can be saved and shared offline.
- **Auth & Persistence** – User sessions, saved audits, and encrypted provider keys are stored in PostgreSQL via Drizzle.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** `≥ 20` (or `bun` / `pnpm`)
- **PostgreSQL** `≥ 14` (or use **PGlite** for a zero-config embedded database)
- A modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/iamirama/amiro_seo_app.git
cd amiro_seo_app

# 2. Install dependencies
npm install
# or
pnpm install
# or
bun install
```

### Environment Variables

Create a `.env.local` file in the project root and fill in the required values:

```env
# ── Database ──────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@localhost:5432/amiro_seo"

# ── Authentication (Better Auth) ──────────────────────────
BETTER_AUTH_SECRET="your-32-character-secret"
BETTER_AUTH_URL="http://localhost:3000"

# ── Optional: AI Provider (for fix suggestions) ───────────
OPENAI_API_KEY="sk-..."
# AI_MODEL="gpt-4o-mini"

# ── Optional: Paid SEO APIs ───────────────────────────────
# AHREFS_API_KEY=""
# SEMRUSH_API_KEY=""
# MOZ_ACCESS_ID=""
# MOZ_SECRET_KEY=""
```

> **Note:** All paid-API keys are **optional**. The app will run and produce meaningful audits without them; the corresponding data points will simply be marked as unavailable.

### Database Setup

```bash
# Generate migration files (if you modify the schema)
npm run db:generate

# Apply migrations to your database
npm run db:migrate

# Or push the schema directly (development only)
npm run db:push
```

If you prefer **PGlite** (no external database required), set `DATABASE_URL="pglite://./.pglite"` and the app will use the embedded Postgres engine.

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.  
To run the production build locally:

```bash
npm run build
npm run start
```

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server (hot-reload) |
| `npm run build` | Create an optimised production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint across the codebase |
| `npm run format` | Format all files with Prettier |
| `npm run test` | Run unit tests with Vitest |
| `npm run db:generate` | Generate Drizzle migration files from the schema |
| `npm run db:migrate` | Apply pending migrations to the database |
| `npm run db:push` | Push the schema directly (dev only) |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

---

## 📁 Project Structure

```
amiro_seo_app/
├── migrations/               # Drizzle SQL migrations
│   ├── 0002_seo.sql
│   └── auth/
│       └── 0001_auth.sql
├── public/                   # Static assets
├── screenshots/              # README / demo screenshots
├── scripts/                  # Utility scripts (seeding, etc.)
├── server/                   # Server-side entry points (if any)
├── src/
│   ├── app/                  # Next.js App Router pages
│   ├── components/           # Reusable UI components (Radix + Tailwind)
│   ├── db/                   # Drizzle schema, client, and adapters
│   ├── features/             # Feature modules (audit, auth, settings)
│   ├── lib/                  # Shared utilities, hooks, and helpers
│   ├── providers/            # Context providers (Query, Auth, Theme)
│   └── styles/               # Global CSS / Tailwind layers
├── .env.example              # Example environment variables
├── eslint.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

---

## ☁️ Deployment

### Vercel (Recommended)

The project is pre-configured for **Vercel**. The standard Next.js preset works out of the box.

1. Push your code to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Add the **Environment Variables** listed above in the Vercel dashboard.
4. Deploy 🎉

> **Live Example:** [https://seoscan-seven.vercel.app/](https://seoscan-seven.vercel.app/)

### Other Platforms

Because the app uses standard Next.js and PostgreSQL, it can be deployed to any platform that supports Node.js and a Postgres database (Railway, Fly.io, Render, AWS, etc.). Ensure `DATABASE_URL` and `BETTER_AUTH_URL` are set correctly for the target environment.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository.
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a **Pull Request**.

Please make sure to run `npm run lint` and `npm run test` before submitting a PR.  
For major changes, open an issue first to discuss what you would like to change.

---

## 📄 License

Distributed under the **MIT License**. See the [`LICENSE`](https://github.com/iamirama/amiro_seo_app/blob/main/LICENSE) file for more information.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/iamirama">Iman Arama</a><br>
  <sub>If this project helped you, consider giving it a ⭐️ on GitHub!</sub>
</p>
