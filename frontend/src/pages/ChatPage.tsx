import { useState, useRef, useEffect } from "react";
import { AI_SERVICE_URL, ApiError, ServiceUnreachable, request } from "../api/client";
import type { ChatMessage, ChatResponse, HouseholdFacts, EligibilityCheckResponse } from "../api/types";
import { ManualFallbackForm } from "../components/ManualFallbackForm";
import { FactConfirmation } from "../components/FactConfirmation";
import { ResultsView } from "../components/ResultsView";

const SUGGESTION_CHIPS = [
  { label: "🏠 Check my eligibility", text: "I want to check which government schemes my family is eligible for" },
  { label: "👨‍👩‍👧 PM Awas Yojana", text: "Am I eligible for Pradhan Mantri Awas Yojana?" },
  { label: "🌾 Kisan Samman", text: "Tell me about PM Kisan Samman Nidhi eligibility" },
  { label: "📋 हिंदी में बताएं", text: "मेरे परिवार की आय 2 लाख है और हम गाँव में रहते हैं। कौन सी योजनाएं मिल सकती हैं?" },
];

export function ChatPage({ token }: { token: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentDown, setAgentDown] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);

  // Hand-off state
  const [extractedFacts, setExtractedFacts] = useState<HouseholdFacts | null>(null);
  const [results, setResults] = useState<EligibilityCheckResponse | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = navigator.language || 'en-IN';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDraft(prev => prev ? prev + " " + transcript : transcript);
        setListening(false);
      };

      recognitionRef.current.onerror = () => setListening(false);
      recognitionRef.current.onend = () => setListening(false);
    }
  }, []);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setListening(true);
      } catch (e) {
        console.warn("Microphone access failed.");
      }
    }
  }

  function readAloud(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN'; // defaults to indian accent or hindi
      window.speechSynthesis.speak(utterance);
    }
  }

  async function send(text?: string) {
    const msg = (text ?? draft).trim();
    if (!msg || busy) return;

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    const history: ChatMessage[] = [...messages, { role: "user", content: msg }];
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

      const newMessages = [...history, { role: "assistant", content: response.reply } as ChatMessage];
      setMessages(newMessages);

      if (autoVoice) {
        readAloud(response.reply);
      }

      // Check if the AI decided to invoke the eligibility tool
      if (response.trace) {
        const toolCall = response.trace.find(
          (t: any) => t.kind === "tool" && t.name === "check_eligibility"
        );
        if (toolCall && toolCall.args) {
          setExtractedFacts(toolCall.args as HouseholdFacts);
        }
      }
    } catch (e) {
      if (e instanceof ServiceUnreachable) {
        setAgentDown(true);
      } else {
        setError(e instanceof ApiError ? e.friendly : "That did not work. Please try again.");
      }
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    send();
  }

  async function handleConfirmFacts(facts: HouseholdFacts) {
    setBusy(true);
    setError(null);
    try {
      const res = await request<EligibilityCheckResponse>("/api/eligibility/check", {
        method: "POST",
        body: facts,
        token
      });
      setResults(res);
      setExtractedFacts(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : "Failed to check eligibility. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = messages.length === 0;

  if (results) {
    return (
      <div className="page-container">
        <ResultsView result={results} />
        <div style={{ textAlign: "center", marginTop: "var(--sp-6)" }}>
          <button className="btn btn-secondary" onClick={() => {
            setResults(null);
            setMessages([]);
          }}>
            Start New Check
          </button>
        </div>
      </div>
    );
  }

  if (extractedFacts) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">Confirm Your Details</h2>
          <p className="page-subtitle">Before checking eligibility, please review the facts extracted from your chat.</p>
        </div>
        <div className="glass-card">
          <FactConfirmation
            extracted={extractedFacts}
            onConfirm={(fc, c) => handleConfirmFacts(fc)}
            submitLabel="Check Eligibility"
          />
        </div>
        {busy && <div className="loading-state"><div className="spinner" /> Checking Eligibility...</div>}
        {error && <div className="alert alert-danger" style={{ marginTop: "var(--sp-4)" }}>⚠️ {error}</div>}
      </div>
    );
  }

  return (
    <main className="chat-page">
      {/* ── Messages area ── */}
      <div className="chat-messages" data-testid="messages">
        {isEmpty && !agentDown && (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">🇮🇳</div>
            <h2>नमस्ते! Welcome to Yojana Saathi</h2>
            <p className="chat-welcome-desc">
              Tell me about your family in any language, and I'll find government
              schemes you may be eligible for.
            </p>
            <p className="chat-welcome-hindi">
              अपने परिवार के बारे में बताइए — मैं सही योजनाएं ढूंढने में आपकी मदद करूँगा।
            </p>
            <div className="chat-chips">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  className="chip"
                  onClick={() => send(chip.text)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            <div className="bubble-avatar">
              {m.role === "user" ? "👤" : "🤖"}
            </div>
            <div className="bubble-content">
              <span className="bubble-sender" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <span>{m.role === "user" ? "You" : "Yojana Saathi"}</span>
                {m.role === "assistant" && (
                  <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", padding: "0 var(--sp-2)", opacity: 0.7 }} onClick={() => readAloud(m.content)} title="Read Aloud">
                    🔊
                  </button>
                )}
              </span>
              <p className="bubble-text">{m.content}</p>
            </div>
          </div>
        ))}

        {busy && (
          <div className="chat-bubble assistant">
            <div className="bubble-avatar">🤖</div>
            <div className="bubble-content">
              <span className="bubble-sender">Yojana Saathi</span>
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ margin: "0 var(--sp-4)" }}>
            ⚠️ {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      {!agentDown && (
        <form className="chat-input-bar" onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "0", borderRadius: "50%", minWidth: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", border: autoVoice ? "2px solid var(--primary-light)" : "1px solid var(--border)", background: autoVoice ? "#fffbeb" : "transparent" }}
              onClick={() => {
                setAutoVoice(!autoVoice);
                if (autoVoice && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              }}
              title={autoVoice ? "Auto Voice: ON (Click to mute)" : "Auto Voice: OFF (Click to unmute)"}
            >
              {autoVoice ? "🔊" : "🔇"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "0", borderRadius: "50%", minWidth: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", border: listening ? "2px solid #ef4444" : "1px solid var(--border)", background: listening ? "#fee2e2" : "transparent" }}
              onClick={toggleListening}
              title="Voice Assistant (Talk)"
            >
              🎤
            </button>
          </div>
          <input
            ref={inputRef}
            id="chat-input"
            className="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            autoComplete="off"
            placeholder={listening ? "Listening (बोलिए)..." : "Type in Hindi, English, or any language..."}
            aria-label="Type your message"
          />
          <button
            type="submit"
            className="btn btn-primary chat-send"
            disabled={busy || draft.trim() === ""}
            aria-label="Send message"
          >
            {busy ? <div className="spinner" /> : "➤"}
          </button>
        </form>
      )}

      {agentDown && (
        <div style={{ padding: "var(--sp-6)" }}>
          <ManualFallbackForm
            token={token}
            reason="The AI assistant is unavailable. Use this form to check eligibility directly."
          />
        </div>
      )}
    </main>
  );
}
