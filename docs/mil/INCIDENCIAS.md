# Registro de incidencias — sistema militar

## F2-INC-01 — «El tiempo no avanza y las tropas no se mueven» (crítica)

**Informe del usuario (23 oct 2026):** en la vista previa privada de la Fase 2, en iPhone, Argentina ataca a Uruguay; al avanzar el tiempo, el juego parecía congelado.

### Reproducción

Recorrido exacto (Argentina → tocar el batallón de Buenos Aires → Mover → Uruguay → Atacar → ×4) con la **compilación real**, en tiempo real y **sin** el acelerador de pruebas, en Chromium con perfil de iPhone 15 Pro Max horizontal:

| Tiempo real a ×4 | Hora del juego | Fecha mostrada | Avance de la marcha |
|---|---|---|---|
| 5 s | 1 | 1 ene 2027 | 0,8 % |
| 20 s | 6 | 1 ene 2027 | 4,6 % |
| 40 s | 12 | 1 ene 2027 | 9,1 % |

Mismo resultado con la copia exacta descargada de la vista previa y con el juego dentro de marcos de otro origen (normal, aislado y sin acceso a almacenamiento). Sin errores de JavaScript. 48 partidas de un año completo (IA muy agresiva, incluido el ataque a Uruguay) sin ninguna excepción del motor.

### Causa

1. **El avance existía pero no se veía.** Con la regla aprobada de 5 minutos por día:
   - la barra superior mostraba solo la fecha, sin hora: a ×4 no cambiaba nada en pantalla durante 75 s (5 min a ×1);
   - la marcha Buenos Aires → Uruguay dura unas 130 horas de juego: ≈ 7 min reales a ×4 y ≈ 27 min a ×1, con un avance en el mapa de ~0,2 % por segundo, imperceptible;
   - ni la orden ni la ficha indicaban cuánto tiempo real tardaría la llegada, y las instrucciones de prueba que di («Pon ×4 y espera a que llegue») no lo advertían.
2. **Fragilidad real del reloj (sin fallo observado, pero posible):**
   - el bucle del reloj dependía solo de `requestAnimationFrame`, que algunos visores integrados de iPhone pueden suspender;
   - si el motor lanzaba una excepción, el bucle se detenía para siempre sin ningún aviso.
3. **Vista previa:** se publicó la compilación web completa (con su propio `<html>`) y el visor la envolvió en otro documento. No alteraba el funcionamiento (comprobado), pero no era la compilación prevista para vistas previas (`npm run build:artifact`).

No se ha podido ejecutar Safari/WebKit en este entorno (la descarga del motor está bloqueada), así que un fallo exclusivo de Safari no puede descartarse por completo; las correcciones 2 cubren los mecanismos conocidos por los que Safari podría detener el reloj.

### Corrección

- **Hora visible** en la barra superior («1 ene 2027 · 06:00»): cambia cada 3 s a ×4.
- **Barra de progreso de la marcha** bajo cada batallón en movimiento en Atlas (crece con el reloj).
- **Aviso de llegada** al dar la orden o atacar: «llegada en 5 d 12 h (≈ 7 min reales a ×4)»; la ficha del batallón muestra el tiempo restante.
- **Reloj robusto:** `requestAnimationFrame` + temporizador de respaldo cada 250 ms con la misma marca de tiempo (sin contar dos veces); cualquier error del motor pausa la partida y se muestra «Error interno…».
- **Vista previa:** ahora se publica `dist/artifact.html` (sin envoltorio propio) e incluye una **herramienta de verificación** (Partida → «Acelerar el reloj ×30 para pruebas», con distintivo «VERIFICACIÓN ×30»). No es una velocidad del juego y **no existe** en la compilación web publicable.

### Evidencia

- Prueba de regresión «pausa, ×1, ×2 y ×4 avanzan en tiempo real (sin acelerar) y la hora visible cambia» (iPhone 15 Pro Max y SE).
- «El reloj sigue aunque el visor suspenda requestAnimationFrame».
- «Un error interno del motor pausa la partida y se avisa en pantalla».
- Recorrido completo Argentina → Uruguay: selección, orden, confirmación, **barra de marcha que crece**, llegada, batalla, resultado, informe, guardado, cierre y recuperación.
- La suite de regresión se ejecutó también **contra la copia descargada de la vista previa publicada** (ver `FASE2.md`).

## F2-INC-02 — Prueba intermitente «Bolivia: Sucre es la capital» (menor)

Falló 1 vez en una ejecución completa; no se reprodujo en 40 repeticiones aisladas ni con 6 pruebas en paralelo. Causa más probable: el icono se medía mientras el mapa aún aplicaba el encuadre. Corrección: la prueba espera a que el mapa esté estable 4 fotogramas antes de medir y comprueba el nombre de la ciudad antes que su tipo. Estado: vigilada en cada ejecución completa.

## F2-INC-03 — Equipo perdido sin registrar (corregida en la Fase 2)

Desmovilizar o disolverse fuera del territorio propio borraba el equipo sin anotarlo en «perdidos». Corregido; cubierto por la prueba de invariantes de inventario.

## F2-INC-04 — Confirmación de ataque aceptada por el mismo toque (corregida en la Fase 2)

La ventana aparecía bajo el dedo y el «clic» del mismo toque pulsaba «Atacar». Los botones se activan tras 400 ms; cubierto por prueba.

## F2-INC-05 — Falso «estancamiento» en la prueba de regresión (corregida en la prueba)

Al ejecutar la regresión contra la copia de la vista previa, 1 de 6 recorridos falló: el batallón «no salía» de Buenos Aires. Volcado del estado en 16 ejecuciones: el juego seguía vivo (miles de horas simuladas, Brasil entrando en la guerra junto a Uruguay, retiradas hacia Entre Ríos). Causa: la prueba aceleraba el reloj ×400 y comprobaba cada ~2 s, es decir, cada ~1.000 horas de juego; la marcha, la batalla y la retirada a Buenos Aires ocurrían entre dos comprobaciones. Corrección: acelerador moderado durante la marcha y la llegada se acredita por la batalla en Uruguay o la presencia del batallón allí. Verificado: 10/10 repeticiones y 3 ejecuciones completas contra la vista previa publicada.
