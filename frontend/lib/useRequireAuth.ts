"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-context";

/**
 * Redirects to /login if not authenticated.
 * If requireAdmin is true, also redirects non-admins to /dashboard.
 */
export function useRequireAuth(requireAdmin = false) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requireAdmin && user.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [user, loading, requireAdmin, router]);

  return { user, loading };
}
