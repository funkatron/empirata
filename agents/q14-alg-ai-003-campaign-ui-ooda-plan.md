# Q14 OODA plan — campaign AI policy + grade (ALG-AI-003 UI)

## Observe
- `Game.aiPolicy` + save validation exist; `resolveAiPolicy` defaults to modern. No campaign menu wiring.
- Classic executor runs when `classic-dos` + grade 1/2 on save; labs set policy only in tests.

## Orient
- Migration step **(2)**: game-level policy/difficulty with save/replay coverage.
- Default remains **modern** when control is “Modern (experimental)”.
- Lab fixtures unchanged unless user picks classic in campaign.

## Decide
- Game menu: opponent policy + classic grade (grade disabled unless classic).
- `makeCampaignMap` stores `aiPolicy`; start/restart campaign preserves policy; toast/scenario line shows label.
- Release **v0.5.3** patch for user-visible campaign setup.

## Act
- PR `cursor/q14-campaign-ai-policy-85b7`.