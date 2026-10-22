# Plan de implementación del sistema militar

Cada fase es una rama y un Pull Request en borrador independientes. Ninguna se fusiona ni se publica sin aprobación del usuario. Cada PR incluye: resumen, matriz MIL (cubierto/parcial/pendiente), archivos tocados, pruebas reales, capturas de iPhone horizontal, riesgos, migración, reversión y siguiente fase.

Reglas de todas las fases: no modificar decisiones aprobadas; no inventar datos reales (lo provisional se marca); toda regla en `src/engine` y a través de `perform` (jugador e IA iguales); proteger Atlas, gestos y guardado (sus pruebas e2e se ejecutan en cada PR).

| Fase | Contenido | Decisiones principales | Depende de |
|---|---|---|---|
| **F0** | Auditoría, matriz, conflictos, plan de migración (este documento) | 162, 171 | — |
| **F1** | Plantilla universal de batallón (1.000 efectivos; 20 tanques, 30 blindados, 8 artillerías, 40 drones, 20 transportes), tripulación automática parametrizable, modelos nacionales **provisionales**, batallones completos e incompletos, inventario nacional por modelo, reposición automática pausable, reclutamiento voluntario progresivo sin entrenamiento, reclutar varios, ficha ilustrada, multiselección con totales, inventario por ramas (Tierra), duración de las marchas, 5 min/día y ×1/×2/×4, pausa al cerrar, guardado v2 con migración | 001, 004, 005, 012, 013, 016–019, 022–034, 038, 039, 076 (provisional), 142–145, 149–158, 163–166 | F0 |
| **F2** | Combate terrestre por intervalos con fuerza multivariable (equipo operativo incluido), bajas humanas y materiales, daños y reparación, combustible y munición, retirada automática por pérdidas y manual, ataque directo, ocupación de jure/de facto con economía ocupada como propia, rendición, informe y panel de batalla; IA con las mismas reglas | 035–037, 040, 041, 077, 078, 082–088, 092–095, 100, 132–141, 159, 167 | F1 + respuestas §4 de la auditoría |
| **F3** | Industria y economía militar: presupuesto separado (salarios, mantenimiento, operaciones) y compras, fabricación y compra con plazos de entrega, precios por modelo, industria limitada y ampliable, restricciones comerciales | 014, 015, 020, 021, 072, 073, 079, 080, 098 | F2; precios y capacidades |
| **F4** | Aviación: inventario nacional, escuadrones administrativos, bombardeo como única misión ofensiva manual, interceptación automática configurable, consumo, pérdidas, panel aéreo | 009, 052–061, 096, 146 | F3; roles de helicópteros y transporte |
| **F5** | Armada y desembarcos: seis clases, flotas configurables, posición y desplazamiento marítimo, puertos y reparación, combate, bloqueo, patrulla, bombardeo costero, transporte anfibio | 062–071, 097, 147 | F3; espacio marítimo en Atlas |
| **F6** | Defensa aérea por estado, niveles I–V, cobertura, interceptación, munición, capacidad, activación, compra y mejora | 042–051 | F4 |
| **F7** | Misiles convencionales (crucero y balísticos, instalaciones localizadas) y nuclear (inventario agregado, programa, disuasión, tratados, confirmación explícita, contador) | 102–121 | F6 |
| **F8** | Diplomacia militar: alianzas, una coalición mundial formal, ayuda y transferencias con tiempo, venta de armas, sanciones, bases extranjeras, alto el fuego, objetivos conjuntos | 089–091, 122–131 | F3 |
| **F9** | Investigación y modernización: árbol con dinero y tiempo, bonificaciones y sustitución automática gratuita (excepción ratificada MIL-075/081) | 074, 075, 081 | Especificación de equivalencias |
| **F10** | Avisos con navegación al evento, informes, optimización y ampliación del mundo | 160, 161 | — |

F3 (industria) va antes de las ramas aérea y naval porque todas necesitan fabricación, compra y precios. Es una propuesta técnica: si el usuario prefiere otro orden, se ajusta sin cambiar reglas de producto.
