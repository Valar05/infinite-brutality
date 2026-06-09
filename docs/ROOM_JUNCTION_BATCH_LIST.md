# Infinite Brutality Room Junction Batch List

Build context: `0.7.3` measured Quake route room. Fresh screenshot evidence: `/storage/emulated/0/Pictures/Screenshots/Screenshot_20260608-212752.png`.

The visual language is now strong enough to batch rooms: flat vector stone, bronze bridge slabs, bone/skull gates, dark chunky walls, and corpsefire route markers. The next bottleneck is topology coverage.

## Connector Answer

Your instinct is right if we are talking about authored variety: four-connector rooms need the fewest variants, while one-connector terminals need many flavors because they carry starts, exits, switches, secrets, rewards, traps, and vistas.

For generated-level frequency, the weighting should be different:

- `2-connector` rooms should be most common in play. They are the route workhorses.
- `3-connector` rooms are next. They create choice, loops, and return shortcuts.
- `1-connector` terminals should be semantically rich but not overused.
- `4-connector` hubs should be rare, compact, and authored hard.

Recommended runtime frequency: `1c 18%`, `2c 52%`, `3c 23%`, `4c 7%`.

Recommended overnight batch coverage: `1c 14`, `2c 20`, `3c 10`, `4c 4`.

## Prompt Contract

Every room prompt should include:

- Connector signature: horizontal `N/E/S/W`, optional vertical `U/D`.
- One route sentence, not a room theme paragraph.
- One movement test: running jump, lip timing, air steering, stair/ramp climb, recovery, shortcut read, or combat footwork.
- One dominant landmark visible from entry.
- One safe recovery affordance for risky jumps unless the room is a deliberate terminal.
- No crouch vocabulary. No generic boxes with scattered junk.
- Do not copy Quake layouts or assets; use abstract lessons only.

## Batch Rooms

### ib_1c_start_runway
- Junction: `1c_terminal`
- Connectors: `S`; vertical overlays: `none`
- Route sentence: `entry_read -> acceleration_runway -> first_lip_preview`
- Role: `start`
- Prompt: Small spawn hall that teaches the material language and shows a future goal through a framed gap.
- Movement test: Player can build run speed before first commitment without clutter.

### ib_1c_exit_skull_gate
- Junction: `1c_terminal`
- Connectors: `N`; vertical overlays: `none`
- Route sentence: `final_landing -> skull_gate_read -> reward_lock`
- Role: `exit`
- Prompt: Compact goal chamber with skull gate, corpsefire markers, and a clear arrival pad.
- Movement test: Exit is visible from entry line but not framed as a giant empty box.

### ib_1c_secret_drop_cache
- Junction: `1c_terminal`
- Connectors: `W`; vertical overlays: `D`
- Route sentence: `side_nick -> drop_step -> cache_landing -> return_read`
- Role: `secret`
- Prompt: A small optional drop/cache with one visible way back, using bone/bronze reward markers.
- Movement test: Drop is forgiving and return route is obvious.

### ib_1c_switch_niche
- Junction: `1c_terminal`
- Connectors: `E`; vertical overlays: `none`
- Route sentence: `tight_entry -> switch_landmark -> route_change_signal`
- Role: `switch`
- Prompt: A switch alcove that exists to change another room, not to be a random dead end.
- Movement test: Switch is framed from the connector and has enough floor for combat turn-around.

### ib_1c_ambush_cup
- Junction: `1c_terminal`
- Connectors: `S`; vertical overlays: `none`
- Route sentence: `entry_threshold -> short_bowl -> cover_pillar -> exit_backtrack`
- Role: `ambush`
- Prompt: A tight combat cup with one chunky central blocker and side footwork lanes.
- Movement test: Player can circle a single landmark; no prop scatter.

### ib_1c_vista_goal_tease
- Junction: `1c_terminal`
- Connectors: `N`; vertical overlays: `none`
- Route sentence: `entry_read -> barred_goal_view -> return_with_memory`
- Role: `vista`
- Prompt: A view chamber that shows a later bridge/gate across a void without allowing access yet.
- Movement test: The tease should improve route memory, not become decoration.

