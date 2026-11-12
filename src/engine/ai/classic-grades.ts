/** ALG-AI-003: recovered DOS 2.05C computer setup grades.
 * The original executable stores grade 1 or 2 in ES:840[player].
 * These are NOT verified player-facing difficulty labels.
 * Keep this module independent of the frozen experimental modern AI.
 */
export type DosComputerGrade = 1 | 2;
export type AiPolicy = {kind:'classic-dos';grade:DosComputerGrade} | {kind:'modern-experimental'};

/** The 12 mode bytes ES:62E8[0..11] are all set to 1 for grade 2, else 0. */
export function dosAiModeFlags(grade:DosComputerGrade):ReadonlyArray<0|1> {
  if(grade!==1&&grade!==2)throw new Error('Unsupported DOS computer grade.');
  return Array.from({length:12},()=>grade===2?1:0);
}

/** Recovered 0xDE40 combat helper factor, not a generic strength multiplier. */
export function dosAiCombatFactor(grade:DosComputerGrade):4|5 {
  if(grade!==1&&grade!==2)throw new Error('Unsupported DOS computer grade.');
  return grade===1?4:5;
}

/** Recovered 0x199C5 per-player grade-B indicator (ES:504). */
export function dosAiGradeBFlag(grade:DosComputerGrade):0|1 {
  if(grade!==1&&grade!==2)throw new Error('Unsupported DOS computer grade.');
  return grade===2?1:0;
}
