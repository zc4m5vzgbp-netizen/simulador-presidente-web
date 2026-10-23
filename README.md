# Simulador de Presidente · Beta 1.0 (web)

Juego de estrategia geopolítica por turnos en tiempo real, ambientado en Sudamérica. Eliges uno de los 12 países soberanos y lo gobiernas: economía, diplomacia y ejército. Los otros 11 países los maneja una IA basada en reglas.

Funciona en el navegador (también en iPhone, con controles táctiles), sin servidor: toda la simulación corre en el dispositivo y las partidas se guardan en IndexedDB.

## Interfaz (UI-001)

Diseñada para jugar **en horizontal** en iPhone: barra superior con los indicadores del país y el tiempo, navegación lateral (Mapa, Economía, Diplomacia, Ejército, Gobierno, Investigación, Espionaje, Estadísticas), mapa en el centro y un panel derecho contraíble que muestra el país, la región o los batallones seleccionados. En vertical aparece un aviso para girar el teléfono y la partida se pausa (Safari no permite bloquear la orientación desde una web). Gobierno, Investigación y Espionaje están marcadas como "en desarrollo". El mapa está organizado en capas (`src/ui/map/layers.ts`); ver *Mapa estratégico (MAP-001)*.

## Cómo jugar

- **Tiempo**: pausa, ×1 (1 día = 5 minutos reales), ×2 y ×4. La partida empieza en pausa el 1 de enero de 2027 y se pausa sola al cerrar u ocultar la app.
- **Mapa**: arrastra con un dedo para moverte y pellizca con dos para acercar o alejar (el zoom se centra entre tus dedos). Toca una región, un marcador o una ciudad para ver su información; un arrastre nunca selecciona. Ver *Interacción táctil (MOBILE-001)*.
- **Mover tropas**: toca un marcador de tus batallones (número dorado), pulsa **Mover** en el panel derecho y luego toca la región de destino. Solo puedes entrar en territorio propio, aliado o de un país con el que estés en guerra.
- **Guerra**: Diplomacia → país → *Declarar la guerra*. Las regiones sin defensores se ocupan tras 1 día (2 días las capitales). El territorio ocupado rinde al 100 % para quien lo controla; la propiedad legal solo cambia con la paz. También se puede atacar sin declarar la guerra (con confirmación y mayor coste diplomático). La paz se negocia en Diplomacia: *paz blanca* (se devuelve todo) o *status quo* (cada uno se queda lo que ocupa).
- **Economía**: ajusta impuestos, gasto, inversión y presupuesto militar; el panel muestra la proyección antes de aplicar. Si te quedas sin reservas, el déficit se cubre con deuda.
- **Derrota**: pierdes si tu país queda sin territorio o si la estabilidad llega a 3.

## Ejército (MIL · Fase 1)

Batallones con plantilla universal fija (1.000 efectivos; máximo 20 tanques, 30 blindados, 8 artillerías, 40 drones y 20 transportes), tripulación automática (el equipo sin personal queda inactivo), inventario nacional por modelo, reposición automática pausable y reclutamiento voluntario progresivo sin entrenamiento. Ficha ilustrada, totales en multiselección e inventario por ramas en *Ejército*. **Los modelos, estadísticas, tripulaciones y cantidades son provisionales** (`src/data/military.ts`).

## Combate terrestre (MIL · Fase 2)

Combate automático por intervalos de una hora. La potencia depende de efectivos, equipo operativo y tripulado, estadísticas de los modelos, munición, combustible y mantenimiento (presupuesto); **sin** terreno, fortificaciones, bonificación defensiva, moral ni organización. Bajas humanas y vehículos dañados o destruidos por separado; reparación fuera de combate; retirada automática por pérdidas graves y manual; panel de batalla desde Atlas e informes en *Ejército*. Coeficientes provisionales. Documentación: `docs/mil/` (auditoría, matriz MIL-001–171, plan, `FASE1.md` y `FASE2.md`).

