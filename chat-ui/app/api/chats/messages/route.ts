import { BACKEND_URL } from "@/app/lib/backend";

export async function POST(req: Request) {
  const body = await req.json(); // { user_id, chat_id }

  const url = `${BACKEND_URL}/chats/messages?user_id=${encodeURIComponent(body.user_id)}&chat_id=${encodeURIComponent(body.chat_id)}`;
  const res = await fetch(url);
  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
