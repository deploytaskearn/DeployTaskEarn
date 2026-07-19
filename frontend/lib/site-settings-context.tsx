"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api, { uploadUrl } from "@/lib/api";

interface SiteSettings {
  site_name?: string;
  site_logo?: string;
  whatsapp_number?: string;
  [key: string]: string | undefined;
}

const SiteSettingsContext = createContext<SiteSettings>({});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});

  useEffect(() => {
    api.get("/cms/settings").then((r) => {
      const s: SiteSettings = r.data;
      if (s.site_logo && !s.site_logo.startsWith("http")) {
        s.site_logo = uploadUrl(s.site_logo) ?? s.site_logo;
      }
      if (s.fbr_certificate_url && !s.fbr_certificate_url.startsWith("http")) {
        s.fbr_certificate_url = uploadUrl(s.fbr_certificate_url) ?? s.fbr_certificate_url;
      }
      setSettings(s);

      // Apply color CSS vars
      const root = document.documentElement;
      const COLOR_KEYS = ["color_bg","color_bg2","color_surface","color_surface_dim","color_accent","color_accent_dim","color_gold","color_alert","color_muted","color_ink"];
      for (const key of COLOR_KEYS) {
        if (s[key]) root.style.setProperty(`--${key.replace(/_/g, "-")}`, s[key]!);
      }
      if (s.site_name) document.title = s.site_name;
    }).catch(() => {});
  }, []);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
