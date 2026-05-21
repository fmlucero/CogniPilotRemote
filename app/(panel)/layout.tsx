import Link from "next/link";
import { requireUser } from "@/lib/dal";
import Sidebar from "./components/Sidebar";
import LogoutButton from "./components/LogoutButton";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="admin-shell">
      <Sidebar rol={user.rol} />

      <div className="admin-main">
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
