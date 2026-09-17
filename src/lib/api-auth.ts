import { NextResponse } from "next/server";

export function validateApiKey(request: Request): { isValid: boolean; response?: NextResponse } {
  const configuredKey = process.env.API_SECRET_KEY;

  if (!configuredKey) {
    console.error("API_SECRET_KEY no está configurada en las variables de entorno.");
    return {
      isValid: false,
      response: NextResponse.json(
        { error: "Error de configuración en el servidor (API_SECRET_KEY no definida)." },
        { status: 500 }
      ),
    };
  }

  const apiKeyHeader = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");

  let providedKey: string | null = null;
  if (apiKeyHeader) {
    providedKey = apiKeyHeader.trim();
  } else if (authHeader && authHeader.startsWith("Bearer ")) {
    providedKey = authHeader.substring(7).trim();
  }

  if (!providedKey || providedKey !== configuredKey.trim()) {
    return {
      isValid: false,
      response: NextResponse.json(
        { error: "No autorizado. x-api-key inválida o faltante." },
        { status: 401 }
      ),
    };
  }

  return { isValid: true };
}
