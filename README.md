# OpportunityKit — The Readiness Runway

> **Tagline:** Know where you stand. Know what to fix. Know if you can make the deadline.  
> **Team:** Team Solitude · SETU 2026 · Forge Realm · PS-03  
> **Repository:** Pure Full-Stack Application (HTML5 / CSS3 / Vanilla ES6 + Node.js + SQLite)

---

## What It Is

**OpportunityKit** is a student-centric full-stack web application that translates unstructured internship, scholarship, job, and competition listings into an actionable, editable requirement checklist. It compares that checklist against a student's profile to deliver:

1. **Explainable Statuses:** `MATCH`, `WORK NEEDED`, `MISSING INFO`, and `MISMATCH (LOCKED)`.
2. **Readiness Range:** Confirmed floor score (e.g. `50%`), possible ceiling (`83%`), and deadline-aware achievable score.
3. **Actionable Fix-Effort Ladder:** Tasks grouped by time investment (`Quick`, `Days`, `Weeks`, `Locked`).
4. **Deadline Runway:** Parallel-safe time projection comparing days needed vs. days remaining.
5. **Live What-If Recalculation:** Changing any profile field, skill, link, or availability immediately recalculates scores without page reload.
6. **In-Memory Resume Suggestions:** PDF and DOCX parsing with zero disk retention, providing suggestions for user review without silent overwrites.
7. **Persistent Reusable Profile:** Node.js + SQLite backend stores the student profile across sessions with complete user deletion controls.

---

## Prerequisites & Zero-Dependency Guarantee

- **Node.js:** Version `v22.0.0` or higher (tested and verified on Node `v24.15.0`).
- **Dependencies:** **Zero external network dependencies required.** OpportunityKit is engineered using Node's standard libraries (`node:http`, `node:sqlite`, `node:zlib`, `node:fs`), so it runs immediately on air-gapped or fresh environments without requiring native C++ build tools (`node-gyp` / Visual Studio build tools) or third-party npm downloads.

---

## Quickstart & Verification Commands

### 1. Install Dependencies
```bash
npm install
```
*(Runs in <1s because core capabilities use Node built-ins; also supports optional packages if installed).*

### 2. Run All Automated Tests
```bash
npm test
```
Executes the comprehensive 30-test suite across logic, fixtures, acceptance criteria, edge cases, API CRUD, SQL injection safety, and in-memory resume parsing.

### 3. Start the Application Server
```bash
npm start
```
Starts the full-stack server at **`http://localhost:3000`** (or your custom `PORT`). Open `http://localhost:3000` in any modern web browser.

---

## Environment Variables

All settings have secure, working defaults:

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | Port for the HTTP API and frontend server |
| `DB_PATH` | `./opportunitykit.db` | File path for persistent SQLite database |
| `MAX_UPLOAD_MB` | `5` | Maximum upload size for in-memory resume parsing (MB) |

---

## How to Verify With Your OWN Opportunity & Resume

OpportunityKit is built from the ground up to analyze **real user-provided opportunities**, not just the demo sample.

### Step-by-Step Custom Verification:

1. **Step 1 — Provide Opportunity Info (Paste Text OR Upload PDF/DOCX):**
   - **Option A (Upload PDF / Document):** Click **Upload PDF / Document (.pdf, .docx)** in Step 1 to select an internship brochure, job description PDF, or hackathon flyer. Text is extracted in-memory and automatically populates the text area and initiates analysis.
   - **Option B (Paste Text):** In the text area, paste any opportunity description (e.g. from LinkedIn, Internshala, Devpost, or a university portal).
   - *Example:*
     > *"Backend Intern: Applicants must be in 3rd or 4th year of B.Tech CSE, minimum CGPA 7.5. Must know Python and SQL. Submit your resume and GitHub profile. Deadline: 25 November 2026."*
   - Notice that if you previously viewed the sample demo, loading custom text or uploading a PDF **automatically clears the demo banner**.
2. **Step 2 — Automatic or Manual Analysis:**
   - The deterministic parser splits the text, extracts requirements into the canonical schema, detects the deadline (`2026-11-25`), and highlights verbatim source evidence excerpts.
