import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import EmpresasView from "./EmpresasView";

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

  const empresas = await prisma.empresa.findMany({
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
    include: { _count: { select: { usuarios: true, rutas: true, reglas: true } } },
  });

  // Serializar para client component (Date → number, JSON intacto)
  const initial = empresas.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    cuit: e.cuit,
    contacto: e.contacto as { email?: string; telefono?: string; direccion?: string } | null,
    activa: e.activa,
    createdAt: e.createdAt.getTime(),
    counts: e._count,
  }));

  return <EmpresasView initial={initial} />;
}
