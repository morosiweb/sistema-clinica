import { signOut } from "@/lib/auth";

// Si el JWT sigue siendo "válido" pero el usuario ya no existe en la base
// (borrado, o el admin lo desactivó), hay que limpiar la cookie de sesión
// acá (un Server Component no puede) antes de mandar a /login. Sin esto,
// /login redirige de vuelta a "/" porque ve isLoggedIn=true, y "/" vuelve a
// mandar a /login: loop infinito.
export async function GET() {
  return signOut({ redirectTo: "/login" });
}
