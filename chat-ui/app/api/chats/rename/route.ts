import { BACKEND_URL } from "@/app/lib/backend";

export async function POST(req: Request) {
  const body = await req.json(); // { user_id, chat_id, title }

  const res = await fetch(`${BACKEND_URL}/chats/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
