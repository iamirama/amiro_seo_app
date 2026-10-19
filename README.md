# 🚀 Amiro SEO App (Northline)
[English](README.en.md) | [فارسی](README.md)

> **آدیت سایت‌های عمومی. امتیازها فقط بر اساس داده‌هایی محاسبه می‌شن که واقعاً جمع‌آوری شده‌اند.**  
> یک ابزار آدیت سئوی تکنیکال رایگان‌محور که سایت را کرال می‌کند، هر یافته را توضیح می‌دهد و یک گزارش کاملاً آفلاین تولید می‌کند. APIهای سئوی پولی **اختیاری** هستند — اگر ارائه‌دهنده‌ای متصل نباشد، هیچ داده‌ای به‌صورت مصنوعی پر نمی‌شود.

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

## 📖 فهرست مطالب

- [✨ امکانات](#-امکانات)
- [🛠 استک فنی](#-استک-فنی)
- [🏗 نمای کلی معماری](#-نمای-کلی-معماری)
- [🚀 شروع به کار](#-شروع-به-کار)
  - [پیش‌نیازها](#پیشنیازها)
  - [نصب](#نصب)
  - [متغیرهای محیطی](#متغیرهای-محیطی)
  - [راه‌اندازی دیتابیس](#راهاندازی-دیتابیس)
  - [اجرای لوکال](#اجرای-لوکال)
- [📜 اسکریپت‌های موجود](#-اسکریپتهای-موجود)
- [📁 ساختار پروژه](#-ساختار-پروژه)
- [☁️ دیپلوی](#️-دیپلوی)
- [🤝 مشارکت](#-مشارکت)
- [📄 لایسنس](#-لایسنس)

---

## ✨ امکانات

- 🔍 **آدیت عمیق تکنیکال** – هر URL عمومی را کرال می‌کند و **بیش از ۴۰۰ فاکتور آن‌پیج** را بررسی می‌کند (تگ‌های متا، هدینگ‌ها، تصاویر، داده‌های ساختاریافته، سیگنال‌های پرفورمنس، هدرهای امنیتی، لینک‌های شکسته و…).
- 🧠 **پیشنهاد رفع مشکل با هوش مصنوعی** – از یک ارائه‌دهنده LLM قابل تنظیم (مثل OpenAI) استفاده می‌کند تا برای هر مشکل پیدا شده، راهکار عملی ارائه بده. *کلید API خودت را وصل کن؛ هیچ هزینه پنهانی وجود ندارد.*
- 📊 **امتیازدهی شفاف و واقعی** – امتیازها **فقط بر اساس داده‌های واقعاً جمع‌آوری‌شده** محاسبه می‌شوند. اگر API پولی وصل نباشد، فاکتورهای مربوطه به‌عنوان *نامشخص* علامت می‌خورند و به‌درستی جریمه نمی‌شوند.
- 🔌 **اتصال اختیاری به APIهای پولی** – می‌توانی Ahrefs، Semrush، Moz، Majestic یا مشابه را وصل کنی. وقتی متصل باشند، داده‌ها آدیت را غنی‌تر می‌کنند؛ وقتی وصل نباشند، آدیت همچنان با داده‌های رایگان کامل کار می‌کند.
- 📄 **گزارش آماده آفلاین** – کل آدیت را می‌توان به‌صورت **یک فایل HTML یا PDF مستقل** دانلود کرد که بدون اینترنت هم باز و قابل اشتراک‌گذاری است.
- 🔐 **حساب کاربری و تاریخچه** – کاربران احراز هویت‌شده می‌توانند آدیت‌ها را ذخیره کنند، گزارش‌های قبلی را ببینند و کلیدهای API هر پروژه را مدیریت کنند.
- ⚙️ **تنظیمات و مدیریت ارائه‌دهنده‌ها** – یک صفحه تنظیمات اختصاصی برای ذخیره امن کلیدهای API و انتخاب ارائه‌دهنده‌های فعال.
- 🌙 **رابط کاربری مدرن** – ساخته‌شده با Radix UI، Tailwind CSS و یک سیستم طراحی منسجم (پالت دستور CMDK، جدول‌های ریسپانسیو، آماده دارک‌مود).

> **دمو آنلاین:** [https://seoscan-seven.vercel.app/](https://seoscan-seven.vercel.app/)  
> دمو جریان اصلی آدیت را بدون نیاز به ثبت‌نام نشان می‌دهد.

---

## 🛠 استک فنی

| لایه | تکنولوژی |
|-------|------------|
| **فریمورک** | [Next.js](https://nextjs.org/) (App Router) + [TanStack Router](https://tanstack.com/router) |
| **زبان** | [TypeScript](https://www.typescriptlang.org/) |
| **استایل‌دهی** | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| **State / دیتا** | [TanStack Query](https://tanstack.com/query) + [TanStack Table](https://tanstack.com/table) |
| **دیتابیس** | [PostgreSQL](https://www.postgresql.org/) با [Drizzle ORM](https://orm.drizzle.team/) (به‌همراه [PGlite](https://pglite.dev/) برای حالت امبدد/لوکال) |
| **احراز هویت** | [Better Auth](https://better-auth.com/) |
| **اعتبارسنجی** | [Zod](https://zod.dev/) |
| **فرم‌ها** | [React Hook Form](https://react-hook-form.com/) |
| **کرال سئو** | [Cheerio](https://cheerio.js.org/) + موتور پارس HTML سفارشی |
| **نمودار** | [D3.js](https://d3js.org/) (via `d3-scale`, `d3-shape`, …) |
| **ابزارهای CLI** | [CMDK](https://cmdk.paco.me/)، [date-fns](https://date-fns.org/)، [clsx](https://github.com/lukeed/clsx) |
| **تست** | [Vitest](https://vitest.dev/) |
| **لینت / فرمت** | [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) |
| **دیپلوی** | [Vercel](https://vercel.com/) |

---

## 🏗 نمای کلی معماری

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

- **موتور آدیت** – URL هدف را واکشی، DOM را با Cheerio پارس و مجموعه‌ای از قوانین بررسی را اجرا می‌کند.
- **کانکتورهای ارائه‌دهنده** – ماژول‌های جداگانه برای هر API سئوی پولی. **اختیاری** هستند و در نبود اعتبارنامه به‌درستی تخریب می‌شوند.
- **سریالایزر گزارش** – نتیجه آدیت را به یک سند HTML مستقل با CSS و تصاویر اینلاین تبدیل می‌کند تا قابل ذخیره و اشتراک‌گذاری آفلاین باشد.
- **احراز هویت و پایداری** – سشن‌ها، آدیت‌های ذخیره‌شده و کلیدهای رمزنگاری‌شده ارائه‌دهنده در PostgreSQL ذخیره می‌شوند.

---

## 🚀 شروع به کار

### پیش‌نیازها

- **Node.js** `≥ 20` (یا `bun` / `pnpm`)
- **PostgreSQL** `≥ 14` (یا از **PGlite** برای دیتابیس امبدد بدون تنظیمات استفاده کن)
- یک مرورگر مدرن (Chrome, Firefox, Safari, Edge)

### نصب

```bash
# 1. کلون کردن ریپازیتوری
git clone https://github.com/iamirama/amiro_seo_app.git
cd amiro_seo_app

# 2. نصب وابستگی‌ها
npm install
# یا
pnpm install
# یا
bun install
```

### متغیرهای محیطی

یک فایل `.env.local` در ریشه پروژه بساز و مقادیر زیر را پر کن:

```env
# ── دیتابیس ──────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@localhost:5432/amiro_seo"

# ── احراز هویت (Better Auth) ─────────────────────────────
BETTER_AUTH_SECRET="یک-رمز-۳۲-کاراکتری"
BETTER_AUTH_URL="http://localhost:3000"

# ── اختیاری: ارائه‌دهنده هوش مصنوعی ──────────────────────
OPENAI_API_KEY="sk-..."
# AI_MODEL="gpt-4o-mini"

# ── اختیاری: APIهای سئوی پولی ────────────────────────────
# AHREFS_API_KEY=""
# SEMRUSH_API_KEY=""
# MOZ_ACCESS_ID=""
# MOZ_SECRET_KEY=""
```

> **نکته:** همه‌ی کلیدهای API پولی **اختیاری** هستند. اپ بدون آن‌ها هم اجرا می‌شود و آدیت معنادار تولید می‌کند؛ فقط آن نقاط داده به‌عنوان «در دسترس نیست» علامت می‌خورند.

### راه‌اندازی دیتابیس

```bash
# تولید فایل‌های مایگریشن (در صورت تغییر اسکیما)
npm run db:generate

# اعمال مایگریشن‌ها روی دیتابیس
npm run db:migrate

# یا پوش کردن مستقیم اسکیما (فقط توسعه)
npm run db:push
```

اگر می‌خواهی از **PGlite** استفاده کنی (بدون نیاز به دیتابیس خارجی)، مقدار `DATABASE_URL="pglite://./.pglite"` را ست کن تا از موتور Postgres امبدد استفاده شود.

### اجرای لوکال

```bash
npm run dev
```

سپس در مرورگر به [http://localhost:3000](http://localhost:3000) برو.  
برای اجرای بیلد پروداکشن به‌صورت لوکال:

```bash
npm run build
npm run start
```

---

## 📜 اسکریپت‌های موجود

| اسکریپت | توضیح |
|--------|-------------|
| `npm run dev` | اجرای سرور توسعه (hot-reload) |
| `npm run build` | ساخت بیلد پروداکشن بهینه‌شده |
| `npm run start` | اجرای سرور پروداکشن |
| `npm run lint` | اجرای ESLint روی کل کد |
| `npm run format` | فرمت کردن همه فایل‌ها با Prettier |
| `npm run test` | اجرای تست‌های واحد با Vitest |
| `npm run db:generate` | تولید فایل‌های مایگریشن Drizzle از اسکیما |
| `npm run db:migrate` | اعمال مایگریشن‌های معلق روی دیتابیس |
| `npm run db:push` | پوش مستقیم اسکیما (فقط توسعه) |
| `npm run db:studio` | باز کردن Drizzle Studio (GUI دیتابیس) |

---

## 📁 ساختار پروژه

```
amiro_seo_app/
├── migrations/               # مایگریشن‌های SQL (Drizzle)
│   ├── 0002_seo.sql
│   └── auth/
│       └── 0001_auth.sql
├── public/                   # فایل‌های استاتیک
├── screenshots/              # اسکرین‌شات‌ها برای README و دمو
├── scripts/                  # اسکریپت‌های کاربردی (seed و…)
├── server/                   # نقاط ورودی سمت سرور (در صورت وجود)
├── src/
│   ├── app/                  # صفحات App Router در Next.js
│   ├── components/           # کامپوننت‌های UI قابل استفاده مجدد (Radix + Tailwind)
│   ├── db/                   # اسکیما، کلاینت و آداپترهای Drizzle
│   ├── features/             # ماژول‌های فیچر (audit, auth, settings)
│   ├── lib/                  # ابزارها، هوک‌ها و هلپرهای مشترک
│   ├── providers/            # Context Providerها (Query, Auth, Theme)
│   └── styles/               # CSS سراسری / لایه‌های Tailwind
├── .env.example              # نمونه متغیرهای محیطی
├── eslint.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

---

## ☁️ دیپلوی

### Vercel (پیشنهادی)

پروژه برای **Vercel** آماده است. تنظیمات پیش‌فرض Next.js روی آن کار می‌کند.

1. کدت را روی GitHub پوش کن.
2. ریپازیتوری را در [Vercel](https://vercel.com/new) ایمپورت کن.
3. **متغیرهای محیطی** بالا را در داشبورد Vercel اضافه کن.
4. دیپلوی کن 🎉

> **نمونه زنده:** [https://seoscan-seven.vercel.app/](https://seoscan-seven.vercel.app/)

### پلتفرم‌های دیگر

چون اپ از Next.js استاندارد و PostgreSQL استفاده می‌کند، روی هر پلتفرمی که Node.js و دیتابیس Postgres را پشتیبانی کند (Railway, Fly.io, Render, AWS و…) هم قابل دیپلوی است. فقط مطمئن شو که `DATABASE_URL` و `BETTER_AUTH_URL` برای محیط هدف به‌درستی تنظیم شده باشند.

---

## 🤝 مشارکت

از مشارکت شما استقبال می‌کنیم! لطفاً این مراحل را دنبال کن:

1. ریپو را **Fork** کن.
2. یک برنچ فیچر بساز: `git checkout -b feat/amazing-feature`
3. تغییرات را کامیت کن: `git commit -m 'feat: add amazing feature'`
4. برنچ را پوش کن: `git push origin feat/amazing-feature`
5. یک **Pull Request** باز کن.

قبل از ارسال PR لطفاً `npm run lint` و `npm run test` را اجرا کن.  
برای تغییرات بزرگ، ابتدا یک issue باز کن تا درباره ایده‌ات صحبت کنیم.

---

## 📄 لایسنس

تحت لایسنس **MIT** منتشر شده است. برای اطلاعات بیشتر فایل [`LICENSE`](https://github.com/iamirama/amiro_seo_app/blob/main/LICENSE) را ببین.

---

<p align="center">
  ساخته‌شده با ❤️ توسط <a href="https://github.com/iamirama">ایمان آراما</a><br>
  <sub>اگر این پروژه به کارت آمد، یک ⭐️ روی GitHub فراموش نشود!</sub>
</p>
