# Challenges Faced & Solutions

5. **Token Quota Loophole: Crossing the Limit Mid-Stream**
   - **Challenge:** To protect costs, we checked if a user had `tokens_remaining > 0` before initiating an LLM query. The fatal flaw was that a user with merely 10 tokens left could invoke a massive 4000-token prompt, wildly overdrafting their bounds before the query terminated naturally.
   - **Solution:** We introduced a dynamic `actual_max_tokens = min(max_token_limit, tokens_remaining)` variable inside the chat endpoint. By passing this minimum natively to the LLM's `max_tokens` restrictor, the LLM physically truncates response generation the exact millisecond the user's account drains.

6. **Token Quota Loophole: Free Tokens from Interrupted Streams**
   - **Challenge:** OpenAI-compatible APIs only send the usage data envelope in the absolute final chunk of an established stream. If a user interrupts generation mid-stream (e.g. closing the browser early), the API drops connection, the `usage` chunk never surfaces, and users receive the generated snippet completely free of charge.
   - **Solution:** We implemented a generic fallback inside the SSE generation loop's `finally` block. If the stream exits but the API `tokens_used` tracker is empty, we spin up the `tiktoken` library to manually calculate both prompt and generated output tokens, accurately auto-charging the user's balance for exactly what they yielded before disconnecting.

7. **Strict Mode Ignoring Empty Context (Falling back to plain LLM)**
   - **Challenge:** When the Vector DB returned 0 chunks (e.g. searching across unindexed/empty documents), the backend was designed to short-circuit and revert to a `PLAIN_SYSTEM_PROMPT` (like ChatGPT). This bypassed the `"strict"` chat mode restrictions, causing the LLM to hallucinate answers instead of correctly stating that no context was found.
   - **Solution:** We removed the short-circuiting logic in `answer_generator.py`. Now, even if the Vector DB returns 0 chunks, the flow correctly passes an empty context list to `build_rag_system_prompt()`. We updated the prompt template builder to explicitly format this empty state as `"No information found in the selected files."`, forcing the LLM to abide by its strict directive and politely refuse to answer.
