# Auditoría técnica para el sistema militar (Fase 0)

Fecha: 22 oct 2026 · Base auditada: `main` en `f9516f5` (MAP-001, MAP-002, MOBILE-001 y ATLAS-001 integrados).
Alcance: lectura completa del motor (`src/engine`), persistencia, interfaz militar y pruebas, contrastada con las decisiones MIL-001 a MIL-171 del documento de entrega. Esta fase **no cambia el juego**.

## 1. Inventario del código

| Área | Archivos | Qué hace hoy |
|---|---|---|
| Estado y tipos | `src/engine/types.ts` | `GameState` serializable. `SAVE_VERSION = 1`. `Unit` = batallón con `men`, `org`, `morale`, ruta, `status` (incluye `training`) y `trainingHours`. |
| Reloj | `src/engine/time.ts` | Paso fijo de 1 hora simulada (`stepHour`). `REAL_MS_PER_DAY = 60 000` (60 s). Velocidades ×1, ×10, ×60. Máximo 48 h por fotograma. |
| Movimiento | `src/engine/military.ts` | Rutas Dijkstra por regiones vecinas, `BASE_SPEED = 1,4` u/h (≈ 3 días entre regiones vecinas), ×0,65 en territorio hostil. Reclutamiento: 1.000 efectivos y 15 días de entrenamiento. Mantenimiento por batallón y desgaste por falta de abastecimiento. |
| Combate y ocupación | `src/engine/war.ts` | Combate cada hora en regiones con enemigos. Daño según `unitPower` (efectivos, calidad, organización y moral); bonificación ×1,3 al bando que controla la región. Retirada si `org ≤ 8`; destrucción por debajo de 150 efectivos. Ocupación tras 24 h (48 h capitales) sin defensores. Paz blanca o status quo. |
| Territorio y economía | `src/engine/territory.ts`, `economy.ts` | Propietario de jure (`owner`) y controlador de facto (`controller`). Regiones ocupadas rinden al 50 % (`OCCUPIED_EFFICIENCY`). Presupuesto militar en % del PIB → `supplyRatio`. |
| IA | `src/engine/ai.ts` | Una decisión diaria por país y revisión mensual. Usa `perform`, igual que el jugador. Sin selector de dificultad. |
| Acciones | `src/engine/actions.ts` | Único punto de entrada de jugador e IA. |
| Persistencia | `src/persistence/saves.ts`, `src/ui/controller.ts` | IndexedDB (memoria si no está disponible). Ranuras 1–3 + autoguardado mensual y al ocultar la app. **El cargador rechaza cualquier versión distinta de la actual**: no hay migraciones. |
| Interfaz militar | `UnitCard.tsx`, `ArmyPanel.tsx`, `ContextPanel.tsx` (`UnitsCard`), `MapView.tsx` | Ficha con efectivos, fuerza, barras de organización y moral. Multiselección por región y orden conjunta «Mover (n)». Reclutar y desmovilizar. |
| Atlas | `src/ui/map/*`, `src/atlas`, `src/ui/military/*` | Escalas Continente/Nación/Región, agrupación de batallones por escala, simbología APP-6 preparada (13 categorías, solo infantería y formación en uso). |
| Pruebas | `tests/*.test.ts` (77), `tests/e2e/*.spec.ts` (43 × 2 iPhone) | Motor, guardado (incluye una partida real de la beta 1.0 en `tests/fixtures/save-v1-beta1.json`), cartografía, encuadre, Atlas. |

El motor no importa nada de la interfaz, `geo` ni `atlas` (lo comprueba una prueba). Toda regla nueva debe vivir en `src/engine` y pasar por `perform`.

## 2. Conflictos entre el código y las decisiones aprobadas

