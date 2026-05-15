import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import UsuariosView from "./UsuariosView";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const user = await getAuthUser();
  if (user?.rol !== "admin_sistema" && user?.rol !== "supervisor") {
    return (
      <>
        <div className="page-header">
          <div>
            <h2>Usuarios</h2>
            <div className="page-subtitle">Acceso restringido</div>
          </div>
        </div>
        <div className="admin-card">
          <p style={{ color: "var(--text-faint)", padding: "2rem 0", textAlign: "center" }}>
            Esta sección es exclusiva del administrador y supervisores.
          </p>
        </div>
      </>
    );
  }

  const usuariosQuery = await prisma.usuario.findMany({
    where: user.rol === "supervisor" && user.empresaId ? { empresaId: user.empresaId } : {},
    orderBy: [{ activo: "desc" }, { rol: "asc" }, { nombre: "asc" }],
    include: {
      empresa: { select: { id: true, nombre: true } },
      _count: { select: { dispositivos: true } },
    },
  });

  // Para el dropdown de empresas en el form
  const empresas = await prisma.empresa.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  const initial = usuariosQuery.map((u) => ({
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    empresaId: u.empresaId,
    empresaNombre: u.empresa?.nombre ?? null,
    activo: u.activo,
    dispositivos: u._count.dispositivos,
    createdAt: u.createdAt.getTime(),
  }));

  return <UsuariosView initial={initial} empresas={empresas} viewerRol={user.rol} viewerId={user.sub} viewerEmpresaId={user.empresaId} />;
}
