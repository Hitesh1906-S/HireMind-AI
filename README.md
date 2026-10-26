# HireMind AI 🚀
### Production-Grade AI Technical Interview & Intelligent Recruitment Platform

**HireMind AI** is an enterprise-grade AI technical recruitment platform that bridges candidate evaluation, transparent candidate ranking, and recruiter intelligence. Built with Next.js 14, Node.js/Express, PostgreSQL, Prisma, Google Gemini 1.5 Flash/Pro, Monaco Code Editor, WebRTC, and PDFKit.

---

## 🌟 Key Capabilities

- **Multimodal AI Technical Interview**: Real-time conversational interview chamber with voice-to-text, adaptive follow-ups, and transcript synthesis.
- **In-Browser Monaco Code Assessment**: Interactive coding editor supporting multiple languages, test suite execution, time & space complexity analysis.
- **Continuous Integrity & Proctoring Timeline**: Detects tab switches, absence, multiple faces, and camera/mic toggling as context for human recruiters.
- **Deterministic Candidate Ranking Engine**: Recruiter-configurable transparent formula weighting Resume Fit, Coding, Technical, Communication, and Alignment scores without arithmetic LLM hallucinations.
- **Side-by-Side Candidate Comparison**: Comprehensive matrix comparing skills, scores, test executions, and integrity flags.
- **Automated PDF Candidate Reports**: Downloadable, publication-ready multi-page dossiers with score breakdowns, AI evaluations, objective metrics, and recruiter notes.
- **Transactional Notification & Email Subsystem**: Multi-provider email engine (Console, SMTP, SendGrid, Resend) and real-time in-app notification center.
- **Production Hardened**: Strict rate limiting, masked audit logging, Helmet security headers, SQL injection protection, XSS prevention, and non-root Docker builds.

---

## 🏛️ Monorepo Architecture

```
hiremind-ai/
├── client/                     # Next.js 14 (App Router, Tailwind CSS, TanStack Query, Monaco)
│   ├── src/
│   │   ├── app/                # Pages: Landing, Dashboard, Candidate Portal, Recruiter Views
│   │   ├── components/         # Voice Studio, Code Editor, Proctoring, Comparison, Reports
│   │   ├── context/            # AuthContext, NotificationContext
│   │   ├── hooks/              # Custom React Hooks
│   │   └── lib/                # Typed REST client with automatic token rotation
├── server/                     # Node.js + Express 4 + Prisma ORM + TypeScript
│   ├── prisma/
│   │   ├── schema.prisma       # Relational PostgreSQL Schema (17 models, complete indexing)
│   │   └── seed.ts             # Deterministic seed data (Users, Jobs, Tests, Resumes)
│   ├── src/
│   │   ├── config/             # Zod environment validation & Prisma singleton
│   │   ├── controllers/        # Handlers: Auth, Jobs, Resumes, Interviews, Analytics, Reports
│   │   ├── middlewares/        # JWT Auth, Role RBAC, Rate Limiting, Error Handling
│   │   ├── routes/             # Versioned REST API Routes (/api/v1)
│   │   ├── services/           # AI Matcher, Ranking, Proctoring, Reports, Email Engine
│   │   └── utils/              # Redacted Logger, PDF Generator, ApiError/ApiResponse
├── docs/                       # Technical Specifications
│   ├── ARCHITECTURE.md         # Subsystem architecture & data flow diagrams
│   └── API.md                  # Comprehensive REST endpoint specification
├── Dockerfile.server           # Multi-stage Alpine container for Express backend
├── Dockerfile.client           # Multi-stage Alpine container for Next.js standalone frontend
├── docker-compose.yml          # Container orchestration (Postgres, Server, Client)
├── .env.example                # Development environment template
└── .env.production.example     # Production environment template
```

---

## 🔐 Security & Hardening Checklist

| Security Dimension | Implementation |
| :--- | :--- |
| **Authentication** | Dual-token JWT (15m access, 7d refresh) with database token rotation and family invalidation. |
| **Authorization (RBAC)** | Strict role enforcement (`CANDIDATE`, `RECRUITER`, `ADMIN`) on backend middleware and frontend routes. |
| **API Validation** | 100% of incoming payloads validated with Zod schemas via `validateRequest` middleware. |
| **Database Protection** | Parameterized queries via Prisma ORM preventing SQL injection; indexed foreign keys. |
| **Rate Limiting** | `express-rate-limit` guards: 15 req/15min on auth endpoints; 500 req/15min on API v1. |
| **Security Headers** | Helmet with HSTS (1 year), frameguard deny, noSniff, xssFilter, same-origin opener policy. |
| **Logging & Audit** | Centralized logger with automatic redaction of tokens, passwords, cookies, and API keys. |
| **File Uploads** | Multer restricted to `application/pdf`, 5MB limit, UUID filenames in secure non-public storage. |
| **Container Security** | Multi-stage Docker builds running as non-root users (`hiremind:1001` and `nextjs:1001`). |

---

## 🛠️ Quick Start

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v15 or higher (or Docker)

### 2. Installation
```bash
git clone https://github.com/softdev-kartik-singhal/HireMind-AI.git
cd HireMind-AI
npm install
```

### 3. Environment Setup
Copy the environment template:
```bash
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

### 4. Database Setup & Seeding
```bash
# Generate Prisma Client
npm run db:generate

# Push schema to PostgreSQL database
npm run db:push

# Seed database with realistic jobs, candidates, tests, and interviews
npm run db:seed
```

### 5. Start Development Servers
```bash
npm run dev
```
- **Web App**: `http://localhost:3000`
- **Backend API**: `http://localhost:5001/api/v1`
- **Health Check**: `http://localhost:5001/health`

---

## 🐳 Docker Deployment

To launch the complete platform with PostgreSQL using Docker Compose:

```bash
# 1. Provide production environment keys
cp .env.production.example .env.production

# 2. Build and launch containers
docker compose --env-file .env.production up -d --build

# 3. Check container logs
docker compose logs -f
```

---

## 🧪 Testing & Verification

Run the full verification suite before committing:

```bash
# TypeScript compilation check across all workspaces
npm run type-check

# ESLint audit
npm run lint

# Production bundle builds
npm run build
```

---

## 📄 License
HireMind AI is distributed under the MIT License.
