"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email?.toLowerCase() || "";
        // Leemos los correos permitidos de la variable de entorno y los separamos por coma
        const allowedEmailsStr = process.env.NEXT_PUBLIC_ALLOWED_EMAILS || "";
        const allowedEmails = allowedEmailsStr.split(",").map(e => e.trim().toLowerCase());

        // Validar si el correo está en la lista de permitidos
        if (allowedEmails.includes(email)) {
          setUser(currentUser);
        } else {
          // Si no está en la lista, lo deslogueamos
          await signOut(auth);
          setUser(null);
          alert("Acceso denegado: comunicate con el equipo de Marketing para solicitar acceso");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== "/login") {
        router.push("/login");
      } else if (user && pathname === "/login") {
        router.push("/");
      }
    }
  }, [user, loading, pathname, router]);

  // Si está cargando y no estamos en login, mostramos un loading para evitar parpadeos
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fava-lightgray/25">
        <div className="w-10 h-10 border-4 border-fava-red border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {/* Si no hay usuario y no es login, no renderizamos los children (los bloquea el useEffect y redirige) */}
      {!user && pathname !== "/login" ? null : children}
    </AuthContext.Provider>
  );
}
