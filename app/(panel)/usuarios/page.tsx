import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
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
  createdAt: number;
}

interface EmpresaShort {
  id: string;
  nombre: string;
}

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const user = await requireRole("admin_sistema", "supervisor");

  const usuariosData = await serverFetch<{ usuarios: UsuarioFromBack[] }>("/api/usuarios");

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
