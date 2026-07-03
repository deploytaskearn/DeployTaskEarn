"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api from "./api";
import { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; phone?: string; referralCode?: string }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const token = typeof window !== "undefined" ? localStorage.getItem("taskearn_token") : null;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      localStorage.removeItem("taskearn_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the current user on mount is the correct, standard pattern here
    refreshUser();
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("taskearn_token", res.data.token);
    setUser(res.data.user);
    await refreshUser();
    return res.data.user as User;
  }

  async function register(data: { name: string; email: string; password: string; phone?: string; referralCode?: string }) {
    const res = await api.post("/auth/register", data);
    localStorage.setItem("taskearn_token", res.data.token);
    setUser(res.data.user);
    await refreshUser();
    return res.data.user as User;
  }

  function logout() {
    localStorage.removeItem("taskearn_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
