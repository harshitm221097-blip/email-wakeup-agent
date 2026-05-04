# Email Wakeup Agent

An autonomous email agent that initiates and sustains conversations with prospects, negotiates within a configured budget, and books calls. Powered by an OpenAI-compatible LLM API.

## Architecture

```
                    ┌──────────────────────┐
                    │    Resend Webhook    │
                    │  (Inbound Email)     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   /api/email/webhook │
                    │   Parse + Route      │
                    └──────────┬───────────┘
                               │
                               ▼
┌─────────────┐     ┌──────────────────────┐     ┌──────────────┐
│   Dashboard │◄───►│     Agent Core       │◄───►│  PostgreSQL   │
│  (Next.js)  │     │                      │     │  (Prisma)    │
│  shadcn/ui  │     │  ┌────────────────┐  │     │              │
│             │     │  │  Perception    │  │     │ - prospects  │
│  /dashboard │     │  │  (LLM)         │  │     │ - messages   │
│  /convos    │     │  └───────┬────────┘  │     │ - agentState │
│  /calendar  │     │          │           │     │ - calls      │
│  /settings  │     │  ┌───────▼────────┐  │     │ - config     │
│  /analytics │     │  │  Reasoning     │  │     └──────────────┘
└─────────────┘     │  │  (Tool-Use)    │  │
                    │  └───────┬────────┘  │
                    │          │           │
                    │  ┌───────▼────────┐  │     ┌──────────────┐
                    │  │  Action        │──┼────►│ Resend API   │
                    │  │  Send/Negotiate│  │     │ (Outbound)   │
                    │  │  Book/Walk Away│  │     └──────────────┘
                    │  └────────────────┘  │
                    └──────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Google Calendar API │
                    │  (OAuth + Events)    │
                    └──────────────────────┘
```

## Agent Design: Perception → Reasoning → Action

### Perception
Inbound emails are classified by the LLM into intents:
- **Interested** — prospect wants to learn more or schedule
- **Curious** — prospect has questions, not yet committed
- **Objecting** — prospect pushes back on terms/rate
- **Declining** — prospect says no
- **Rescheduling** — prospect cancels an existing booking
- **Silent** — no response (follow-up trigger)

Extracted signals: rate quotes, scheduling preferences, objection types.

### Reasoning
The LLM selects an action via structured output (JSON mapped to `AgentDecision`):
- `SEND_REPLY` — natural email response
- `NEGOTIATE` — counter-offer within budget ceiling
- `PROPOSE_SLOTS` — offer calendar availability
- `BOOK_CALL` — confirm time, create calendar event
- `WALK_AWAY` — polite decline when no fit
- `WAIT` — no action needed

### Memory
Full conversation history is persisted in PostgreSQL. The agent state (JSON) tracks:
- Negotiation position: current offer, budget discussed, max revealed
- Scheduling state: slots proposed, call booked, reschedule count
- Prospect signals: interest level, objections, rates mentioned

Every agent turn loads the full thread — no context loss across N-message threads.

### Reschedule Loop (Critical)
1. Prospect agrees → agent books → Google Calendar event created
2. Prospect cancels → perception detects `RESCHEDULING` intent
3. Agent loads full memory (negotiation position, budget agreed, prior context)
4. Responds gracefully, proposes new slots
5. Works **N times** — no context loss, no personality drift

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| UI | shadcn/ui + Tailwind CSS (ElevenLabs dark theme) |
| Database | PostgreSQL + Prisma 7 ORM |
| Email | Resend (API + webhooks) |
| AI/LLM | OpenAI-compatible API (qcall.ai) |
| Calendar | Google Calendar API (OAuth 2.0) |

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally
- LLM API key (OpenAI-compatible endpoint)
- Resend API key (free tier works)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up PostgreSQL

Create a database:
```bash
createdb email_wakeup_agent
```

Or use an existing PostgreSQL instance and update `DATABASE_URL` in `.env`.

### 3. Configure environment

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/email_wakeup_agent"

# Custom LLM (OpenAI-compatible endpoint)
LLM_BASE_URL="https://llm.qcall.ai/v1/chat/completions"
LLM_MODEL="qcall/slm-3b-int4"
LLM_API_KEY="your-llm-api-key"

# Resend (Email)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="agent@yourdomain.com"
RESEND_WEBHOOK_SECRET="whsec_..."

# Google Calendar (optional)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/callback"

# Agent Config
AGENT_GIG_DESCRIPTION="Describe your gig opportunity here"
AGENT_BUDGET_CEILING="150"
AGENT_TONE="professional yet friendly"
AGENT_CALENDAR_TIMEZONE="America/New_York"
AGENT_AVAILABLE_HOURS_START="9"
AGENT_AVAILABLE_HOURS_END="17"
```

#### Getting API Keys

- **LLM API**: Sign up at [qcall.ai](https://qcall.ai) or use any OpenAI-compatible endpoint
- **Resend**: Sign up at [resend.com](https://resend.com), create an API key, and verify your sending domain
- **Google Calendar**:
  1. Go to [Google Cloud Console](https://console.cloud.google.com)
  2. Create a project and enable the Google Calendar API
  3. Create OAuth 2.0 credentials (web application)
  4. Add `http://localhost:3000/api/calendar/callback` as an authorized redirect URI
  5. Copy the Client ID and Client Secret

### 4. Run database migrations

```bash
npx prisma db push
npm run db:seed
```

### 5. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Configure Resend webhook

