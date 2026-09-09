import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "No autorizado. Token faltante." }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ error: "Error de configuración de seguridad del servidor." }, { status: 500 });
    }
    
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error("Token verification failed:", error);
      return NextResponse.json({ error: "No autorizado. Token inválido." }, { status: 401 });
    }

    const { long_url, title } = await request.json();

    if (!long_url) {
      return NextResponse.json({ error: "long_url es requerido" }, { status: 400 });
    }

    const bitlyToken = process.env.BITLY_ACCESS_TOKEN;
    if (!bitlyToken) {
      return NextResponse.json({ error: "BITLY_ACCESS_TOKEN no configurado" }, { status: 500 });
    }

    const response = await fetch("https://api-ssl.bitly.com/v4/bitlinks", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${bitlyToken}`,
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
