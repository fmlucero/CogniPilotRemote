import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Bookmarks viejos a /admin/* — 308 permanentes a las rutas nuevas.
    return [
      { source: "/admin",          destination: "/dashboard", permanent: true },
      { source: "/admin/empresas", destination: "/empresas",  permanent: true },
      { source: "/admin/usuarios", destination: "/usuarios",  permanent: true },
      { source: "/admin/reglas",   destination: "/reglas",    permanent: true },
      { source: "/admin/reportes", destination: "/reportes",  permanent: true },
    ];
  },
};

export default nextConfig;
