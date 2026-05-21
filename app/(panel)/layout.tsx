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
            <span className="user-badge">
              👤 {user.email}
              <small>{user.rol}</small>
            </span>
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