3. **Step 3 — Review the Extracted Checklist:**
   - Inspect the detected rows (`Year`, `CGPA`, `Skills`, `Resume`, `GitHub`).
   - Click **+ Add Requirement** to manually add any custom criteria (e.g. state residency or specific coursework).
   - Delete any rule you do not wish to track.
4. **Step 4 — Enter Your Profile or Upload Your Resume:**
   - Either fill in the profile fields manually, or click **Choose File (.pdf / .docx)** to upload your resume.
   - The in-memory parser extracts your skills, education, and URLs into a **Review Modal**. Uncheck any field you do not wish to adopt and click **Apply Selected Suggestions**. Notice your confirmed values are never silently overwritten.
   - Click **Save Profile** to persist your profile to the SQLite database.
5. **Step 5 — Inspect the Results Dashboard & What-If:**
   - Observe your headline score (`Readiness score: X/100`), the readiness range (`floor%–ceiling%`), and the clear verdict (`Ready to Apply`, `Not Ready to Apply Yet`, or `Not Eligible — Consider Skipping`).
   - Now test **Live What-If**: Type a required skill into your technical skills input (e.g., add `SQL`), or enter a valid GitHub URL. Notice that the score, status, and ladder immediately update live without reloading.
6. **Step 6 — Review the Fix-Effort Ladder & Deadline Runway:**
   - See tasks organized by Quick wins, Days, Weeks, and Locked blockers.
   - Check the Deadline Runway bar: it calculates calendar days remaining vs. estimated preparation days needed (`max(skills) + sum(documents)`).
7. **Step 7 — Print or Export:**
   - Click **Print / Save PDF** to generate an executive readiness summary via `@media print`.

---

## Core Architecture & Module Responsibilities

The codebase separates pure comparison logic from browser UI and backend persistence:

```
opportunitykit/
├── index.html         # Accessible single-page application structure & modals
├── styles.css         # Deep teal design system, WCAG AA status badges, 360px mobile responsive & print styles
├── app.js             # State manager, live What-If recalculator, form sync, REST API integration
├── extract.js         # Layered deterministic parser with sentence splitting & evidence attribution
├── compare.js         # Canonical rule evaluator, alias normalizer, and plain-language reasoning
├── score.js           # Score out of 100, floor/ceiling range, deadline-aware achievable score, verdicts
├── effort.js          # Configurable effort lookup table, date-only normalization, parallel runway logic
├── samples.js         # Isolated Section 8 demo fixture and test data (strictly isolated from real analysis)
├── server.js          # Zero-dependency Node HTTP server, static host, REST endpoints, input validation
├── db.js              # SQLite database initialization, schema DDL, parameterized prepared queries
├── resume.js          # In-memory FlateDecode PDF & DOCX stream parsers, deterministic skill/education extractor
├── package.json       # Project scripts and metadata
└── tests/
    ├── logic.test.js  # 18 logic & fixture tests (Sample, Tests A, B, C, D, edge cases, isolation)
    └── api.test.js    # 12 API, validation, SQL safety, restart persistence, and resume extraction tests
```

### Module Contracts (UMD Architecture)
All pure-logic files (`extract.js`, `compare.js`, `score.js`, `effort.js`, `samples.js`) export via UMD footers:
- In the browser: loaded via `<script>` tags onto `window.OK.*`.
- In Node.js: loaded via `require('./module.js')` for unit testing.

```js
extract(text) -> Item[]
normalize(skill) -> canonicalSkill
compare(item, profile) -> { status, reason, missingValues?, effortType, locked }
score(results, runwayData) -> { total, matches, missing, mismatches, floor, ceiling, achievable, rangeText }
verdict(results) -> "ready" | "not-ready" | "skip" | "empty"
runway(results, deadline, today) -> { daysNeeded, daysLeft, reachable, state, explanation }
```

---

## REST API Reference

| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/health` | Service health check | None | `{ status: "ok", uptime: number, database: "sqlite", version: "1.0.0" }` |
| `GET` | `/api/profile` | Retrieve saved profile | None | `{ profile: object \| null }` |
| `PUT` | `/api/profile` | Upsert student profile | Validated JSON profile payload | `{ status: "success", profile: object }` (or `422` with errors) |
| `DELETE` | `/api/profile` | Delete profile and all personal data | None | `{ status: "deleted" }` |
| `GET` | `/api/checks` | Retrieve recent opportunity checks | None | `{ checks: Array }` |
| `POST` | `/api/checks` | Save an opportunity check to history | JSON check payload | `{ status: "saved", check: object }` |
| `POST` | `/api/opportunity/extract-file` | In-memory opportunity brochure parser (PDF/DOCX) | PDF, DOCX, or TXT file | `{ success: true, text: string, textLength: number, fileName: string }` |
| `POST` | `/api/resume/extract` | In-memory resume text & suggestion parser | PDF or DOCX file (multipart or binary) | `{ success: true, textLength: number, suggestions: object }` |

---

## Database Schema (SQLite)

Tables are automatically initialized on startup with parameterized queries:

### `profiles` Table
```sql
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  year INTEGER,
  branch TEXT,
  degree TEXT,
  cgpa REAL,
  skills TEXT,               -- JSON string array e.g. ["JavaScript","Python"]
  docs TEXT,                 -- JSON string object e.g. {"resume":true}
  links TEXT,                -- JSON string object e.g. {"github":"https://..."}
  availability_weeks INTEGER,
  notes TEXT,
  updated_at TEXT
);
```

### `opportunity_checks` Table
```sql
CREATE TABLE IF NOT EXISTS opportunity_checks (
  id TEXT PRIMARY KEY,
  title TEXT,
  opportunity_type TEXT,
  deadline TEXT,
  input_text TEXT,
  requirements TEXT,         -- JSON string array
  score_floor INTEGER,
  score_ceiling INTEGER,
  verdict TEXT,
  created_at TEXT
);
```

---

## Canonical Rule Model & Vocabulary

Internal engine uses the Section 16.3 canonical schema, accepting Section 4.2 names as transparent aliases:

| Canonical Rule | Section 4.2 Alias | Description | Example |
|---|---|---|---|
| `one_of` | `in_set` | Profile value must be in allowed array | Study year in `[2, 3]` |
| `min` | `gte`, `gte_weeks` | Numeric value must be $\ge$ threshold | `cgpa >= 7.5`, `availability >= 8` |
| `max` | `lte` | Numeric value must be $\le$ threshold | Annual family income $\le$ ₹3,00,000 |
| `has_all` | `has_all` | Profile skills must contain every required skill | `["HTML", "CSS", "JavaScript"]` |
| `has_any` | `has_any` | At least one item satisfied | Portfolio OR GitHub link provided |
| `present` | `bool_required` | Required document or condition confirmed | `resume === true` |
| `url` | `url_required` | Well-formed `http://` or `https://` URL | `https://github.com/username` |
| `equals` | `equals` | Case-insensitive exact match | Work location: `"Pune"` |
| `custom` | `manual` | User-defined criteria needing confirmation | Custom course prerequisite |

---

## Status & User-Facing Display Label Mapping

| Internal Status | Blocker / Effort | User-Facing Status Label | Sub-Label Explanation |
|---|---|---|---|
| `MATCH` | Any | **MATCH** | Satisfied |
| `MISMATCH` | Locked (`locked: true`) | **MISMATCH** + **LOCKED** | Non-fixable eligibility blocker (consider skipping) |
| `MISMATCH` | Fixable (`quick`, `days`, `weeks`) | **WORK NEEDED** | Mismatch: preparation or update required |
| `MISSING_INFO` | Simple confirmation (`quick`) | **MISSING INFO** | Unknown, not a failure |
| `MISSING_INFO` | Document / skill preparation | **WORK NEEDED** | Missing info: answer or document needed |

*Key Principle:* **Unknown is not failure.** An empty profile field produces `MISSING INFO`, never `MISMATCH`.

---

## Score Calculation Explained

Readiness is an explainable requirement-completion indicator, not a hiring prediction:

- Let $T$ = number of active requirements.
- Let $M$ = confirmed matches (`MATCH`).
- Let $U$ = unknown items (`MISSING_INFO`).
- Let $G$ = mismatches (`MISMATCH`).

