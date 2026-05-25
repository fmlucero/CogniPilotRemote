"use client";

// HU-49 — Footer global con commit corto del back-api.
// Visible en todo el panel. Click → /sistema/version. Si el endpoint falla
// (Redis o Postgres caído por ejemplo), el footer queda oculto.

import Link from "next/link";
import { useEffect, useState } from "react";

interface VersionResponse {
  service: string;
  git_commit_short: string;
  build_time: string;
}

export default function BuildFooter() {
  const [v, setV] = useState<VersionResponse | null>(null);

  useEffect(() => {
    fetch("/api/system/version", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setV(d))
      .catch(() => { /* silencio: el footer es decoración */ });
  }, []);

  if (!v) return null;
  const buildShort = v.build_time && v.build_time !== "unknown"
    ? v.build_time.slice(0, 10)
    : "—";

  return (
    <Link
      href="/sistema/version"
      style={{
        position: "fixed",
        bottom: 8,
        right: 12,
        fontSize: ".7rem",
        color: "var(--text-faint)",
        textDecoration: "none",
        fontFamily: "var(--font-mono, monospace)",
        background: "var(--bg)",
        padding: ".2rem .55rem",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        opacity: 0.7,
        zIndex: 100,
      }}
      title={`build ${v.build_time}`}
    >
      {v.service}@{v.git_commit_short} · {buildShort}
    </Link>
  );
}
