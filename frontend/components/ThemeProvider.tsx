"use client";

import { useEffect } from "react";
import api from "@/lib/api";

const COLOR_KEYS = [
  "color_bg", "color_bg2", "color_surface", "color_surface_dim",
  "color_accent", "color_accent_dim", "color_gold", "color_alert",
  "color_muted", "color_ink",
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    api.get("/cms/settings").then((res) => {
      const s = res.data as Record<string, string>;
      const root = document.documentElement;
      for (const key of COLOR_KEYS) {
        const val = s[key];
        if (val) root.style.setProperty(`--${key.replace(/_/g, "-")}`, val);
      }
      if (s.site_name) document.title = s.site_name;
    }).catch(() => {});
  }, []);

  return <>{children}</>;
}
