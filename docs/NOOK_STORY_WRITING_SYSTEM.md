# Nook Story Writing System

Date: 2026-06-11
Status: design packet for first-pass procedural environmental writing

## Thesis

Infinite Brutality crossed a line when small nooks and dioramas made the world feel inhabited instead of abstract. The next step is to treat those nooks as story carriers.

At this stage the player should see no living people. The story is told through evidence that people were here:

- sleeping arrangements
- rationing systems
- household repairs
- shrine substitutions
- burial habits
- child-height marks
- watch rules
- smuggling traces
- interrupted tasks

The goal is not lore drops. The goal is forensic worldbuilding.

Voice and compression rules for short fragments and TTS lines live in `docs/NOOK_NARRATOR_VIBE.md`.

## Story Questions

Every run should fragmentarily answer two questions:

1. Where did these people come from?
2. How do they live now that the world has become Limbo?

The player should infer answers from repeated evidence rather than receive direct exposition.

## Hidden Run Story State

Each run should silently choose a story state that pressures every nook packet:

- `origin_population`
- `rupture_event`
- `survival_doctrine`
- `taboo`
- `hope`

Example:

- origin: displaced terrace-monastery households
- rupture: aqueduct poisoning and bridge tribunals
- doctrine: concealment and rationed speech
- taboo: naming the dead after dusk
- hope: eastward ascent to the lit terraces

The run story state should be visible indirectly in every district and nook.

## Corpus Plan

Use a broad, real, unabridged source field. Do not build this from one prestige text only.

### Band 1: Foundation Corpus

Purpose: civilizational voice, collective scale, public memory.

Source families:

- epic warfare and return narratives
- tragedy and lament
- scripture and liturgy
- apocalypse writing
- funeral orations
- ordeal and judgment texts

Suggested source zones:

- Homeric epic and post-Homeric epic
- Greek tragedy
- Psalms, Lamentations, prophetic writing
- apocrypha and visionary literature
- Roman funeral/legal rhetoric

### Band 2: Daily-Life Corpus

Purpose: make absent people feel real.

Source families:

- letters
- household manuals
- monastic rules
- market rules
- army camp regulations
- burial customs
- agricultural calendars
- recipe and remedy books
- account ledgers
- pilgrims' observations

### Band 3: Ruin Corpus

Purpose: collapse, siege, plague, exile, prison, aftermath.

Source families:

- siege chronicles
- plague writing
- refugee testimony
- prison and exile writing
- famine records
- postwar reconstruction accounts
- martyr records

### Band 4: Child And Domestic Corpus

Purpose: preserve tenderness and ordinary instruction inside horror.

Source families:

- copybook exercises
- lullabies
- household teaching texts
- family admonitions
- catechism-style questions
- apprenticeship instructions

### Band 5: Local Canon Corpus

Purpose: stop the system from becoming generic classics paste.

Sources:

- Infinite Brutality district roles
- Hanging Gardens former-use tags
- district landmark names
- recurring settlement jobs
- recurring rules, taboos, and prayers introduced by this project

## Nook Story Rule

A nook is not a random prop cluster. A nook is a micro-history packet with three stacked layers:

- `former_use`: what the place originally was
- `survival_use`: how later people repurposed it
- `rupture`: what interrupted, broke, or transformed it

Every nook should also answer:

- who used this place?
- what verb defined their use here?
- what pressure shaped their choices?
- what remains unsaid but visible?

## First-Pass Nook Families

Start with five families only.

### 1. Shelter Nook

Dominant verbs:

- slept
- hid
- waited

Evidence cues:

- bedding layers
- windbreak cloth
- concealed stores
- bowl-sharing patterns
- child-height marks

Text forms:

- sleeping order
- ration note
- lullaby fragment
- prayer for silence

### 2. Shrine Nook

Dominant verbs:

- prayed
- vowed
- bargained

Evidence cues:

- substitute offerings
- wax drips
- erased icons
- rope-knotted petitions
- repeated hand-touch wear

Text forms:

- vow formula
- names withheld or abbreviated
- warning against a forbidden rite
- promise of ascent, pardon, or concealment

### 3. Repair Nook

Dominant verbs:

- repaired
- measured
- substituted

Evidence cues:

- tool rolls
- scavenged fittings
- chalk measures
- failed reinforcement
- broken replacement pieces

Text forms:

- material substitutions
- work order fragment
- pressure warning
- diagrammatic marks

### 4. Ration Nook

Dominant verbs:

- counted
- stored
- distributed

Evidence cues:

- tally walls
- sealed jars
- portions by size/age
- spoiled allotments
- hidden reserve compartment

Text forms:

- issue list
- priority order
- theft warning
- emergency reduction note

### 5. Burial Nook

Dominant verbs:

- mourned
- named
- concealed

Evidence cues:

