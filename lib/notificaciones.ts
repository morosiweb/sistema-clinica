// Fase 5 (pendiente): conectar un proveedor real (Resend/SendGrid) y, más
// adelante, WhatsApp/SMS. Por ahora solo registramos en el log del servidor
// para no bloquear la Fase 2b (reserva pública) mientras no hay envío real.
export async function enviarLinkPaciente(destino: { email: string | null; nombre: string }, link: string) {
  console.log(`[notificaciones] Link de acceso para ${destino.nombre} (${destino.email ?? "sin email"}): ${link}`);
}
