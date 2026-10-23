import type { CountryId } from './regionDefs';
import { COUNTRY_DEFS } from './countries';
import { COUNTRY_IDS } from './regionDefs';

/**
 * Sistema militar terrestre (MIL Fase 1).
 *
 * Las CANTIDADES MÁXIMAS de la plantilla son reglas aprobadas (MIL-022…026).
 * Todo lo demás de este archivo son DATOS PROVISIONALES DE PRUEBA (MIL-165):
 * nombres de modelos, estadísticas, tripulaciones, dotación inicial, reservas y
 * ritmo de reclutamiento. No describen equipos ni inventarios reales y la
 * interfaz los marca como provisionales. Sustituirlos aquí no cambia el motor.
 */

export type EquipCategory = 'tank' | 'armored' | 'artillery' | 'drone' | 'transport';
export const EQUIP_CATEGORIES: EquipCategory[] = ['tank', 'armored', 'artillery', 'drone', 'transport'];

/** Plantilla universal y fija de batallón (MIL-001C A, 022–026). */
export const BATTALION_TEMPLATE = {
  maxMen: 1000,
  slots: { tank: 20, armored: 30, artillery: 8, drone: 40, transport: 20 } as Record<EquipCategory, number>,
} as const;

export const CATEGORY_LABEL: Record<EquipCategory, { one: string; many: string }> = {
  tank: { one: 'Tanque', many: 'Tanques' },
  armored: { one: 'Blindado multipropósito', many: 'Blindados' },
  artillery: { one: 'Artillería', many: 'Artillería' },
  drone: { one: 'Dron', many: 'Drones' },
  transport: { one: 'Vehículo de transporte', many: 'Transportes' },
};

/** Orden en el que se asignan las tripulaciones si faltan efectivos (MIL-027/028). */
export const CREW_PRIORITY: EquipCategory[] = ['tank', 'armored', 'artillery', 'drone', 'transport'];

/** Tripulación por categoría. PROVISIONAL: las cifras por modelo están pendientes (MIL-027). */
export const PROVISIONAL_CREW: Record<EquipCategory, number> = { tank: 4, armored: 3, artillery: 6, drone: 2, transport: 2 };

/** Estadísticas simples por modelo (MIL-076). Escala 1–10. Aún no intervienen en el combate (Fase 2). */
export interface ModelStats {
  firepower: number;
  protection: number;
  mobility: number;
}

export interface EquipmentModel {
  id: string;
  country: CountryId;
  category: EquipCategory;
  name: string;
  crew: number;
  stats: ModelStats;
  /** Siempre true en la Fase 1: dato de prueba, no un equipo real. */
  provisional: boolean;
}

const BASE_STATS: Record<EquipCategory, ModelStats> = {
  tank: { firepower: 8, protection: 8, mobility: 5 },
  armored: { firepower: 4, protection: 5, mobility: 7 },
  artillery: { firepower: 9, protection: 2, mobility: 3 },
  drone: { firepower: 3, protection: 1, mobility: 9 },
  transport: { firepower: 0, protection: 2, mobility: 6 },
};

const SHORT: Record<EquipCategory, string> = { tank: 'T', armored: 'B', artillery: 'A', drone: 'D', transport: 'V' };

/** Un modelo provisional por país y categoría; estadísticas diferenciadas según la calidad militar del país. */
export const EQUIPMENT_MODELS: Record<string, EquipmentModel> = {};
for (const c of COUNTRY_IDS) {
  const q = COUNTRY_DEFS[c].quality;
  for (const cat of EQUIP_CATEGORIES) {
    const id = `${c}-${SHORT[cat]}1`;
    const scale = (v: number) => Math.round(Math.min(10, v * (0.75 + 0.25 * q)) * 10) / 10;
    const b = BASE_STATS[cat];
    EQUIPMENT_MODELS[id] = {
      id,
      country: c,
      category: cat,
      name: `${CATEGORY_LABEL[cat].one} ${c}-${SHORT[cat]}1`,
      crew: PROVISIONAL_CREW[cat],
      stats: { firepower: scale(b.firepower), protection: scale(b.protection), mobility: scale(b.mobility) },
      provisional: true,
    };
  }
}

/** Modelo nacional de una categoría (MIL-029 B: patrón universal, modelos nacionales). */
export function nationalModel(c: CountryId, cat: EquipCategory): EquipmentModel {
  return EQUIPMENT_MODELS[`${c}-${SHORT[cat]}1`];
}

/**
 * Dotación inicial PROVISIONAL: fracción de cada hueco de la plantilla que tienen
 * los batallones al empezar, y reserva nacional como fracción de lo asignado.
 */
