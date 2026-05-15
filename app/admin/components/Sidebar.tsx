"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

const items: NavItem[] = [
  { href: "/admin",           label: "Dashboard", icon: "▦" },
  { href: "/admin/empresas",  label: "Empresas",  icon: "◐", disabled: true },
  { href: "/admin/usuarios",  label: "Usuarios",  icon: "○", disabled: true },
  { href: "/admin/reglas",    label: "Reglas",    icon: "⚙", disabled: true },
  { href: "/admin/reportes",  label: "Reportes",  icon: "▤", disabled: true },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">🚚</span>
        <div>
          <div className="sidebar-brand-name">CogniPilot</div>
          <div className="sidebar-brand-tag">Panel admin</div>
        </div>
      </div>

      <nav>
        <div className="sidebar-section-label">Operación</div>
        <div className="sidebar-nav">
          {items.map((item) => {
            const isActive = pathname === item.href;
            const className = [
              isActive ? "active" : "",
              item.disabled ? "disabled" : "",
            ].filter(Boolean).join(" ");
            return (
              <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                className={className}
                aria-disabled={item.disabled}
                tabIndex={item.disabled ? -1 : 0}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        v0.1 · TIF · UM 2025
      </div>
    </aside>
  );
}
