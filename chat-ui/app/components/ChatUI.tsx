"use client";

import { useState, useEffect } from "react";
import MarkdownMessage from "./MarkdownMessage";
import { signIn, signOut, useSession } from "next-auth/react";

type Message = {
  role: "user" | "assistant";
  content: string;
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
      </div>
    );
  }

  async function sendMessage() {
    if (!input.trim() || isStreaming || !sessionKey) return;
    
    setIsStreaming(true);
    const userMessage = input;
    setInput("");

    setMessages((msgs) => [
        ...msgs,
        { role: "user", content: userMessage },
        { role: "assistant", content: "" },
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
          updated[updated.length - 1].content = text;
          return updated;
        });
      }
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

    setMessages([
      { role: "assistant", content: "Chat cleared. How can I help?" },
    ]);
  }

  return (
    <div className="flex h-screen justify-center bg-gray-100">
      <div className="flex w-full max-w-2xl flex-col bg-white shadow-lg">

        <div className="border-b px-4 py-3 flex items-center justify-between">
          <span className="font-semibold">💬 Chatbot</span>
          <button
            onClick={clearChat}
            className="text-sm text-red-600 hover:underline"
          >
            Clear chat
          </button>
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
                {msg.role === "assistant" ? (<MarkdownMessage content={msg.content} />) : (msg.content)}
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

