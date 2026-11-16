# WhatsApp Flows: extremo de demostración

Ruta preparada: `POST /api/whatsapp/flows/prueba`. No consulta ni escribe datos en la base de la clínica y no envía notificaciones. Solo devuelve especialidades y profesionales ficticios, los próximos tres días y horarios de ejemplo. Los martes excluye 15:00–17:00 como demostración de bloqueo. El resultado final incluye `mode=demo` y `booking_created=false`.

## Habilitación

1. Generar las claves con `npx tsx scripts/generar-claves-flow-demo.ts`. El script guarda una clave pública y un archivo privado de configuración fuera del repositorio, en la carpeta privada del usuario. No reemplaza claves existentes ni imprime la clave privada.
2. En Vercel → proyecto → Settings → Environment Variables, cargar para el entorno que se usará:
   - `WHATSAPP_FLOW_DEMO_ENABLED`: `true`.
   - `WHATSAPP_FLOW_DEMO_PRIVATE_KEY_BASE64`: el valor del archivo privado generado. Es la clave privada codificada en base64; base64 no es cifrado.
   - `WHATSAPP_FLOW_DEMO_APP_SECRET`: el **secreto de la aplicación «Prueba Flows»** de Meta, desde Configuración de la aplicación → Básica. No es un access token, ni la clave de Gmail, ni la clave pública.
3. Crear un nuevo despliegue después de cargar las variables. Sin habilitación la ruta devuelve 404; sin los dos secretos completos devuelve 503. No se omite la verificación de firma para facilitar las pruebas.
4. En el Flow → Extremo → Establecer URI, usar la URL del despliegue seguida por `/api/whatsapp/flows/prueba`. Si se aloja en el proyecto actual de la clínica: `https://sistema-clinica-two.vercel.app/api/whatsapp/flows/prueba`.
5. Mantener el número de prueba seleccionado. Registrar en Meta el contenido de `clave-publica.pem`, **nunca** el archivo privado, y conectar la aplicación «Prueba Flows». La firma se comprueba con el secreto de esa misma aplicación.
6. Ejecutar la comprobación de estado. El extremo responde al `ping` mediante el protocolo cifrado de Flows. Abrir el borrador y probar especialidad → profesional → fecha → horario → datos ficticios → resumen → enviar solicitud de prueba.

El JSON compatible es `reserva-turnos-prueba.json`, entregado para el editor de Meta. Conserva los nombres técnicos de la plantilla (`department`, `location`, `date`, `time`, `name`, `email`, `phone`) y sus cuatro pantallas. `department` representa especialidad y `location` representa profesional. Los campos `__example__` solo son ejemplos para el editor; el extremo entrega las opciones durante la ejecución. No enviar DNI, información clínica ni datos de pacientes reales en esta prueba.

El extremo de Flows y el webhook de mensajes son conexiones distintas. Esta entrega prepara el intercambio de datos del formulario; no implementa un bot que envíe el Flow al recibir un mensaje, ni publica el Flow en Meta. Para usar la agenda real se requiere otra implementación con identificación de pacientes, controles de acceso, reservas transaccionales y manejo de reintentos.

## Comprobaciones

`npx tsx --test tests/whatsapp-flow-demo.test.ts`: intercambio RSA-OAEP/SHA-256 y AES-128-GCM, firma del cuerpo original, disponibilidad ficticia dependiente de selecciones, bloqueo de ejemplo, respuesta final sin datos personales, errores de cifrado y límites de lectura. Las claves y mensajes de estas pruebas son sintéticos.

Protocolo basado en los ejemplos oficiales de [cifrado](https://github.com/WhatsApp/WhatsApp-Flows-Tools/blob/main/examples/endpoint/nodejs/book-appointment/src/encryption.js) y [respuestas de reserva](https://github.com/WhatsApp/WhatsApp-Flows-Tools/blob/main/examples/endpoint/nodejs/book-appointment/src/flow.js). El ejemplo oficial es un prototipo: esta implementación exige además la firma del cuerpo original, limita su tamaño y no registra contenidos ni secretos en logs.
