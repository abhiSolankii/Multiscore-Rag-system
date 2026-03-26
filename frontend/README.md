# Multiscore RAG — Frontend

A production-ready React frontend for the Multiscore RAG system. Dark-themed, fully responsive, and built with a clean scalable architecture.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| React 19 + Vite 8 | Core framework and build tool |
| Tailwind CSS v4 | Utility-first styling |
| Ant Design | Complex UI components (modals, selects, switches, tabs, upload) |
| Lucide React | Icons |
| Redux Toolkit | Global state management |
| React Router v6 | Client-side routing |
| Axios | HTTP client with interceptors |
| react-markdown + remark-gfm | Markdown rendering with GFM support |
| react-hot-toast | Toast notifications |

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` as needed:
```env
VITE_API_URL=http://localhost:8000/api   # Backend base URL
VITE_ENABLE_STREAMING=false              # Set to true to enable SSE streaming
```

### 3. Run dev server
```bash
npm run dev
```
Opens at **http://localhost:5173**

### 4. Build for production
```bash
npm run build
```

---

## Project Structure

```
src/
├── api/
│   ├── client.js          # Axios instance — Bearer token injection + 401 refresh interceptor
│   ├── auth.js            # login, signup, getMe, updateMe
│   ├── chat.js            # createChat, getChats, updateChat, getMessages, sendMessage, sendMessageStream
│   ├── ingestion.js       # ingestFile, ingestUrl, ingestGithub, pollStatus, listDocuments, deleteDocument
│   └── admin.js           # listUsers, getAdminUser, updateAdminUser, listAllDocuments, deleteAnyDocument
│
├── constants/
│   └── app.js             # APP_NAME, APP_TAGLINE — single source of truth for branding
│
├── store/
│   ├── index.js           # Redux store root
│   ├── authSlice.js       # user, token, isLoading — token rehydrated from localStorage on boot
│   └── chatSlice.js       # chats, activeChat, messages, streaming state, SSE status steps, usedChunks
│
├── hooks/
│   └── useAuth.js         # Selector hook aggregating auth state
│
├── utils/
│   ├── token.js           # localStorage helpers (msrag_token, msrag_refresh)
│   ├── errorHandler.js    # handleError(err) — parses API error, shows toast, logs to console
│   └── citations.js       # parseCitations(content, chunks) — parses [[Chunk N]] into segments
│
├── router/
│   ├── PrivateRoute.jsx   # Redirects unauthenticated users to /login
│   └── index.jsx          # React Router v6 config with all routes
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx  # Shell — sidebar + main outlet + auth:logout event listener
│   │   └── Sidebar.jsx    # Collapsible nav — shows Admin link only when user.is_admin is true
│   └── chat/
│       ├── ChatCard.jsx         # Chat card with mode badge, date, continue button
│       ├── CreateChatModal.jsx  # New chat modal — title, mode, include_public
│       ├── DocManagerModal.jsx  # Per-chat source toggle — enables/disables docs via inactive_docs
│       ├── MessageBubble.jsx    # Renders user and assistant messages with Markdown + citations
│       ├── CitationChip.jsx     # [[Chunk N]] rendered as clickable [N] badge
│       ├── ChunkModal.jsx       # Source detail modal — content, score, page, token count
│       ├── ChatInput.jsx        # Auto-resize textarea with char counter and send button
│       └── TypingIndicator.jsx  # SSE step labels or animated dots
│
└── pages/
    ├── auth/
    │   ├── LoginPage.jsx
    │   └── SignupPage.jsx
    ├── ChatsPage.jsx       # Chat grid with search + mode filter + create modal
    ├── ChatPage.jsx        # Active chat — dual streaming/non-streaming message flow
    ├── IngestPage.jsx      # PDF / URL / GitHub ingestion + status polling + doc table (public/private split)
    ├── SettingsPage.jsx    # Account info + editable preferences
    ├── AdminPage.jsx       # Admin dashboard — user management + all documents (admin only)
    └── NotFoundPage.jsx