$$\text{Confirmed Floor (Headline Score)} = \begin{cases} 0 & \text{if } T = 0 \\ \mathrm{round}\left(\frac{M}{T} \times 100\right) & \text{if } T > 0 \end{cases}$$

$$\text{Possible Ceiling} = \begin{cases} 0 & \text{if } T = 0 \\ \mathrm{round}\left(\frac{M + U}{T} \times 100\right) & \text{if } T > 0 \end{cases}$$

$$\text{Readiness Range} = \text{Floor}\% \text{ to } \text{Ceiling}\%$$

### Deadline-Aware Achievable Score:
- If the runway status is `reachable`, achievable score equals the ceiling.
- If the runway is `blocked-by-locked` or `passed`, achievable score is capped at the confirmed floor.
- If the runway is `not-reachable`, only quick confirmations that require 0 days are counted toward the achievable score.

---

## Fix-Effort Ladder Lookup Table

Configured in `effort.js` (`DEFAULT_EFFORT_LOOKUP`):

| Effort Type | Typical Task | Default Calculation | Notes |
|---|---|---|---|
| **Quick** | Adding link, setting availability weeks | `0 days` | Takes only a few minutes |
| **Days** | Preparing resume, marksheet, income certificate | `2 days` | Sequential document preparation |
| **Days** | Focused skill gap (e.g. basic JavaScript) | `5 days` (default) | Parallel-safe skill learning |
| **Weeks** | Larger skill gap | `10 days` | Substantial new competency |
| **Locked** | Fixed year of study or CGPA cutoff | `N/A` | Non-remediable for current cycle |

### Parallel-Safe Runway Formula:
$$\text{Days Needed} = \max(\text{Skill Tasks}) + \sum(\text{Document Tasks}) + 0 \times (\text{Quick Tasks})$$

---

## Extraction Coverage & Limitations

### What is Supported:
- **Eligibility:** Study year (`2nd or 3rd year`, `third year`, `final year`), CGPA / GPA (`7.5+`, `minimum 7.5`, `at least 7.0`), Degree (`B.Tech`, `B.E.`), Income limits (e.g. `below ₹3,00,000`, `3 LPA`), Team size (`teams of 2–4`).
- **Skills:** Comma/bullet lists of languages, frameworks, databases, and devops tools.
- **Documents:** Resume, CV, marksheets, transcripts, income certificates, statements with word counts (e.g. `300-word statement`), working prototypes, demo videos.
- **Links:** Portfolio, GitHub, website, demo repository.
- **Logistics & Timeline:** Availability durations (`8 weeks`, `10 weeks`, `3 months`), work modes (`hybrid`, `remote`, `on-site`), location (e.g. `Pune`), application deadlines in multiple standard formats.
- **Negative Exemption Handling:** Sentences stating *"any programming language"* are never falsely extracted as a language skill requirement.

### Known Extraction Limitations:
- Completely unscannable, image-based, or heavily stylized flyers without machine-readable text cannot be parsed deterministically.
- In such ambiguous cases, OpportunityKit safely shows a clear empty state and invites manual checklist entry rather than inventing requirements.

---

## Resume Parsing Limits & Data Privacy

1. **Formats Supported:** PDF (`.pdf`) and Word (`.docx`) files up to 5 MB.
2. **In-Memory Zero Retention:** Files are processed entirely in Node memory buffers. Neither the original resume file nor intermediate disk artifacts are retained.
3. **Suggestion Workflow:** Extracted skills and fields are presented in a review modal with individual checkboxes. The user can accept, edit, or discard suggestions. Confirmed profile data is never silently overwritten.
4. **Scanned / Image PDFs:** Resumes consisting only of scanned raster images (without text streams) will trigger a friendly error message prompting manual entry.
5. **Single Demo Profile:** By design, the default server deployment operates in demo mode (`id = 'demo_user'`). Authentication, encryption, and multi-user isolation are not claimed.

---

## Decisions & Assumptions

