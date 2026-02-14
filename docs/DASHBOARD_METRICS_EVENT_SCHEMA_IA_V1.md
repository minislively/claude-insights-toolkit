# Dashboard + Metrics + Event Schema v1

Status: Draft

This document defines **(1) KPI/metric dictionary**, **(2) canonical event schema**, and **(3) dashboard information architecture (IA)** for Claude Insights Toolkit.

It is written to reduce dependency on Claude Code’s internal `/insights` view by treating it as **one input source** (adapter), while keeping analysis and dashboard logic stable as we ingest additional sources later.

---

## 1) Scope

### Goals

- Make it obvious **what we should look at** in the dashboard (top-level KPIs + drill-down paths).
- Make it obvious **how numbers accumulate** (source → event → aggregation unit).
- Define a **canonical event model** so Claude facets/report are just adapters.
- Keep v1 compatible with current storage and API handlers.

### Non-goals (v1)

- Team-level RBAC, multi-tenant permissions model.
- A full metrics warehouse / OLAP schema.
- Real-time streaming ingestion.

---

## 2) Current data model and accumulation (as-is)

The current toolkit already has a 2-layer dataset:

### A. Session facets (per-session summaries)

- Source path: `~/.claude/usage-data/facets/*.json`
- Type: `src/types/insights.ts:ISessionFacet`
- Collector: `src/collectors/facets.ts:collectFacets()`
- Stored as daily aggregates:
  - Output directory (default): `~/claude-insights/data/`
  - File shape: `IInsightsDay` per `YYYY-MM-DD.json` (sessions array)

### B. Report-based snapshots (period summaries)

- Source path: `~/.claude/usage-data/report.html`
- Snapshot type: `src/types/insights.ts:ISnapshot`
- Written under: `~/claude-insights/snapshots/*.json`
- Contains period-wide aggregates and optional cost estimation:
  - `ISnapshot.metrics.costKpi.estimatedCostUsd`

### C. Dashboard API reads from `~/claude-insights/*`

- Server handlers: `src/server/api-handlers.ts`
  - `/api/data` reads `~/claude-insights/data/*.json`
  - `/api/snapshots` reads `~/claude-insights/snapshots/*.json`
  - `/api/profile` derives from latest stored report

---

## 3) Canonical Event Schema v1

### 3.1 Design principles

- **Source-agnostic**: Claude facets/report are adapters that produce canonical events.
- **Stable envelope, flexible payload**: envelope is versioned; payload is typed by `event_type`.
- **Aggregation-friendly**: all events include the minimal dimensions needed for grouping.

### 3.2 Event envelope

All canonical events MUST conform to the envelope below.

```ts
// CanonicalEventEnvelope (conceptual)
{
  schema_version: 1,

  // Required identity
  event_id: string,           // UUID or stable hash
  event_type: string,         // e.g. "session_summary"
  occurred_at: string,        // ISO 8601

  // Required scoping
  source: string,             // e.g. "claude_facets", "claude_report", "app_backend"
  tenant_id: string,          // personal/team namespace

  // Recommended dimensions
  user_id?: string,
  session_id?: string,
  project?: {
    repo_name?: string,
    repo_path_hash?: string,
    branch?: string,
    primary_language?: string,
  },
  environment?: {
    os?: string,
    machine_id_hash?: string,
    app_version?: string,
  },

  // Event body
  payload: unknown
}
```

Notes:
- `tenant_id` is mandatory even for personal-only usage (e.g. `"personal"`).
- `event_id` should be deterministic when possible to avoid duplicates.

### 3.3 Canonical event types (minimum set)

#### 1) `session_summary`

Purpose: one record per session summarizing the outcome and friction.

Payload (v1): mapped directly from `ISessionFacet`.

```json
{
  "schema_version": 1,
  "event_id": "...",
  "event_type": "session_summary",
  "occurred_at": "2026-02-14T01:23:45.000Z",
  "source": "claude_facets",
  "tenant_id": "personal",
  "session_id": "...",
  "payload": {
    "underlying_goal": "...",
    "goal_categories": { "bug_fix": 1 },
    "outcome": "mostly_achieved",
    "claude_helpfulness": "very_helpful",
    "session_type": "iterative_refinement",
    "friction_counts": { "api_errors": 2 },
    "user_satisfaction_counts": { "satisfied": 1 },
    "primary_success": "multi_file_changes",
    "brief_summary": "...",
    "friction_detail": "..."
  }
}
```

#### 2) `snapshot_summary`

Purpose: one record per snapshot summarizing a period’s aggregate metrics.

Payload (v1): mapped directly from `ISnapshot`.

```json
{
  "schema_version": 1,
  "event_id": "...",
  "event_type": "snapshot_summary",
  "occurred_at": "2026-02-14T02:00:00.000Z",
  "source": "claude_report",
  "tenant_id": "personal",
  "payload": {
    "date": "2026-02-14",
    "metrics": {
      "sessions": 12,
      "messages": 84,
      "days": 7,
      "successRate": 66,
      "costKpi": {
        "estimatedCostUsd": 7.23,
        "estimatedTokens": 123456,
        "estimationModel": "..."
      }
    }
  }
}
```

#### 3) `error_event` (for service expansion)

Purpose: unify service/backend/integration errors.

Payload (v1 proposal):

```json
{
  "error_code": "HTTP_502",
  "component": "llm_gateway",
  "severity": "error",
  "retry_count": 2,
  "is_user_visible": true
}
```

#### 4) `suggestion_event` (for recommendations)

Subtypes: `shown | accepted | dismissed`

Payload (v1 proposal):

```json
{
  "suggestion_id": "reduce-context-overflow",
  "category": "efficiency",
  "action": "accepted",
  "expected_impact": {
    "metric": "context_overflow_rate",
    "direction": "down"
  }
}
```

