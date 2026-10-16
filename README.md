# Sistema Clínica

Turnos, agenda médica, ficha e historia clínica, licencias y caja. Next.js 16, React 19, Prisma 7 y PostgreSQL. Los pacientes reservan y gestionan turnos **sin cuenta ni contraseña**, con un código por email y un enlace personal.

## Instalación

Requiere Node.js 22, npm y PostgreSQL.

```powershell
npm ci
Copy-Item .env.example .env
```

Completar el entorno:

| Variable                       | Uso                                                                                                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Conexión PostgreSQL; usar conexión directa para migraciones si el proveedor la distingue del pool.                                                                                                                                                                                 |
| `DIRECT_URL`                   | Conexión directa o de sesión para Prisma CLI; si está vacía, usa `DATABASE_URL`. En Supabase, el pool transaccional 6543 es para la aplicación y el de sesión 5432 para migraciones. [Referencia del proveedor](https://supabase.com/docs/guides/database/connecting-to-postgres). |
| `NEXTAUTH_URL`                 | URL real del sistema; localhost para desarrollo, HTTPS al publicar.                                                                                                                                                                                                                |
| `NEXTAUTH_SECRET`              | Secreto aleatorio de sesión y HMAC de códigos.                                                                                                                                                                                                                                     |
| `TOKEN_ENCRYPTION_KEY`         | 32 bytes en base64 para cifrar enlaces. Conservar y respaldar: cambiarlo impide recuperar enlaces existentes.                                                                                                                                                                      |
| `RESEND_API_KEY`               | Credencial de Resend, utilizada cuando `EMAIL_PROVIDER=resend`.                                                                                                                                                                                                                    |
| `EMAIL_FROM`                   | Remitente de un dominio verificado en Resend; Gmail usa siempre la cuenta autenticada.                                                                                                                                                                                             |
| `CRON_SECRET`                  | Secreto Bearer del programador de recordatorios.                                                                                                                                                                                                                                   |
| `NEXT_PUBLIC_CLINIC_TIME_ZONE` | Zona IANA, predeterminado `America/Argentina/Buenos_Aires`. Cambiarla requiere recompilar.                                                                                                                                                                                         |

### Enviar desde Gmail personal

En Vercel → proyecto → Settings → Environment Variables, crear para **Production**:

| Variable             | Valor                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `EMAIL_PROVIDER`     | `gmail`                                                                                                         |
| `GMAIL_USER`         | La cuenta Gmail que generó la contraseña de aplicación                                                          |
| `GMAIL_APP_PASSWORD` | La contraseña de aplicación de 16 caracteres. Guardarla como secreto; no usar la contraseña habitual de Google. |

Guardar las variables y crear un nuevo despliegue: los cambios de entorno no actualizan despliegues anteriores. No anteponer `NEXT_PUBLIC_`, no guardar la clave en Git ni compartirla por chat. También pueden cargarse en Preview si se desea probar ese entorno.

La cuenta necesita verificación en dos pasos y permitir contraseñas de aplicación. Los espacios que Google usa para agrupar la clave se eliminan al leerla. Gmail conecta a `smtp.gmail.com:465` con TLS y usa esa misma cuenta como remitente; una configuración anterior de `EMAIL_FROM` no altera este remitente. No necesita dominio propio para este modo.

Los códigos, confirmaciones, recordatorios, cancelaciones y enlaces comparten el proveedor seleccionado. Una configuración incompleta o desconocida bloquea el envío, sin cambiar automáticamente a otro proveedor. Si no se define `EMAIL_PROVIDER`, se conserva Resend. Para volver a Resend, configurar `EMAIL_PROVIDER=resend`, su API key y un remitente de dominio verificado.

Si el envío falla, un administrador puede abrir `/api/admin/correo` con su sesión del sistema. El diagnóstico informa el proveedor del despliegue, si las variables están cargadas y el resultado de conectar/autenticar contra Google, sin enviar correos ni mostrar contraseñas o respuestas SMTP crudas. Está limitado a seis consultas por administrador cada diez minutos. Los demás roles y visitantes no pueden acceder. Las conexiones aceptadas no garantizan entrega: completar después una solicitud real de código.

El proyecto usa Nodemailer 10.1.2 o posterior mediante `overrides`: el peer opcional de Auth.js apunta a versiones anteriores con avisos de seguridad. La autenticación del personal continúa usando credenciales y se valida en las pruebas de integración.

Generar **cada secreto por separado**:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

En una base **nueva y vacía**:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

El seed crea el primer administrador y muestra su contraseña una vez. Admite `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. Los usuarios del personal se administran en `/admin/usuarios`; el paciente nunca es un usuario interno.

## Actualizar una base anterior sin migraciones

Respaldar y comprobar que las tablas coincidan con el esquema inicial. No ejecutar `migrate reset` ni borrar tablas.

1. Ejecutar `npm run db:preflight`. Informa IDs de documentos inválidos y DNI/emails internos equivalentes. Resolver esos casos antes de migrar.
2. Solo si las tablas corresponden exactamente a la baseline inicial, registrarla como existente:

```powershell
npx prisma migrate resolve --applied 202610160001_baseline
npm run db:migrate
```

Si el esquema difiere, preparar una migración específica; no marcarlo arbitrariamente como coincidente. La segunda migración agrega verificación, límites, revisiones y anulaciones; normaliza DNI/emails sin fusionar identidades, conserva contenido clínico previo como primera revisión y reconcilia ausencias. Detecta conflictos antes de cambiar datos y se ejecuta en una transacción. Las actualizaciones posteriores usan `npm run db:migrate`. `db:push` queda para prototipos y no reemplaza las migraciones.

## Reserva sin registro

1. Elegir médico, día y hora; se pueden cambiar antes de confirmar.
2. Ingresar DNI y contacto. Un paciente nuevo recibe el código en el email ingresado. Un DNI existente siempre lo recibe en el email que ya tiene guardado la clínica, aunque escriba otro.
3. Ingresar el código de seis dígitos: diez minutos de validez y cinco intentos. Verificación, reserva y consumo del código se confirman juntos, revalidando disponibilidad.
4. Recibir el enlace personal para gestionar turnos. El paciente no ve notas médicas ni de secretaría.

La recuperación en `/mi-turno/recuperar` también exige un código al contacto registrado y da una respuesta genérica. Si el email cambió o no existe uno, secretaría debe verificar y actualizar el contacto; nunca se reemplaza desde el sitio público por conocer un DNI. Los códigos se guardan con HMAC, sin texto plano ni logs. El código de reserva no sirve para recuperación.

El enlace funciona hasta su regeneración, que revoca el anterior. Cancelar/reprogramar online requiere turno pendiente/confirmado, versión vigente y al menos cuatro horas de anticipación. Hay un máximo de cinco turnos próximos por paciente para reservas online.

Los límites de solicitudes se guardan en PostgreSQL: tres códigos por DNI en diez minutos y límites por origen. Al desplegar detrás de un proxy, configurar que **reemplace** `X-Real-IP`/`X-Forwarded-For` sin confiar en valores enviados por el visitante.

## Operación interna

- Las fechas de agenda son días civiles; las horas son locales de la clínica. Los instantes reales, recordatorios y cierres de caja se convierten usando su zona IANA.
- Las escrituras de agenda, horarios, licencias y contacto comparten un bloqueo transaccional PostgreSQL. Se comprueban médico activo, vigencia, duración, futuro, turnos y bloqueos en la misma transacción.
- ADMIN administra todo. SECRETARIA opera pacientes, turnos y caja sin notas médicas. MEDICO accede a su agenda/licencias habilitadas, sus notas y fichas de pacientes relacionados. Los permisos máximos se recortan por rol y se editan en Usuarios. Las bajas afectan páginas y API aun con JWT anterior.
- La ficha y las notas conservan revisiones con autor, fecha y contenido anterior/posterior. La versión de ficha evita sobrescrituras concurrentes. Una visita retrospectiva exige relación previa y fecha no futura: secretaría debe asignar la primera consulta mediante un turno.
- Las licencias solicitadas por médicos quedan pendientes. Secretaría/admin aprueba o rechaza; antes de aprobar hay que resolver las citas de esa franja. Los bloques semanales admiten vigencia y duración propia y rechazan superposiciones.
- AUSENTE actualiza el contador del paciente. No se pueden marcar citas futuras atendidas/ausentes, y reactivar un cancelado exige disponibilidad nuevamente.
- Anular un cobro conserva el original y exige motivo, actor y fecha. Caja registra la contrapartida en la fecha de anulación, sin borrar el ingreso del cierre original.

Las tablas internas se consultan únicamente desde el backend. La migración habilita RLS y revoca acceso de los roles públicos de Supabase (`anon` y `authenticated`) si existen; el usuario propietario usado por Prisma conserva su operación.

## Recordatorios

`/api/cron/recordatorios` exige `Authorization: Bearer <CRON_SECRET>`. `vercel.json` lo programa diariamente a las 12:00 UTC. Procesa las próximas 48 horas, también reservas recientes de menos de 24 h. Solo marca envíos aceptados, conserva fallos para reintentar y continúa con los demás. Incluye enlace de gestión, reinicia al reprogramar y usa bloqueo por turno contra ejecuciones simultáneas e idempotencia de proveedor con Resend. Gmail utiliza un Message-ID estable por clave; SMTP no garantiza deduplicación si el proceso se interrumpe después de que el servidor acepta el mensaje y antes de guardar el resultado. La cadencia diaria limita la rapidez de los reintentos; una frecuencia mayor requiere un programador compatible.

## Verificación

```powershell
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:integration
```

Las pruebas de integración inician PostgreSQL temporal **local** y un receptor local de correos. Reemplazan las variables del proceso de prueba: no usan la base del `.env` ni envían correos reales. Incluyen migraciones desde cero y datos previos, códigos, roles, concurrencia real, ficha, licencias, cobros, fallos de correo y reserva completa en Chromium. `npm test` también inicia un receptor SMTP local para comprobar el canal Gmail, autenticación, rechazos, remitente y contenido de los distintos mensajes, sin conectarse a Google. Al terminar detienen servicios y eliminan únicamente su directorio temporal.

Se usa [embedded-postgres](https://github.com/leinelissen/embedded-postgres) como dependencia exclusiva de desarrollo para no exigir Docker. Ejecutar las pruebas con un usuario normal; no crean usuarios del sistema. Ver también [el registro de correcciones](docs/CORRECCIONES.md).