### ib_1c_upper_reward_perch
- Junction: `1c_terminal`
- Connectors: `W`; vertical overlays: `U`
- Route sentence: `stair_lip -> upper_perch -> reward_marker -> safe_turnaround`
- Role: `reward`
- Prompt: A small upper ledge reward reached by stairs or ramp lip.
- Movement test: Player has enough width to turn and jump back safely.

### ib_1c_low_recovery_sump
- Junction: `1c_terminal`
- Connectors: `E`; vertical overlays: `D`
- Route sentence: `fall_recovery -> corpsefire_breadcrumb -> stair_return`
- Role: `recovery`
- Prompt: A lower recovery pocket beneath risky jumps, with a fast readable return.
- Movement test: Falling costs time but does not feel like death unless marked as hazard.

### ib_1c_locked_shrine
- Junction: `1c_terminal`
- Connectors: `N`; vertical overlays: `none`
- Route sentence: `locked_view -> key_socket -> compact_goal`
- Role: `locked`
- Prompt: A locked terminal shrine that makes a future key/switch route meaningful.
- Movement test: Player reads why it is blocked immediately.

### ib_1c_trial_lip
- Junction: `1c_terminal`
- Connectors: `S`; vertical overlays: `none`
- Route sentence: `short_runway -> single_lip_gap -> landing_marker`
- Role: `movement_trial`
- Prompt: A small one-jump practice room for bridge/ramp lip timing.
- Movement test: Jump is one clear verb: running jump plus air steering.

### ib_1c_enemy_balcony
- Junction: `1c_terminal`
- Connectors: `E`; vertical overlays: `U`
- Route sentence: `entry_floor -> upper_enemy_read -> stair_or_side_route`
- Role: `combat_perch`
- Prompt: A compact balcony with one enemy/readable threat above the entry.
- Movement test: Threat teaches vertical aim and movement without becoming a maze.

### ib_1c_blood_deadfall
- Junction: `1c_terminal`
- Connectors: `W`; vertical overlays: `none`
- Route sentence: `entry_read -> deadfall_landmark -> reward_or_switch`
- Role: `hazard_terminal`
- Prompt: A guillotine/deadfall terminal used as a setpiece and route punctuation.
- Movement test: Hazard silhouette is readable before player commits.

### ib_1c_return_shortcut_receiver
- Junction: `1c_terminal`
- Connectors: `N`; vertical overlays: `D`
- Route sentence: `one_way_arrival -> unlock_read -> return_to_hub`
- Role: `shortcut_receiver`
- Prompt: A receiver pocket for one-way drops or teleporter-like returns, with physical return logic where possible.
- Movement test: Arrival orientation points player back toward the known route.

### ib_1c_boss_key_cell
- Junction: `1c_terminal`
- Connectors: `S`; vertical overlays: `none`
- Route sentence: `entry_squeeze -> key_plinth -> exit_backtrack_pressure`
- Role: `key_reward`
- Prompt: A compact key/reward cell with one route back and a pressure beat.
- Movement test: Reward pickup sits on a route sentence, not in random clutter.

### ib_2c_straight_lip_bridge
- Junction: `2c_straight`
- Connectors: `S,N`; vertical overlays: `none`
- Route sentence: `entry_read -> acceleration_runway -> lip -> bridge_landing -> exit_read`
- Role: `crossing`
- Prompt: Straight compact bridge room with one measured jump line and side rails.
- Movement test: Forward run builds naturally before the lip.

### ib_2c_straight_low_high
- Junction: `2c_straight`
- Connectors: `S,N`; vertical overlays: `U`
- Route sentence: `entry_floor -> stair_lip -> upper_exit`
- Role: `climb`
- Prompt: Straight low-to-high room with staggered stair/ramp lips.
- Movement test: Height change teaches next landing before jump.