1. **Rule Vocabulary Harmonization:** Section 16.3 canonical schema is the single internal model; Section 4.2 names are accepted as transparent aliases.
2. **Display Status Architecture:** Implemented via a single unified `displayStatus(result)` function used consistently across all views.
3. **Node 22+ Native SQLite:** Leveraged `node:sqlite` for synchronous, rock-solid persistence with zero build dependencies, while maintaining full compatibility with `better-sqlite3`.
4. **Zero AI Dependency:** The core extraction, evaluation, scoring, and runway calculations are 100% deterministic, explainable, and run offline without API keys.
5. **No Rubric Language in Public UI:** The public web interface speaks strictly to students about readiness; judging criteria and rubric points are strictly excluded from the application interface.
6. **Honest Monetization:** Proposed tiers (Free, Student Pro ₹49/mo, Campus License, Organizer Listing) are clearly marked as proposed future concepts with no fake payment gates.
7. **High-Fidelity PDF & Document Parsing:** Implemented Mozilla PDF.js (via `pdf-parse`) in `resume.js` as specified in Section 2 & 12 of the spec for high-fidelity in-memory extraction of opportunity brochures/JDs and resumes. Added dual-layer fallback to deterministic stream extraction and comprehensive sanitization (`sanitizeHumanText`, `isPredominantlyHumanText`) to eliminate font bytecode, PostScript tokens, or encrypted codes, ensuring that JD text displays in 100% clear human language.

---

## Deployment Guide

Static-only hosting (such as GitHub Pages) is insufficient because the app requires the Node.js SQLite backend to persist profiles and process resumes.

### Deploying to Render, Railway, or Fly.io:
1. **Repository:** Push this repository to GitHub.
2. **Build & Start Commands:**
   - Build Command: `npm install`
   - Start Command: `npm start`
3. **Environment Variables:** Set `PORT=3000` (or host-assigned port) and optionally `DB_PATH=/data/opportunitykit.db`.
4. **Persistent Disks:** If persistent SQLite storage across cloud redeployments is desired, mount a persistent volume (e.g. `/data`) and point `DB_PATH=/data/opportunitykit.db`.
5. **Container Dockerfile (Optional):**
   ```dockerfile
   FROM node:22-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

---

## Private Team Demo Checklist (Internal Team Reference Only)

- [x] Run `npm start` on a clean checkout; verify app opens at `http://localhost:3000`.
- [x] Click **Load Sample Demo**: verify 6 requirements extracted, 3 MATCH, 1 MISMATCH, 2 MISSING_INFO.
- [x] Verify Readiness Range is exactly `50%–83%` and verdict is `Not Ready to Apply Yet`.
- [x] Verify Deadline Runway shows 12 days left, 5 days needed, and `Reachable`.
- [x] Test **Live What-If**:
  - Add GitHub link: `https://github.com/alex` &rarr; link row turns `MATCH`.
  - Set availability to `8` weeks &rarr; availability row turns `MATCH`.
  - Add `JavaScript` to skills &rarr; skills row turns `MATCH`, score becomes `100%–100%`, verdict becomes `Ready to Apply`.
- [x] Test **Locked Blocker**: Change year to `1` or CGPA to `6.5` &rarr; status becomes `MISMATCH (LOCKED)` and verdict changes to `Not Eligible — Consider Skipping`.
- [x] Test **Custom Dynamic Opportunity**: Paste Section 16.6 Test A, Test B, Test C, and Test D &rarr; verify dynamic extraction, accurate evidence attribution, and zero stale carryover.
- [x] Test **Resume Upload**: Upload a test PDF or DOCX &rarr; verify in-memory extraction review modal without disk storage.
- [x] Test **Backend Profile Persistence**: Click Save Profile, reload the page &rarr; profile data restored from SQLite database.
- [x] Test **Profile Deletion**: Click Delete Profile &rarr; database record cleared.
- [x] Test **Print Stylesheet**: Click Print / Save PDF &rarr; clean, high-contrast print report without navigation buttons.
- [x] Test **Mobile Responsiveness**: Resize viewport to `360px` &rarr; table collapses into stacked cards.
- [x] Run `npm test` &rarr; all 30 tests pass with zero failures.