| # | Decisión | Código actual | Tratamiento propuesto |
|---|---|---|---|
| C1 | MIL-153 C: 1 día = 5 min reales | `REAL_MS_PER_DAY = 60 000` | **F1**: 300 000 ms. |
| C2 | MIL-154 B: pausa, ×1, ×2, ×4 | ×1, ×10, ×60 | **F1**: ×1, ×2, ×4. |
| C3 | MIL-018 A: sin entrenamiento obligatorio; MIL-012 B: reclutamiento progresivo | 15 días de entrenamiento; 1.000 efectivos de golpe | **F1**: el batallón es operativo al crearse y se completa con voluntarios día a día. |
| C4 | MIL-032 A: sin indicador de preparación 0–100 | Barras «Org.» y «Moral» en la ficha; `org` y `morale` intervienen en combate y marcha | **F1**: se retiran de la interfaz. **F2**: la fuerza pasa a depender de efectivos, equipo operativo, tecnología, mantenimiento y suministros (MIL-077 B). |
| C5 | MIL-085 A: lo ocupado rinde como propio | `OCCUPIED_EFFICIENCY = 0.5` | **F2** (junto a la ocupación). |
| C6 | MIL-082 B: guerra por declaración **o ataque directo** | `canEnter` exige guerra declarada | **F2**. |
| C7 | MIL-041 B: retirada automática por pérdidas graves + manual | Retirada por organización baja; sin orden manual | **F2**. |
| C8 | MIL-133 A / MIL-134 A: terreno sin efecto, sin fortificaciones | `DEFENDER_BONUS = 1.3` para quien controla la región | **Decisión del usuario** (ver §4). No se toca hasta F2. |
| C9 | Guardados existentes deben conservarse | El cargador rechaza versiones distintas | **F1**: cadena de migraciones (§5). |
| C10 | README | Documenta 60 s/día, ×10/×60, 15 días de entrenamiento y 50 % del PIB ocupado | Se actualiza en la fase que cambia cada regla. |

## 3. Datos indispensables que faltan (no se inventan)

| Dato | Decisiones | Tratamiento hasta que exista |
|---|---|---|
| Tripulación por modelo | MIL-027 | Valores **provisionales** por categoría, parametrizables por modelo. |
| Modelos reales por país y sus estadísticas | MIL-016, 029, 076 | Modelos **provisionales** etiquetados como tales en la interfaz. |
| Inventarios iniciales reales | MIL-017 | Dotación **provisional** por país. |
| Ritmo de reclutamiento voluntario | MIL-012 | Ritmo **provisional** parametrizable. |
| Equivalencias de modelos, condiciones, conservación de cantidades y equipos dañados | MIL-075, MIL-081 | Bloquea F9: no se implementa hasta especificarlo. |
| Roles de helicópteros y transporte aéreo | MIL-055 | Bloquea parte de F4: sin misiones nuevas. |
| Rutas y espacio marítimo en Atlas | MIL-064, 071 | Bloquea F5. |
| Precios, tiempos de producción y capacidad industrial | MIL-015, 021, 079 | Necesarios para F3. |
| Texto literal de MIL-002, 003, 006, 007, 008, 010, 011 y 140 | — | Marcadas «A cotejar» en la matriz. |

Todo dato provisional vive en un único archivo de datos, con la marca `provisional: true`, y la interfaz lo señala.

## 4. Preguntas para el usuario (no bloquean la Fase 1)

1. **`DEFENDER_BONUS`** (×1,3 de daño recibido menos para quien controla la región): ¿se mantiene como regla de defensa o se elimina por ser equivalente a una fortificación (MIL-134 A)?
2. **Moral**: MIL-077 B enumera efectivos, equipo, tecnología, mantenimiento y suministros. ¿La moral nacional debe seguir influyendo en la fuerza, o se elimina en F2?
3. Texto literal de las decisiones marcadas «A cotejar».

## 5. Plan de migración de guardados

- `SAVE_VERSION` pasa a 2 en F1. El cargador aplica migraciones en cadena (`v1 → v2 → …`) y rechaza solo versiones **posteriores** a la del juego.
- La migración es determinista y no usa el generador aleatorio de la partida: el mismo guardado produce siempre el mismo resultado.
- v1 → v2: se añade el inventario nacional y la dotación de equipo de cada batallón según la plantilla y los datos provisionales; los batallones en entrenamiento pasan a estar operativos con sus efectivos.
- El registro guardado no se reescribe al cargar: las ranuras manuales conservan su v1 hasta que el jugador vuelva a guardar (el autoguardado sí escribe v2).
- Prueba obligatoria: la partida real de la beta 1.0 (`tests/fixtures/save-v1-beta1.json`) carga, migra y sigue simulando.
- Reversión: una versión anterior del juego no lee guardados v2. Por eso no se publica sin aprobación y, si hubiera que revertir, se publicaría una versión que mantenga el lector v2.
