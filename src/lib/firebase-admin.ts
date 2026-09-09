import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const getAdminAuth = () => {
  if (!getApps().length) {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      console.warn('Falta FIREBASE_PRIVATE_KEY, ignorando admin en build time.');
      return null;
    }
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error) {
      console.error('Error inicializando firebase-admin:', error);
      return null;
    }
  }
  return getAuth();
};
