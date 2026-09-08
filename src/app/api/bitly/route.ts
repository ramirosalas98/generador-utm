import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { long_url, title } = await request.json();

    if (!long_url) {
      return NextResponse.json({ error: "long_url es requerido" }, { status: 400 });
    }

    const token = process.env.BITLY_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "BITLY_ACCESS_TOKEN no configurado" }, { status: 500 });
    }

    const response = await fetch("https://api-ssl.bitly.com/v4/shorten", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        long_url,
        domain: "bit.ly",
        title
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Bitly Error:", data);
      return NextResponse.json({ error: data.message || "Error al acortar link" }, { status: response.status });
    }

    return NextResponse.json({ link: data.link });
  } catch (error) {
    console.error("Internal API Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
