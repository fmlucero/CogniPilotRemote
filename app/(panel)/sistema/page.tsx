// HU-38 base + HU-45..HU-49 — Hub de Infraestructura. Solo admin.
// La home `/sistema` muestra los healthchecks principales (HU-38) y debajo
// un bloque de "Explorar" con cards-link a las sub-secciones técnicas.

import Link from "next/link";
import { requireRole } from "@/lib/dal";
import HealthView from "./HealthView";

export const dynamic = "force-dynamic";

interface SubSection {
  href: string;
  icon: string;
  title: string;
  description: string;
  status?: "available" | "pending";
}

const SUBSECTIONS: SubSection[] = [
  {
    href: "/sistema/containers",
    icon: "📦",
    title: "Containers",
    description: "Inventario completo del stack — imagen, estado, puertos, networks, restarts y uptime de cada container.",
    status: "available",
  },
  {
    href: "/sistema/red",
    icon: "🕸",
    title: "Red y topología",
    description: "Diagrama del flujo de peticiones (Cloudflare → nginx → app/back-api → postgres/redis) con IPs, puertos y networks.",
    status: "available",
  },
  {
    href: "/sistema/peticiones",
    icon: "📡",
    title: "Peticiones HTTP",
    description: "Últimas 100 peticiones recibidas por el back-api con método, path, status, latencia y origen. Auditoría en vivo.",
    status: "available",
  },
  {
    href: "/sistema/worker",
    icon: "⚙",
    title: "Worker async",
    description: "Estado del worker arq: jobs ejecutados, pendientes, fallidos, último resultado. Útil para diagnosticar tareas asíncronas.",
    status: "pending",
  },
  {
    href: "/sistema/version",
    icon: "🏷",
    title: "Versión y build",
    description: "Commit del último deploy, branch, build time y versiones de runtime (Python, Postgres, Redis) — qué hay en producción.",
    status: "pending",
  },
];

export default async function SistemaPage() {
  await requireRole("admin_sistema");
  return (
    <>
      <HealthView />

      <div className="admin-card" style={{ padding: "1rem 1.25rem", marginTop: "1.5rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>Explorar el sistema</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {SUBSECTIONS.map((s) => {
            const isPending = s.status === "pending";
            const inner = (
              <div
                style={{
                  padding: "1rem 1.1rem",
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: ".3rem",
                  opacity: isPending ? 0.55 : 1,
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: ".5rem", fontSize: "1.05rem", fontWeight: 600 }}>
                  <span style={{ fontSize: "1.2rem" }}>{s.icon}</span>
                  <span>{s.title}</span>
                  {isPending && (
                    <span style={{ marginLeft: "auto", fontSize: ".7rem", color: "var(--text-faint)", background: "var(--bg)", padding: ".15rem .4rem", borderRadius: "3px" }}>
                      pronto
                    </span>
                  )}
                </div>
                <p style={{ fontSize: ".82rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                  {s.description}
                </p>
              </div>
            );
            return isPending ? (
              <div key={s.href}>{inner}</div>
            ) : (
              <Link key={s.href} href={s.href} style={{ textDecoration: "none", color: "inherit" }}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
