"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import axios from "axios";
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
      const res = await adminApi.get("/auth/admin-me");
      setAdmin(res.data);
    } catch (err) {
      // Only a genuine 401 (token actually rejected) means the session is
      // really over — a network hiccup or transient 500 on this check must
      // never wipe a valid token and silently bounce the admin to login.
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        localStorage.removeItem("taskearn_admin_token");
        setAdmin(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the current admin on mount is the correct, standard pattern here
    refresh();
  }, []);

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
