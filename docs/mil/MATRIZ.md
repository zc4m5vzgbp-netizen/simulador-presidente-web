# Matriz MIL-001 a MIL-171

Estado de cada decisión tras la **Fase 2** (rama `feature/mil-002-combate`), con las decisiones nuevas F2-001 A (sin bonificación defensiva) y F2-002 A (sin moral ni organización). Los resúmenes proceden del documento de entrega; donde el traspaso no incluye el texto literal se indica **A cotejar**.

Estados: **Cumple** · **Parcial** · **Conflicto** (el código contradice la decisión) · **No implementado** · **Planificado** · **Proceso** · **A confirmar** (requiere decisión del usuario) · **A cotejar** (falta el texto literal de la decisión).

Fases: F0 auditoría · F1 batallones e inventario · F2 combate terrestre · F3 industria y economía militar · F4 aviación · F5 armada · F6 defensa aérea · F7 misiles y nuclear · F8 diplomacia militar · F9 investigación y modernización · F10 avisos y ampliación. Ver `PLAN.md`.

Resumen: No implementado: 72 · Cumple: 67 · Parcial: 22 · A cotejar: 7 · Proceso: 3

| MIL | Opción | Decisión (resumen) | Fase | Estado | Dónde / nota |
|---|---|---|---|---|---|
| 001 | B→C A | Plantilla fija universal de batallón (MIL-001C A sustituye a 001 B) | F1 | Cumple | `BATTALION_TEMPLATE` (`src/data/military.ts`), `src/engine/equipment.ts` |
| 002 | B | A cotejar: texto literal no incluido en el traspaso | — | A cotejar | Solicitar formulación literal |
| 003 | B | A cotejar: texto literal no incluido en el traspaso | — | A cotejar | Solicitar formulación literal |
| 004 | B→ | Solo batallones; sin brigadas, divisiones ni ejércitos como entidades | F1 | Cumple | Solo existe `Unit` (batallón) |
| 005 | B→ | Plantilla única (sustituida) | F1 | Cumple | Una sola plantilla para todos los países |
| 006 | B | A cotejar: texto literal no incluido en el traspaso | — | A cotejar | Solicitar formulación literal |
| 007 | B | A cotejar: texto literal no incluido en el traspaso | — | A cotejar | Solicitar formulación literal |
| 008 | A | A cotejar: texto literal no incluido en el traspaso | — | A cotejar | Solicitar formulación literal |
| 009 | B→ | Inventario aéreo nacional (sustitución) | F4 | No implementado | Sin aviación |
| 010 | B | A cotejar: texto literal no incluido en el traspaso | — | A cotejar | Solicitar formulación literal |
| 011 | C | A cotejar: texto literal no incluido en el traspaso | — | A cotejar | Solicitar formulación literal |
| 012 | B | Reclutamiento progresivo | F1 | Cumple | Nace con 250 voluntarios y +50/día (ritmo provisional) — `recruit`, `dailyReplenishment` |
| 013 | A | Reclutamiento solo voluntario | F1 | Cumple | Sin conscripción |
| 014 | B | Equipo fabricable o comprable | F3 | No implementado | Sin equipos |
| 015 | B | Tiempo de producción y entrega | F3 | No implementado | — |
| 016 | B | Modelos de equipo diferenciados por país | F1 | Parcial | Un modelo por país y categoría, **provisional**; faltan modelos reales |
| 017 | B | Reservas por modelo | F1 | Cumple | `CountryState.inventory` por modelo; cantidades provisionales |
| 018 | A | Sin entrenamiento obligatorio | F1 | Cumple | Entrenamiento eliminado; guardados v1 migran a operativos |
| 019 | B | Reposición automática pausable | F1 | Cumple | `setAutoReplenish`; interruptor en Ejército |
| 020 | B | Mantenimiento con presupuesto | F3 | Parcial | `upkeepNeeded`/`supplyRatio` solo por batallón |
| 021 | B | Industria limitada y ampliable | F3 | No implementado | — |
| 022 | B | Máximo 20 tanques por batallón | F1 | Cumple | Plantilla + prueba |
| 023 | C | Máximo 30 blindados multipropósito | F1 | Cumple | Plantilla + prueba |
| 024 | B | Máximo 8 artillerías | F1 | Cumple | Plantilla + prueba |
| 025 | C | Máximo 40 drones | F1 | Cumple | Plantilla + prueba |
| 026 | A | Máximo 20 vehículos de transporte | F1 | Cumple | Plantilla + prueba |
| 027 | B | Tripulación asignada automáticamente; resto infantería | F1 | Parcial | `crewReport` asigna por prioridad; cifras por modelo PENDIENTE DE DATO (provisionales 4/3/6/2/2) |
| 028 | B | Batallones incompletos; equipo sin personal inactivo | F1 | Cumple | Equipo sin tripulación = inactivo, visible en la ficha |
| 029 | B | Patrón universal con modelos nacionales | F1 | Cumple | Plantilla universal; modelos nacionales (provisionales) |
| 030 | B | Reclutar varios batallones a la vez | F1 | Cumple | Reclutar 1–5 por orden |
| 031 | B | Agrupación visual de batallones | F1 | Cumple | Atlas: pilas por región y agrupación por país (`MapView.tsx`, `scale.ts`) |
| 032 | A | Sin indicador de preparación 0–100 | F1/F2 | Cumple | F1 retiró la interfaz; F2 eliminó `org`/`morale` del motor (F2-002 A) |
| 033 | B | Movimiento con tiempo | F1 | Cumple | `etaHours`: «llega en …» en la ficha |
| 034 | B | Órdenes conjuntas | F1 | Cumple | Multiselección → «Mover (n)» (`ContextPanel.tsx`) |
| 035 | B | Combustible y munición | F2 | Cumple | Combustible y munición 0–1 por batallón (`combat.ts`); consumo y escasez provisionales |
| 036 | B | Mantenimiento de equipo | F2 | Cumple | Reparación diaria limitada por presupuesto; mantenimiento en la potencia |
| 037 | B | Bajas humanas y materiales separadas | F2 | Cumple | Bajas humanas y vehículos dañados/destruidos por separado |
| 038 | B | Reposición automática pausable | F1 | Cumple | Efectivos (pagados) y equipo desde la reserva; pausable |
| 039 | A | Experiencia idéntica (sin veteranía) | F1 | Cumple | Sin experiencia ni moral en el motor |
| 040 | B | Combate por intervalos | F2 | Cumple | Intervalos de 1 hora (`hourlyCombat`) |
| 041 | B | Retirada automática por pérdidas graves y manual | F2 | Cumple | Automática por pérdidas (40 % efectivos o 60 % vehículos, provisional) y manual |
| 042 | B | Instalaciones antiaéreas por estado | F6 | No implementado | Capa «bases» prevista y vacía |
| 043 | A | Cinco niveles acumulativos I–V | F6 | No implementado | — |
| 044 | B | Cobertura circular | F6 | No implementado | — |
| 045 | B | Categorías de amenazas | F6 | No implementado | — |
| 046 | B | Probabilidad de interceptación | F6 | No implementado | — |
| 047 | B | Interceptores limitados | F6 | No implementado | — |
| 048 | B | Capacidad simultánea | F6 | No implementado | — |
| 049 | B | Compra o desarrollo | F6 | No implementado | — |
| 050 | B | Mejoras con coste y tiempo | F6 | No implementado | — |
| 051 | B | Activación y desactivación | F6 | No implementado | — |
| 052 | B | Cinco categorías aéreas | F4 | No implementado | — |
| 053 | B | Inventario nacional y escuadrones administrativos | F4 | No implementado | — |
| 054 | B | Cantidad seleccionada por misión | F4 | No implementado | — |
| 055 | A | Única misión ofensiva manual: bombardeo | F4 | No implementado | Roles de helicópteros/transporte: PENDIENTE DE DATO |
| 056 | A | Alcance aéreo ilimitado | F4 | No implementado | — |
| 057 | B | Consumo de combustible y munición | F4 | No implementado | — |
| 058 | B | Interceptaciones | F4 | No implementado | — |
| 059 | B | Pérdidas y regreso | F4 | No implementado | — |
| 060 | B | Misiones temporizadas | F4 | No implementado | — |
| 061 | B | Defensa aérea automática con cazas, configurable | F4 | No implementado | — |
| 062 | B | Seis clases navales | F5 | No implementado | — |
| 063 | B | Composición de flotas visible | F5 | No implementado | — |
| 064 | B | Posición física de buques/flotas | F5 | No implementado | Rutas marítimas en Atlas: PENDIENTE DE DATO |
| 065 | B | Misiones navales (bloqueo, patrulla, bombardeo costero, transporte) | F5 | No implementado | — |
| 066 | B | Flotas libres configurables | F5 | No implementado | — |
| 067 | A | Submarinos sin sigilo especial | F5 | No implementado | — |
| 068 | B | Puertos y reparación | F5 | Parcial | Atlas: 76 puertos reales (capa parcial), sin uso en la partida |
| 069 | B | Combate naval | F5 | No implementado | — |
| 070 | B | Consumo y mantenimiento naval | F5 | No implementado | — |
| 071 | B | Transporte anfibio obligatorio | F5 | No implementado | Hoy el mapa del juego no tiene cruces oceánicos |
| 072 | B | Presupuesto militar ajustable | F3 | Cumple | `policy.militaryBudget` (Economía) |
| 073 | B | Salarios/mantenimiento/operaciones separados de compras | F3 | Parcial | Un solo presupuesto cubre mantenimiento; sin compras |
| 074 | B | Árbol de investigación (dinero y tiempo) | F9 | No implementado | Sección «Investigación» bloqueada |
| 075 | A* | Bonificaciones generales + sustitución automática (excepción ratificada) | F9 | No implementado | Equivalencias y reglas: PENDIENTE DE DATO |
| 076 | B | Estadísticas simples por modelo | F1 | Parcial | Fuego y protección intervienen en combate; modelos y cifras **provisionales** |
| 077 | B | Fuerza efectiva multivariable | F2 | Parcial | Efectivos, equipo operativo, estadísticas, mantenimiento y suministros; **tecnología uniforme (1,0) hasta F9** |
| 078 | B | Deterioro gradual por presupuesto | F2 | Cumple | Mantenimiento: potencia × (0,6 + 0,4 × abastecimiento); desgaste si < 60 % |
| 079 | B | Precios por modelo | F3 | No implementado | — |
| 080 | B | Restricciones comerciales | F3 | No implementado | — |
| 081 | A* | Sustitución física gratuita por modelos superiores (ratificada) | F9 | No implementado | Equivalencias, condiciones y equipos dañados: PENDIENTE DE DATO |
| 082 | B | Guerra por declaración o ataque directo | F2 | Cumple | `directAttack` con confirmación; más coste diplomático (provisional) |
| 083 | B | Conquista con entrada de batallones y sin defensores | F2 | Cumple | Ocupación por entrada y ausencia de defensores |
| 084 | B | Propietario de jure ≠ controlador de facto | F2 | Cumple | `owner` / `controller` |
| 085 | A | Ocupado funciona económicamente como propio | F2 | Cumple | Rendimiento económico completo para el controlador (`territory.ts`) |
| 086 | B | Anexión solo por paz/rendición | F2 | Cumple | Solo por paz «status quo» |
| 087 | B | Rendición multivariable | F2 | Parcial | `warAssessment` orienta a la IA; no hay rendición formal |
| 088 | B | Paz negociable | F2 | Parcial | Solo paz blanca o status quo |
| 089 | B | Alto el fuego | F8 | No implementado | — |
| 090 | B | Guerras multinacionales | F8 | Parcial | `joinWar` mediante apoyo militar |
| 091 | B | Objetivos conjuntos | F8 | No implementado | — |
| 092 | B | IA autónoma | F2 | Parcial | IA con las mismas reglas; aún no usa ataque directo ni retirada manual |
| 093 | B | Decisión estratégica de la IA | F2 | Parcial | Sin cambios en F2 |
| 094 | B | Ofensivas de la IA | F2 | Parcial | Sin cambios en F2 |
| 095 | B | Defensa de la IA | F2 | Parcial | Sin cambios en F2 |
| 096 | B | Bombardeos e interceptación de la IA | F4 | No implementado | — |
| 097 | B | Marina de la IA | F5 | No implementado | — |
| 098 | B | Economía militar de la IA | F3 | Parcial | Presupuesto y reclutamiento |
| 099 | B | IA sin ventajas | F1 | Cumple | Usa `perform`, las mismas acciones que el jugador |
| 100 | B | Negociación de la IA | F2 | Parcial | Responde a propuestas |
| 101 | A | Dificultad única fija | — | Cumple | No hay selector |
| 102 | B | Misiles estratégicos | F7 | No implementado | — |
| 103 | B | Crucero y balísticos | F7 | No implementado | — |
| 104 | B | Inventario e instalaciones de lanzamiento | F7 | No implementado | — |
| 105 | B | Objetivos estratégicos | F7 | No implementado | — |
| 106 | B | Alcance por modelo | F7 | No implementado | — |
| 107 | B | Defensa antimisiles | F7 | No implementado | — |
| 108 | B | Producción/compra de misiles | F7 | No implementado | — |
| 109 | B | Armas nucleares | F7 | No implementado | — |
| 110 | B | Autorización explícita del lanzamiento nuclear | F7 | No implementado | — |
| 111 | B | Efectos graves | F7 | No implementado | — |
| 112 | A | Una clase nuclear | F7 | No implementado | — |
| 113 | A | Inventario nuclear agregado | F7 | No implementado | — |
| 114 | B | Programa nuclear | F7 | No implementado | — |
| 115 | B | Diplomacia nuclear | F7 | No implementado | — |
| 116 | B | Disuasión | F7 | No implementado | — |
| 117 | B | Respuesta de la IA | F7 | No implementado | — |
| 118 | B | Daño amplio | F7 | No implementado | — |
| 119 | B | Recuperación gradual | F7 | No implementado | — |
| 120 | B | Tratados nucleares | F7 | No implementado | — |
| 121 | A | Contador nuclear como interfaz principal | F7 | No implementado | — |
| 122 | B | Pactos, alianzas y coaliciones | F8 | Parcial | Acuerdos comerciales y apoyo militar; sin alianzas |
| 123 | B | Tratados condicionan intervención | F8 | No implementado | — |
| 124 | B | Ayuda múltiple | F8 | Parcial | `sendAid` (dinero) |
| 125 | B | Transferencias con tiempo | F8 | No implementado | La ayuda actual es instantánea |
| 126 | B | Venta de armas | F8 | No implementado | — |
| 127 | B | Sanciones | F8 | No implementado | — |
| 128 | B | Bases extranjeras | F8 | No implementado | — |
| 129 | B | Control nacional de fuerzas | F8 | Cumple | Cada país controla solo sus batallones |
| 130 | B | Decisión aliada estratégica | F8 | No implementado | — |
| 131 | A | Una única coalición mundial formal | F8 | No implementado | — |
| 132 | B | Combate por intervalos | F2 | Cumple | Intervalos de 1 hora |
| 133 | A | El terreno no modifica el combate | F2 | Cumple | Sin terreno en el combate (prueba) |
| 134 | A | Sin fortificaciones terrestres | F2 | Cumple | `DEFENDER_BONUS` eliminado (F2-001 A); prueba de igualdad |
| 135 | B | Objetivos automáticos | F2 | Cumple | Reparto automático del daño según efectivos enemigos |
| 136 | B | Cooperación sin fusión | F2 | Cumple | Cada batallón conserva identidad, equipo y pérdidas |
| 137 | B | Vehículos dañados y reparables | F2 | Cumple | Dañados ocupan su hueco y no combaten; reparación diaria |
| 138 | B | Escasez penaliza | F2 | Cumple | Munición, combustible y presupuesto penalizan potencia y marcha |
| 139 | B | Informe de bajas y consumos | F2 | Cumple | Informe: bajas, vehículos dañados/destruidos por tipo, consumos, evolución |
| 140 | B | Indicadores discretos | F2 | Parcial | Interpretado como indicadores discretos de combate y suministros (marcador, 5 segmentos); texto literal a cotejar |
| 141 | B | Panel de batalla | F2 | Cumple | Panel de batalla desde Atlas, la región o Ejército |
| 142 | B | Agrupación en el mapa por zoom | F1 | Cumple | Atlas Continente/Nación/Región |
| 143 | B | Ficha de batallón | F1 | Cumple | Efectivos, 5 categorías, infantería, tripulación, estado, marcha |
| 144 | B | Vista ilustrada | F1 | Cumple | Siluetas genéricas propias (`Silhouette.tsx`) |
| 145 | B | Multiselección con totales y detalle | F1 | Cumple | Totales + detalle individual (`UnitsCard`) |
| 146 | B | Panel aéreo | F4 | No implementado | — |
| 147 | B | Flotas visibles | F5 | No implementado | — |
| 148 | B | Instalaciones diferenciadas con filtros | F4–F7 | Parcial | Atlas: aeropuertos/puertos con filtros; bases previstas |
| 149 | B | Inventario por ramas | F1 | Parcial | Tierra completa; Aire y Armada marcadas como pendientes (F4/F5) |
| 150 | B | Órdenes táctiles seleccionar → acción → destino | F1 | Cumple | MOBILE-001 |
| 151 | B | Paneles táctiles plegables | F1 | Cumple | ATLAS-001 |
| 152 | B | Tiempo automático y pausa | F1 | Cumple | `GameClock` |
| 153 | C | 1 día = 5 minutos reales a ×1 | F1 | Cumple | `REAL_MS_PER_DAY = 300 000` |
| 154 | B | Pausa, ×1, ×2, ×4 | F1 | Cumple | ×1, ×2, ×4 |
| 155 | B | No avanza con el juego cerrado; pausa al cerrar | F1 | Cumple | Pausa y autoguardado al ocultar la app |
| 156 | B | Autoguardado y guardado manual | F1 | Cumple | Mensual + al ocultar; 3 ranuras |
| 157 | B | Varias partidas | F1 | Cumple | Ranuras 1–3 + autoguardado |
| 158 | B | Cálculo por intervalos determinista respecto a la velocidad | F1 | Cumple | `stepHour`; prueba de reloj |
| 159 | B | Todas las guerras simuladas | F2 | Cumple | Todas las regiones cada hora |
| 160 | B | Avisos relevantes | F10 | Parcial | Avisos y registro |
| 161 | B | Navegación desde avisos | F10 | No implementado | — |
| 162 | B | Desarrollo por fases | — | Cumple | `docs/mil/PLAN.md` |
| 163 | B | Fase 1: batallones, inventario, fichas, movimiento | F1 | Cumple | PR de Fase 1 |
| 164 | B | Varios países de prueba | F1 | Cumple | Los 12 países tienen modelos y dotación de prueba |
| 165 | B | Datos provisionales diferenciados | F1 | Cumple | Marcados «Provisional» en ficha e inventario |
| 166 | B | Inspección, agrupación y movimiento | F1 | Cumple | Pruebas e2e |
| 167 | B | Combate en Fase 2 | F2 | Cumple | PR de Fase 2 |
| 168 | B | Calidad visual en cada fase | — | Proceso | Capturas por PR |
| 169 | B | Pruebas automatizadas + iPhone | — | Proceso | Unitarias, e2e emuladas; iPhone real lo valida el usuario |
| 170 | B | Proteger Atlas | — | Proceso | Pruebas e2e de Atlas obligatorias en cada PR |
| 171 | B | Documento maestro, matriz y pruebas | F0 | Cumple | `docs/mil/` |

## Decisiones adicionales aprobadas

| Decisión | Contenido | Fase | Estado | Dónde / nota |
|---|---|---|---|---|
| F2-001 A | Sin bonificación territorial defensiva | F2 | Cumple | `DEFENDER_BONUS` eliminado; prueba de igualdad |
| F2-002 A | Sin moral ni organización en el cálculo militar | F2 | Cumple | Campos eliminados del estado; pruebas |
| MIL-MOV-001 B | Movimiento terrestre al 25 % del tiempo anterior | F2 | Cumple | `LAND_SPEED_MULTIPLIER = 4` en `travelHours` (`military.ts`); `docs/mil/MOV-001.md` |
