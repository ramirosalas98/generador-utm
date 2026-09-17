import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { validateApiKey } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = validateApiKey(request);
  if (!auth.isValid) {
    return auth.response!;
  }

  try {
    const { db } = getFirebaseAdmin();

    const [campaignsSnap, sourcesSnap, mediumsSnap, tagsSnap, linksSnap] = await Promise.all([
      db.collection("campaigns").get(),
      db.collection("sources").get(),
      db.collection("mediums").get(),
      db.collection("tags").get(),
      db.collection("links").get(),
    ]);

    const campaigns = campaignsSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name as string,
      color: doc.data().color,
    })).sort((a, b) => a.name.localeCompare(b.name));

    const allMediums = mediumsSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name as string,
      parentId: doc.data().parentId as string | undefined,
    })).sort((a, b) => a.name.localeCompare(b.name));

    const sources = sourcesSnap.docs.map((doc) => {
      const sId = doc.id;
      const associatedMediums = allMediums.filter((m) => m.parentId === sId);
      return {
        id: sId,
        name: doc.data().name as string,
        color: doc.data().color,
        mediums: associatedMediums.map((m) => ({ id: m.id, name: m.name })),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const tags = tagsSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name as string,
    })).sort((a, b) => a.name.localeCompare(b.name));

    const genericLinks = linksSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name as string,
      url: doc.data().url as string,
    })).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      campaigns,
      sources,
      allMediums,
      tags,
      genericLinks,
    });
  } catch (error: any) {
    console.error("Error al obtener taxonomía:", error);
    return NextResponse.json(
      { error: error?.message || "Error al obtener taxonomía" },
      { status: 500 }
    );
  }
}
