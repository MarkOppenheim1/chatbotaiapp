"use client";

import { useState } from "react";
import MarkdownMessage from "./MarkdownMessage";
import { signIn, signOut, useSession } from "next-auth/react";

type Source = {
  source: string;
  page: number | null;
  snippet: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export default function ChatUI() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const sessionKey = userId ? `user:${userId}` : null;
  const [isStreaming, setIsStreaming] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! Ask me something." },
  ]);
  const [input, setInput] = useState("");

  if (status === "loading") {
    return <div>Loading session...</div>;
  }

  if (!sessionKey) {
    return (
      <div className="flex h-screen items-center justify-center">
        <button
          onClick={() => signIn("github")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Sign in with GitHub
        </button>
        <button
          onClick={() => signIn("google")}
          className="rounded bg-white px-4 py-2 text-black border"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  async function fetchSources(userMessage: string, session_id: string) {
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: userMessage,
          session_id,
        }),
      });

      if (!res.ok) return [];
      const data = await res.json();
      return (data?.sources ?? []) as Source[];
    } catch {
      return [];
    }
  }

  async function sendMessage() {
    if (!input.trim() || isStreaming || !sessionKey) return;

    setIsStreaming(true);
    const userMessage = input;
    setInput("");

    setMessages((msgs) => [
      ...msgs,
      { role: "user", content: userMessage },
      { role: "assistant", content: "", sources: [] },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: userMessage,
          session_id: sessionKey,
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        text += decoder.decode(value);
        setMessages((msgs) => {
          const updated = [...msgs];
          // last message is the assistant placeholder we appended
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: text,
          };
          return updated;
        });
      }

      // ✅ After streaming is done, fetch sources and attach to the last assistant message
      const sources = await fetchSources(userMessage, sessionKey);

      setMessages((msgs) => {
        const updated = [...msgs];
        // attach to the last assistant message
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "assistant") {
            updated[i] = { ...updated[i], sources };
            break;
          }
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  async function clearChat() {
    if (!sessionKey) return;

    await fetch("/api/clear-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionKey,
      }),
    });

    setMessages([{ role: "assistant", content: "Chat cleared. How can I help?" }]);
  }

  return (
    <div className="flex h-screen justify-center bg-gray-100">
      <div className="flex w-full max-w-2xl flex-col bg-white shadow-lg">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <span className="font-semibold">💬 Chatbot</span>

          <div className="flex items-center gap-3">
            <button
              onClick={clearChat}
              className="text-sm text-red-600 hover:underline"
            >
              Clear chat
            </button>

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-sm text-gray-700 hover:underline"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="px-4 py-1 text-xs text-gray-500">
          Signed in as {session?.user?.email ?? session?.user?.name}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white"
                    : "bg-green-200 text-gray-900"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    <MarkdownMessage content={msg.content} />

                    {/* ✅ Sources */}
                    {!!msg.sources?.length && (
                      <div className="mt-3 border-t border-black/10 pt-2 text-xs text-gray-700">
                        <div className="font-semibold mb-1">Sources</div>
                        <ul className="space-y-2">
                          {msg.sources.map((s, idx) => (
                            <li key={idx}>
                              <div className="font-medium">
                                [{idx + 1}]{" "}
                                <a
                                  href={`http://localhost:8001/files?path=${encodeURIComponent(s.source)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 underline hover:text-blue-800"
                                >
                                  {s.source}
                                </a>
                                {s.page ? ` (p. ${s.page})` : ""}
                              </div>
                              {!!s.snippet && (
                                <div className="opacity-80">{s.snippet}</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  msg.content
                )}
              </div>
            </div>
            
          ))}

          {isStreaming && (
            <div className="text-sm text-gray-500 italic">
              Assistant is typing…
            </div>
          )}
        </div>

        <div className="border-t p-3 flex gap-2">
          <input
            disabled={isStreaming}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message…"
            className="flex-1 rounded border px-3 py-2 focus:outline-none focus:ring disabled:bg-gray-100"
          />
          <button
            disabled={isStreaming}
            onClick={sendMessage}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
