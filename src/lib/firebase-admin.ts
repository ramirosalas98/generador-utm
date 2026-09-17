import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

export function getFirebaseAdmin(): { app: App; db: Firestore } {
  if (!adminApp) {
    const apps = getApps();
    if (apps.length > 0) {
      adminApp = apps[0];
    } else {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const rawKey = process.env.FIREBASE_PRIVATE_KEY;
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

      if (!clientEmail || !rawKey || !projectId) {
        throw new Error(
          "Faltan variables de entorno para Firebase Admin (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID)"
        );
      }

      // Reemplaza los \n literales si vienen escapados como string
      const privateKey = rawKey.replace(/\\n/g, "\n");

      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
  }

  if (!adminDb) {
    adminDb = getFirestore(adminApp);
  }

  return { app: adminApp, db: adminDb };
}
