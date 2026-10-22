import type { CountryId } from './regionDefs';

/**
 * Datos iniciales SIMPLIFICADOS Y ESTIMADOS (orden de magnitud aproximado a
 * mediados de la década de 2020). No son estadísticas oficiales actuales.
 *
 * gdp: PIB anual (miles de millones USD) · pop: millones de habitantes
 * tax / spending / investment / military: % del PIB
 * reserves / debt: miles de millones USD · growth: % anual tendencial
 * stability: 0-100 · quality: calidad militar relativa · units: batallones iniciales
 * aggression: propensión de la IA a iniciar guerras (0-1)
 */
export interface CountryDef {
  id: CountryId;
  name: string;
  short: string;
  color: string;
  gdp: number;
  pop: number;
  tax: number;
  spending: number;
  investment: number;
  military: number;
  reserves: number;
  debt: number;
  growth: number;
  stability: number;
  quality: number;
  units: number;
  aggression: number;
}

export const COUNTRY_DEFS: Record<CountryId, CountryDef> = {
  ARG: { id: 'ARG', name: 'Argentina', short: 'ARG', color: '#6fa8dc', gdp: 640, pop: 46, tax: 24, spending: 19, investment: 2.5, military: 0.6, reserves: 30, debt: 400, growth: 1.5, stability: 55, quality: 1.0, units: 4, aggression: 0.1 },
  BOL: { id: 'BOL', name: 'Bolivia', short: 'BOL', color: '#93c47d', gdp: 46, pop: 12.3, tax: 27, spending: 19, investment: 4, military: 1.2, reserves: 2, debt: 38, growth: 2, stability: 45, quality: 0.85, units: 3, aggression: 0.1 },
  BRA: { id: 'BRA', name: 'Brasil', short: 'BRA', color: '#7fbf63', gdp: 2200, pop: 214, tax: 33, spending: 27, investment: 3, military: 1.1, reserves: 350, debt: 1650, growth: 2.3, stability: 60, quality: 1.05, units: 8, aggression: 0.08 },
  CHL: { id: 'CHL', name: 'Chile', short: 'CHL', color: '#d06b6b', gdp: 330, pop: 19.6, tax: 22, spending: 17, investment: 3, military: 1.5, reserves: 45, debt: 130, growth: 2.2, stability: 65, quality: 1.15, units: 4, aggression: 0.1 },
  COL: { id: 'COL', name: 'Colombia', short: 'COL', color: '#e8c95a', gdp: 360, pop: 52, tax: 23, spending: 16, investment: 3, military: 3.0, reserves: 60, debt: 200, growth: 2, stability: 55, quality: 1.1, units: 6, aggression: 0.1 },
  ECU: { id: 'ECU', name: 'Ecuador', short: 'ECU', color: '#e6a04d', gdp: 120, pop: 18, tax: 22, spending: 16, investment: 2.5, military: 2.0, reserves: 8, debt: 70, growth: 1.5, stability: 45, quality: 0.9, units: 3, aggression: 0.1 },
  GUY: { id: 'GUY', name: 'Guyana', short: 'GUY', color: '#56b6a6', gdp: 17, pop: 0.8, tax: 22, spending: 14, investment: 6, military: 0.6, reserves: 1, debt: 4, growth: 10, stability: 60, quality: 0.8, units: 1, aggression: 0.02 },
  PRY: { id: 'PRY', name: 'Paraguay', short: 'PRY', color: '#c27ba0', gdp: 44, pop: 7, tax: 15, spending: 11, investment: 3, military: 1.0, reserves: 10, debt: 18, growth: 3.5, stability: 60, quality: 0.85, units: 2, aggression: 0.08 },
  PER: { id: 'PER', name: 'Perú', short: 'PER', color: '#c9705a', gdp: 270, pop: 34, tax: 18, spending: 14, investment: 3, military: 1.1, reserves: 70, debt: 90, growth: 2.7, stability: 45, quality: 1.0, units: 4, aggression: 0.1 },
  SUR: { id: 'SUR', name: 'Surinam', short: 'SUR', color: '#9c8fd6', gdp: 4, pop: 0.6, tax: 24, spending: 17, investment: 3, military: 0.8, reserves: 1.2, debt: 3.5, growth: 2.5, stability: 50, quality: 0.7, units: 1, aggression: 0.02 },
  URY: { id: 'URY', name: 'Uruguay', short: 'URY', color: '#5fa0c9', gdp: 80, pop: 3.4, tax: 29, spending: 24, investment: 2.5, military: 1.9, reserves: 17, debt: 50, growth: 2, stability: 75, quality: 1.0, units: 2, aggression: 0.03 },
  VEN: { id: 'VEN', name: 'Venezuela', short: 'VEN', color: '#b48cd9', gdp: 100, pop: 28, tax: 20, spending: 12, investment: 2, military: 2.5, reserves: 10, debt: 110, growth: 2, stability: 40, quality: 0.9, units: 5, aggression: 0.35 },
};

/** Relaciones iniciales especiales (por defecto: vecinos +15, resto +5). */
export const INITIAL_RELATIONS: [CountryId, CountryId, number][] = [
  ['VEN', 'GUY', -55],
  ['CHL', 'BOL', -35],
  ['CHL', 'PER', -5],
  ['COL', 'VEN', -25],
  ['ECU', 'PER', 5],
  ['ARG', 'URY', 45],
  ['ARG', 'BRA', 35],
  ['BRA', 'URY', 40],
  ['BRA', 'PRY', 35],
  ['ARG', 'CHL', 15],
  ['ARG', 'PRY', 25],
  ['BOL', 'PRY', 10],
  ['GUY', 'SUR', 30],
  ['COL', 'ECU', 30],
  ['VEN', 'BOL', 30],
  ['VEN', 'BRA', 10],
];
