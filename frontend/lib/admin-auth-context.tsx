"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import adminApi from "./admin-api";
import { User } from "./types";

interface AdminAuthValue {
  admin: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const token = typeof window !== "undefined" ? localStorage.getItem("taskearn_admin_token") : null;
    if (!token) { setAdmin(null); setLoading(false); return; }
    try {
      const res = await adminApi.get("/auth/me");
      if (res.data?.role !== "ADMIN") throw new Error("not admin");
      setAdmin(res.data);
    } catch {
      localStorage.removeItem("taskearn_admin_token");
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function login(email: string, password: string): Promise<User> {
    const res = await adminApi.post("/auth/admin-login", { email, password });
    localStorage.setItem("taskearn_admin_token", res.data.token);
    const user = res.data.user as User;
    setAdmin(user);
    return user;
  }

  function logout() {
    localStorage.removeItem("taskearn_admin_token");
    setAdmin(null);
  }

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
