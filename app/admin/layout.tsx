import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import Sidebar from "./components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <div className="admin-shell">
      <Sidebar />

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
            <button id="logout-btn" className="btn-ghost">Salir</button>
          </div>
        </header>

        <div className="admin-content">
          {children}
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.getElementById('logout-btn')?.addEventListener('click', async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            });
          `,
        }}
      />
    </div>
  );
}
