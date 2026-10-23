# Estrategia permanente de regresión

**Regla:** ninguna fase se presenta como terminada si falla cualquier prueba, incluidas las de fases anteriores, o si existe un error crítico reproducible. Cada fase debe conservar el funcionamiento de las anteriores.

## Antes de entregar cada fase

1. `npm run typecheck` — tipos del motor y de la interfaz.
2. `npm test` — motor (reglas, combate, inventario, guardado y migraciones).
3. `npm run build` — compilación web publicable.
4. `npm run test:e2e` — todas las pruebas de interfaz en iPhone 15 Pro Max y SE horizontales, **incluida** `regression.spec.ts`.
5. `npm run test:regression` dos veces más, para detectar intermitencias.
6. `npm run build:artifact` → publicar la vista previa → **descargar la página publicada** y ejecutar contra ella: `E2E_BASE_URL=http://127.0.0.1:4174 npx playwright test regression` (comprueba que la vista previa ejecuta esa compilación y funciona).
7. Recorrido manual de usuario en la compilación (capturas) y revisión de errores de consola.
8. GitHub Actions en verde en el PR.

## Qué cubre `tests/e2e/regression.spec.ts`

| Función esencial | Prueba | Comprueba en el estado |
|---|---|---|
| Inicio y selección de país | todas | partida creada con el país elegido |
| Reloj y velocidades, en **tiempo real sin acelerar** | «pausa, ×1, ×2 y ×4…» | horas simuladas por segundo real; hora visible; pausa y reanudación |
| Reloj robusto | «…suspenda requestAnimationFrame», «error interno…» | sigue avanzando; un error pausa y avisa |
| Selección de regiones, estados y batallones | recorridos ARG→UY y funciones esenciales | ficha abierta, selección |
| Movimiento y llegada | ARG→UY | destino, avance de `progress`, barra visible en Atlas, llegada |
| Declaración de guerra y ataque directo | ARG→UY, guerra formal | guerra creada; el mismo toque no confirma |
| Combate, bajas, retirada y ocupación | ARG→UY | informe con bajas de ambos bandos, bajas acumuladas, ocupación con rendimiento completo **o** retirada/destrucción |
| Reclutamiento y reposición (pausable) | funciones esenciales | +2 batallones, reserva consumida, voluntarios que llegan, sin reposición en pausa |
| Economía e inventarios | funciones esenciales | política aplicada, informe mensual, inventario |
| Guardado, cierre y recuperación | ARG→UY | guardado manual, pausa + autoguardado al ocultar, recarga y estado idéntico |
| Atlas | guerra formal + Atlas | escalas Continente/Nación/Región, ficha de estado, panel plegable |
| Navegación táctil en iPhone | todas | toques reales (`touchscreen.tap`) en ambos tamaños |

Además siguen vigentes las pruebas específicas de cada fase (`ui`, `mobile`, `landscape`, `map`, `atlas`, `military`, `combat`) y las del motor.

## Limitación conocida

En este entorno no se puede instalar WebKit (motor de Safari): las pruebas usan Chromium con perfil de iPhone. Por eso la validación final de cada fase incluye la comprobación del usuario en Safari de un iPhone real, con las instrucciones del PR.
