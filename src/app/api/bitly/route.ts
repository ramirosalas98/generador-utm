import { NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Conjunto de claves públicas oficiales de Google para validar tokens de Firebase Auth
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "No autorizado. Token faltante." }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return NextResponse.json({ error: "Error de configuración: NEXT_PUBLIC_FIREBASE_PROJECT_ID no configurado." }, { status: 500 });
    }

    let payload: any;
    try {
      const result = await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
      });
      payload = result.payload;
    } catch (err: any) {
      console.error("Token verification failed:", err);
      return NextResponse.json({ error: "No autorizado. Token inválido o expirado." }, { status: 401 });
    }

    const email = (payload.email || "").toLowerCase();
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
