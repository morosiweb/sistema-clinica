# Correcciones de la revisión del 16/10/2026

| Hallazgo                         | Resolución                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Acceso por DNI                | Código por email registrado, diez minutos, cinco intentos, HMAC y consumo atómico. No se entrega token sin verificar. Alta y reserva se confirman juntas. |
| 2. Notas expuestas               | DTO por rol para listado, detalle y escritura; selección pública sin notas clínicas/internas. Búsqueda administrativa sin ficha ni tokens.                |
| 3. Usuario inactivo              | Páginas y API consultan estado vigente sin confiar solo en JWT.                                                                                           |
| 4. Reservas simultáneas          | Bloqueo transaccional compartido entre todas las escrituras de disponibilidad. Prueba con dos reservas concurrentes en PostgreSQL real.                   |
| 5. Slots inválidos               | Comprobación dentro de la transacción: médico activo, franja, vigencia, duración, futuro y conflictos.                                                    |
| 6. Reactivación                  | Transiciones explícitas; el cancelado solo vuelve a ocupar un slot libre.                                                                                 |
| 7. Cambios públicos concurrentes | Propiedad, versión, estado y anticipación se verifican dentro del bloqueo.                                                                                |
| 8. Visitas futuras/sin relación  | Médico tratante activo y fecha pasada. Primera atención asignada previamente por secretaría.                                                              |
| 9. Zona horaria                  | Conversión centralizada IANA para slots, anticipación, panel, recordatorios y caja.                                                                       |
| 10. Citas ocultas                | Calendario con intervalos y alturas reales, incluso fuera del rango habitual y de franjas de 30 minutos. Cancelados separados de sus reemplazos.          |
| 11. Correo fallido               | Resultado explícito, error persistido, continuación/reintento, bloqueo e idempotencia.                                                                    |
| 12. Reprogramación/recordatorio  | Reinicia marca y error e incluye enlace de gestión.                                                                                                       |
| 13. Emails internos              | Normalización, búsqueda compatible con registros antiguos y control de duplicados equivalentes.                                                           |
| 14. Roles/permisos               | Valores por rol, recorte de permisos máximos y editor de pantallas; protección del último administrador activo.                                           |
| 15. Borrado de pagos             | Anulación con motivo/actor. Validación de relación turno-pago y médico-horario. Contrapartida contable en fecha de anulación.                             |
| 16. Datos inválidos              | Fechas reales, DNI/email canónicos, validación de query strings y centavos/límites. Errores consistentes 400/403/404/409/429.                             |
| 17. Ficha médica                 | Versión, revisiones con autor y anterior/posterior, respuestas mínimas. Las notas también conservan revisiones.                                           |
| 18. Red y formularios            | Manejo de errores/finalización de envío; recursos abortables descartan respuestas antiguas y slots del filtro anterior.                                   |

Además: licencias completas, contador de ausencias, vigencias/duraciones por bloque, control de bloques superpuestos, paginación de pacientes e historia, límites en consultas, metadatos en español, etiquetas asociadas, migraciones, ejemplo de entorno y pruebas automatizadas.

Las migraciones se detienen ante documentos o emails equivalentes; no fusionan pacientes ni borran registros para resolver conflictos. La segunda migración es necesaria antes de usar estas funciones. Ver el procedimiento para bases nuevas y anteriores en el README.

Los límites deliberados son cinco turnos próximos online, cuatro horas mínimas para modificar, tres solicitudes de código por DNI en diez minutos y cinco intentos por código. Los enlaces personales duran hasta su regeneración; los códigos son temporales y de un uso.

## Validación ejecutada

- Compilación de producción y TypeScript: correctos.
- ESLint: sin errores ni advertencias.
- 9 pruebas unitarias y 29 de integración: correctas, incluida reserva completa y recuperación frente a fallo de red en Chromium.
- Migraciones probadas desde cero y desde datos anteriores en PostgreSQL local temporal; concurrencia real y aislamiento de roles públicos verificados.
- Las dos migraciones quedaron aplicadas en la base configurada, después de comprobar que coincidía con la baseline, no tenía pacientes/turnos y no presentaba conflictos. Los tres usuarios internos se conservaron. No se cargaron datos de pruebas en esa base ni se enviaron correos reales.
- Se configuró `DIRECT_URL` local para migraciones por conexión de sesión; la aplicación mantiene su conexión con pool.
- `npm audit --omit=dev`: sin vulnerabilidades reportadas. La auditoría completa mantiene cinco alertas de la cadena de herramientas de desarrollo de ESLint/`braces`; no se aplicó el downgrade mayor de Next/ESLint sugerido automáticamente. No forman parte de las dependencias de ejecución.

## Pendiente externo: dominio de correo

El dominio de la clínica todavía no fue entregado. La cuenta de Resend tiene el remitente de pruebas `@resend.dev` y no tiene dominios verificados. El flujo quedó probado con un receptor local de correos. Para habilitar códigos a pacientes reales, hay que verificar el dominio de la clínica en Resend, publicar sus registros DNS y configurar `EMAIL_FROM`. No hace falta modificar el flujo ni crear cuentas de pacientes. Mientras tanto, las pruebas con el proveedor se limitan a los destinatarios autorizados por su modo de pruebas.
