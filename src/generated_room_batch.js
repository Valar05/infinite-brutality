// Generated from ../data/room_junction_batch.json. Do not hand-edit room specs here.
export const GENERATED_ROOM_BATCH = [
  {
    "id": "ib_1c_start_runway",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "S"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_read",
      "acceleration_runway",
      "first_lip_preview"
    ],
    "semantic_role": "start",
    "batch_prompt": "Small spawn hall that teaches the material language and shows a future goal through a framed gap.",
    "movement_test": "Player can build run speed before first commitment without clutter.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_exit_skull_gate",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "final_landing",
      "skull_gate_read",
      "reward_lock"
    ],
    "semantic_role": "exit",
    "batch_prompt": "Compact goal chamber with skull gate, corpsefire markers, and a clear arrival pad.",
    "movement_test": "Exit is visible from entry line but not framed as a giant empty box.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_secret_drop_cache",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "W"
    ],
    "vertical_overlays": [
      "D"
    ],
    "route_sentence": [
      "side_nick",
      "drop_step",
      "cache_landing",
      "return_read"
    ],
    "semantic_role": "secret",
    "batch_prompt": "A small optional drop/cache with one visible way back, using bone/bronze reward markers.",
    "movement_test": "Drop is forgiving and return route is obvious.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_switch_niche",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "E"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "tight_entry",
      "switch_landmark",
      "route_change_signal"
    ],
    "semantic_role": "switch",
    "batch_prompt": "A switch alcove that exists to change another room, not to be a random dead end.",
    "movement_test": "Switch is framed from the connector and has enough floor for combat turn-around.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_ambush_cup",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "S"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_threshold",
      "short_bowl",
      "cover_pillar",
      "exit_backtrack"
    ],
    "semantic_role": "ambush",
    "batch_prompt": "A tight combat cup with one chunky central blocker and side footwork lanes.",
    "movement_test": "Player can circle a single landmark; no prop scatter.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_vista_goal_tease",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_read",
      "barred_goal_view",
      "return_with_memory"
    ],
    "semantic_role": "vista",
    "batch_prompt": "A view chamber that shows a later bridge/gate across a void without allowing access yet.",
    "movement_test": "The tease should improve route memory, not become decoration.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_upper_reward_perch",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "W"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "stair_lip",
      "upper_perch",
      "reward_marker",
      "safe_turnaround"
    ],
    "semantic_role": "reward",
    "batch_prompt": "A small upper ledge reward reached by stairs or ramp lip.",
    "movement_test": "Player has enough width to turn and jump back safely.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_low_recovery_sump",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "E"
    ],
    "vertical_overlays": [
      "D"
    ],
    "route_sentence": [
      "fall_recovery",
      "corpsefire_breadcrumb",
      "stair_return"
    ],
    "semantic_role": "recovery",
    "batch_prompt": "A lower recovery pocket beneath risky jumps, with a fast readable return.",
    "movement_test": "Falling costs time but does not feel like death unless marked as hazard.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_locked_shrine",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "locked_view",
      "key_socket",
      "compact_goal"
    ],
    "semantic_role": "locked",
    "batch_prompt": "A locked terminal shrine that makes a future key/switch route meaningful.",
    "movement_test": "Player reads why it is blocked immediately.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_trial_lip",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "S"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "short_runway",
      "single_lip_gap",
      "landing_marker"
    ],
    "semantic_role": "movement_trial",
    "batch_prompt": "A small one-jump practice room for bridge/ramp lip timing.",
    "movement_test": "Jump is one clear verb: running jump plus air steering.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_enemy_balcony",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "E"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "entry_floor",
      "upper_enemy_read",
      "stair_or_side_route"
    ],
    "semantic_role": "combat_perch",
    "batch_prompt": "A compact balcony with one enemy/readable threat above the entry.",
    "movement_test": "Threat teaches vertical aim and movement without becoming a maze.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_blood_deadfall",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "W"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_read",
      "deadfall_landmark",
      "reward_or_switch"
    ],
    "semantic_role": "hazard_terminal",
    "batch_prompt": "A guillotine/deadfall terminal used as a setpiece and route punctuation.",
    "movement_test": "Hazard silhouette is readable before player commits.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_return_shortcut_receiver",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "N"
    ],
    "vertical_overlays": [
      "D"
    ],
    "route_sentence": [
      "one_way_arrival",
      "unlock_read",
      "return_to_hub"
    ],
    "semantic_role": "shortcut_receiver",
    "batch_prompt": "A receiver pocket for one-way drops or teleporter-like returns, with physical return logic where possible.",
    "movement_test": "Arrival orientation points player back toward the known route.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_1c_boss_key_cell",
    "junction_class": "1c_terminal",
    "horizontal_connectors": [
      "S"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_squeeze",
      "key_plinth",
      "exit_backtrack_pressure"
    ],
    "semantic_role": "key_reward",
    "batch_prompt": "A compact key/reward cell with one route back and a pressure beat.",
    "movement_test": "Reward pickup sits on a route sentence, not in random clutter.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_straight_lip_bridge",
    "junction_class": "2c_straight",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_read",
      "acceleration_runway",
      "lip",
      "bridge_landing",
      "exit_read"
    ],
    "semantic_role": "crossing",
    "batch_prompt": "Straight compact bridge room with one measured jump line and side rails.",
    "movement_test": "Forward run builds naturally before the lip.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_straight_low_high",
    "junction_class": "2c_straight",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "entry_floor",
      "stair_lip",
      "upper_exit"
    ],
    "semantic_role": "climb",
    "batch_prompt": "Straight low-to-high room with staggered stair/ramp lips.",
    "movement_test": "Height change teaches next landing before jump.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_straight_high_low",
    "junction_class": "2c_straight",
    "horizontal_connectors": [
      "N",
      "S"
    ],
    "vertical_overlays": [
      "D"
    ],
    "route_sentence": [
      "upper_entry",
      "visible_lower_goal",
      "drop_or_stair_recovery"
    ],
    "semantic_role": "descent",
    "batch_prompt": "Straight high-to-low descent with a safer stair line and faster drop.",
    "movement_test": "Drop is optional speed expression, not required blind fall.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_straight_split_bridge",
    "junction_class": "2c_straight",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_read",
      "forked_bridge_choice",
      "merge_landing"
    ],
    "semantic_role": "choice",
    "batch_prompt": "Two parallel bridge lines: wider safe line and narrower fast line.",
    "movement_test": "Both lines fit in one visible composition.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_straight_hazard_gutter",
    "junction_class": "2c_straight",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "runway",
      "blood_gutter_lip",
      "offset_landing"
    ],
    "semantic_role": "hazard_crossing",
    "batch_prompt": "Straight route over a narrow blood gutter with recoverable side ledge.",
    "movement_test": "Hazard supports timing, not punishment spam.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_straight_gallery_return",
    "junction_class": "2c_straight",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "direct_bridge",
      "side_gallery_recovery",
      "merge_exit"
    ],
    "semantic_role": "recovery_line",
    "batch_prompt": "Straight main bridge with one side gallery that rejoins before the exit.",
    "movement_test": "Side gallery is slower but clearly safe.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_corner_left_lip",
    "junction_class": "2c_corner",
    "horizontal_connectors": [
      "S",
      "W"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_runway",
      "left_turn_lip",
      "landing_read"
    ],
    "semantic_role": "corner",
    "batch_prompt": "Left-turn room where air steering matters across an angled gap.",
    "movement_test": "Player sees the turn before committing.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_corner_right_lip",
    "junction_class": "2c_corner",
    "horizontal_connectors": [
      "S",
      "E"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_runway",
      "right_turn_lip",
      "landing_read"
    ],
    "semantic_role": "corner",
    "batch_prompt": "Right-turn room with a matching but not mirrored silhouette.",
    "movement_test": "Air correction matters but landing is forgiving.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_corner_switchback_low",
    "junction_class": "2c_corner",
    "horizontal_connectors": [
      "E",
      "N"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "entry_floor",
      "switchback_stairs",
      "upper_exit"
    ],
    "semantic_role": "switchback",
    "batch_prompt": "Tight switchback climb around one chunky wall mass.",
    "movement_test": "No open box floor; route wraps the mass.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_corner_drop_return",
    "junction_class": "2c_corner",
    "horizontal_connectors": [
      "W",
      "N"
    ],
    "vertical_overlays": [
      "D"
    ],
    "route_sentence": [
      "entry_high",
      "drop_choice",
      "stair_return_exit"
    ],
    "semantic_role": "descent_corner",
    "batch_prompt": "Corner descent with fast drop and safer wraparound stair.",
    "movement_test": "Both exits visible from the high entry.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_corner_enemy_overlook",
    "junction_class": "2c_corner",
    "horizontal_connectors": [
      "S",
      "E"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "entry_read",
      "enemy_overlook",
      "side_stair",
      "exit"
    ],
    "semantic_role": "combat_corner",
    "batch_prompt": "Corner route with a single upper enemy balcony as a readable pressure source.",
    "movement_test": "Balcony supports route pressure, not clutter.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_corner_skull_gate_tease",
    "junction_class": "2c_corner",
    "horizontal_connectors": [
      "W",
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "blocked_goal_view",
      "side_turn",
      "exit_gate_read"
    ],
    "semantic_role": "goal_tease",
    "batch_prompt": "Corner that shows the goal ahead but sends player around one bend.",
    "movement_test": "Goal tease improves navigation.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_vertical_up_stack",
    "junction_class": "2c_vertical",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "entry_read",
      "ramp_lip",
      "mid_landing",
      "upper_exit"
    ],
    "semantic_role": "vertical_transition",
    "batch_prompt": "A two-landing vertical transition room, compact and readable.",
    "movement_test": "Every landing is visible before jump.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_vertical_down_stack",
    "junction_class": "2c_vertical",
    "horizontal_connectors": [
      "N",
      "S"
    ],
    "vertical_overlays": [
      "D"
    ],
    "route_sentence": [
      "upper_entry",
      "mid_drop",
      "low_exit_recovery"
    ],
    "semantic_role": "vertical_transition",
    "batch_prompt": "A downward stack with one optional faster drop line.",
    "movement_test": "Landing markers prevent blind falling.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_under_over_cross",
    "junction_class": "2c_layered",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [
      "U",
      "D"
    ],
    "route_sentence": [
      "lower_path_visible",
      "upper_bridge_cross",
      "merge_exit"
    ],
    "semantic_role": "layered",
    "batch_prompt": "A room where lower and upper paths cross visually but connect at the end.",
    "movement_test": "Player understands relationship between layers.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_bridge_underpass",
    "junction_class": "2c_layered",
    "horizontal_connectors": [
      "E",
      "W"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "underpass_entry",
      "stair_lip",
      "bridge_overpass_exit"
    ],
    "semantic_role": "layered",
    "batch_prompt": "A compact under/over bridge relation with one side stair.",
    "movement_test": "Architecture teaches vertical route grammar.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_crusher_timing",
    "junction_class": "2c_straight",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "readable_hazard",
      "wait_or_run",
      "exit_landing"
    ],
    "semantic_role": "timing",
    "batch_prompt": "Short crusher/deadfall timing room with no random props.",
    "movement_test": "Hazard timing is visible and bypassable with speed.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_broken_bridge_recovery",
    "junction_class": "2c_straight",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "runway",
      "broken_bridge_gap",
      "lower_recovery",
      "exit"
    ],
    "semantic_role": "recovery",
    "batch_prompt": "Broken bridge with lower recovery and stair back to main exit.",
    "movement_test": "Failure teaches path rather than resetting.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_side_secret_spur",
    "junction_class": "2c_straight_plus_secret",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [
      "D"
    ],
    "route_sentence": [
      "main_line",
      "visible_side_secret",
      "continue_exit"
    ],
    "semantic_role": "secret_tease",
    "batch_prompt": "Straight room with a visible but unreachable side terminal that another room unlocks.",
    "movement_test": "Secret does not confuse critical path.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_2c_combat_bridge_bulge",
    "junction_class": "2c_straight",
    "horizontal_connectors": [
      "S",
      "N"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_bridge",
      "combat_bulge",
      "exit_bridge"
    ],
    "semantic_role": "combat",
    "batch_prompt": "A bridge path that widens once for melee footwork, then narrows again.",
    "movement_test": "Combat space is measured, not arena-sized.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_t_choice_low",
    "junction_class": "3c_t",
    "horizontal_connectors": [
      "S",
      "E",
      "W"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_read",
      "left_safe_right_fast",
      "visible_merge_future"
    ],
    "semantic_role": "choice_t",
    "batch_prompt": "T-junction with two clear choices: safe recovery and fast risky line.",
    "movement_test": "Choices are visible from entry.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_t_goal_blocked",
    "junction_class": "3c_t",
    "horizontal_connectors": [
      "S",
      "N",
      "E"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "visible_locked_goal",
      "side_route",
      "return_shortcut"
    ],
    "semantic_role": "gate_loop",
    "batch_prompt": "Classic gate-loop T: goal ahead, side route changes route state.",
    "movement_test": "Blocked goal and return line are physically legible.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_t_vertical_split",
    "junction_class": "3c_t_vertical",
    "horizontal_connectors": [
      "S",
      "N",
      "W"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "entry",
      "upper_side_route",
      "straight_exit_or_reward"
    ],
    "semantic_role": "vertical_choice",
    "batch_prompt": "T with one upper side route and one flat through route.",
    "movement_test": "Upper route reads as optional but valuable.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_t_drop_recovery",
    "junction_class": "3c_t_vertical",
    "horizontal_connectors": [
      "N",
      "E",
      "W"
    ],
    "vertical_overlays": [
      "D"
    ],
    "route_sentence": [
      "high_entry",
      "side_drop_recovery",
      "through_exit"
    ],
    "semantic_role": "recovery_t",
    "batch_prompt": "T where one branch is a lower recovery/shortcut receiver.",
    "movement_test": "Drop branch does not hide critical path.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_y_bridge_fork",
    "junction_class": "3c_y",
    "horizontal_connectors": [
      "S",
      "NE",
      "NW"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_lip",
      "forked_bridges",
      "distinct_landmarks"
    ],
    "semantic_role": "fork",
    "batch_prompt": "Y-shaped bridge fork with two landmarks and no central empty floor.",
    "movement_test": "Both branch silhouettes are readable.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_loop_return_node",
    "junction_class": "3c_t",
    "horizontal_connectors": [
      "S",
      "N",
      "W"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "main_entry",
      "exit_ahead",
      "return_shortcut_side"
    ],
    "semantic_role": "loop_node",
    "batch_prompt": "A node designed to receive a loop shortcut from a later room.",
    "movement_test": "Shortcut mouth is obvious but not noisy.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_combat_crossfire",
    "junction_class": "3c_t",
    "horizontal_connectors": [
      "S",
      "E",
      "N"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "entry",
      "upper_threat",
      "two_exit_choices"
    ],
    "semantic_role": "combat_choice",
    "batch_prompt": "T-junction with one upper threat controlling two exits.",
    "movement_test": "Threat supports decision, not unfair damage.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_secret_lock_split",
    "junction_class": "3c_t",
    "horizontal_connectors": [
      "S",
      "N",
      "E"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "main_path",
      "locked_secret_side",
      "exit_read"
    ],
    "semantic_role": "secret_lock",
    "batch_prompt": "Main path plus locked side room with clear key language.",
    "movement_test": "Locked side branch does not become a fake critical path.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_stairwell_t",
    "junction_class": "3c_t_vertical",
    "horizontal_connectors": [
      "S",
      "E",
      "N"
    ],
    "vertical_overlays": [
      "U",
      "D"
    ],
    "route_sentence": [
      "lower_entry",
      "stairwell_core",
      "two_height_exits"
    ],
    "semantic_role": "stairwell",
    "batch_prompt": "Compact stairwell junction linking two horizontal exits at different heights.",
    "movement_test": "Vertical core is central landmark.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_3c_triple_bridge_refined",
    "junction_class": "3c_t",
    "horizontal_connectors": [
      "S",
      "N",
      "W"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "central_bridge",
      "side_gallery",
      "upper_crossing",
      "exit"
    ],
    "semantic_role": "triple_bridge",
    "batch_prompt": "A smaller sibling of the current measured skull room.",
    "movement_test": "Must fit the whole route read into one first-person view.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_4c_compact_cross_hub",
    "junction_class": "4c_cross",
    "horizontal_connectors": [
      "N",
      "E",
      "S",
      "W"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "entry_read",
      "four_portals",
      "one_dominant_goal"
    ],
    "semantic_role": "hub",
    "batch_prompt": "Small four-way hub where one exit is dominant and the others are clearly secondary.",
    "movement_test": "No open box; center has landmark mass and perimeter lanes.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_4c_layered_cross",
    "junction_class": "4c_cross_vertical",
    "horizontal_connectors": [
      "N",
      "E",
      "S",
      "W"
    ],
    "vertical_overlays": [
      "U"
    ],
    "route_sentence": [
      "lower_cross",
      "upper_bridge_cross",
      "route_memory"
    ],
    "semantic_role": "layered_hub",
    "batch_prompt": "Four-way room with upper bridge crossing above lower cross.",
    "movement_test": "Upper layer creates memory, not confusion.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_4c_locked_cross",
    "junction_class": "4c_cross",
    "horizontal_connectors": [
      "N",
      "E",
      "S",
      "W"
    ],
    "vertical_overlays": [],
    "route_sentence": [
      "visible_locked_goal",
      "two_side_routes",
      "return_exit"
    ],
    "semantic_role": "locked_hub",
    "batch_prompt": "Four-way locked-goal hub with two side routes and one return.",
    "movement_test": "Gate logic is readable from spawn.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  },
  {
    "id": "ib_4c_void_ring",
    "junction_class": "4c_cross",
    "horizontal_connectors": [
      "N",
      "E",
      "S",
      "W"
    ],
    "vertical_overlays": [
      "D"
    ],
    "route_sentence": [
      "ring_walk",
      "central_void",
      "four_readable_exits"
    ],
    "semantic_role": "void_hub",
    "batch_prompt": "Compact ring around a central void, with four exits visible but one marked critical.",
    "movement_test": "Ring is narrow enough that movement matters.",
    "prompt_guardrails": [
      "compact measured room, not a giant box",
      "route sentence first; decoration only after movement reads",
      "use current vector stone/bronze/bone visual language",
      "include side recovery for risky movement where applicable",
      "do not copy Quake layouts or assets"
    ]
  }
];
