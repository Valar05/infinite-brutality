# Outlaw vehicle runtime asset

Authority: **after-clearance accepted**.

The former wheel-clearance experiment was explicitly accepted by Drew on 2026-09-22 and is now the production geometry authority for the Outlaw truck. The pre-clearance model is historical comparison only.

Runtime asset:
- `https://valar05.github.io/model-viewer-lab/models/outlaw/Outlaw_Complete_Clearance_TEXTURED.glb`
- generated from the provenance-locked accepted clearance source in `Valar05/model-viewer-lab`
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


## Cockpit and handling authority

The production driving perspective is first-person, Half-Life 2 style: the driver camera lives inside the same world-space truck that renders the exterior. The exterior is not replaced by a separate cockpit-only scene.

The minimum interior currently includes:
- dashboard and brow
- center console
- driver seat
- steering column and visible steering wheel
- instrument cluster

Handling donor: `Valar05/long-haul`.

Ported behavior family:
- wheelbase steering using the Outlaw's actual ~3.528 m axle spacing
- Long Haul steering response / return shape
- speed-gated drift buildup
- lateral slip
- delayed heading recovery
- grip-based momentum alignment
- turn-look yaw
- reduced first-person-safe turn roll

Long Haul's 160 mph envelope is intentionally not copied. The Outlaw uses a grounded lower speed envelope while preserving the donor's handling relationships.

Camera:
- default: cockpit / first person
- debug: chase camera for wheel and steering inspection
- keyboard toggle: `C`
- direct URL debug mode: `?vehicle=outlaw&vehicleCamera=debug`