## Interacción táctil (MOBILE-001)

- **Toque o arrastre**: un dedo que se mueve 10 px o menos y se levanta antes de 0,7 s es un toque (selecciona); si se mueve más, es un arrastre y no selecciona nada al soltar, aunque empiece o termine sobre un marcador.
- **Pellizco**: el punto del mapa que está entre los dedos se queda entre los dedos; si los dedos se desplazan juntos, el mapa los acompaña. Al levantar un dedo se sigue arrastrando con el otro, sin saltos. Un gesto cancelado por el sistema no selecciona.
- **Límites**: zoom entre 120 y 1450 unidades de mapa de ancho. El encuadre siempre conserva tierra de los 12 países en su zona central (60 %), así que el mapa no se pierde por un arrastre (`src/ui/map/bounds.ts`).
- **Marcadores**: zona táctil de al menos 44 × 44 px.
- **Controles y paneles en horizontal**: el menú de capas, el aviso de orden de marcha y los avisos se ajustan al hueco libre entre los botones del mapa y el tirador del panel; en pantallas estrechas el minimapa se oculta mientras el menú de capas está abierto. Con el panel contraído, el tirador respeta el margen seguro lateral del iPhone.
- Sin cambios en el motor, el guardado ni las mecánicas del juego.

Capturas antes/después (iPhone SE y 15 Pro Max, horizontal) en `docs/mobile-001/`.

## Mapa estratégico (MAP-001)

- **Fronteras**: las internacionales se dibujan con línea clara sobre un borde oscuro; las divisiones regionales del juego, finas y discontinuas.
- **Ciudades** (capa activable): las 12 capitales nacionales (estrella) y La Paz como sede de gobierno de Bolivia (anillo), siempre visibles; 33 ciudades principales (punto) aparecen al acercar. Los nombres se colocan evitando batallones, otros nombres e iconos; si no caben, se ocultan hasta acercar más. Al tocarlas se ve: tipo, país, provincia/estado, región del juego, coordenadas y fuente. **Sin población ni economía propias** (no hay datos verificados en el juego).
- **Pasos fronterizos** (capa activable): 22 pasos reales, 20 terrestres (rombo) y 2 fluviales (círculo azul con línea discontinua entre terminales). Cada uno tiene nombre, países, localidades, coordenadas, precisión y enlaces a sus fuentes. **No cambian todavía el movimiento militar.**
- **Carreteras principales** (capa activable): 20 corredores trazados sobre la red vial real (Natural Earth 1:10m Roads, camino más corto por la red). Sin líneas rectas inventadas ni cálculo de transporte.
- **Previstas** en MAP-001: provincias/estados, puertos y aeropuertos (ya disponibles desde ATLAS-001; ver abajo).

Organización: definiciones con fuentes por país en `src/data/geo/sources/*.def.ts` → `npm run gen:geo` (valida y genera `src/data/geo/geo.generated.json`) → acceso tipado en `src/geo/` → dibujo en `src/ui/map/GeoLayers.tsx`. El motor (`src/engine`) no importa nada de esto (lo comprueba una prueba).

Validación automática del generador: cada paso terrestre debe estar a ≤ 15 km de la frontera de ambos países (resultado: 0–8,3 km); los corredores se descartan si no hay camino continuo o si miden más del doble de la línea recta.

Limitaciones documentadas:
- 7 pasos tienen precisión "localidad" (centro de la ciudad fronteriza), no la estructura exacta.
- Descartados por falta de fuente fiable: Guayaramerín–Guajará-Mirim (la fuente no documenta el transbordador), la coordenada de Leticia del DLCA (error de signo) y un paso vial oficial Guyana–Venezuela (no existe).
- Corredor Caracas–Ciudad Guayana descartado: la red de Natural Earth no tiene trazado continuo.
- Natural Earth asigna mal algunas provincias en su tabla de ciudades; por eso la provincia se calcula por posición sobre los límites administrativos de Natural Earth 1:10m.