export const PROVISIONAL_FILL: Record<CountryId, Record<EquipCategory, number> & { reserve: number }> = {
  ARG: { tank: 0.5, armored: 0.6, artillery: 0.6, drone: 0.15, transport: 0.8, reserve: 0.2 },
  BOL: { tank: 0.2, armored: 0.4, artillery: 0.4, drone: 0.05, transport: 0.6, reserve: 0.15 },
  BRA: { tank: 0.6, armored: 0.7, artillery: 0.7, drone: 0.3, transport: 0.85, reserve: 0.25 },
  CHL: { tank: 0.75, armored: 0.7, artillery: 0.7, drone: 0.3, transport: 0.85, reserve: 0.25 },
  COL: { tank: 0.25, armored: 0.6, artillery: 0.6, drone: 0.4, transport: 0.8, reserve: 0.2 },
  ECU: { tank: 0.3, armored: 0.5, artillery: 0.5, drone: 0.15, transport: 0.7, reserve: 0.15 },
  GUY: { tank: 0, armored: 0.2, artillery: 0.25, drone: 0, transport: 0.5, reserve: 0.1 },
  PRY: { tank: 0.15, armored: 0.35, artillery: 0.35, drone: 0.05, transport: 0.6, reserve: 0.15 },
  PER: { tank: 0.45, armored: 0.55, artillery: 0.6, drone: 0.15, transport: 0.75, reserve: 0.2 },
  SUR: { tank: 0, armored: 0.2, artillery: 0.2, drone: 0, transport: 0.5, reserve: 0.1 },
  URY: { tank: 0.3, armored: 0.5, artillery: 0.5, drone: 0.1, transport: 0.7, reserve: 0.15 },
  VEN: { tank: 0.55, armored: 0.6, artillery: 0.6, drone: 0.25, transport: 0.75, reserve: 0.2 },
};

/** Reclutamiento voluntario progresivo (MIL-012/013). PROVISIONAL. */
export const RECRUITMENT = {
  /** Voluntarios con los que se forma un batallón nuevo (ya operativo). */
  initialMen: 250,
  /** Voluntarios que se incorporan por batallón y día. */
  menPerDay: 50,
  /** Máximo de batallones por orden de reclutamiento. */
  maxPerOrder: 5,
};

/**
 * Combate terrestre (MIL Fase 2). TODOS LOS COEFICIENTES SON PROVISIONALES:
 * calibran la duración y la letalidad de las batallas, no proceden de datos reales.
 * Sin terreno, sin fortificaciones y sin bonificación por defender (F2-001 A);
 * sin moral ni organización (F2-002 A).
 */
export const COMBAT = {
  /** Potencia por soldado de infantería. */
  infantryPower: 0.01,
  /** Potencia por vehículo operativo y tripulado = potencia de fuego del modelo × peso de su categoría. */
  categoryWeight: { tank: 0.06, armored: 0.03, artillery: 0.08, drone: 0.015, transport: 0 } as Record<EquipCategory, number>,
  /** Tecnología: 1,0 para todos hasta la Fase 9 (investigación). */
  technology: 1,
  /** Mantenimiento: potencia × (mín + (1 − mín) × abastecimiento presupuestario, máx. 1). */
  maintenanceMin: 0.6,
  /** Daño por punto de potencia y hora. */
  damagePerPower: 0.45,
  /** Variación aleatoria del daño (determinista con la semilla): ±15 %. */
  damageSpread: 0.15,
  /** Protección máxima de la infantería gracias a los blindados (reduce bajas humanas). */
  maxShield: 0.3,
  /** Divisor del blindaje: Σ(vehículos operativos × protección) / shieldDivisor. */
  shieldDivisor: 2000,
  /** Impactos esperados contra vehículos por punto de daño. */
  vehicleHitsPerDamage: 0.03,
  /** Probabilidad base de que un impacto destruya (si no, daña); se reduce con la protección del modelo. */
  destroyChance: 0.4,
  protectionDivisor: 15,
  /** Retirada automática por pérdidas graves (respecto a la entrada en la batalla). */
  retreatMenLoss: 0.4,
  retreatVehicleLoss: 0.6,
  retreatMinVehicles: 10,
  /** Por debajo de estos efectivos el batallón queda destruido. */
  destroyedBelowMen: 150,
};

/** Suministros simplificados por batallón: carga 0–1 de combustible y munición (MIL-035). PROVISIONAL. */
export const SUPPLY = {
  /** 72 horas de combate continuo con la carga completa. */
  ammoPerCombatHour: 1 / 72,
  fuelPerCombatHour: 1 / 96,
  fuelPerMarchHour: 1 / 144,
  /** Por debajo de este nivel empiezan las penalizaciones. */
  shortage: 0.2,
  /** Potencia mínima sin munición (fracción) y de los vehículos sin combustible. */
  ammoFloor: 0.25,
  fuelFloor: 0.3,
  /** Velocidad mínima de marcha sin combustible (a pie). */
  fuelSpeedFloor: 0.5,
  /**
   * Reabastecimiento diario fuera de combate (fracción de carga), × abastecimiento
   * presupuestario. IGUAL en cualquier territorio: depender del territorio
   * favorecería al controlador de la región (F2-001 A).
   */
  dailyResupply: 0.5,
};

/** Reparación diaria de vehículos dañados fuera de combate (MIL-137 B). PROVISIONAL. */
export const REPAIR = {
  /** Fracción de los dañados que se reparan al día con mantenimiento completo. */
  dailyRate: 0.25,
  /** Sin reparaciones si el abastecimiento presupuestario baja de aquí. */
  minSupplyRatio: 0.3,
};

/** Ataque directo sin declaración (MIL-082 B): consecuencias diplomáticas adicionales. PROVISIONAL. */
export const DIRECT_ATTACK = {
  thirdPartyRelation: -10,
  attackerStability: -4,
};
