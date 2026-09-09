import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "No autorizado. Token faltante." }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Error de configuración: NEXT_PUBLIC_FIREBASE_API_KEY no encontrada." }, { status: 500 });
    }

    // Verificar ID token contra el Identity Toolkit de Firebase de Google directamente (sin dependencias problemáticas de Node ESM/CJS)
    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.users || verifyData.users.length === 0) {
      console.error("Token verification failed:", verifyData);
      return NextResponse.json({ error: "No autorizado. Token inválido o expirado." }, { status: 401 });
    }

    const email = (verifyData.users[0].email || "").toLowerCase();
    const allowedEmailsStr = process.env.NEXT_PUBLIC_ALLOWED_EMAILS || "";
    const allowedEmails = allowedEmailsStr.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    
    // Si hay correos configurados, validar que el usuario pertenezca
    if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
      return NextResponse.json({ error: `No autorizado. El correo ${email} no tiene permisos.` }, { status: 403 });
    }

    const { long_url, title } = await request.json();

    if (!long_url) {
      return NextResponse.json({ error: "long_url es requerido" }, { status: 400 });
    }

    const bitlyToken = process.env.BITLY_ACCESS_TOKEN;
    if (!bitlyToken) {
      return NextResponse.json({ error: "BITLY_ACCESS_TOKEN no configurado en las variables de entorno." }, { status: 500 });
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
      return NextResponse.json({ 
        error: data.description || data.message || "Error al acortar link con Bitly" 
      }, { status: response.status });
    }

    return NextResponse.json({ link: data.link });
  } catch (error: any) {
    console.error("Internal API Error:", error);
    return NextResponse.json({ error: error?.message || "Error interno del servidor" }, { status: 500 });
  }
}