## Atlas de mando (ATLAS-001)

Interfaz del mapa rediseñada a partir del prototipo «Atlas de mando», conectada al motor existente (mismo React + TypeScript + SVG + IndexedDB; **sin MapLibre**, sin cambios en reglas, guardado, coordenadas del juego ni detección de toques del motor).

- **Pantalla**: mapa casi a pantalla completa, barra superior compacta, columna de controles flotante (vidrio), panel contextual derecho plegable (al plegarlo el mapa recupera el ancho), selector visible **Continente / Nación / Región** (abreviado en pantallas estrechas). Botones de al menos 32 px de alto y zonas táctiles de 44 px en marcadores.
- **Estilo**: colores de país desaturados (el propio algo más vivo), relieve procedimental discreto ya existente, fronteras nacionales claras y gruesas; estatales finas y tenues.
- **Escalas** (`src/ui/map/scale.ts`): se eligen por densidad (unidades de mapa por píxel), así funcionan igual en iPhone SE y 15 Pro Max. El pellizco actualiza el selector.
  - *Continente*: países, capitales y **una agrupación militar por país** (en su capital, sumando efectivos reales). Sin estados, vías ni instalaciones. Ríos mayores.
  - *Nación*: estados/provincias, autopistas y troncales, ciudades principales, pasos fronterizos, aeropuertos y puertos principales, batallones por región.
  - *Región*: además vías secundarias, todas las instalaciones de la selección con su código IATA, más ríos y nombres de estado.
  - Jerarquía vial tipo Apple Maps: autopista (*Major Highway*), troncal (*Road* con rango ≤ 4) y secundaria (resto), cada una con su grosor.
- **Rótulos**: colocación con candidatos alrededor de cada icono que evita marcadores, iconos, otros rótulos y los controles flotantes; si no cabe, no se dibuja. Las instalaciones ceden el sitio a ciudades, pasos y unidades. Una prueba comprueba, en las tres escalas, que ningún rótulo visible se superpone.
- **Fichas** (`src/ui/panels/InfoCard.tsx`, reutilizable): *Estado* (tipo, país, capital según Natural Earth, región del juego, ciudades del mapa e instalaciones situadas en él; debajo, la ficha de la región del juego con sus datos reales de partida) e *Instalación* (tipo según la fuente, estado, región, coordenadas). **No se muestran poblaciones, producciones ni capacidades inventadas**; el uso de aeropuertos y puertos en la partida figura como *Pendiente*.
- **Simbología militar** (`src/ui/military/`): APP-6 simplificado. El marco indica la relación (propio/aliado rectángulo, hostil rombo, neutral cuadrado; aire, mar y submarino tienen marco propio) y el glifo el tipo. Estructura preparada para infantería, mecanizada, blindados, tanques, artillería, defensa antiaérea, cazas, helicópteros, drones, flotas, buques, submarinos y formaciones compuestas; **solo infantería (batallones) y formación (agrupación continental) existen hoy en el juego**: no se añadieron mecánicas ni se cambió el combate.

Datos (todos reales y verificables, Natural Earth 1:10m v5.1.2, dominio público): 240 estados/provincias de los 12 países (Admin-1; Galápagos excluido por quedar fuera del lienzo del mapa), red vial por jerarquía, ríos y lagos, 79 aeropuertos y 76 puertos (selección de principales de Natural Earth, **no inventario completo**: capas marcadas *Parcial*). Extractos en `data-src/natural-earth/*-sa.geojson` → `npm run gen:atlas` → `src/data/atlas/atlas.generated.json` → acceso tipado en `src/atlas/`. La capital de un estado se toma de Natural Earth solo si coincide en posición y nombre; si no, se muestra "No identificada en la fuente" (45 casos).

