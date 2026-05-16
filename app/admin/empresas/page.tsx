import { serverFetch } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import EmpresasView from "./EmpresasView";

interface EmpresaFromBack {
  id: string;
  nombre: string;
  cuit: string;
  contacto: { email?: string; telefono?: string; direccion?: string } | null;
  activa: boolean;
  createdAt: string;  // ISO datetime serializado por FastAPI
  _count: { usuarios: number; rutas: number; reglas: number };
}

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const user = await getAuthUser();
  // Layout ya redirige si no hay user. Acá filtramos por rol.
  if (user?.rol !== "admin_sistema") {
    return (
      <>
        <div className="page-header">
          <div>
            <h2>Empresas</h2>
            <div className="page-subtitle">Acceso restringido</div>
          </div>
        </div>
        <div className="admin-card">
          <p style={{ color: "var(--text-faint)", padding: "2rem 0", textAlign: "center" }}>
            Esta sección es exclusiva del administrador del sistema.
          </p>
        </div>
      </>
    );
  }

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
