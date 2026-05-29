// HU-50 — CRUD de rutas para admin/supervisor/gerente.

import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import RutasView, { type RutaListItem, type EmpresaOption } from "./RutasView";

export const dynamic = "force-dynamic";

interface EmpresaFromBack {
  id: string;
  nombre: string;
}

export default async function RutasPage() {
  const me = await requireRole("admin_sistema", "supervisor", "gerente");

  const data = await serverFetch<{ rutas: RutaListItem[] }>("/api/rutas");

  // Admin necesita la lista de empresas para el dropdown del form. Supervisor y
  // gerente operan en su propia empresa (no pueden leer /api/empresas, que es
  // admin-only), así que les pasamos su empresaId directamente.
  let empresas: EmpresaOption[] = [];
  if (me.rol === "admin_sistema") {
    const ed = await serverFetch<{ empresas: EmpresaFromBack[] }>("/api/empresas");
    empresas = ed.empresas.map((e) => ({ id: e.id, nombre: e.nombre }));
  } else if (me.empresaId) {
    empresas = [{ id: me.empresaId, nombre: "(tu empresa)" }];
  }

  return (
    <RutasView
      initial={data.rutas}
      viewerRol={me.rol}
      viewerEmpresaId={me.empresaId ?? null}
      empresas={empresas}
    />
  );
}
