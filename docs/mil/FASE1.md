# MIL · Fase 1 — Batallones, equipo e inventario

Rama `feature/mil-001-batallones` (sobre la Fase 0). Borrador: no fusionar ni publicar sin aprobación.

## Qué hace

- **Plantilla universal fija** (MIL-001C A, 022–026): 1.000 efectivos, 20 tanques, 30 blindados multipropósito, 8 artillerías, 40 drones y 20 vehículos de transporte como máximo. Ningún batallón la supera (comprobado en los 12 países).
- **Tripulación automática** (027, 028): los efectivos tripulan el equipo por prioridad (tanques → blindados → artillería → drones → transportes); lo que no tiene tripulación queda **inactivo** y se ve en la ficha; el resto es infantería.
- **Modelos nacionales** (016, 029, 076, 164, 165): un modelo por país y categoría, con estadísticas simples (fuego, protección, movilidad) diferenciadas. **Todos son provisionales** y la interfaz los marca así.
- **Inventario nacional por modelo** (017) y **reposición automática pausable** (019, 038): cada día, los batallones en territorio propio y fuera de combate cubren bajas (pagándolas como reclutamiento) y completan el equipo desde la reserva. Nunca se crea equipo. Al desmovilizar en territorio propio, el equipo vuelve a la reserva.
- **Reclutamiento voluntario y progresivo, sin entrenamiento** (012, 013, 018, 030): el batallón nace operativo con 250 voluntarios y suma 50 al día (ritmo provisional); se pueden reclutar de 1 a 5 a la vez.
- **Ficha ilustrada** (143, 144): efectivos, infantería y las cinco categorías con siluetas genéricas propias, barras de ocupación de la plantilla, equipo sin tripulación, modelos y estado. Sin barras de organización/moral (032 A).
- **Multiselección** (145): totales de los batallones seleccionados y detalle de cada uno.
- **Inventario por ramas** (149): Tierra completo; Aire y Armada indicados como pendientes (fases 4 y 5).
- **Marchas con duración** (033): «llega en 2 d 5 h» en la ficha.
- **Tiempo** (153–155): 1 día = 5 minutos reales a ×1; pausa, ×1, ×2, ×4; al cerrar u ocultar la app el juego se pausa y se autoguarda.
- **Guardado v2** con migración desde v1 (ver abajo).

## Qué NO hace todavía (sin fingirlo)

- El equipo y sus estadísticas **no influyen en el combate**: el combate sigue igual que antes (efectivos, calidad, organización y moral) hasta la Fase 2.
- No hay fabricación ni compra de equipo (Fase 3): las reservas son finitas.
- No hay daños, reparación, combustible ni munición (Fase 2).
- Las regiones ocupadas siguen rindiendo al 50 % (conflicto con MIL-085 A, Fase 2).

## Datos provisionales (todos en `src/data/military.ts`)

Nombres de modelo (p. ej. «Tanque VEN-T1»), estadísticas, tripulación por categoría (tanque 4, blindado 3, artillería 6, dron 2, transporte 2), dotación inicial y reservas por país, voluntarios iniciales (250) y diarios (50). No describen equipos ni inventarios reales. Sustituirlos no exige cambiar el motor.

## Archivos

- Motor: `src/engine/equipment.ts` (nuevo), `src/engine/migrations.ts` (nuevo), `military.ts`, `types.ts`, `time.ts`, `war.ts`, `setup.ts`, `actions.ts`.
- Datos: `src/data/military.ts` (nuevo).
- Persistencia: `src/persistence/saves.ts`.
- Interfaz: `src/ui/panels/UnitCard.tsx`, `ArmyPanel.tsx`, `src/ui/layout/ContextPanel.tsx`, `src/ui/military/Silhouette.tsx` (nuevo), `src/ui/controller.ts`, `format.ts`, `GameScreen.tsx`, `styles.css`; en Atlas solo se quitó la clase visual de batallones «en entrenamiento» (`MapView.tsx`).
- Pruebas: `tests/military.test.ts` y `tests/e2e/military.spec.ts` (nuevos); actualizadas `tests/engine.test.ts`, `tests/e2e/ui.spec.ts`, `landscape.spec.ts`, `helpers.ts`.

## Migración de guardados

`SAVE_VERSION` 1 → 2. Al cargar una partida v1: se añade inventario y reposición activa a cada país, el equipo provisional a cada batallón, y los batallones que entrenaban pasan a operativos con sus efectivos. Se conservan efectivos, posiciones, guerras, economía y fecha. Es determinista y no reescribe la ranura hasta volver a guardar. Prueba: la partida real de la beta 1.0 carga, migra y sigue simulando.

**Reversión**: la versión anterior del juego no lee guardados v2. Si hubiera que revertir tras publicar, se mantendría el lector v2.

## Riesgos

- Con 5 min por día, una marcha entre regiones vecinas (≈ 3 días) dura ≈ 15 min reales a ×1 o ≈ 4 min a ×4. Es la regla aprobada; conviene validarla jugando.
- La reposición automática gasta reservas monetarias al cubrir bajas.
- La IA usa las mismas acciones (recluta con el mismo ritmo y coste).
