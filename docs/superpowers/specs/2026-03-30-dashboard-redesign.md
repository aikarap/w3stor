# Dashboard Redesign & Agent Activity Page

## Summary

Consolidate the dashboard into a single tabbed layout, replace the upload route with a modal, add real-time per-provider file status, create a public Agent Activity page, and simplify the landing page nav.

---

## 1. Dashboard — Tabbed Layout

**Route:** `/dashboard` (single page, no sub-routes)

### Tabs

| Tab | Content |
|---|---|
| **Files** (default) | Metrics cards + file table + upload modal trigger |
| **Chat** | Existing chat UI (moved from `/dashboard/chat`) |
| **Workflows** | Existing workflow builder (moved from `/swarm`) |

### Files Tab

- **Top section:** 4 metric cards (Total Files, Storage Used, Fully Replicated, Conversations) — same as current overview but without upload volume chart or activity feed.
- **Upload button:** "Upload to Filecoin" button next to the file count. Opens upload modal.
- **File table:** Paginated list with sortable columns: Name, CID, Size, Status, SPs, Date, Links.
- **Expandable rows:** Each row toggles open to show per-SP detail:
  - Provider ID, status (pending/stored/verified/failed), tx hash (links to `filecoin-testnet.blockscout.com`), PDP explorer link.
  - Updates in real-time via SSE — each SP populates as it confirms, not all at once.
- **Real-time:** Rows in non-terminal states (`pinata_pinned`, `uploading`, `stored`) subscribe to `/events/files/:cid`. Unsubscribe on `fully_replicated` or `failed`.

### Chat Tab

Existing chat page content rendered as a tab. No changes to chat functionality.

### Workflows Tab

Existing `/swarm` workflow builder rendered as a tab. Renamed from "Swarm" to "Workflows".

### Routes Deleted

- `/dashboard/upload` — replaced by upload modal
- `/dashboard/files` — merged into Files tab
- `/dashboard/chat` — content stays, rendered as tab
- `/swarm` — content moves to Workflows tab

---

## 2. Upload Modal

**Trigger:** "Upload to Filecoin" button in Files tab.

**Flow:**
1. Modal opens with drag-drop zone, tags input, description textarea.
2. User drops file → x402 payment prompt.
3. After payment signing → modal shows pinning status (spinner).
4. Once pinned (API returns CID) → modal closes automatically.
5. New file appears in table with `pinata_pinned` status.
6. Real-time SSE updates show per-SP progress in expandable row.

**Status transitions visible in table:** `pinata_pinned` → `uploading` → `stored` → `fully_replicated`

---

## 3. Landing Page Nav

**Current:** Docs, Live Demo, Platform

**New:** Docs, Dashboard, Agent Activity

| Item | Route |
|---|---|
| Docs | `/docs` |
| Dashboard | `/dashboard` |
| Agent Activity | `/agent-activity` |

Dashboard sub-nav in header removed — tabs handle navigation within the page.

---

## 4. Agent Activity Page (public)

**Route:** `/agent-activity`

Public page, no auth/wallet required. Shows what the storage agent has been doing across the network. Purpose: transparency and on-chain verification.

### Two Tabs

| Tab | Content |
|---|---|
| **Recent Activity** (default) | Public file table |
| **Upload Volume** | Time-series chart (30-day upload history) |

### Recent Activity Table

- **Columns:** PieceCID, CID, Status, SPs, Date
- **No filename, no wallet info** — on-chain data only
- **Expandable rows:** Same per-SP detail as dashboard file table (provider status, tx hashes, PDP links)
- **Real-time:** SSE via `/events/platform` for live updates
- **Data source:** Existing `GET /platform/activity` endpoint (already returns `piece_cid`, `status`, `sp_count`)

### Upload Volume Tab

Existing `StorageChart` component moved here. Data from `GET /platform/metrics` (upload volume over 30 days).

### Removed from Current Platform Page

- 4 metric summary cards (Total Users, Total Files, Storage Used, Conversations)
- Activity feed component (replaced by the table)

---

## 5. Components

### New Components
- **`UploadModal`** — modal with drag-drop, payment flow, pinning status
- **`ExpandableFileRow`** — toggleable row showing per-SP status with real-time updates
- **`DashboardTabs`** — tab container for Files/Chat/Workflows
- **`AgentActivityTable`** — public file table with PieceCID/CID columns

### Reused Components
- `FileTable` — enhanced with expandable rows (used in both dashboard and agent activity)
- `StorageChart` — moved to Agent Activity upload volume tab
- `MetricsCard` — used in dashboard Files tab
- `StatusBadge` — used in expandable rows for per-SP status

### Deleted Components/Pages
- `apps/web/src/app/dashboard/upload/page.tsx`
- `apps/web/src/app/dashboard/files/page.tsx`
- `apps/web/src/app/dashboard/chat/page.tsx` (content moved, route deleted)
- `apps/web/src/app/platform/page.tsx` (replaced by agent-activity)
- `apps/web/src/app/swarm/` (content moved to dashboard Workflows tab)

---

## 6. API Changes

No backend API changes needed. All data is already available:
- `GET /files?wallet=...` — user files with payment/tx data
- `GET /status/:cid` — per-SP status with tx hashes
- `GET /platform/activity` — all files with piece_cid
- `GET /platform/metrics` — upload volume
- `GET /events/files/:cid` — SSE per-file
- `GET /events/platform` — SSE platform-wide
