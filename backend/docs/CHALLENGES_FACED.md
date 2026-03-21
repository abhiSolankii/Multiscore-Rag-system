# Challenges Faced & Solutions

1) **Motor MongoDB Returning Dictionary Instead of Object Attributes**
   - **Challenge:** We encountered an `AttributeError: 'dict' object has no attribute 'id'` when accessing user data in the chat endpoints.
   - **Solution:** Since we are using `Motor` for asynchronous MongoDB interaction, it returns raw Python dictionaries instead of mapped ORM objects. We solved this by consistently referencing keys natively (e.g., `user["_id"]`) in the backend logic, and only mapping `_id` back to `id` at the boundary layer before sending it to the client.

2) **Pydantic Over-Injecting Default Values on Route Returns**
   - **Challenge:** Our signup API returned a small manual dictionary without specific config settings. The overarching `UserResponse` Pydantic model caught this and "helpfully" injected default configuration values (like `enable_streaming=true`), completely squashing custom configurations that users had submitted during signup.
   - **Solution:** We fixed the route to simply return the full raw `user_dict` obtained exactly as it was inserted into MongoDB. Pydantic then seamlessly serialized the true custom config values while safely filtering out hidden fields like `hashed_password`.

3) **Spurious Configuration Fields Appearing in Login Swagger Docs**
   - **Challenge:** The `UserLogin` schema unexpectedly required/displayed a `config` object in our OpenAPI documentation (`/docs`), which made no sense for a basic credential check.
   - **Solution:** We identified a Pydantic inheritance trap where `UserLogin` was inheriting from `UserBase`. We decoupled it and made `UserLogin` inherit directly from `BaseModel`, strictly isolating it to accept only `email` and `password`.

4) **Dead User-Level Configurations Causing Logic Confusion**
   - **Challenge:** We had a `default_mode` field embedded globally inside the User configuration. This caused architectural confusion, as "mode" (e.g. strict RAG vs hybrid RAG) is innately specific to individual chat sessions, not a global monolithic user setting.
   - **Solution:** Validated through a codebase audit that the field was unused logically, then cleanly stripped it from `UserConfig` so that configurations remain properly restricted to their relevant domain objects (Chat vs. User).

5) **Token Quota Loophole: Crossing the Limit Mid-Stream**
   - **Challenge:** To protect costs, we checked if a user had `tokens_remaining > 0` before initiating an LLM query. The fatal flaw was that a user with merely 10 tokens left could invoke a massive 4000-token prompt, wildly overdrafting their bounds before the query terminated naturally.
   - **Solution:** We introduced a dynamic `actual_max_tokens = min(max_token_limit, tokens_remaining)` variable inside the chat endpoint. By passing this minimum natively to the LLM's `max_tokens` restrictor, the LLM physically truncates response generation the exact millisecond the user's account drains.

6) **Token Quota Loophole: Free Tokens from Interrupted Streams**
   - **Challenge:** OpenAI-compatible APIs only send the usage data envelope in the absolute final chunk of an established stream. If a user interrupts generation mid-stream (e.g. closing the browser early), the API drops connection, the `usage` chunk never surfaces, and users receive the generated snippet completely free of charge.
   - **Solution:** We implemented a generic fallback inside the SSE generation loop's `finally` block. If the stream exits but the API `tokens_used` tracker is empty, we spin up the `tiktoken` library to manually calculate both prompt and generated output tokens, accurately auto-charging the user's balance for exactly what they yielded before disconnecting.