### ib_2c_straight_high_low
- Junction: `2c_straight`
- Connectors: `N,S`; vertical overlays: `D`
- Route sentence: `upper_entry -> visible_lower_goal -> drop_or_stair_recovery`
- Role: `descent`
- Prompt: Straight high-to-low descent with a safer stair line and faster drop.
- Movement test: Drop is optional speed expression, not required blind fall.

### ib_2c_straight_split_bridge
- Junction: `2c_straight`
- Connectors: `S,N`; vertical overlays: `none`
- Route sentence: `entry_read -> forked_bridge_choice -> merge_landing`
- Role: `choice`
- Prompt: Two parallel bridge lines: wider safe line and narrower fast line.
- Movement test: Both lines fit in one visible composition.

### ib_2c_straight_hazard_gutter
- Junction: `2c_straight`
- Connectors: `S,N`; vertical overlays: `none`
- Route sentence: `runway -> blood_gutter_lip -> offset_landing`
- Role: `hazard_crossing`
- Prompt: Straight route over a narrow blood gutter with recoverable side ledge.
- Movement test: Hazard supports timing, not punishment spam.

### ib_2c_straight_gallery_return
- Junction: `2c_straight`
- Connectors: `S,N`; vertical overlays: `none`
- Route sentence: `direct_bridge -> side_gallery_recovery -> merge_exit`
- Role: `recovery_line`
- Prompt: Straight main bridge with one side gallery that rejoins before the exit.
- Movement test: Side gallery is slower but clearly safe.

### ib_2c_corner_left_lip
- Junction: `2c_corner`
- Connectors: `S,W`; vertical overlays: `none`
- Route sentence: `entry_runway -> left_turn_lip -> landing_read`
- Role: `corner`
- Prompt: Left-turn room where air steering matters across an angled gap.
- Movement test: Player sees the turn before committing.

### ib_2c_corner_right_lip
- Junction: `2c_corner`
- Connectors: `S,E`; vertical overlays: `none`
- Route sentence: `entry_runway -> right_turn_lip -> landing_read`
- Role: `corner`
- Prompt: Right-turn room with a matching but not mirrored silhouette.
- Movement test: Air correction matters but landing is forgiving.

### ib_2c_corner_switchback_low
- Junction: `2c_corner`
- Connectors: `E,N`; vertical overlays: `U`
- Route sentence: `entry_floor -> switchback_stairs -> upper_exit`
- Role: `switchback`
- Prompt: Tight switchback climb around one chunky wall mass.
- Movement test: No open box floor; route wraps the mass.

### ib_2c_corner_drop_return
- Junction: `2c_corner`
- Connectors: `W,N`; vertical overlays: `D`
- Route sentence: `entry_high -> drop_choice -> stair_return_exit`
- Role: `descent_corner`
- Prompt: Corner descent with fast drop and safer wraparound stair.
- Movement test: Both exits visible from the high entry.

### ib_2c_corner_enemy_overlook
- Junction: `2c_corner`
- Connectors: `S,E`; vertical overlays: `U`
- Route sentence: `entry_read -> enemy_overlook -> side_stair -> exit`
- Role: `combat_corner`
- Prompt: Corner route with a single upper enemy balcony as a readable pressure source.
- Movement test: Balcony supports route pressure, not clutter.

### ib_2c_corner_skull_gate_tease
- Junction: `2c_corner`
- Connectors: `W,N`; vertical overlays: `none`
- Route sentence: `blocked_goal_view -> side_turn -> exit_gate_read`
- Role: `goal_tease`
- Prompt: Corner that shows the goal ahead but sends player around one bend.
- Movement test: Goal tease improves navigation.

### ib_2c_vertical_up_stack
- Junction: `2c_vertical`
- Connectors: `S,N`; vertical overlays: `U`
- Route sentence: `entry_read -> ramp_lip -> mid_landing -> upper_exit`
- Role: `vertical_transition`
- Prompt: A two-landing vertical transition room, compact and readable.
- Movement test: Every landing is visible before jump.

