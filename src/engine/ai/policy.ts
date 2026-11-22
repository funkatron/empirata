import type { Game } from '../types.js';
import type { AiPolicy } from './classic-grades.js';

/** Default for new campaigns (slice E): Classic DOS grade A. */
export const DEFAULT_AI_POLICY: AiPolicy = { kind: 'classic-dos', grade: 1 };

// Frozen: modern-experimental AI receives no further development.
// Legacy saves that omit aiPolicy resolve here; new campaigns default to classic-dos.
/** Pre-0.6 saves and rules-lab fixtures that omit `aiPolicy` keep modern behavior. */
export const LEGACY_IMPLICIT_AI_POLICY: AiPolicy = { kind: 'modern-experimental' };

/** Effective opponent policy for play/saves. */
export function resolveAiPolicy(game: Game): AiPolicy {
  return game.aiPolicy ?? LEGACY_IMPLICIT_AI_POLICY;
}

export function isClassicDosPolicy(policy: AiPolicy): policy is Extract<AiPolicy, { kind: 'classic-dos' }> {
  return policy.kind === 'classic-dos';
}

/** Player-facing label for campaign UI and reports. */
export function formatAiPolicyLabel(policy: AiPolicy): string {
  if (policy.kind === 'modern-experimental') return 'Modern (experimental, frozen)';
  return `Classic DOS · computer grade ${policy.grade}`;
}