Pendiente (visible como tal en la interfaz): bases militares (capa *Prevista*, vacía), inventario completo de puertos y aeropuertos, uso de infraestructura en la partida, tipos de unidad distintos de la infantería, panel de composición y despliegue con datos reales.

Capturas reales (iPhone 15 Pro Max y SE, horizontal) de las tres escalas, la ficha de estado y el panel plegado en `docs/atlas-001/`.

## Ejecutar localmente

```bash
npm install
npm run build        # genera dist/index.html (un único archivo autocontenido)
npm run serve        # http://localhost:4173
```

## Pruebas

```bash
npm test             # 120 pruebas: motor (43, incluida la carga de una partida de la beta 1.0), cartografía (16), encuadre del mapa (4), atlas (7), escalas/simbología (7), ejército (15) y combate (28)
npm run build && npx playwright install chromium && npm run test:e2e   # 61 pruebas táctiles × 2 tamaños de iPhone en horizontal, incluida la regresión integral (npm run test:regression)
SHOTS=1 npx playwright test screenshots   # capturas en docs/map-001/
```

## Desplegar en Cloudflare Pages

1. Sube este repositorio a GitHub.
2. Cloudflare → Workers & Pages → Create → Pages → *Connect to Git* → elige el repositorio.
3. Configuración de compilación: **Build command** `npm run build` · **Build output directory** `dist` · variable `NODE_VERSION = 22`.
4. Cada `git push` a `main` vuelve a publicar.

## Arquitectura

```
src/engine/      Lógica pura, sin interfaz (TypeScript)
  types.ts       Modelo de datos y estado serializable
  time.ts        Reloj: pasos de 1 hora simulada, independiente de los fotogramas
  economy.ts     Actualización diaria, cierre mensual, políticas, transferencias
  diplomacy.ts   Relaciones, ayuda, comercio, apoyo militar, propuestas
  military.ts    Batallones, reclutamiento, mantenimiento, rutas (Dijkstra), movimiento
  war.ts         Guerras, combate horario, ocupación, tratados de paz
  territory.ts   Control de regiones y agregados económicos
  ai.ts          IA por reglas y prioridades
  actions.ts     Dispatcher único: jugador e IA usan las mismas acciones
  setup.ts       Partida nueva
src/persistence/ Guardado (IndexedDB / memoria)
src/ui/          Interfaz React + mapa SVG
src/data/        Datos iniciales (estimados) y mapa generado
scripts/         Generador del mapa y compilación
```

- **Ampliable**: las regiones se definen en `src/data/regionDefs.ts` (con `parentId` opcional). Para añadir provincias o nuevos continentes se añaden definiciones y se ejecuta `npm run gen:map`; el motor no asume un número fijo de regiones. Ministerios, espionaje, tecnología, marina y aviación se añadirían como nuevos módulos del motor con sus acciones en `actions.ts`.
- **Determinista**: el generador aleatorio forma parte del estado, así que cargar una partida y continuar produce exactamente el mismo futuro.

## Decisiones técnicas que difieren del prompt

- **esbuild en lugar de Vite** y **node:test en lugar de Vitest**: el entorno de desarrollo no tenía acceso al registro de npm; esbuild (el compilador que Vite usa internamente) y el ejecutor de pruebas de Node estaban disponibles. El resultado es equivalente: un `index.html` estático. Migrar a Vite/Vitest más adelante es directo.
- **JSX clásico** (`React.createElement`) para poder compilar sin dependencias adicionales.

## Datos

Las cifras iniciales (PIB, deuda, población, etc.) son **simplificadas y estimadas** para el juego, no estadísticas oficiales. Fronteras: Natural Earth 1:50m (dominio público), simplificadas. Ciudades, límites administrativos y carreteras: Natural Earth 1:10m (dominio público). Pasos fronterizos: Wikipedia, latitude.to y DLCA (enlaces en `src/data/geo/sources/crossings.def.ts`).
