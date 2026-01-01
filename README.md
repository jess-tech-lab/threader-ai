# Threader AI

> **AI-Powered Product Feedback Intelligence**
>
> Transform scattered user feedback into strategic product decisions.
---

## The Problem

**Product teams are drowning in feedback but starving for insights.**

Every day, thousands of users share their experiences on Reddit, Twitter, support tickets, and app reviews. Product managers spend hours manually reading these posts, trying to identify patterns and prioritize what matters.

The result? **The "Noise-to-Signal" gap:**
- 80% of feedback is noise (duplicates, venting, off-topic)
- 20% contains actionable insights buried in unstructured text
- Critical issues get missed while teams chase vanity metrics
- Roadmaps are built on gut feeling, not user evidence

---

## The Solution

Threader AI is an **autonomous feedback intelligence agent** that:

1. **Hunts** for product mentions across Reddit and social platforms
2. **Analyzes** each piece of feedback through a Senior PM lens
3. **Synthesizes** strategic insights with Impact Scores and OKR recommendations
4. **Visualizes** everything in a beautiful, executive-ready dashboard

---

## Key Innovation

### "What They Say vs. What They Mean"

Threader AI doesn't just summarize feedback—it performs **root cause analysis** to understand the underlying user need:

| What They Say | What They Mean | Root Cause |
|---------------|----------------|------------|
| "The app is slow" | "I waste time waiting" | **Speed** |
| "Too many clicks to do X" | "This should be simpler" | **Ease** |
| "I don't trust the sync" | "I've lost data before" | **Trust** |
| "Why can't I customize Y?" | "The default doesn't fit my workflow" | **Control** |

### Impact vs. Effort Matrix

Every piece of feedback is scored on a 1-10 scale for:
- **Impact**: How many users does this affect? How severe is the pain?
- **Urgency**: Is this a growing trend or a stable complaint?
- **Effort**: Engineering estimate (Small/Medium/Large)

The result is a prioritized backlog that answers: **"What should we build next?"**

### Impact Score Formula

```
Impact = (Reach × 0.4) + (Sentiment × 0.3) + (Velocity × 0.3)
```

Where:
- **Reach** = Upvotes + Comments (normalized)
- **Sentiment** = Classification confidence/intensity
- **Velocity** = Engagement per hour (trend momentum)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Data Collection** | Node.js + Reddit API | Cost-effective scraping (free tier) |
| **AI Analysis** | LangChain + GPT-4o | Structured output classification |
| **Schema Validation** | Zod | Type-safe LLM responses |
| **Database** | Supabase (Postgres) | Multi-tenant storage with RLS |
| **Frontend** | React 19 + Vite | Modern dashboard UI |
| **Styling** | Tailwind CSS v4 | Apple-inspired "Liquid Glass" design |
| **PDF Export** | jsPDF | Strategic reports and one-pagers |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Threader AI Pipeline                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: SMART SCRAPER                                          │
│  ───────────────────────────────────────────────────────────────│
│  • LLM discovers relevant subreddits for the company            │
│  • Fetches recent posts (24-hour window)                        │
│  • Filters for relevance using embeddings                       │
│  • Normalizes data into standard feedback format                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: CLASSIFIER (Senior PM Perspective)                     │
│  ───────────────────────────────────────────────────────────────│
│  • Categorizes: Feature Request, Usability Friction, Bug, Praise│
│  • Root Cause Analysis: Speed, Ease, Control, Trust, Cost       │
│  • Impact Assessment: Revenue, Retention, Brand Trust           │
│  • Generates actionable insights and reply drafts               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: STRATEGIC SYNTHESIZER                                  │
│  ───────────────────────────────────────────────────────────────│
│  • Clusters feedback into Focus Areas                           │
│  • Calculates Impact Scores (0-10)                              │
│  • Identifies trends (Rising, Stable, Declining, New)           │
│  • Generates OKRs with measurable Key Results                   │
│  • Creates Priority Matrix (Impact vs. Effort)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: STORAGE & VISUALIZATION                                │
│  ───────────────────────────────────────────────────────────────│
│  • Saves to Supabase with tenant isolation (RLS)                │
│  • Creates point-in-time snapshots for trend comparison         │
│  • Renders executive dashboard with PDF export                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key
- Supabase project (optional, for persistence)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/threader-ai.git
cd threader-ai

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env` with your credentials:

```env
# Required
OPENAI_API_KEY=sk-...

