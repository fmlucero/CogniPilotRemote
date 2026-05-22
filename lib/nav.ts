// Fuente única de verdad para navegación + autorización del panel web.
// Consumido por: proxy.ts (gating de rutas), (panel)/layout.tsx, Sidebar, app/page.tsx.

import type { AccessPayload } from "./jwt";

export type Rol = AccessPayload["rol"];

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Rol[];
  disabled?: boolean;
  /** Si true, está permitido por el proxy pero NO se renderea en el sidebar.
   *  Útil para rutas a las que se accede desde otros lugares (ej. /perfil
   *  vía el badge del topbar, /usuarios/[id] vía un row del listado). */
  hidden?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard", icon: "▦", roles: ["admin_sistema"] },
  { href: "/supervisor", label: "Mi home",   icon: "★", roles: ["supervisor"] },
  { href: "/gerente",    label: "Mi home",   icon: "★", roles: ["gerente"] },
  { href: "/empresas",   label: "Empresas",  icon: "◐", roles: ["admin_sistema"] },
  { href: "/usuarios",   label: "Usuarios",  icon: "○", roles: ["admin_sistema", "supervisor"] },
  { href: "/dispositivos", label: "Dispositivos", icon: "📱", roles: ["admin_sistema", "supervisor"] },
  { href: "/jornada",    label: "Pre-jornada", icon: "🚦", roles: ["admin_sistema", "supervisor", "gerente"] },
  { href: "/incidentes", label: "Incidentes", icon: "⚠", roles: ["admin_sistema", "supervisor"] },
  { href: "/alertas",    label: "Alertas",   icon: "🚨", roles: ["admin_sistema", "supervisor", "gerente"] },
  { href: "/reglas",     label: "Reglas",    icon: "⚙", roles: ["admin_sistema", "supervisor"] },
  { href: "/metricas",   label: "Métricas",  icon: "📊", roles: ["admin_sistema"] },
  { href: "/sistema",    label: "Salud",     icon: "🩺", roles: ["admin_sistema"] },
  { href: "/auditoria",  label: "Auditoría", icon: "🔍", roles: ["admin_sistema"] },
  { href: "/perfil",     label: "Mi perfil", icon: "👤", roles: ["admin_sistema", "supervisor", "gerente"], hidden: true },
];

export function homeForRole(rol: Rol): string {
  if (rol === "repartidor") return "/login";
  if (rol === "supervisor") return "/supervisor";
  if (rol === "gerente") return "/gerente";
  return "/dashboard";
}

export function isAllowed(rol: Rol, path: string): boolean {
  if (path === "/" || path === "/login") return true;
  const item = NAV_ITEMS.find((i) => path === i.href || path.startsWith(i.href + "/"));
  return item ? item.roles.includes(rol) : false;
}

export function navItemsForRole(rol: Rol): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(rol) && !i.hidden);
}
