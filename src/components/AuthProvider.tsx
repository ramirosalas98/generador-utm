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
        // Validar el dominio de FAVA
        if (currentUser.email && currentUser.email.endsWith("@grupofava.com.ar")) {
          setUser(currentUser);
        } else {
          // Si no es de FAVA, lo deslogueamos
          await signOut(auth);
          setUser(null);
          alert("Acceso denegado. Solo se permiten correos de @grupofava.com.ar");
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
