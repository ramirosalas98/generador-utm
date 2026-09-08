"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import Image from "next/image";
import { useState } from "react";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      // El redireccionamiento lo maneja el AuthProvider
    } catch (err: any) {
      console.error(err);
      setError("Hubo un error al iniciar sesión. Intentá nuevamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-fava-red flex flex-col items-center justify-center p-4">
      <div className="bg-fava-white w-full max-w-md rounded-2xl shadow-fava-elevation p-10 flex flex-col items-center gap-8 text-center">
        
        <Image 
          src="/logo-rojo.png" 
          alt="FAVA" 
          width={150} 
          height={50} 
          className="object-contain"
        />

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-satoshi font-bold text-fava-darkgray">
            Generador de UTM
          </h1>
          <p className="text-fava-mediumgray font-public text-sm">
            Iniciá sesión con tu cuenta corporativa para acceder a la herramienta.
          </p>
        </div>

        {error && (
          <div className="bg-fava-lightred/20 text-fava-red px-4 py-3 rounded-lg text-sm font-public font-medium w-full">
            {error}
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-fava-white border-2 border-fava-lightgray hover:border-fava-red hover:bg-fava-lightgray/10 text-fava-darkgray font-satoshi font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-fava-red border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Ingresar con Google
            </>
          )}
        </button>

      </div>
    </div>
  );
}
