# Outlaw vehicle runtime asset

Authority: **after-clearance accepted**.

The former wheel-clearance experiment was explicitly accepted by Drew on 2026-09-22 and is now the production geometry authority for the Outlaw truck. The pre-clearance model is historical comparison only.

Runtime asset:
- `Outlaw_Complete_Clearance_TEXTURED.glb`
- Z-up source converted at presentation/runtime level
- wheel radius: ~0.54 m
- front axle mesh centers: x ~ -1.86375
- rear axle mesh centers: x ~ 1.66425

Named wheel assemblies used by runtime:
- WHEEL_FL / RIM_FL / HUB_FL
- WHEEL_FR / RIM_FR / HUB_FR
- WHEEL_RL / RIM_RL / HUB_RL
- WHEEL_RR / RIM_RR / HUB_RR

First mobility proof is deliberately narrow: Rapier kinematic collision/contact, forward/reverse speed integration, front steering, wheel spin, and chase camera. It does not claim suspension, drivetrain, tire-force simulation, or final vehicle physics.
