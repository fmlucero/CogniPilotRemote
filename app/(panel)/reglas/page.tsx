// HU-04 — CRUD de reglas para admin/supervisor.

import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import ReglasView, { type Regla, type EmpresaOption } from "./ReglasView";

export const dynamic = "force-dynamic";

interface EmpresaFromBack {
  id: string;
  nombre: string;
}

export default async function ReglasPage() {
  const me = await requireRole("admin_sistema", "supervisor");

  const reglasData = await serverFetch<{ reglas: Regla[] }>("/api/reglas");

  // Admin necesita la lista de empresas para el dropdown del form de creación.
  let empresas: EmpresaOption[] = [];
  if (me.rol === "admin_sistema") {
    const empresasData = await serverFetch<{ empresas: EmpresaFromBack[] }>("/api/empresas");
    empresas = empresasData.empresas.map((e) => ({ id: e.id, nombre: e.nombre }));
  } else if (me.empresaId) {
    empresas = [{ id: me.empresaId, nombre: "(tu empresa)" }];
  }

  return (
    <ReglasView
      initial={reglasData.reglas}
      viewerRol={me.rol}
      viewerEmpresaId={me.empresaId ?? null}
      empresas={empresas}
    />
  );
}
