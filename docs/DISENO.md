# Interfaz de la clínica

La identidad utiliza azul profundo, verde petróleo, fondos claros y la tipografía Geist. La marca es provisional hasta recibir el nombre y los materiales de la clínica. No se muestran testimonios, estadísticas comerciales ni datos de contacto inventados.

- `components/brand.tsx`: marca, cabecera y pie del sitio público.
- `components/patient-layout.tsx`: marco de las reservas y del acceso personal.
- `components/staff-shell.tsx`: navegación del personal, menú móvil y salida de sesión.
- `components/page-heading.tsx`: títulos, descripciones y acciones principales.
- `app/globals.css`: variables visuales, formularios, estados, agenda y adaptación a pantallas pequeñas. El tema es claro, independiente de la preferencia de color del dispositivo.

Las páginas internas comparten `app/(sistema)/layout.tsx`. El grupo no cambia las direcciones públicas. La sesión se valida durante cada petición y el menú respeta los permisos existentes. El inicio muestra turnos reales del día; para médicos, exclusivamente los de su agenda.

La reserva conserva los cuatro pasos: profesional, día y horario, datos y verificación. El resumen acompaña el flujo y los botones permiten corregir la elección antes de confirmar. La gestión personal conserva los límites de reprogramación y cancelación.

La agenda presenta una grilla por duración real en escritorio y una lista por día en celulares. Se conservan los filtros, los turnos fuera del horario habitual y los cancelados. El menú móvil admite teclado, Escape y retorno del foco; también se respetan las preferencias de movimiento reducido.

`npm run test:integration` comprueba los flujos con PostgreSQL y correo locales. Incluye navegación por rol, reservas en Chromium y verificación de desbordes en pantallas pequeñas. Las capturas se guardan en `test-results/`, excluido de Git.
