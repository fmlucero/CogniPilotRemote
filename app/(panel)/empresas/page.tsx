import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import EmpresasView from "./EmpresasView";

interface EmpresaFromBack {
  id: string;
  nombre: string;
  cuit: string;
  contacto: { email?: string; telefono?: string; direccion?: string } | null;
  activa: boolean;
  createdAt: string;
  _count: { usuarios: number; rutas: number; reglas: number };
}

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  await requireRole("admin_sistema");

  const data = await serverFetch<{ empresas: EmpresaFromBack[] }>("/api/empresas");

  const initial = data.empresas.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    cuit: e.cuit,
    contacto: e.contacto,
    activa: e.activa,
    createdAt: new Date(e.createdAt).getTime(),
    counts: e._count,
  }));

  return <EmpresasView initial={initial} />;
}
