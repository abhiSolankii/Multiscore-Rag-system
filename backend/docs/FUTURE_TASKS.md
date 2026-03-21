# Future Tasks & Roadmap

This document outlines planned improvements, refactors, and feature additions for the Multiscore RAG backend and its integration with the frontend.

## 1. Streaming & Real-Time UX - Done

- **LLM Streaming (ChatGPT-style)**: Implement Server-Sent Events (SSE) to stream the final LLM response token-by-token.
  - _Debugging Consideration_: To prevent streams from obfuscating backend debug logs, streaming will be strictly controlled via a toggle in the `.env` settings (e.g., `ENABLE_STREAMING=true`).
- **Live "Thinking" Status Traces**: Send live, step-by-step progress updates to the frontend during the generation phase (e.g., `"Retrieving documents..."` → `"Building context..."` → `"LLM is thinking..."`). This provides transparency and improves perceived latency.

## 2. Schema Expansion: User Configs - Done

- **User Preferences Object**: Expand the `User` MongoDB schema to include a dedicated `settings` or `config` object.
  - This object will persist user-specific toggles horizontally across the app, such as whether they have streaming responses turned on/off by default, UI themes, or default prompt behaviors.

## 3. Schema Expansion: Chat-wise Configs - Done

Certain features require granular control at the individual _Chat_ level, rather than globally:

- **Strict vs. Hybrid Knowledge**: A toggle in the `Chat` schema allowing the user to decide if the LLM should answer _strictly_ using the provided PDF/Web sources, or if it is allowed to seamlessly merge the sources with its own internet/training knowledge.
- **Document-Level Filtering**: A chat-wise whitelist/blacklist. The frontend will display a list of all documents owned by the user, allowing them to explicitly toggle specific documents off for _that specific chat_. The `retriever_manager` will apply an `$in` or `$nin` filter on `document_id` during the Qdrant search.

## 4. Ingestion / Source Improvements

Current loaders need to be upgraded for higher-fidelity text extraction:

- **PDFs**:
  - Add Table extraction capabilities (crucial for financial/scientific docs).
  - Enhance page splitting boundaries.
  - Strip header/footer noise (page numbers, repeating titles) that disrupts semantic meaning.
- **Web Pages**:
  - Implement a "Readability" parse to aggressively strip out navbars, sidebars, footers, and ads, isolating only the core article text.
- **GitHub Repositories**:
  - Implement strict `.gitignore` style filtering.
  - **Ignore**: `node_modules/`, `*.lock`, `venv/`, and all binary/image files.
  - **Focus explicitly on**: `README`, `/docs`, `.md`, `.py`, `.ts`, `.js`, etc.

## 5. Rich Source Citations (Frontend UX) - Done

When the LLM cites a source, the frontend UX should be deeply interactive:

- **Chunk Previews**: When the user hovers over a cited source `[Source: document.pdf]`, a modal/popup should appear displaying the exact textual chunks that the LLM pulled that information from. The backend will package the `used_chunks` data array alongside the final text response.
- **Clickable Links**:
  - Web sources should be rendered as clickable `a href` tags.
  - PDF sources should ideally bridge to an active PDF viewer in the frontend, jumping directly to the referenced page.

## 6. Answer Execution Modes

- Give the user a dropdown or quick-action buttons to enforce the format of the response natively in the system prompt.
- **Modes**: `Summary`, `Bullet points`, `Table format`, `Detailed explanation`.

## 8. Context Memory Optimization

- We currently blindly fetch the latest 5 messages + the current query to maintain conversation context.
- _Improvement needed_: Explore upgrading this from a fixed `message_count` to a dynamic **Token Budget**. If the last 2 messages were massive 4,000-word essays, fetching 5 could blow out the OpenRouter context window. It should dynamically pack as many prior messages as fit comfortably into a `MAX_HISTORY_TOKENS` limit.

## 9. User Token Limits & Cost Tracking - Done

- **Is it possible?** Yes! Every API response from OpenRouter includes a `usage` object detailing exact `prompt_tokens`, `completion_tokens`, and `total_tokens`.
- Expand the message schema to store `tokens_used` for every single assistant response.
- Expose this data to the frontend so the user can literally see the token cost attached to each message bubble.
- Add a `max_token_limit` and `total_tokens_used` field to the `User` config. Deduct/increment tokens per chat to enforce quotas or offer tiered subscription plans.