```

---

## Routes

| Path | Access | Description |
|---|---|---|
| `/login` | Public | Sign in |
| `/signup` | Public | Create account |
| `/chats` | Protected | Browse and manage chats |
| `/chats/:chatId` | Protected | Active chat screen |
| `/ingest` | Protected | Data ingestion and document management |
| `/settings` | Protected | User preferences |
| `/admin` | Protected (admin only) | Admin dashboard |
| `*` | Public | 404 Not Found |

> The `/admin` route is accessible to any authenticated user who navigates to it directly. The sidebar link is hidden for non-admins. For server-side enforcement, the backend's `require_admin` dependency blocks all `/api/admin/*` calls for non-admin users.

---

## Key Flows

### Authentication
- Sign up → redirect to `/login`
- Login → JWT stored in `localStorage` as `msrag_token` / `msrag_refresh`
- Axios interceptor attaches `Authorization: Bearer <token>` to every request
- On 401: interceptor tries `POST /api/auth/refresh` with the stored refresh token, queuing all in-flight requests until the new token arrives. If refresh fails → auto-logout + redirect `/login`
- On app boot: if `msrag_token` exists in localStorage, calls `GET /api/users/me` to rehydrate user state in Redux

### Chat Flow
1. `/chats` — loads chat list from Redux (fetched from backend on mount)
2. **Create** button → `CreateChatModal` → `POST /api/chats/create` → redirects to new chat
3. **Continue** → `/chats/:chatId`
4. Messages loaded via `GET /api/chats/:chatId/messages/list`
5. Sending a message:
   - `VITE_ENABLE_STREAMING=false` → `POST /api/chats/:chatId/messages/send` → JSON response dispatched to Redux
   - `VITE_ENABLE_STREAMING=true` → `fetch()` ReadableStream → SSE events parsed line by line:
     - `event: status` → updates `statusStep` in Redux (shown in `TypingIndicator`)
     - `event: token` → appended to `streamingContent` in Redux (live-rendered in `MessageBubble`)
     - `event: usage` → logged (billing handled by backend)
     - `event: done` → assembles final message, dispatches `finishStreaming`

### Source Citation
- LLM responses contain `[[Chunk N]]` inline markers
- `parseCitations(content, usedChunks)` splits the response into `{ type: 'text' }` and `{ type: 'citation' }` segments
- Each citation segment renders as a `CitationChip` — a small `[N]` badge
- Clicking a badge opens `ChunkModal` showing:
  - Source URL / filename (with external link if web)
  - Type, page, chunk index, token count, relevance score
  - Full raw chunk content

### Document On/Off (per chat)
- In `ChatPage` header: **Manage Sources** button opens `DocManagerModal`
- Lists all user documents; each has an Ant `Switch` toggle
- Toggling calls `PATCH /api/chats/:chatId` with updated `config.inactive_docs` array
- Redux `activeChat` updated optimistically

### Ingestion
- **PDF**: `POST /api/ingest/file` (multipart form)
- **URL**: `POST /api/ingest/url`
- **GitHub**: `POST /api/ingest/github`
- After submit, `task_id` is stored in session-only `pendingJobs` state and polled every **5 seconds** via `GET /api/ingest/status/:taskId`
- When status returns `"done"` or `"failed"` → toast + document list refreshes + job removed from polling
- On page reload: `pendingJobs` resets (session-only), but the document list API returns each doc's `status` field. If any doc has `status !== "done"`, a yellow warning appears next to the refresh button
- Documents are shown in two sections: **Private** and **Public**

### Admin System
- Users with `is_admin: true` in the database see an **Admin** nav link in the sidebar (orange accent)
- `AdminPage` (`/admin`) shows:
  - All users with email, token balance, active/admin badges
  - **Edit** button → modal to update `tokens_remaining`, `total_tokens_used`, `is_active`, `is_admin`, and `config` fields
  - All documents across all users (collapsible) with delete button
- All admin API calls go to `/api/admin/*` — blocked server-side for non-admins
- To promote a user to admin: `db.users.updateOne({ email: "you@email.com" }, { $set: { is_admin: true } })`

---

## App Branding

App name is controlled from one place:
```js
// src/constants/app.js
export const APP_NAME = 'Multiscore RAG';
```
Used in: tab title (`document.title` in App.jsx + `index.html`), Sidebar logo text, Login and Signup page subtitles.

The tab icon (`/public/favicon.svg`) is also used as the sidebar logo — same asset, consistent branding.

---

## Ant Design Dark Theme

`App.jsx` wraps the entire app in Ant Design's `ConfigProvider` with `theme.darkAlgorithm`. This ensures all Ant components (Modal, Select, Switch, Tabs, Tooltip) render with a dark background matching the app's color palette — no white flash on modals or dropdowns.

```js
<ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#6366f1', ... } }}>
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000/api` | Backend API base URL |
| `VITE_ENABLE_STREAMING` | `false` | Set `true` to enable SSE token streaming |

---

## Redux State Shape

```js
// auth slice
{
  user: { _id, email, is_admin, config, tokens_remaining, total_tokens_used },
  token: "jwt_access_token",
  isLoading: false
}

// chat slice
{
  chats: [...],
  activeChat: { _id, title, config: { mode, include_public, inactive_docs } },
  messages: [...],
  isStreaming: false,
  streamingContent: "",
  statusStep: "retrieving" | "rewriting_query" | "retrieved" | "building_context" | "calling_llm" | "generating" | null,
  usedChunks: [...]
}
```

---

## Error Handling

All API errors go through `utils/errorHandler.js`:
```js
handleError(err, fallback?)
// → Parses err.response.data.detail or err.message
// → toast.error(message)
// → console.error(err)
```
Used at every `try/catch` site across the app.

---

## Backend Requirements

The frontend expects these backend endpoints to exist:

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | Returns `{ access_token, refresh_token }` |
| POST | `/api/auth/signup` | Creates user |
| POST | `/api/auth/refresh` | Accepts `{ refresh_token }`, returns new tokens |
| GET | `/api/users/me` | Returns `{ user }` with `is_admin` field |
| PATCH | `/api/users/me` | Updates user config |
| GET | `/api/chats/list` | Returns chat array |
| POST | `/api/chats/create` | Creates chat |
| PATCH | `/api/chats/:id` | Updates chat config |
| DELETE | `/api/chats/:id` | Deletes chat |
| GET | `/api/chats/:id/messages/list` | Returns message array |
| POST | `/api/chats/:id/messages/send` | Streaming or JSON response |
| POST | `/api/ingest/file` | Multipart PDF upload |
| POST | `/api/ingest/url` | URL ingestion |
| POST | `/api/ingest/github` | GitHub repo ingestion |
| GET | `/api/ingest/status/:taskId` | Returns `{ status: "done" \| "pending" \| "failed" }` |
| GET | `/api/ingest/documents` | List documents with `status` and `is_public` fields |
| DELETE | `/api/ingest/document/:docId` | Delete document + vectors |
| GET | `/api/admin/users` | Admin: list all users |
| PATCH | `/api/admin/users/:id` | Admin: edit user |
| GET | `/api/admin/documents` | Admin: list all documents |
| DELETE | `/api/admin/documents/:docId` | Admin: delete any document |

> Make sure `http://localhost:5173` is in your backend's CORS allowed origins.