### ib_2c_vertical_down_stack
- Junction: `2c_vertical`
- Connectors: `N,S`; vertical overlays: `D`
- Route sentence: `upper_entry -> mid_drop -> low_exit_recovery`
- Role: `vertical_transition`
- Prompt: A downward stack with one optional faster drop line.
- Movement test: Landing markers prevent blind falling.

### ib_2c_under_over_cross
- Junction: `2c_layered`
- Connectors: `S,N`; vertical overlays: `U,D`
- Route sentence: `lower_path_visible -> upper_bridge_cross -> merge_exit`
- Role: `layered`
- Prompt: A room where lower and upper paths cross visually but connect at the end.
- Movement test: Player understands relationship between layers.

### ib_2c_bridge_underpass
- Junction: `2c_layered`
- Connectors: `E,W`; vertical overlays: `U`
- Route sentence: `underpass_entry -> stair_lip -> bridge_overpass_exit`
- Role: `layered`
- Prompt: A compact under/over bridge relation with one side stair.
- Movement test: Architecture teaches vertical route grammar.

### ib_2c_crusher_timing
- Junction: `2c_straight`
- Connectors: `S,N`; vertical overlays: `none`
- Route sentence: `readable_hazard -> wait_or_run -> exit_landing`
- Role: `timing`
- Prompt: Short crusher/deadfall timing room with no random props.
- Movement test: Hazard timing is visible and bypassable with speed.

### ib_2c_broken_bridge_recovery
- Junction: `2c_straight`
- Connectors: `S,N`; vertical overlays: `none`
- Route sentence: `runway -> broken_bridge_gap -> lower_recovery -> exit`
- Role: `recovery`
- Prompt: Broken bridge with lower recovery and stair back to main exit.
- Movement test: Failure teaches path rather than resetting.

### ib_2c_side_secret_spur
- Junction: `2c_straight_plus_secret`
- Connectors: `S,N`; vertical overlays: `D`
- Route sentence: `main_line -> visible_side_secret -> continue_exit`
- Role: `secret_tease`
- Prompt: Straight room with a visible but unreachable side terminal that another room unlocks.
- Movement test: Secret does not confuse critical path.

### ib_2c_combat_bridge_bulge
- Junction: `2c_straight`
- Connectors: `S,N`; vertical overlays: `none`
- Route sentence: `entry_bridge -> combat_bulge -> exit_bridge`
- Role: `combat`
- Prompt: A bridge path that widens once for melee footwork, then narrows again.
- Movement test: Combat space is measured, not arena-sized.

### ib_3c_t_choice_low
- Junction: `3c_t`
- Connectors: `S,E,W`; vertical overlays: `none`
- Route sentence: `entry_read -> left_safe_right_fast -> visible_merge_future`
- Role: `choice_t`
- Prompt: T-junction with two clear choices: safe recovery and fast risky line.
- Movement test: Choices are visible from entry.

### ib_3c_t_goal_blocked
- Junction: `3c_t`
- Connectors: `S,N,E`; vertical overlays: `none`
- Route sentence: `visible_locked_goal -> side_route -> return_shortcut`
- Role: `gate_loop`
- Prompt: Classic gate-loop T: goal ahead, side route changes route state.
- Movement test: Blocked goal and return line are physically legible.

### ib_3c_t_vertical_split
- Junction: `3c_t_vertical`
- Connectors: `S,N,W`; vertical overlays: `U`
- Route sentence: `entry -> upper_side_route -> straight_exit_or_reward`
- Role: `vertical_choice`
- Prompt: T with one upper side route and one flat through route.
- Movement test: Upper route reads as optional but valuable.

### ib_3c_t_drop_recovery
- Junction: `3c_t_vertical`
- Connectors: `N,E,W`; vertical overlays: `D`
- Route sentence: `high_entry -> side_drop_recovery -> through_exit`
- Role: `recovery_t`
- Prompt: T where one branch is a lower recovery/shortcut receiver.
- Movement test: Drop branch does not hide critical path.

