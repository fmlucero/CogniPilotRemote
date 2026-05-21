import { requireUser } from "@/lib/dal";
import PerfilForm from "./PerfilForm";

const ROL_LABEL: Record<string, string> = {
  admin_sistema: "Admin del sistema",
  supervisor: "Supervisor",
  gerente: "Gerente",
  repartidor: "Repartidor",
};
const ROL_PILL: Record<string, string> = {
  admin_sistema: "rol-admin",
  supervisor: "rol-supervisor",
  gerente: "rol-gerente",
  repartidor: "rol-repartidor",
};

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const user = await requireUser();

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Mi perfil</h2>
          <div className="page-subtitle">Datos de la cuenta y seguridad</div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
        <div className="card-header">
          <h2>Mi cuenta</h2>
          <p className="last-update">Datos básicos del usuario logueado</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div>
            <div className="sidebar-section-label">Email</div>
            <code className="mono" style={{ fontSize: "0.95rem" }}>{user.email}</code>
          </div>
          <div>
            <div className="sidebar-section-label">Rol</div>
            <span className={`pill ${ROL_PILL[user.rol]}`}>{ROL_LABEL[user.rol] ?? user.rol}</span>
          </div>
          <div>
            <div className="sidebar-section-label">Empresa ID</div>
            <code className="mono" style={{ fontSize: "0.85rem" }}>
              {user.empresaId ?? "—"}
            </code>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="card-header">
          <h2>🔐 Cambiar contraseña</h2>
          <p className="last-update">
            Mínimo 8 caracteres. La nueva contraseña debe ser distinta de la actual.
          </p>
        </div>
        <PerfilForm />
      </div>
    </>
  );
}
