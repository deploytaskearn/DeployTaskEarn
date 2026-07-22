"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import api from "@/lib/admin-api";

const COLOR_FIELDS = [
  { key: "color_bg", label: "Background (dark)", default: "#0A0F0D" },
  { key: "color_bg2", label: "Background 2 (sections)", default: "#111A14" },
  { key: "color_surface", label: "Surface (cards/light)", default: "#F5F2EA" },
  { key: "color_accent", label: "Primary accent (green)", default: "#00C875" },
  { key: "color_accent_dim", label: "Accent hover", default: "#009E5C" },
  { key: "color_gold", label: "Gold / Premium color", default: "#F4C842" },
  { key: "color_alert", label: "Alert / Warning", default: "#E8633A" },
  { key: "color_muted", label: "Muted text", default: "#8A8F87" },
  { key: "color_ink", label: "Ink (text on light bg)", default: "#0E1C15" },
];

const TEXT_FIELDS = [
  { key: "site_name", label: "Site name", placeholder: "TaskEarn" },
  { key: "site_tagline", label: "Hero tagline (line 1)", placeholder: "Complete tasks." },
  { key: "site_tagline2", label: "Hero tagline (line 2, colored)", placeholder: "Earn real money." },
  { key: "site_description", label: "Hero description", placeholder: "Surveys, app installs..." },
  { key: "site_footer_text", label: "Footer text", placeholder: "© 2025 TaskEarn" },
  { key: "site_referral_pct", label: "Referral bonus %", placeholder: "5" },
  { key: "site_min_withdrawal", label: "Min withdrawal (₨)", placeholder: "500" },
  { key: "whatsapp_number", label: "WhatsApp number (country code, no +)", placeholder: "923001234567" },
  { key: "whatsapp_group_link", label: "WhatsApp group invite link", placeholder: "https://chat.whatsapp.com/…" },
];

async function saveSetting(key: string, value: string) {
  await api.post("/cms/admin/settings", { key, value });
}

