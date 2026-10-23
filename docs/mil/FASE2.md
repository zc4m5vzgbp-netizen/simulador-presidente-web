# MIL · Fase 2 — Combate terrestre

Rama `feature/mil-002-combate` (sobre la Fase 1, PR #9). Borrador: no fusionar ni publicar sin aprobación.

## Decisiones nuevas aplicadas

- **F2-001 A — sin bonificación defensiva.** Se eliminó `DEFENDER_BONUS`. Ojo a la aritmética: el código anterior **dividía** el daño recibido por el controlador entre 1,3, es decir, recibía el 76,9 % (−23,1 %), no un −30 %; multiplicar ×1,3 el daño del defensor habría sido otra regla distinta. Ya no existe ninguna. Prueba: mismo resultado sea quien sea el controlador de la región.
- **F2-002 A — sin moral ni organización.** Los campos `org` y `morale` desaparecen del estado (y de los guardados al migrar). No intervienen en potencia, retirada, marcha ni recuperación. La estabilidad nacional sigue siendo otro sistema y no toca el combate. Pruebas: los batallones no tienen esos campos; cambiar la estabilidad no altera nada; inyectar campos heredados tampoco.

## Qué hace

1. **Combate por intervalos de una hora** en cada región con batallones enemigos. Cada batallón reparte su potencia entre los enemigos según sus efectivos; el daño es simultáneo.
2. **Potencia** = (infantería × 0,01 + Σ vehículos operativos **tripulados** × potencia de fuego del modelo × peso de su categoría × factor de combustible) × factor de munición × mantenimiento × tecnología. No intervienen terreno, fortificaciones, bonificación defensiva, moral, organización, experiencia ni la calidad del país.
3. **Pérdidas separadas**: bajas humanas (reducidas por el blindaje de los vehículos) e impactos sobre vehículos, que quedan **dañados** (ocupan su hueco, no combaten) o **destruidos** (pasan a «perdidos» del país).
4. **Reparación** diaria fuera de combate, en territorio propio o aliado, limitada por el presupuesto (no repara por debajo del 30 % de abastecimiento). La reserva nacional dañada también se repara.
5. **Combustible y munición** (carga 0–1 por batallón): el combate consume ambos; marchar consume combustible. Por debajo del 20 %: menos potencia y, sin combustible, marcha a pie (más lenta). Reabastecimiento diario fuera de combate, igual en cualquier territorio: **simplificación provisional** porque esta fase no modela líneas de suministro (MIL-035 simplificado, sin logística individual). F2-001 A no prohíbe diferencias logísticas; si se aprueba una regla de logística por territorio, se cambia en `SUPPLY.dailyResupply`.
6. **Retirada automática** por pérdidas graves (≥ 40 % de los efectivos o ≥ 60 % de los vehículos con los que entró en la batalla) y **retirada manual** (botón «Retirar» en la ficha y en el panel de batalla). Rodeado: la automática acaba en rendición; la manual se rechaza.
7. **Ocupación**: propietario legal y controlador separados; el territorio ocupado **rinde al 100 %** para quien lo controla (se eliminó el 50 %).
8. **Ataque directo**: dar orden de marcha hacia un país en paz pide confirmación y, si se acepta, empieza la guerra («Ataque de X contra Y») con más coste diplomático que una declaración (−10 adicional con todos los demás países y −4 de estabilidad propia, provisionales). Se respeta la tregua.
9. **Combate conjunto**: varios batallones del mismo bando combaten juntos; cada uno conserva identidad, equipo y pérdidas.
10. **Informes**: por país, bajas, vehículos dañados y destruidos por tipo, munición y combustible consumidos (en cargas de batallón), evolución de efectivos por hora y batallones implicados (entrada → ahora). Últimos 20 informes en *Ejército*.
11. **Atlas**: el marcador de batalla se puede tocar y abre el panel; indicadores discretos de munición y combustible (5 segmentos) en la ficha; «Ver batalla» en la ficha de la región. Atlas no se rediseñó: el único cambio es que el marcador existente es tocable.

## Revisión de las observaciones sobre los PR #8 y #9

- **Inventario y conservación**: nueva contabilidad por modelo `reserva + reserva dañada + en batallones (operativo y dañado) + perdido`, constante mientras no haya fabricación (F3). Prueba de invariantes por país y modelo durante 40 días de guerra con reposición, reparación, destrucción y desmovilización.
- **Problema corregido de la Fase 1**: desmovilizar fuera del territorio propio (o disolverse por desabastecimiento allí) borraba el equipo sin registrarlo; ahora pasa a «perdidos».
- **Migración v1 → v2**: no duplica equipo (prueba: los totales migrados = dotación × batallones + reserva inicial).
- **Provisional frente a real**: todas las cantidades y modelos siguen siendo provisionales (no hay ninguno real todavía) y la interfaz lo indica.
- **Plantilla**: dañados y operativos cuentan para los máximos; la reparación y la reposición nunca los superan.

## Guardado v3

`SAVE_VERSION` 2 → 3. Migración v2 → v3 determinista: quita moral y organización, añade dañados vacíos, combustible y munición llenos, contabilidad vacía, ficha de seguimiento de las batallas en curso e informes vacíos. Probado con:
- partida nueva (v3);
- partida real de la beta 1.0 (v1 → v2 → v3), sin duplicar equipo;
- partida v2 de la Fase 1 **con una guerra, una batalla y tres regiones ocupadas en curso** (`tests/fixtures/save-v2-fase1-guerra.json`, generada con el código de la Fase 1): conserva guerras, batallas, ocupaciones, economía, posiciones, órdenes y equipo, y sigue simulando;
- guardar y cargar a mitad de batalla: el resultado posterior es idéntico al de no haber guardado.

La ranura no se reescribe al cargar. **Reversión**: una versión anterior no lee v3; no publicar sin aprobación.

## Parámetros provisionales (todos en `src/data/military.ts`)

`COMBAT` (potencia, daño, blindaje, impactos, destrucción, umbrales de retirada), `SUPPLY` (consumos y reabastecimiento), `REPAIR`, `DIRECT_ATTACK`. Calibrados para batallas de horas a pocos días; no son datos reales.

## Sin implementar (no se finge)

- Tecnología: factor 1,0 para todos hasta la investigación (F9).
- La IA usa las mismas reglas, pero todavía **no** decide ataques directos ni retiradas manuales (solo automáticas).
- Rendición multivariable y paz negociada más allá de blanca/status quo (MIL-087/088), alto el fuego y objetivos conjuntos (F8).
- Fabricación y compra: lo destruido no se repone (F3).
- Aviación, armada, defensa aérea, misiles, nuclear (F4–F7).

## Archivos

- Motor: `src/engine/combat.ts` (nuevo), `war.ts`, `military.ts`, `equipment.ts`, `territory.ts`, `migrations.ts`, `types.ts`, `time.ts`, `actions.ts`, `setup.ts`, `ai.ts`.
- Datos: `src/data/military.ts`.
- Interfaz: `src/ui/panels/BattleCard.tsx` (nuevo), `UnitCard.tsx`, `ArmyPanel.tsx`, `src/ui/layout/ContextPanel.tsx`, `src/ui/GameScreen.tsx`, `src/ui/map/MapView.tsx` (marcador tocable), `selection.ts`, `icons.tsx`, `styles.css`.
- Pruebas: `tests/combat.test.ts`, `tests/e2e/combat.spec.ts`, `tests/fixtures/save-v2-fase1-guerra.json` (nuevos); actualizadas `tests/military.test.ts`.

## Revisión tras la prueba del usuario (incidencia F2-INC-01)

Detalle completo en `INCIDENCIAS.md` y estrategia de pruebas en `REGRESION.md`.

- **Causa del «congelamiento»:** el reloj avanzaba, pero no se veía: la fecha no mostraba la hora (75 s sin cambios a ×4, 5 min a ×1) y la marcha a Uruguay dura ≈ 7 min reales a ×4 con un avance imperceptible en el mapa; mis instrucciones de prueba no lo advertían. Además, el reloj dependía solo de `requestAnimationFrame` y un error del motor lo habría detenido en silencio.
- **Correcciones:** hora visible; barra de progreso de la marcha en Atlas; aviso de llegada en tiempo de juego y real; reloj con temporizador de respaldo y error visible; vista previa con la compilación prevista (`build:artifact`) y herramienta de verificación ×30 solo en la vista previa.
- **Impactos sobre vehículos:** ahora solo alcanzan a vehículos operativos **y tripulados** (los que combaten), recalculados tras cada impacto; los dañados y los que no tienen tripulación no quedan expuestos. Prueba incluida.
- **ETA:** simula hora a hora el avance con el combustible, su consumo y el reabastecimiento diario, con las mismas reglas que el movimiento real. Prueba: coincide exactamente con la llegada real con combustible lleno, escaso y casi vacío.
- **Bolivia:** no reproducible en 40 repeticiones; espera de estabilidad añadida (F2-INC-02).
- **Regresión integral:** `tests/e2e/regression.spec.ts`, incluido el reloj en tiempo real sin acelerar y el recorrido completo Argentina → Uruguay; también ejecutada contra la copia descargada de la vista previa publicada.

## Problema encontrado durante la fase

- **Confirmación que se aceptaba sola**: la ventana de «¿Atacar sin declarar la guerra?» aparecía bajo el dedo y el mismo toque pulsaba «Atacar». Ahora sus botones solo responden tras 400 ms; una prueba lo comprueba.

## Riesgos

- Los coeficientes provisionales determinan la duración y letalidad de las batallas; conviene validarlos jugando.
- El ritmo de 5 min/día hace que las batallas duren minutos u horas reales a ×1.