#### 5) `cache_event` (for cache KPI)

Subtypes: `hit | miss | write | invalidate`

Payload (v1 proposal):

```json
{
  "action": "hit",
  "cache_key_hash": "...",
  "ttl_ms": 600000,
  "size_bytes": 2048
}
```

---

## 4) Metric Dictionary (KPI v1)

### 4.1 Aggregation units

- **Event**: atomic record (canonical event).
- **Session**: group by `session_id` (or by `payload.session_id` when adapter-specific).
- **Day**: `YYYY-MM-DD` (currently `IInsightsDay.date`).
- **Week / 30d**: rolling periods computed at query time.

### 4.2 KPI list (v1)

Below, “Available now” means it can be computed from existing stored data (`~/claude-insights/data` + `~/claude-insights/snapshots`).

1) **Success Rate** (Available now)
- ID: `success_rate`
- Definition: percent of sessions with `outcome ∈ {fully_achieved, mostly_achieved}`
- Formula: `successful_sessions / total_sessions`
- Source: `session_summary` (facets)
- Primary dims: day/week, session_type, goal_category

2) **API Error Session Rate** (Available now)
- ID: `api_error_session_rate`
- Definition: percent of sessions where any API-related `friction_counts` > 0
- Formula: `sessions_with_api_errors / total_sessions`
- Source: `session_summary` (facets)
- Notes: analyzer logic exists in `src/analyzers/api-errors.ts`

3) **Context Overflow Rate** (Available now)
- ID: `context_overflow_rate`
- Definition: percent of sessions with `context_limit` or `context_length_exceeded`
- Formula: `sessions_with_context_overflow / total_sessions`
- Source: `session_summary` (facets)

4) **Estimated Cost (USD)** (Available now)
- ID: `estimated_cost_usd`
- Definition: estimated cost for a snapshot period
- Formula: `snapshot.metrics.costKpi.estimatedCostUsd`
- Source: `snapshot_summary` (report snapshot)
- Caveat: only available when snapshots exist and costKpi is present

5) **Cost per Successful Session** (Available now, best-effort)
- ID: `cost_per_success`
- Definition: estimated cost divided by successful sessions
- Formula: `estimated_cost_usd / successful_sessions`
- Source: snapshots + session summaries (same period)
- Note: requires aligning snapshot period to the session window shown

6) **Iterative Refinement Share** (Available now)
- ID: `iterative_refinement_share`
- Definition: percent of sessions with `session_type = iterative_refinement`
- Formula: `count(session_type=iterative_refinement)/total_sessions`
- Source: `session_summary`

7) **Efficiency Score (Distribution)** (Available now)
- ID: `efficiency_score`
- Definition: derived 0–100 score and buckets
- Source: `src/analyzers/session-efficiency.ts`
- Output: distribution + “worst sessions” list

8) **Helpfulness Distribution** (Available now)
- ID: `helpfulness_distribution`
- Definition: distribution across `claude_helpfulness`
- Source: `session_summary`

9) **User Satisfaction Distribution** (Available now)
- ID: `user_satisfaction_distribution`
- Definition: distribution from `user_satisfaction_counts`
- Source: `session_summary`

10) **Suggestion Acceptance Rate** (Expansion-ready)
- ID: `suggestion_acceptance_rate`
- Definition: accepted / shown
- Source: `suggestion_event`

11) **Cache Hit Ratio** (Expansion-ready)
- ID: `cache_hit_ratio`
- Definition: hits / misses (or hit_rate)
- Source: `cache_event`

Note: v1 dashboard should prioritize (1)–(9) for the initial “what should I look at?” experience.

---

## 5) Dashboard IA v1

### 5.1 IA principle: question-first navigation

Instead of listing analyzer pages as-is, group navigation by the questions a user asks:

1) **Executive Overview**
- “Is everything healthy?” “Did we improve vs last week?” “What are the top actions?”

2) **Health**
- API errors
- Context overflows
- Failure drivers

3) **Efficiency & Cost**
- Efficiency score
- Iterative refinement load
- Cost and cost-per-success (where available)

4) **Quality & Behavior**
- Helpful/satisfaction
- Category success
- Time patterns

5) **Drill-down / Supporting**
- Sessions list
- Reports viewer
- Profile
- History (snapshots)

### 5.2 Mapping to current routes (implementation alignment)

Current routes are defined in `web/src/App.tsx` and include:

- `/` Overview
- `/sessions`
- `/api-errors`
- `/category-success`
- `/session-efficiency`
- `/helpfulness`
- `/time-patterns`
- `/trends`
- `/reports`
- `/profile`
- `/history`

v1 IA does not require removing routes; it requires:
- an “Executive Overview” that highlights KPI cards and deltas
- regrouping navigation (optional in v1) so the first-time experience is guided

---

## 6) Open questions (to finalize v1)

1) Period alignment:
- Should the dashboard’s default window be **last 7 full days** or **last 30 days**?
- How do we align `snapshot_summary` period to `session_summary` day-window (for cost-per-success)?

2) Tenant model:
- For now, should `tenant_id` always be `"personal"`, with future expansion to `"team:<id>"`?

3) Suggestion and cache events:
- Where will these events be emitted in the expanded service (CLI hooks, backend API, or dashboard UI)?

---

## 7) Appendix: mapping checklist (adapter implementation guide)

When adding a new data source, implement:

- Adapter → canonical event(s)
- Idempotency key strategy (`event_id` determinism)
- Minimal dimension extraction (`tenant_id`, `session_id`, `occurred_at`, `project`)
- Validation against schema_version

Existing adapters (already implicit):
- `claude_facets` → `session_summary`
- `claude_report` → `snapshot_summary`
