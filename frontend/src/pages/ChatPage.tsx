import { useState } from "react";
import { AI_SERVICE_URL, ApiError, ServiceUnreachable, request } from "../api/client";
import type { ChatMessage, ChatResponse } from "../api/types";
import { ManualFallbackForm } from "../components/ManualFallbackForm";

/**
 * The conversation. The input carries no language hint: whatever the person
 * types goes through unchanged and the agent answers in the same language.
 *
 * If the AI service cannot be reached, the page does not show an error and stop
 * - it switches to the manual form, which reaches the rule engine directly.
 */
export function ChatPage({ token }: { token: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentDown, setAgentDown] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const response = await request<ChatResponse>("/agent/chat", {
        method: "POST",
        body: { messages: history },
        token,
        baseUrl: AI_SERVICE_URL,
        serviceName: "ai-service",
      });
      setMessages([...history, { role: "assistant", content: response.reply }]);
    } catch (e) {
      if (e instanceof ServiceUnreachable) {
        setAgentDown(true);
      } else {
        setError(e instanceof ApiError ? e.friendly : "That did not work. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Yojana Saathi</h1>

      <ol aria-label="Conversation" data-testid="messages">
        {messages.map((m, i) => (
          <li key={i} data-role={m.role}>
            <b>{m.role === "user" ? "You" : "Saathi"}:</b> {m.content}
          </li>
        ))}
      </ol>

      {!agentDown && (
        <form onSubmit={send}>
          <label htmlFor="chat-input">Type in any language</label>
          <input
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
          <button type="submit" disabled={busy || draft.trim() === ""}>
            Send
          </button>
        </form>
      )}

      {busy && <p role="status">Thinking…</p>}
      {error && <p role="alert">{error}</p>}

      {agentDown && (
        <ManualFallbackForm
          token={token}
          reason="The assistant is unavailable, so we have switched you to the direct form."
        />
      )}
    </main>
  );
}