# Optional (for database persistence)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Run the Scout

```bash
# Analyze a company's feedback
npm run scout "Notion"
```

### Start the Dashboard

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the dashboard.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `npm run scout "Company"` | Run full pipeline for a company |
| `npm run scrape:reddit` | Scrape Reddit only |
| `npm run analyze` | Run classifier on stored feedback |
| `npm run synthesize` | Generate strategic synthesis |
| `npm run pipeline` | Run legacy pipeline (deprecated) |

---

## Security

### Row-Level Security (RLS)

Threader AI is built for multi-tenant SaaS deployments. Every database table is protected by Supabase Row-Level Security:

```sql
-- Users can only see their own tenant's data
CREATE POLICY "tenant_isolation" ON feedback_items
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
```

This means:
- **Company A** cannot see **Company B's** feedback
- Even with database access, queries are scoped to the authenticated tenant
- Service role key bypasses RLS (used only in trusted backend jobs)

### API Keys

| Key | Access Level | Use Case |
|-----|--------------|----------|
| `SUPABASE_ANON_KEY` | Public, respects RLS | Frontend queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin, bypasses RLS | Backend jobs only |

**Never expose the service role key to the frontend.**

---

## Dashboard Features

### Executive Overview
- Brand-centric headline: "[Company]: Growth Opportunities"
- Key metrics grid (Total Analyzed, High Signal, Focus Areas, Brand Score)
- Sentiment distribution bar
- Collapsible narrative summary

### Focus Areas
- Impact-scored cards with trend badges (Rising, Stable, New)
- Risk stakes highlighting ("Ignoring this risks...")
- User segment tags (Power Users, Mobile, Enterprise)
- "Ask Threader" AI chat integration

### What Users Love
- Star-rated testimonials with shareability scores
- Brand personality traits
- Top features that resonate

### Expectation Gaps
- Users Expect vs. Reality comparison
- Severity badges (High, Medium, Low)
- Suggested fixes

### Next Moves (OKRs)
- AI-generated quarterly objectives
- Measurable key results
- Theme-based grouping

### PDF Export
- **Full Strategic Report**: 5-page detailed analysis
- **Executive One-Pager**: TL;DR for stakeholders

---

## Project Structure

```
threader-ai/
├── src/                          # Backend (Node.js)
│   ├── scrapers/
│   │   ├── redditScraper.js      # Reddit API integration
│   ├── analysis/
│   │   ├── classifier.js         # Feedback classification
│   │   ├── synthesizer.js        # Strategic synthesis
│   │   └── subredditDiscovery.js # LLM-powered subreddit finder
│   │   └── comparer.js           # Trend comparison
│   ├── db/
│   │   └── supabase.js           # Database operations
│   ├── scout.js                  # CLI entry point
│   └── pipeline.js               # Legacy pipeline
│
├── frontend/                     # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardV2.tsx   # Main dashboard
│   │   │   └── dashboard/        # Dashboard components
│   │   ├── lib/
│   │   │   └── reportGenerator.ts # PDF export
│   │   └── types/                # TypeScript definitions
│   └── package.json
│
├── .env.example                  # Environment template
├── package.json                  # Backend dependencies
└── README.md                     # This file
```

---

- [LangChain](https://langchain.com) for the AI orchestration framework
- [Supabase](https://supabase.com) for the backend-as-a-service
- [Tailwind CSS](https://tailwindcss.com) for the styling system
- [Framer Motion](https://www.framer.com/motion/) for animations

---
