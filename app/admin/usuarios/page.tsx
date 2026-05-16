import { serverFetch } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import UsuariosView from "./UsuariosView";

interface UsuarioFromBack {
  id: string;
  email: string;
  nombre: string;
  rol: "admin_sistema" | "supervisor" | "gerente" | "repartidor";
  empresaId: string | null;
  empresaNombre: string | null;
  activo: boolean;
  dispositivos: number;
  createdAt: number;  // ms epoch (FastAPI ya lo devuelve así)
}

interface EmpresaShort {
  id: string;
  nombre: string;
}

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

  // El back filtra por rol del que llama: supervisor ve solo su empresa, admin ve todos.
  const usuariosData = await serverFetch<{ usuarios: UsuarioFromBack[] }>("/api/usuarios");

  // Empresas para el dropdown — admin ve todas, supervisor solo necesita la propia
  // pero por consistencia siempre traemos la lista; el endpoint la filtra por rol.
  let empresas: EmpresaShort[] = [];
  if (user.rol === "admin_sistema") {
    const e = await serverFetch<{ empresas: Array<EmpresaShort & { activa: boolean }> }>(
      "/api/empresas",
    );
    empresas = e.empresas.filter((x) => x.activa).map(({ id, nombre }) => ({ id, nombre }));
  } else if (user.empresaId) {
    empresas = [{ id: user.empresaId, nombre: "" }];
  }

  return (
    <UsuariosView
      initial={usuariosData.usuarios}
      empresas={empresas}
      viewerRol={user.rol}
      viewerId={user.sub}
      viewerEmpresaId={user.empresaId}
    />
  );
}
