import type { Game } from '../types.js';
import type { AiPolicy } from './classic-grades.js';

export const DEFAULT_AI_POLICY: AiPolicy = { kind: 'modern-experimental' };

/** Effective opponent policy. Omitted saves keep the modern experimental executor. */
export function resolveAiPolicy(game: Game): AiPolicy {
  return game.aiPolicy ?? DEFAULT_AI_POLICY;
}

export function isClassicDosPolicy(policy: AiPolicy): policy is Extract<AiPolicy, { kind: 'classic-dos' }> {
  return policy.kind === 'classic-dos';
}

/** Player-facing label for campaign UI and reports. */
export function formatAiPolicyLabel(policy: AiPolicy): string {
  if (policy.kind === 'modern-experimental') return 'Modern (experimental)';
  return `Classic DOS · computer grade ${policy.grade}`;
}