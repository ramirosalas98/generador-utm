import { NextResponse } from "next/server";

function isBotChallenge(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes("just a moment") ||
    lower.includes("attention required") ||
    lower.includes("cloudflare") ||
    lower.includes("ddos-guard") ||
    lower.includes("security check") ||
    lower.includes("access denied") ||
    lower.includes("robot check")
  );
}

function formatSlugFallback(urlString: string): string {
  try {
    const parsed = new URL(urlString);
    const pathname = parsed.pathname.replace(/\/$/, "");
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return parsed.hostname.replace(/^www\./, "");
    const lastSegment = segments[segments.length - 1];
    // Remove query, hash, .html, etc.
    const cleanSegment = decodeURIComponent(lastSegment).replace(/\.[a-z0-9]+$/i, "");
    // Replace hyphens and underscores with spaces
    const words = cleanSegment.replace(/[-_]+/g, " ").trim();
    if (!words) return parsed.hostname.replace(/^www\./, "");
    // Capitalize words
    return words.replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return urlString;
  }
}

async function fetchFavaTitle(urlObj: URL): Promise<string | null> {
  const pathname = urlObj.pathname.replace(/^\/|\/$/g, "");
  if (!pathname) return "Fava";

  const query = `
    query ResolveRoute($url: String!) {
      route(url: $url) {
        ... on ProductInterface {
          name
          meta_title
        }
        ... on CategoryInterface {
          name
          meta_title
        }
        ... on CmsPage {
          title
          meta_title
        }
      }
    }
  `;

  try {
    const res = await fetch("https://fava.com.ar/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      body: JSON.stringify({
        query,
        variables: { url: pathname }
      }),
      signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) return null;
    const json = await res.json();
    const routeData = json.data?.route;
    if (!routeData) return null;

    return routeData.name || routeData.title || routeData.meta_title || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ title: "" }, { status: 400 });
  }

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ title: url });
  }

  // 1. Manejo específico para Fava (consulta directa a GraphQL de Magento para evitar bloqueo de Cloudflare)
  if (parsedUrl.hostname.includes("fava.com.ar")) {
    const favaTitle = await fetchFavaTitle(parsedUrl);
    if (favaTitle && !isBotChallenge(favaTitle)) {
      return NextResponse.json({ title: favaTitle });
    }
    // Fallback con slug formateado
    return NextResponse.json({ title: formatSlugFallback(url) });
  }

  // 2. Fetch HTML estándar para otros dominios
  try {
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      }
    });

    if (!response.ok) {
      return NextResponse.json({ title: formatSlugFallback(url) });
    }

    const text = await response.text();
    const match = text.match(/<title[^>]*>([^<]*)<\/title>/i);
    let title = match && match[1] ? match[1].trim() : "";

    // Si no hay título o es un desafío antibot (Cloudflare, etc.)
    if (!title || isBotChallenge(title)) {
      return NextResponse.json({ title: formatSlugFallback(url) });
    }

    return NextResponse.json({ title });
  } catch (error) {
    return NextResponse.json({ title: formatSlugFallback(url) });
  }
}

