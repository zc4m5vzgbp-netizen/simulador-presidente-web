/**
 * Punto de entrada único para TODAS las acciones de juego.
 * El jugador (desde la interfaz) y la IA usan exactamente este dispatcher,
 * de modo que ambos respetan las mismas reglas.
 */
import type { CountryId, GameState, PeaceTerms, Policy, ProposalKind } from './types';
import { fail, type ActionResult } from './core';
import { payDebt, setPolicy } from './economy';
import { disband, moveUnit, recruit } from './military';
import { cancelTrade, improveRelations, propose, respondProposal, sendAid, worsenRelations } from './diplomacy';
import { declareWar } from './war';

export type Action =
  | { type: 'setPolicy'; patch: Partial<Policy> }
  | { type: 'payDebt'; amount: number }
  | { type: 'recruit'; regionId: string }
  | { type: 'disband'; unitId: string }
  | { type: 'move'; unitId: string; target: string }
  | { type: 'improveRelations'; target: CountryId }
  | { type: 'worsenRelations'; target: CountryId }
  | { type: 'sendAid'; target: CountryId; amount: number }
  | { type: 'propose'; target: CountryId; kind: ProposalKind; terms?: PeaceTerms; warId?: string }
  | { type: 'cancelTrade'; target: CountryId }
  | { type: 'declareWar'; target: CountryId }
  | { type: 'respondProposal'; proposalId: string; accept: boolean };

export function perform(state: GameState, actor: CountryId, action: Action): ActionResult {
  if (state.countries[actor].eliminated) return fail('Tu país ya no controla territorio.');
  if (state.gameOver && actor === state.player) return fail('La partida ha terminado.');
  switch (action.type) {
    case 'setPolicy': return setPolicy(state, actor, action.patch);
    case 'payDebt': return payDebt(state, actor, action.amount);
    case 'recruit': return recruit(state, actor, action.regionId);
    case 'disband': return disband(state, actor, action.unitId);
    case 'move': return moveUnit(state, actor, action.unitId, action.target);
    case 'improveRelations': return improveRelations(state, actor, action.target);
    case 'worsenRelations': return worsenRelations(state, actor, action.target);
    case 'sendAid': return sendAid(state, actor, action.target, action.amount);
    case 'propose': return propose(state, actor, action.target, { kind: action.kind, terms: action.terms, warId: action.warId });
    case 'cancelTrade': return cancelTrade(state, actor, action.target);
    case 'declareWar': return declareWar(state, actor, action.target);
    case 'respondProposal': {
      const p = state.proposals.find((x) => x.id === action.proposalId);
      if (p && p.to !== actor) return fail('Esa propuesta no es para ti.');
      return respondProposal(state, action.proposalId, action.accept);
    }
  }
}
