# Simulador de Presidente · Beta 1.0 (web)

Juego de estrategia geopolítica por turnos en tiempo real, ambientado en Sudamérica. Eliges uno de los 12 países soberanos y lo gobiernas: economía, diplomacia y ejército. Los otros 11 países los maneja una IA basada en reglas.

Funciona en el navegador (también en iPhone, con controles táctiles), sin servidor: toda la simulación corre en el dispositivo y las partidas se guardan en IndexedDB.

## Interfaz (UI-001)

Diseñada para jugar **en horizontal** en iPhone: barra superior con los indicadores del país y el tiempo, navegación lateral (Mapa, Economía, Diplomacia, Ejército, Gobierno, Investigación, Espionaje, Estadísticas), mapa en el centro y un panel derecho contraíble que muestra el país, la región o los batallones seleccionados. En vertical aparece un aviso para girar el teléfono y la partida se pausa (Safari no permite bloquear la orientación desde una web). Gobierno, Investigación y Espionaje están marcadas como "en desarrollo". El mapa está organizado en capas (`src/ui/map/layers.ts`) con huecos reservados para carreteras, pasos fronterizos, ciudades, puertos y aeropuertos, todavía vacíos.

## Cómo jugar

- **Tiempo**: pausa, normal (1 día = 60 s), rápida (×10) y muy rápida (×60). La partida empieza en pausa el 1 de enero de 2027.
- **Mapa**: arrastra para moverte, pellizca para hacer zoom. Toca una región para ver su información.
- **Mover tropas**: toca un marcador de tus batallones (número dorado), pulsa **Mover** en el panel derecho y luego toca la región de destino. Solo puedes entrar en territorio propio, aliado o de un país con el que estés en guerra.
- **Guerra**: Diplomacia → país → *Declarar la guerra*. Las regiones sin defensores se ocupan tras 1 día (2 días las capitales). La ocupación transfiere el 50 % de su PIB al ocupante. La paz se negocia en Diplomacia: *paz blanca* (se devuelve todo) o *status quo* (cada uno se queda lo que ocupa).
- **Economía**: ajusta impuestos, gasto, inversión y presupuesto militar; el panel muestra la proyección antes de aplicar. Si te quedas sin reservas, el déficit se cubre con deuda.
- **Derrota**: pierdes si tu país queda sin territorio o si la estabilidad llega a 3.

## Ejecutar localmente

```bash
npm install
npm run build        # genera dist/index.html (un único archivo autocontenido)
npm run serve        # http://localhost:4173
```

## Pruebas

```bash
npm test             # 43 pruebas del motor (node:test), incluida la carga de una partida de la beta 1.0
npm run build && npx playwright install chromium && npm run test:e2e   # 14 pruebas táctiles × 2 tamaños de iPhone en horizontal
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

Las cifras iniciales (PIB, deuda, población, etc.) son **simplificadas y estimadas** para el juego, no estadísticas oficiales. Fronteras: Natural Earth 1:50m (dominio público), simplificadas.
