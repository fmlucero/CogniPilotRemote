import Link from "next/link";
import { requireUser } from "@/lib/dal";
import Sidebar from "./components/Sidebar";
import LogoutButton from "./components/LogoutButton";
import ImpersonationBanner from "./components/ImpersonationBanner";
import AlertasBanner from "./components/AlertasBanner";
import AlertaToast from "./components/AlertaToast";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isImpersonation = Boolean(user.impersonated_by);

  return (
    <div className="admin-shell">
      <Sidebar rol={user.rol} />

      <div className="admin-main">
        {isImpersonation && <ImpersonationBanner targetLabel={user.email} />}
        <AlertasBanner rol={user.rol} />
        <AlertaToast rol={user.rol} />
        <header className="admin-topbar">
          <div className="topbar-title">
            <small>Panel</small>
            <h1>CogniPilot Admin</h1>
          </div>
          <div className="topbar-meta">
            <Link href="/perfil" className="user-badge user-badge-link" title="Ir a mi perfil">
              👤 {user.email}
              <small>{user.rol}</small>
            </Link>
            <LogoutButton />
          </div>
        </header>

        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}
