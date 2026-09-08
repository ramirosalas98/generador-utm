import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ title: "" }, { status: 400 });
  }

  try {
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
      }
    });
    const text = await response.text();
    const match = text.match(/<title>([^<]*)<\/title>/i);
    let title = match && match[1] ? match[1].trim() : url;
    
    // Some stores format titles like "Product Name - FAVA". Let's optionally clean it up if you want, or just leave it.
    // title = title.replace(/\s*-\s*FAVA.*$/i, '');

    return NextResponse.json({ title });
  } catch (error) {
    // Fallback if fetch fails
    return NextResponse.json({ title: url });
  }
}
