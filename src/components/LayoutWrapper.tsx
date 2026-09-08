"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import AuthProvider, { useAuth } from "./AuthProvider";
import { auth } from "@/lib/firebase";

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Navbar */}
      <header className="bg-fava-red h-16 flex items-center justify-between px-8 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-6">
          <Image 
            src="/logo-blanco.png" 
            alt="FAVA" 
            width={90} 
            height={30} 
            className="object-contain"
          />
          <div className="h-6 w-px bg-fava-lightgray/50"></div>
          <span className="text-fava-white font-satoshi font-bold text-xl tracking-wide">Generador de UTM</span>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-fava-white hover:text-fava-lightgray transition-colors">
            <Settings size={24} />
          </Link>
          <div className="relative group">
            <button className="w-10 h-10 rounded-full bg-fava-lightgray flex items-center justify-center overflow-hidden hover:ring-2 ring-fava-white transition-all text-fava-darkgray font-satoshi font-bold text-sm uppercase">
              {user?.email ? user.email.substring(0, 2) : "US"}
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-fava-white rounded-md shadow-fava-elevation border border-fava-lightgray opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
              <div className="px-4 py-2 border-b border-fava-lightgray truncate text-xs text-fava-mediumgray">
                {user?.email}
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-full text-left px-4 py-3 text-sm font-medium text-fava-darkgray hover:bg-fava-lightgray/30 hover:text-fava-red flex items-center gap-2"
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-8">
        {children}
      </main>
    </>
  );
}

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  );
}
