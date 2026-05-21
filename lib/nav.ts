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
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "▦", roles: ["admin_sistema", "supervisor", "gerente"] },
  { href: "/empresas",  label: "Empresas",  icon: "◐", roles: ["admin_sistema"] },
  { href: "/usuarios",  label: "Usuarios",  icon: "○", roles: ["admin_sistema", "supervisor"] },
  { href: "/reglas",    label: "Reglas",    icon: "⚙", roles: ["admin_sistema", "supervisor"], disabled: true },
  { href: "/reportes",  label: "Reportes",  icon: "▤", roles: ["admin_sistema", "gerente"],    disabled: true },
];

export function homeForRole(rol: Rol): string {
  if (rol === "repartidor") return "/login";
  return "/dashboard";
}

export function isAllowed(rol: Rol, path: string): boolean {
  if (path === "/" || path === "/login") return true;
  const item = NAV_ITEMS.find((i) => path === i.href || path.startsWith(i.href + "/"));
  return item ? item.roles.includes(rol) : false;
}

export function navItemsForRole(rol: Rol): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(rol));
}
