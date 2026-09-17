import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { validateApiKey } from "@/lib/api-auth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import QRCode from "qrcode";
import { COMPLEMENTARY_COLORS } from "@/lib/colors";

const getMonthLabel = (date: Date) => {
  const lbl = format(date, "MMM yyyy", { locale: es });
  return lbl.charAt(0).toUpperCase() + lbl.slice(1);
};

export async function GET(request: Request) {
  const auth = validateApiKey(request);
  if (!auth.isValid) {
    return auth.response!;
  }

  try {
    const { db } = getFirebaseAdmin();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const campaign = searchParams.get("campaign");
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);

    let query: FirebaseFirestore.Query = db.collection("generated_links");

    if (month) {
      query = query.where("monthYear", "==", month);
    }
    if (campaign) {
      query = query.where("campaign.name", "==", campaign);
    }

    query = query.orderBy("createdAt", "desc").limit(limitParam);

    const snapshot = await query.get();
    const links = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      total: links.length,
      links,
    });
  } catch (error: any) {
    console.error("Error al consultar links:", error);
    return NextResponse.json(
      { error: error?.message || "Error interno al consultar links" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = validateApiKey(request);
  if (!auth.isValid) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const {
      originalUrl: rawOriginalUrl,
      campaignName,
      sourceName,
      mediumName,
      linkName: rawLinkName,
      tags = [],
      saveNewTags = true,
      generateBitly = true,
      generateQR = false,
      qrTarget = "bitly",
      monthYear: customMonthYear,
      allowDuplicate = false,
    } = body;

    if (!campaignName || !sourceName || !mediumName) {
      return NextResponse.json(
        { error: "campaignName, sourceName y mediumName son campos obligatorios." },
        { status: 400 }
      );
    }

    const { db } = getFirebaseAdmin();
    const finalMonthYear = customMonthYear || getMonthLabel(new Date());

    // 1. Resolver URL y Nombre del enlace (soporte para links genéricos de la app)
    let finalUrl = rawOriginalUrl ? rawOriginalUrl.trim() : "";
    let finalLinkName = rawLinkName ? rawLinkName.trim() : "";
    let genericLinkId: string | null = null;

    // Si no enviaron URL pero sí linkName, o viceversa, buscar en links genéricos guardados
    const linksSnap = await db.collection("links").get();
    const dbGenericLinks = linksSnap.docs.map((doc) => ({
      id: doc.id,
      name: (doc.data().name || "") as string,
      url: (doc.data().url || "") as string,
    }));

    if (!finalUrl && finalLinkName) {
      const searchWords = finalLinkName
        .toLowerCase()
        .split(/[\s-]+/)
        .filter(Boolean);

      // Coincidencia exacta o donde estén todas las palabras clave
      const match =
        dbGenericLinks.find(
          (l) => l.name.toLowerCase() === finalLinkName.toLowerCase()
        ) ||
        dbGenericLinks.find((l) => {
          const lName = l.name.toLowerCase();
          return searchWords.every((w) => lName.includes(w));
        }) ||
        dbGenericLinks.find((l) => {
          const lName = l.name.toLowerCase();
          return searchWords.some((w) => lName.includes(w));
        });

      if (match) {
        finalUrl = match.url;
        finalLinkName = match.name;
        genericLinkId = match.id;
      }
    } else if (finalUrl) {
      const match = dbGenericLinks.find(
        (l) => l.url.replace(/\/$/, "") === finalUrl.replace(/\/$/, "")
      );
      if (match) {
        if (!finalLinkName) finalLinkName = match.name;
        genericLinkId = match.id;
      }
    }

    if (!finalUrl) {
      return NextResponse.json(
        {
          error:
            "No se proporcionó originalUrl y no se encontró ningún link genérico guardado que coincida con el nombre indicado.",
        },
        { status: 400 }
      );
    }

    // Asegurar protocolo https:// si no viene en el link
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }

    if (!finalLinkName) {
      finalLinkName = "Enlace";
    }

    // 2. Campaña: buscar o crear
    const campQuery = await db.collection("campaigns").get();
    let matchedCamp = campQuery.docs.find(
      (d) => d.data().name.toLowerCase() === campaignName.trim().toLowerCase()
    );
    let campaignId = matchedCamp ? matchedCamp.id : "";
    let finalCampaignName = matchedCamp ? matchedCamp.data().name : campaignName.trim();

    if (!matchedCamp) {
      const newCampRef = await db.collection("campaigns").add({
        name: finalCampaignName,
      });
      campaignId = newCampRef.id;
    }

    // 3. Fuente (Source): buscar o crear
    const sourceQuery = await db.collection("sources").get();
    let matchedSource = sourceQuery.docs.find(
      (d) => d.data().name.toLowerCase() === sourceName.trim().toLowerCase()
    );
    let sourceId = matchedSource ? matchedSource.id : "";
    let finalSourceName = matchedSource ? matchedSource.data().name : sourceName.trim();

    if (!matchedSource) {
      const newSourceRef = await db.collection("sources").add({
        name: finalSourceName,
      });
      sourceId = newSourceRef.id;
    }

    // 4. Medio (Medium): buscar o crear vinculado a la fuente
    const medQuery = await db
      .collection("mediums")
      .where("parentId", "==", sourceId)
      .get();
    let matchedMed = medQuery.docs.find(
      (d) => d.data().name.toLowerCase() === mediumName.trim().toLowerCase()
    );
    let mediumId = matchedMed ? matchedMed.id : "";
    let finalMediumName = matchedMed ? matchedMed.data().name : mediumName.trim();

    if (!matchedMed) {
      const newMedRef = await db.collection("mediums").add({
        name: finalMediumName,
        parentId: sourceId,
      });
      mediumId = newMedRef.id;
    }

    // 5. Verificar duplicados en el mismo mes si allowDuplicate es false
    if (!allowDuplicate) {
      const duplicateSnap = await db
        .collection("generated_links")
        .where("monthYear", "==", finalMonthYear)
        .where("campaign.name", "==", finalCampaignName)
        .where("linkName.name", "==", finalLinkName)
        .where("source.name", "==", finalSourceName)
        .where("medium.name", "==", finalMediumName)
        .limit(1)
        .get();

      if (!duplicateSnap.empty) {
        const existingDoc = duplicateSnap.docs[0];
        return NextResponse.json({
          message: "Este link ya existía en la base de datos para este mes.",
          isDuplicate: true,
          link: {
            id: existingDoc.id,
            ...existingDoc.data(),
          },
        });
      }
    }

    // 6. Tags: procesar y persistir nuevos tags si saveNewTags es true
    const tagsSnap = await db.collection("tags").get();
    const existingTags = tagsSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name as string,
    }));

    const finalTagsList: string[] = [];
    let newTagIdx = 0;
    for (const rawTag of tags) {
      const tName = String(rawTag).trim();
      if (!tName) continue;
      finalTagsList.push(tName);

      const exists = existingTags.some(
        (et) => et.name.toLowerCase() === tName.toLowerCase()
      );
      if (!exists && saveNewTags) {
        const colorIndex =
          (existingTags.length + newTagIdx) % COMPLEMENTARY_COLORS.length;
        await db.collection("tags").add({
          name: tName,
          color: COMPLEMENTARY_COLORS[colorIndex],
        });
        existingTags.push({ id: "new", name: tName });
        newTagIdx++;
      }
    }

    // 7. Construir URL UTM
    const urlObj = new URL(finalUrl);
    urlObj.searchParams.set("utm_source", finalSourceName);
    urlObj.searchParams.set("utm_medium", finalMediumName);
    urlObj.searchParams.set("utm_campaign", finalCampaignName);
    const utmUrl = urlObj.toString();

    // 8. Bitly (opcional)
    let bitlyUrl: string | null = null;
    if (generateBitly) {
      const bitlyToken = process.env.BITLY_ACCESS_TOKEN;
      if (bitlyToken) {
        try {
          const bitlyRes = await fetch("https://api-ssl.bitly.com/v4/bitlinks", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${bitlyToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              long_url: utmUrl,
              domain: "bit.ly",
              title: `${finalCampaignName} - ${finalLinkName} - ${finalSourceName} - ${finalMediumName}`,
            }),
          });
          if (bitlyRes.ok) {
            const bitlyData = await bitlyRes.json();
            bitlyUrl = bitlyData.link;
          } else {
            console.error("Bitly API response error:", await bitlyRes.text());
          }
        } catch (bitlyErr) {
          console.error("Error al acortar con Bitly:", bitlyErr);
        }
      } else {
        console.warn("BITLY_ACCESS_TOKEN no configurado.");
      }
    }

    // 9. QR Code (opcional)
    let qrDataUrl: string | null = null;
    const hasQR = Boolean(generateQR);
    const resolvedQrTarget: "bitly" | "utm" =
      qrTarget === "bitly" && bitlyUrl ? "bitly" : "utm";

    if (hasQR) {
      const targetForQr = resolvedQrTarget === "bitly" ? bitlyUrl! : utmUrl;
      qrDataUrl = await QRCode.toDataURL(targetForQr, { width: 512, margin: 2 });
    }

    // 10. Guardar en Firestore 'generated_links'
    const newLinkData = {
      monthYear: finalMonthYear,
      campaign: { id: campaignId, name: finalCampaignName },
      linkName: {
        id: genericLinkId || "custom",
        name: finalLinkName,
      },
      source: { id: sourceId, name: finalSourceName },
      medium: { id: mediumId, name: finalMediumName },
      tags: finalTagsList,
      utmUrl,
      originalUrl: finalUrl,
      bitlyUrl,
      hasQR,
      qrSource: hasQR ? resolvedQrTarget : null,
      createdAt: Date.now(),
    };

    const docRef = await db.collection("generated_links").add(newLinkData);

    return NextResponse.json({
      message: "Link generado y guardado exitosamente.",
      isDuplicate: false,
      link: {
        id: docRef.id,
        ...newLinkData,
        qrDataUrl: qrDataUrl || undefined,
      },
    });
  } catch (error: any) {
    console.error("Error al crear link:", error);
    return NextResponse.json(
      { error: error?.message || "Error interno al crear el enlace" },
      { status: 500 }
    );
  }
}
