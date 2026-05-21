import { redirect } from "next/navigation";
import { currentUser } from "@/lib/dal";
import { homeForRole } from "@/lib/nav";

// Safety net — el proxy ya redirige `/`. Este page corre si por alguna razón
// el proxy no actuó (matcher excluyente, fallback al renderer, etc.).
export default async function Home() {
  const user = await currentUser();
  if (user && user.rol !== "repartidor") redirect(homeForRole(user.rol));
  redirect("/login");
}