### ib_3c_y_bridge_fork
- Junction: `3c_y`
- Connectors: `S,NE,NW`; vertical overlays: `none`
- Route sentence: `entry_lip -> forked_bridges -> distinct_landmarks`
- Role: `fork`
- Prompt: Y-shaped bridge fork with two landmarks and no central empty floor.
- Movement test: Both branch silhouettes are readable.

### ib_3c_loop_return_node
- Junction: `3c_t`
- Connectors: `S,N,W`; vertical overlays: `none`
- Route sentence: `main_entry -> exit_ahead -> return_shortcut_side`
- Role: `loop_node`
- Prompt: A node designed to receive a loop shortcut from a later room.
- Movement test: Shortcut mouth is obvious but not noisy.

### ib_3c_combat_crossfire
- Junction: `3c_t`
- Connectors: `S,E,N`; vertical overlays: `U`
- Route sentence: `entry -> upper_threat -> two_exit_choices`
- Role: `combat_choice`
- Prompt: T-junction with one upper threat controlling two exits.
- Movement test: Threat supports decision, not unfair damage.

### ib_3c_secret_lock_split
- Junction: `3c_t`
- Connectors: `S,N,E`; vertical overlays: `none`
- Route sentence: `main_path -> locked_secret_side -> exit_read`
- Role: `secret_lock`
- Prompt: Main path plus locked side room with clear key language.
- Movement test: Locked side branch does not become a fake critical path.

### ib_3c_stairwell_t
- Junction: `3c_t_vertical`
- Connectors: `S,E,N`; vertical overlays: `U,D`
- Route sentence: `lower_entry -> stairwell_core -> two_height_exits`
- Role: `stairwell`
- Prompt: Compact stairwell junction linking two horizontal exits at different heights.
- Movement test: Vertical core is central landmark.

### ib_3c_triple_bridge_refined
- Junction: `3c_t`
- Connectors: `S,N,W`; vertical overlays: `U`
- Route sentence: `central_bridge -> side_gallery -> upper_crossing -> exit`
- Role: `triple_bridge`
- Prompt: A smaller sibling of the current measured skull room.
- Movement test: Must fit the whole route read into one first-person view.

### ib_4c_compact_cross_hub
- Junction: `4c_cross`
- Connectors: `N,E,S,W`; vertical overlays: `none`
- Route sentence: `entry_read -> four_portals -> one_dominant_goal`
- Role: `hub`
- Prompt: Small four-way hub where one exit is dominant and the others are clearly secondary.
- Movement test: No open box; center has landmark mass and perimeter lanes.

### ib_4c_layered_cross
- Junction: `4c_cross_vertical`
- Connectors: `N,E,S,W`; vertical overlays: `U`
- Route sentence: `lower_cross -> upper_bridge_cross -> route_memory`
- Role: `layered_hub`
- Prompt: Four-way room with upper bridge crossing above lower cross.
- Movement test: Upper layer creates memory, not confusion.

### ib_4c_locked_cross
- Junction: `4c_cross`
- Connectors: `N,E,S,W`; vertical overlays: `none`
- Route sentence: `visible_locked_goal -> two_side_routes -> return_exit`
- Role: `locked_hub`
- Prompt: Four-way locked-goal hub with two side routes and one return.
- Movement test: Gate logic is readable from spawn.

### ib_4c_void_ring
- Junction: `4c_cross`
- Connectors: `N,E,S,W`; vertical overlays: `D`
- Route sentence: `ring_walk -> central_void -> four_readable_exits`
- Role: `void_hub`
- Prompt: Compact ring around a central void, with four exits visible but one marked critical.
- Movement test: Ring is narrow enough that movement matters.

## Batch Priority

1. Build the `2c_*` workhorses first so the generator can make routes immediately.
2. Add `1c_*` terminals second so routes have goals, secrets, switches, and starts.
3. Add `3c_*` junctions third for loops and decision pressure.
4. Add `4c_*` hubs last and keep them rare.

Minimum overnight target: 24 rooms = 8 terminals, 10 workhorses, 4 junctions, 2 hubs.
Full overnight target: all 48 specs in `data/room_junction_batch.json`.
