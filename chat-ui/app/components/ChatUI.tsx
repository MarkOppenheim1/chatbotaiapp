"use client";

import { useEffect, useRef, useState } from "react";
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-gray-100">
          <div className="mb-6">
            <div className="text-2xl font-semibold text-gray-900">Welcome</div>
            <div className="mt-1 text-sm text-gray-600">
              Sign in to start chatting.
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => signIn("github")}
              className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-white font-medium shadow-sm transition
                        hover:bg-gray-800 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-gray-900/30"
            >
              {/* GitHub icon */}
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-5 w-5 fill-white"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              Continue with GitHub
            </button>

            <button
              onClick={() => signIn("google")}
              className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-gray-900 font-medium shadow-sm border border-gray-200 transition
                        hover:bg-gray-50 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {/* Google icon */}
              <svg
                aria-hidden="true"
                viewBox="0 0 48 48"
                className="h-5 w-5"
              >
                <path
                  fill="#FFC107"
                  d="M43.611 20.083H42V20H24v8h11.303C33.694 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.273 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917Z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.306 14.691 12.88 19.51C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.273 4 24 4 16.318 4 9.656 8.337 6.306 14.691Z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.121 0 9.795-1.966 13.314-5.168l-6.146-5.202C29.137 35.091 26.705 36 24 36c-5.202 0-9.66-3.319-11.283-7.946l-6.525 5.025C9.505 39.556 16.227 44 24 44Z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611 20.083H42V20H24v8h11.303c-.79 2.216-2.305 4.087-4.256 5.263l.003-.002 6.146 5.202C36.759 39.07 44 34 44 24c0-1.341-.138-2.651-.389-3.917Z"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            By continuing, you agree to our terms and privacy policy.
          </div>
        </div>
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

  function ProfileMenu({
    user,
    onLogout,
  }: {
    user: { name?: string; email?: string; image?: string; provider?: string };
    onLogout: () => void;
  }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    // Close when clicking outside
    useEffect(() => {
      function onDocClick(e: MouseEvent) {
        if (!ref.current) return;
        if (!ref.current.contains(e.target as Node)) setOpen(false);
      }
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const providerLabel =
      user.provider === "google"
        ? "Google"
        : user.provider === "github"
        ? "GitHub"
        : "Account";

    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {user.image ? (
            <img
              src={user.image}
              alt="profile"
              className="h-7 w-7 rounded-full"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-gray-200" />
          )}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4 text-gray-500"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="px-4 py-3">
              <div className="text-sm font-semibold text-gray-900">
                {user.name ?? "Signed in"}
              </div>
              <div className="text-xs text-gray-600">{user.email ?? ""}</div>
              <div className="mt-1 text-[11px] text-gray-500">
                Signed in with {providerLabel}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            <button
              onClick={onLogout}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              role="menuitem"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    );
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

            <ProfileMenu
              user={{
                name: session?.user?.name ?? undefined,
                email: session?.user?.email ?? undefined,
                image: session?.user?.image ?? undefined,
                provider: (session?.user as any)?.provider ?? "unknown",
              }}
              onLogout={() => signOut({ callbackUrl: "/" })}
            />
          </div>
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