export default function AdminCustomizePage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [certDragOver, setCertDragOver] = useState(false);
  const certInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    api.get("/cms/settings").then((r) => setValues(r.data)).catch(() => {});
  }, []);

  function set(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (key.startsWith("color_")) {
      document.documentElement.style.setProperty(`--${key.replace(/_/g, "-")}`, val);
    }
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(async () => {
      setSavingKey(key);
      setError(null);
      try {
        await saveSetting(key, val);
        setSavedKey(key);
        setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
      } catch {
        setError(`Failed to save "${key}"`);
      } finally {
        setSavingKey((k) => (k === key ? null : k));
      }
    }, 600);
  }

  async function uploadLogo(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Only image files allowed (JPG, PNG, SVG, WebP, GIF)");
      return;
    }
    setLogoUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("logo", file);
      const res = await api.post("/admin/upload/logo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url: string = res.data.url;
      // Save the URL as site_logo setting
      setValues((prev) => ({ ...prev, site_logo: url }));
      await saveSetting("site_logo", url);
      setSavedKey("site_logo");
      setTimeout(() => setSavedKey((k) => (k === "site_logo" ? null : k)), 3000);
    } catch {
      setError("Logo upload failed. Check file size (max 5MB).");
    } finally {
      setLogoUploading(false);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadLogo(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadLogo(file);
  }

  function removeLogo() {
    setValues((prev) => ({ ...prev, site_logo: "" }));
    saveSetting("site_logo", "").catch(() => {});
  }

  async function uploadCertificate(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Only image files allowed (JPG, PNG, WebP)");
      return;
    }
    setCertUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("logo", file);
      const res = await api.post("/admin/upload/logo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url: string = res.data.url;
      setValues((prev) => ({ ...prev, fbr_certificate_url: url }));
      await saveSetting("fbr_certificate_url", url);
      setSavedKey("fbr_certificate_url");
      setTimeout(() => setSavedKey((k) => (k === "fbr_certificate_url" ? null : k)), 3000);
    } catch {
      setError("Certificate upload failed. Check file size (max 5MB).");
    } finally {
      setCertUploading(false);
    }
  }

  function onCertFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadCertificate(file);
    e.target.value = "";
  }

  function onCertDrop(e: React.DragEvent) {
    e.preventDefault();
    setCertDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadCertificate(file);
  }

  function removeCertificate() {
    setValues((prev) => ({ ...prev, fbr_certificate_url: "" }));
    saveSetting("fbr_certificate_url", "").catch(() => {});
  }

  function reset() {
    COLOR_FIELDS.forEach((f) => set(f.key, f.default));
  }

  const logoUrl = values["site_logo"];
  const certUrl = values["fbr_certificate_url"];
  const waNumber = values["whatsapp_number"];
  const BACKEND = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:4000';

  const PRESET_LOGOS = [
    { label: "Dark logo",  url: `${BACKEND}/uploads/taskearn-logo-dark.svg`,  bg: "#0A0F0D" },
    { label: "Light logo", url: `${BACKEND}/uploads/taskearn-logo-light.svg`, bg: "#F5F2EA" },
    { label: "Mark",       url: `${BACKEND}/uploads/taskearn-mark.svg`,       bg: "#0A0F0D" },
    { label: "Icon tile",  url: `${BACKEND}/uploads/taskearn-icon-tile.svg`,  bg: "#0A0F0D" },
  ];

  return (
    <div>
      <AdminPageHeader title="Site Customization" subtitle="Changes save automatically. No Save button needed." />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)", border: "1px solid rgba(232,99,58,0.2)" }}>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* ── Logo Upload ── */}
      <div className="mb-8 rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--color-surface)" }}>Site Logo</h3>
        <div className="flex flex-wrap items-start gap-6">
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-2xl transition-all"
            style={{
              width: 160, height: 120,
              background: dragOver ? "rgba(0,200,117,0.08)" : "rgba(255,255,255,0.04)",
              border: dragOver ? "2px dashed var(--color-accent)" : "2px dashed rgba(255,255,255,0.15)",
            }}
          >
            {logoUploading ? (
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>Uploading…</div>
            ) : (
              <>
                <Upload size={22} style={{ color: "var(--color-muted)" }} />
                <div className="text-xs text-center px-2" style={{ color: "rgba(245,242,234,0.45)" }}>
                  Click or drag<br />JPG · PNG · SVG · WebP
                </div>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileInput} />

          {/* Current logo preview */}
          {/* Preset logos gallery */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium mb-1" style={{ color: "rgba(245,242,234,0.45)" }}>Or pick a preset:</div>
            <div className="flex flex-wrap gap-2">
              {PRESET_LOGOS.map((p) => (
                <button
                  key={p.url}
                  onClick={() => {
                    setValues((prev) => ({ ...prev, site_logo: p.url }));
                    saveSetting("site_logo", p.url).then(() => {
                      setSavedKey("site_logo");
                      setTimeout(() => setSavedKey((k) => k === "site_logo" ? null : k), 2000);
                    }).catch(() => {});
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-105"
                  style={{
                    background: p.bg,
                    border: logoUrl === p.url ? "2px solid var(--color-accent)" : "1px solid rgba(255,255,255,0.1)",
                    width: 90, minHeight: 60,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.label} style={{ width: 70, height: 36, objectFit: "contain" }} />
                  <span className="text-[10px]" style={{ color: p.bg === "#F5F2EA" ? "#0E1C15" : "rgba(245,242,234,0.5)" }}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {logoUrl ? (
            <div className="relative flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Current logo"
                className="rounded-xl object-contain"
                style={{ width: 120, height: 80, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: 8 }}
              />
              <div className="text-xs font-medium" style={{ color: savedKey === "site_logo" ? "var(--color-accent)" : "rgba(245,242,234,0.5)" }}>
                {savedKey === "site_logo" ? "✓ Saved & live" : "Current logo"}
              </div>
              <button
                onClick={removeLogo}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "var(--color-alert)", color: "#fff" }}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col justify-center gap-1">
              <div className="text-sm font-medium" style={{ color: "rgba(245,242,234,0.6)" }}>No logo uploaded</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.35)" }}>Shows ₨ symbol by default</div>
              <div className="text-xs mt-1" style={{ color: "rgba(245,242,234,0.35)" }}>Max size: 5 MB</div>
            </div>
          )}
        </div>
      </div>

      {/* ── FBR Certificate Upload ── */}
      <div className="mb-8 rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--color-surface)" }}>FBR Registration Certificate</h3>
        <p className="text-xs mb-4" style={{ color: "rgba(245,242,234,0.45)" }}>Shown as a trust badge on the user dashboard. Upload a clear photo or scan of the certificate.</p>
        <div className="flex flex-wrap items-start gap-6">
          <div
            onClick={() => certInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setCertDragOver(true); }}
            onDragLeave={() => setCertDragOver(false)}
            onDrop={onCertDrop}
            className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-2xl transition-all"
            style={{
              width: 160, height: 120,
              background: certDragOver ? "rgba(0,200,117,0.08)" : "rgba(255,255,255,0.04)",
              border: certDragOver ? "2px dashed var(--color-accent)" : "2px dashed rgba(255,255,255,0.15)",
            }}
          >
            {certUploading ? (
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>Uploading…</div>
            ) : (
              <>
                <Upload size={22} style={{ color: "var(--color-muted)" }} />
                <div className="text-xs text-center px-2" style={{ color: "rgba(245,242,234,0.45)" }}>
                  Click or drag<br />JPG · PNG · WebP
                </div>
              </>
            )}
          </div>
          <input ref={certInputRef} type="file" accept="image/*" className="hidden" onChange={onCertFileInput} />

          {certUrl ? (
            <div className="relative flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={certUrl}
                alt="FBR certificate"
                className="rounded-xl object-cover"
                style={{ width: 120, height: 120, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <div className="text-xs font-medium" style={{ color: savedKey === "fbr_certificate_url" ? "var(--color-accent)" : "rgba(245,242,234,0.5)" }}>
                {savedKey === "fbr_certificate_url" ? "✓ Saved & live" : "Current certificate"}
              </div>
              <button
                onClick={removeCertificate}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "var(--color-alert)", color: "#fff" }}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col justify-center gap-1">
              <div className="text-sm font-medium" style={{ color: "rgba(245,242,234,0.6)" }}>No certificate uploaded</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.35)" }}>Badge is hidden from users until one is set</div>
              <div className="text-xs mt-1" style={{ color: "rgba(245,242,234,0.35)" }}>Max size: 5 MB</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Colors */}
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-surface)" }}>Colors</h3>
            <button onClick={reset} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,242,234,0.6)" }}>
              Reset defaults
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {COLOR_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={values[f.key] || f.default}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: "rgba(245,242,234,0.8)" }}>{f.label}</div>
                  <div className="font-mono text-xs" style={{ color: "rgba(245,242,234,0.35)" }}>{values[f.key] || f.default}</div>
                </div>
                {savingKey === f.key && <span className="text-xs" style={{ color: "var(--color-muted)" }}>saving…</span>}
                {savedKey === f.key && <span className="text-xs" style={{ color: "var(--color-accent)" }}>✓</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Text & Content */}
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="font-semibold text-sm mb-5" style={{ color: "var(--color-surface)" }}>Text & Content</h3>
          <div className="flex flex-col gap-4">
            {TEXT_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium" style={{ color: "rgba(245,242,234,0.55)" }}>{f.label}</label>
                  {savingKey === f.key && <span className="text-xs" style={{ color: "var(--color-muted)" }}>saving…</span>}
                  {savedKey === f.key && <span className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>✓ Saved</span>}
                </div>
                <input
                  type="text"
                  value={values[f.key] || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: savedKey === f.key ? "1px solid rgba(0,200,117,0.4)" : "1px solid rgba(255,255,255,0.1)",
                    color: "var(--color-surface)",
                    transition: "border-color 0.3s",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live color preview */}
      <div className="mt-8 rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-medium mb-4" style={{ color: "rgba(245,242,234,0.45)" }}>Live color preview</div>
        <div className="flex flex-wrap gap-3">
          {COLOR_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md border" style={{ background: values[f.key] || f.default, borderColor: "rgba(255,255,255,0.1)" }} />
              <span className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp status */}
      {waNumber && (
        <div className="mt-6 rounded-xl p-4 flex items-center gap-3" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.2)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#25D366" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: "#25D366" }}>WhatsApp support active</div>
            <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>+{waNumber}</div>
          </div>
          <a
            href={`https://wa.me/${waNumber.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: "#25D366", color: "#fff" }}
          >
            Test →
          </a>
        </div>
      )}
    </div>
  );
}
