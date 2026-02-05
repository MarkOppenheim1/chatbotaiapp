export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch("http://localhost:8001/chats", {
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