- wrapped bundles
- ash containers
- apology offerings
- age or kin tallies
- names removed or covered

Text forms:

- memorial list
- vow of remembrance
- rule for silence
- taboo line

## Fragment Channels

Do not tell story only through readable prose.

Each nook can combine:

- inscription
- chalk note
- scratched mark
- tally system
- icon sequence
- household arrangement
- object repetition
- absence or interruption
- reused official plaque
- stitched or knotted signal

This keeps the world from becoming a note-dispenser.

## Speaker Classes

Every written fragment must belong to a speaker class.

First-pass classes:

- caretaker
- child
- novice
- quartermaster
- mourner
- scavenger
- guard
- penitent
- refugee clerk
- work captain

The class determines diction, confidence, literacy, and what kind of thing they would bother to write down.

## Packet Schema

Each generated nook packet should include:

- `id`
- `district_role`
- `nook_family`
- `former_use`
- `survival_use`
- `speaker_class`
- `dominant_verb`
- `material_context`
- `survival_pressure`
- `run_story_axes`
- `taboo_or_rule`
- `evidence_objects`
- `text_fragments`
- `symbol_fragments`
- `absence_or_interruption`
- `linked_motif`
- `story_function`

`story_function` should be one of:

- origin clue
- doctrine clue
- rupture clue
- taboo clue
- hope clue
- contradiction clue

## Starter Fragment Template Types

Use short, reusable fragment shapes before writing custom prose.

First-pass template types:

- `rule_fragment`: local survival rule or prohibition
- `tally_fragment`: count, portion, or issue mark
- `vow_fragment`: promise, bargain, or devotional obligation
- `substitution_fragment`: what had to replace what
- `warning_fragment`: practical hazard or enforcement note
- `memorial_fragment`: partial naming or remembrance
- `child_copy_fragment`: repeated learning line or copied rule
- `route_fragment`: directional mark, false route, or safe path cue
- `work_fragment`: labor sequence, shift, or measured instruction
- `absence_fragment`: sign that something expected is missing or interrupted

These should stay brief. The system should prefer many small correlated fragments over one long monologue.

## First Five Survivor Cultures For Hanging Gardens

These are not races or factions in a combat sense. They are surviving social formations whose traces can overlap in one district.

### 1. Terrace Households

Former world:

- orchard keepers
- bath attendants
- cistern labor families

Now:

- family clusters hiding in half-public infrastructure
- domestic order maintained under ruin pressure

Signs:

- washing bowls reused as offering basins
- child-height ledgers on retaining walls
- stitched windbreak cloth and terraced pallet layers

### 2. Rope-Market Carriers

Former world:

- market porters
- bridge haulers
- scaffold riggers

Now:

- circulation experts who survive by moving goods and people quietly
- route knowledge preserved through marks and rope code

Signs:

- knot language
- route arrows that contradict official pathing
- weight tallies and load-sharing notes

### 3. Chapel Custodians

Former world:

- shrine cleaners
- bell keepers
- rite assistants

Now:

- keepers of stripped-down rites using salvaged substitutes
- maintain taboos even after institutional collapse

Signs:

- reused censers
- apology formulas
- partial litanies with names removed

### 4. Furnace Tenders

Former world:

- kiln laborers
- corpsefire keepers
- ash handlers

Now:

- managers of heat, disposal, and hard survival arithmetic
- practical, exhausted, morally compromised

Signs:

- ash ledgers
- fuel substitution notes
- body-count coded as heat requirement

### 5. Toll Remnant Scribes

Former world:

- clerks
- weigh-masters
- bridge customs officers

Now:

- record keepers trying to preserve legitimacy after legitimacy has collapsed
- write rules, exemptions, and censored histories

Signs:

- stamped tablets reused as prayer backing
- amended entry rules
- confiscation and pardon lists

## Generation Sequence

Phase 1 should be narrow and reliable.

1. Choose hidden run story axes.
2. Choose district role and former use.
3. Choose 2 to 5 nook packets for the district.
4. For each packet, choose family, speaker class, dominant verb, and pressure.
5. Emit object evidence first.
6. Emit text and symbol fragments second.
7. Emit one contradiction or interruption in at least one packet per district.
8. Reuse motifs across packets so the player assembles a larger story.

## Anti-Slop Rules

- No generic lore tablets.
- No fragment without a practical reason to exist in that location.
- No pure poetry unless the site is actually ritual or memorial.
- No speakerless text.
- No room gets more than one long readable fragment in the first pass.
- Most story should live in short fragments plus object arrangements.

## Best Immediate Next Step

Do not try to generate final prose for the whole game yet.

First implement:

- a corpus/source manifest plan
- the nook packet schema
- five nook families
- five survivor cultures
- 8 to 12 fragment templates per family
- one district pilot using only shelter, shrine, repair, ration, and burial packets