In your Resend dashboard, set the inbound webhook URL to:
```
https://your-domain.com/api/email/webhook
```

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (dark theme)
│   ├── page.tsx                  # Dashboard
│   ├── conversations/            # List + thread view
│   ├── settings/                 # Agent config
│   ├── calendar/                 # Scheduled calls
│   ├── analytics/                # Metrics
│   └── api/
│       ├── agent/process/        # Trigger agent loop
│       ├── email/webhook/        # Resend inbound
│       ├── calendar/             # Google OAuth + slots
│       ├── conversations/        # List + detail
│       ├── prospects/            # CRUD + outreach
│       ├── config/               # Agent configuration
│       ├── stats/                # Dashboard stats
│       ├── analytics/            # Analytics metrics
│       └── calls/                # Scheduled calls
├── agent/
│   ├── core.ts                   # Main agent loop (processInboundEmail, initiateOutreach)
│   ├── memory.ts                 # Conversation memory manager (loadMemory, saveAgentState, addMessage)
│   ├── types.ts                  # TypeScript types (AgentDecision, ConversationMemory, etc.)
│   └── prompts/
│       ├── system.ts             # System prompt builder
│       ├── perception.ts         # Intent classification prompt
│       ├── negotiation.ts        # Budget negotiation prompt
│       ├── scheduling.ts         # Slot proposal prompt
│       └── reschedule.ts         # Reschedule handling prompt
├── components/
│   ├── ui/                       # shadcn/ui primitives (18 components)
│   ├── layout/                   # Sidebar, app shell
│   ├── dashboard/                # Stats cards, recent activity
│   ├── conversations/            # Thread view, message bubbles
│   ├── settings/                 # Config forms
│   ├── calendar/                 # Call cards, slot picker
│   └── analytics/                # Metrics, pipeline funnel
└── lib/
    ├── db.ts                     # Prisma client singleton
    ├── resend.ts                 # Resend client (lazy init)
    ├── claude.ts                 # LLM API client (OpenAI-compatible)
    └── google-calendar.ts        # Google Calendar OAuth + event helpers
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prospects` | List all prospects |
| POST | `/api/prospects` | Create a prospect |
| POST | `/api/prospects/[id]/outreach` | Send first outreach email |
| POST | `/api/agent/process` | Process inbound email through agent |
| POST | `/api/email/webhook` | Resend inbound webhook handler |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/[id]` | Get conversation with messages |
| GET | `/api/calendar/slots` | Get available time slots |
| GET | `/api/calendar/connect` | Start Google OAuth flow |
| GET | `/api/calendar/callback` | Google OAuth callback |
| GET | `/api/config` | Get agent configuration |
| POST | `/api/config` | Update agent configuration |
| GET | `/api/stats` | Dashboard stats |
| GET | `/api/analytics` | Analytics metrics |
| GET | `/api/calls` | List scheduled calls |

## Design Decisions & Trade-offs

### Why Prisma with JSON agent state?
The agent state (negotiation position, scheduling signals, prospect intent) changes shape as the conversation evolves. Using a JSON column avoids schema migrations for every state change while keeping the conversation metadata queryable. The trade-off is less type safety at the DB level — we compensate with strict TypeScript types in the agent layer.

### Why Resend over Gmail API?
Resend provides a clean webhook-based inbound flow with no IMAP polling. Setup is simpler (API key vs OAuth), and the free tier covers development. The trade-off is domain verification requirements for production use.

### Why OpenAI-compatible LLM over Claude?
The agent uses any OpenAI-compatible LLM endpoint, allowing flexibility in model choice. The `callLLM` abstraction in `lib/claude.ts` works with any provider that supports the `/v1/chat/completions` format.

### Why Google Calendar integration?
When a call is booked, the agent automatically creates a Google Calendar event with the prospect as an attendee. This provides real calendar sync with email reminders. If Google Calendar is not connected, the call is still booked in the database — the integration is graceful.

## Sample Thread Transcripts

### 1. Successful Negotiation + Booking
```
Agent → Prospect: "Hi John, I came across your profile and thought you'd be a great fit..."
Prospect → Agent: "Thanks for reaching out! What's the compensation range?"
Agent → Prospect: "The role budgets up to $150/hr depending on experience..."
Prospect → Agent: "I usually charge $160, but I'm interested. Could we do $145?"
Agent → Prospect: "$145 works perfectly. Want to hop on a call to discuss details? I have slots..."
Prospect → Agent: "Tuesday 2pm works."
Agent → Prospect: "Booked! Tuesday at 2pm ET. Looking forward to it."
→ Call scheduled, Google Calendar event created
```

### 2. Cancellation + Re-booking
```
[After initial booking at Tuesday 2pm]
Prospect → Agent: "Sorry, something came up and I can't make Tuesday anymore."
Agent → Prospect: "No problem at all! Let's find another time that works..."
Prospect → Agent: "How about Thursday morning?"
Agent → Prospect: "Thursday at 10am ET is open. Shall I lock that in?"
Prospect → Agent: "Perfect, Thursday 10am."
Agent → Prospect: "Rescheduled! Thursday at 10am ET. Talk then."
→ Reschedule count: 1, calendar event updated, full context preserved
```

### 3. Graceful Walk-away
```
Agent → Prospect: "Hi Emily, we're looking for a skilled developer..."
Prospect → Agent: "Thanks but I'm not available right now."
Agent → Prospect: "Completely understand. If things change, feel free to reach out. Wishing you all the best!"
→ Prospect marked WALKED_AWAY, conversation COMPLETED
```

## Scripts

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run db:push      # Push schema to database
npm run db:seed      # Seed default config + sample data
npm run db:studio    # Open Prisma Studio
npm run db:generate  # Regenerate Prisma client
npm run lint         # Run ESLint
```
