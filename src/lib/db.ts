import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, where } from "firebase/firestore";
import { db } from "./firebase";

// Tipos para las colecciones de configuración
export type ConfigItem = {
  id: string;
  name: string;
  parentId?: string;
  url?: string;
  color?: string;
};

// Obtenemos los ítems de una colección específica
export const getConfigItems = async (collectionName: string, parentId?: string): Promise<ConfigItem[]> => {
  let q;
  if (parentId) {
    // Solo filtramos acá para evitar pedir índices compuestos en Firebase
    q = query(collection(db, collectionName), where("parentId", "==", parentId));
  } else {
    q = query(collection(db, collectionName));
  }
  
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
    parentId: doc.data().parentId,
    url: doc.data().url,
    color: doc.data().color
  }));

// Ordenamos alfabéticamente en memoria
  return results.sort((a, b) => a.name.localeCompare(b.name));
};

export const addConfigItem = async (collectionName: string, name: string, parentId?: string, url?: string, color?: string): Promise<string> => {
  const data: any = { name };
  if (parentId) data.parentId = parentId;
  if (url) data.url = url;
  if (color) data.color = color;
  const docRef = await addDoc(collection(db, collectionName), data);
  return docRef.id;
};

export const updateConfigItem = async (collectionName: string, id: string, data: Partial<ConfigItem>): Promise<void> => {
  await updateDoc(doc(db, collectionName, id), data);
};

export const deleteConfigItem = async (collectionName: string, id: string): Promise<void> => {
  await deleteDoc(doc(db, collectionName, id));
};

// --- LÓGICA DE ENLACES GENERADOS ---
export type GeneratedLink = {
  id?: string;
  monthYear: string; // ej: "Sep 2026"
  campaign: { id: string; name: string };
  linkName: { id: string; name: string }; // "Link Genérico" o Custom
  source: { id: string; name: string };
  medium: { id: string; name: string };
  tags: string[];
  utmUrl: string;
  bitlyUrl: string | null;
  hasQR: boolean;
  qrSource?: 'bitly' | 'utm' | null;
  createdAt: number;
};

export const saveGeneratedLink = async (linkData: Omit<GeneratedLink, "id">): Promise<string> => {
  const docRef = await addDoc(collection(db, "generated_links"), linkData);
  return docRef.id;
};
