<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,24&height=200&section=header&text=Amiro%20SEO&fontSize=60&fontColor=ffffff&animation=fadeIn&fontAlignY=38" width="100%"/>

### 🚀 Technical SEO audits. Real data. Zero fluff.

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](./LICENSE)

[![Stars](https://img.shields.io/github/stars/iamirama/amiro_seo_app?style=for-the-badge&logo=github&color=FFD700)](https://github.com/iamirama/amiro_seo_app/stargazers)
[![Forks](https://img.shields.io/github/forks/iamirama/amiro_seo_app?style=for-the-badge&logo=github&color=60a5fa)](https://github.com/iamirama/amiro_seo_app/network)
[![Issues](https://img.shields.io/github/issues/iamirama/amiro_seo_app?style=for-the-badge&logo=github&color=f87171)](https://github.com/iamirama/amiro_seo_app/issues)
[![Last Commit](https://img.shields.io/github/last-commit/iamirama/amiro_seo_app?style=for-the-badge&logo=git&color=a78bfa)](https://github.com/iamirama/amiro_seo_app/commits/main)

<br/>

[🚀 Quick Start](#-quick-start) · [✨ Features](#-features) · [🛠 Tech Stack](#-tech-stack) · [🧩 Architecture](#-architecture-overview) · [☁️ Deploy](#️-deploy)

<br/>

🌍 **Languages**: **English** ✅ · [فارسی](./README.md)
<br/>
<br/>

<a href="https://seoscan-seven.vercel.app/" target="_blank">
  <img src="https://img.shields.io/badge/🚀_Live_Demo-Try_Amiro_SEO_App-4F46E5?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" height="45" />
</a>
</div>

---

## 📌 What is this?

**Amiro SEO** is a free-first technical SEO audit tool that crawls any public website, explains every finding, and generates a fully offline report. Paid SEO APIs are **optional** — if no provider is connected, no data is artificially fabricated.

Built for developers and SEO specialists who want transparent, real-data audits without hidden costs.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🔍 | **Deep Technical Audit** | Crawls every public URL and checks **400+ on-page factors** (meta tags, headings, images, structured data, performance signals, security headers, broken links, and more). |
| 🤖 | **AI-Powered Remedies** | Uses a configurable LLM provider (e.g. OpenAI) to suggest actionable fixes for each issue found. *Bring your own API key — no hidden costs.* |
| ✅ | **Transparent Scoring** | Scores are calculated **only from data actually collected**. If a paid API isn't connected, those factors are marked as *unknown* and are not unfairly penalized. |
| 🔌 | **Optional Paid API Integrations** | Connect Ahrefs, Semrush, Moz, Majestic, or similar. When connected, data enriches the audit; when not, the audit still works fully with free data. |
| 📄 | **Offline-Ready Report** | Download the entire audit as a **standalone HTML or PDF file** that opens and can be shared without an internet connection. |
| 👤 | **User Accounts & History** | Authenticated users can save audits, view past reports, and manage API keys per project. |
| ⚙️ | **Settings & Provider Management** | A dedicated settings page for securely storing API keys and selecting active providers. |
| 🎨 | **Modern UI** | Built with Radix UI, Tailwind CSS, and a cohesive design system (CMDK command palette, responsive tables, dark-mode ready). |

> **Live Demo:** [https://seoscan-seven.vercel.app/](https://seoscan-seven.vercel.app/)
> Demonstrates the core audit flow without requiring registration.

---

## 🛠 Tech Stack

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Radix UI](https://img.shields.io/badge/Radix_UI-161618?style=flat-square&logo=radixui&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-C5F74F?style=flat-square&logo=drizzle&logoColor=black)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

| Layer | Technology |
|---|---|
| **Framework** | Next.js (App Router) + TanStack Router |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS + Radix UI |
| **State / Data** | TanStack Query + TanStack Table |
| **Database** | PostgreSQL with Drizzle ORM (plus PGlite for embedded/local mode) |
| **Authentication** | Better Auth |
| **Validation** | Zod |
| **Forms** | React Hook Form |
| **SEO Crawling** | Cheerio + custom HTML parser engine |
| **Charts** | D3.js (via `d3-scale`, `d3-shape`, …) |
| **CLI Tools** | CMDK, date-fns, clsx |
| **Testing** | Vitest |
| **Lint / Format** | ESLint + Prettier |
| **Deploy** | Vercel |

---

## 🧩 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Client (Next.js / React)                                │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │
│ │ Audit UI    │ │ Settings    │ │ Report Viewer   │    │
│ └─────────────┘ └─────────────┘ └─────────────────┘    │
└──────────────────────────┬──────────────────────────────┘
                           │ (TanStack Query / Router)
┌──────────────────────────▼──────────────────────────────┐
│ Server (Next.js API / RPC)                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │
│ │ Audit       │ │ Auth        │ │ Provider        │    │
│ │ Engine      │ │ (Better)    │ │ Connectors      │    │
│ └──────┬──────┘ └──────┬──────┘ └────────┬────────┘    │
│        │               │                  │             │
│ ┌──────▼───────────────▼──────────────────▼────────┐    │
│ │ Drizzle ORM (PostgreSQL)                        │    │
│ └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

- **Audit Engine** – Fetches the target URL, parses the DOM with Cheerio, and runs a suite of check rules.
- **Provider Connectors** – Separate modules for each paid SEO API. They are **optional** and degrade gracefully when credentials are absent.
- **Report Serializer** – Converts the audit result into a standalone HTML document with inline CSS and images, ready for offline saving and sharing.
- **Auth & Persistence** – Sessions, saved audits, and encrypted provider keys are stored in PostgreSQL.

---

## ⚡ Quick Start

### 1️⃣ Prerequisites

- **Node.js** `≥ 20` (or `bun` / `pnpm`)
- **PostgreSQL** `≥ 14` (or use **PGlite** for an embedded, zero-config database)
- A modern browser (Chrome, Firefox, Safari, Edge)

### 2️⃣ Clone & Install

```
git clone https://github.com/iamirama/amiro_seo_app.git
cd amiro_seo_app
npm install
# or pnpm install
# or bun install
```

### 3️⃣ Environment Variables

Create a `.env.local` file in the project root:

```
# ── Database ─────────────────────────────────
DATABASE_URL="postgresql://user:password@localhost:5432/amiro_seo"

# ── Auth (Better Auth) ───────────────────────
BETTER_AUTH_SECRET="a-32-character-secret"
BETTER_AUTH_URL="http://localhost:3000"

# ── Optional: AI Provider ────────────────────
OPENAI_API_KEY="sk-..."
AI_MODEL="gpt-4o-mini"

# ── Optional: Paid SEO APIs ──────────────────
# AHREFS_API_KEY=""
# SEMRUSH_API_KEY=""
# MOZ_ACCESS_ID=""
# MOZ_SECRET_KEY=""
```

> **Note:** All paid API keys are **optional**. The app runs without them and still produces meaningful audits — those data points are simply marked as "unavailable".

### 4️⃣ Database Setup

```
# Generate migration files (if schema changed)
npm run db:generate

# Apply migrations to the database
npm run db:migrate

# Or push schema directly (development only)
npm run db:push
```

To use **PGlite** (no external database needed), set:
```
DATABASE_URL="pglite://./.pglite"
```

### 5️⃣ Run Locally

```
npm run dev
```

Then open **http://localhost:3000**.

For a production build locally:
```
npm run build
npm run start
```

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (hot-reload) |
| `npm run build` | Build optimized production bundle |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint on the entire codebase |
| `npm run format` | Format all files with Prettier |
| `npm run test` | Run unit tests with Vitest |
| `npm run db:generate` | Generate Drizzle migration files from schema |
| `npm run db:migrate` | Apply pending migrations to the database |
| `npm run db:push` | Push schema directly (development only) |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

---

## 📁 Project Structure

```
amiro_seo_app/
├── migrations/              # SQL migrations (Drizzle)
│   ├── 0002_seo.sql
│   └── auth/
│       └── 0001_auth.sql
├── public/                  # Static assets
├── screenshots/             # Screenshots for README & demo
├── scripts/                 # Utility scripts (seed, etc.)
├── server/                  # Server-side entry points (if any)
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # Reusable UI components (Radix + Tailwind)
│   ├── db/                  # Drizzle schema, client, and adapters
│   ├── features/            # Feature modules (audit, auth, settings)
│   ├── lib/                 # Shared utilities, hooks, and helpers
│   ├── providers/           # Context Providers (Query, Auth, Theme)
│   └── styles/              # Global CSS / Tailwind layers
├── .env.example             # Sample environment variables
├── eslint.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

---

## ☁️ Deploy

### Vercel (Recommended)

The project is ready for **Vercel**. Default Next.js settings work out of the box.

1. Push your code to GitHub.
2. Import the repository on [Vercel](https://vercel.com/new).
3. Add the **environment variables** listed above in the Vercel dashboard.
4. Deploy.

> **Live Demo:** [https://seoscan-seven.vercel.app/](https://seoscan-seven.vercel.app/)

### Other Platforms

Since the app uses standard Next.js and PostgreSQL, it can be deployed on any platform that supports Node.js and a Postgres database (Railway, Fly.io, Render, AWS, etc.). Just make sure `DATABASE_URL` and `BETTER_AUTH_URL` are correctly configured for the target environment.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repo.
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push the branch: `git push origin feat/amazing-feature`
5. Open a **Pull Request**.

Before submitting a PR, please run `npm run lint` and `npm run test`. For major changes, open an issue first to discuss your idea.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.

---

<div align="center">

### ⭐ If this project helped you, please give it a star!

[![Star](https://img.shields.io/badge/⭐_Star_this_repo-FFD700?style=for-the-badge&logo=github&logoColor=black)](https://github.com/iamirama/amiro_seo_app)

<sub>Made with ❤️ by <a href="https://github.com/amirhoseini">Amirhoseini</a></sub>

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,24&height=120&section=footer" width="100%"/>

</div>
