# Chronoscope — plan

An interactive environment for comparing bitemporal storage representations. Static single page, no server.

Source concept: `Chronoscope.md`. This document is the build plan for it.

---

## 1. Product description

**The problem it teaches.** That knowledge of the past changes is the easy half, and most engineers accept it on being told. The hard half is what follows: once history is mutable, the way you *represent* it stops being an implementation detail. Events, validity intervals and snapshots can all describe the same logical history and still behave completely differently the moment a retroactive fact arrives — different write amplification, different invalidation, and at least one silent correctness trap. That is a systems-design problem, and it is close to invisible in static diagrams because every diagram shows the representation already settled.

**The experience.** One fact log sits at the top of the screen as the source of truth: Mark's salary and reporting line, as a handful of facts on two axes. Below it, four representations of that same history side by side — deltas, intervals, snapshots, hybrid — each rendering its own internal state in its own native shape.

You inject the retroactive fact: *salary became 20 at valid time 30*, recorded now. Every row reacts at once, and they react differently. The delta log appends one record and shrugs. The interval table splits a rectangle and rewrites everything downstream of it. The snapshot store invalidates two snapshots and rebuilds them. The hybrid does a partial replay. Same fact, same resulting history, four unrelated costs — visible in one frame, which is the thing prose cannot do.

**The trap.** A fifth row runs the snapshot strategy with one plausible mistake: it reads stored snapshots as though they were sets of changes. The snapshot at valid time 40 holds `salary = 10` because only the manager changed then — and replayed as a delta, it silently reverts the retroactive raise. Chronoscope does not caption this. It runs the strategy, compares it against the reference query at every coordinate, and paints the region where it is wrong directly onto the bitemporal plane. You can see the exact rectangle of history that this bug corrupts, and drag the cursors into it.

**The payoff.** Reconstruction is a two-coordinate question — pick a valid time and a system time, and every strategy answers. Four agree with the reference implementation everywhere. One does not, and you can see precisely where.

**Sandbox.** The prepared scenario is an entry point, not the boundary. Any fact can be injected by hand — attribute, value, and any valid time, past or future — and every strategy absorbs it. System time is the one thing not freely settable: it is an append-only clock the user advances, because a store that lets you record into its own past has stopped being an audit log. Stepping that clock between insertions still constructs any history worth building.

**Then, scale.** A cost panel projects each strategy's asymptotics as history grows: records stored, duplicated state, reconstruction work, records touched by a retroactive correction, snapshots invalidated, write amplification. Not a benchmark of any database — a model, making the architectural shape of each choice legible.

**Success test.** An engineer who already knows what bitemporality is comes away able to argue for a representation, and against the other three, on cost grounds.

---

## 2. Core model

**Time** is a calendar date at the surface and an integer day offset underneath. The core stores and compares offsets from a fixed epoch, so plane arithmetic and interval splitting stay integer work; formatting to dates happens only at the edge, in the renderers. Axes, tables and cursors all read as real dates.

```ts
type Time = number    // days since epoch; rendered as a calendar date
type Attr = 'salary' | 'manager'

type Fact = {
  id: FactId
  attr: Attr
  value: Value
  validFrom: Time     // when it became true in the world
  systemTime: Time    // when we recorded it
}
```

Validity is open-ended: a fact holds from `validFrom` until the next fact on the same attribute supersedes it. No explicit end, and no `supersedes` pointer — a correction is simply a later `systemTime` at an existing `validFrom`, and a retroactive insert is a `validFrom` earlier than facts already recorded. Both fall out of the two coordinates without extra machinery, which is itself part of the lesson.

**Scenario** (from `Chronoscope.md`)

| Recorded | Valid from | Fact | Shape |
|---|---|---|---|
| 15 Jan | 15 Jan | salary = 60,000 | baseline |
| 15 Jan | 15 Jan | manager = Jim | baseline |
| 1 Apr | 1 Apr | manager = Rob | ordinary, in order |
| 10 Jun | **1 Mar** | **salary = 72,000** | retroactive — recorded after 1 April, valid before it |

The fourth row is the whole demo. It is also exactly the input that breaks the delta-interpreted snapshot, because the 1 April snapshot already carries `salary = 60,000` — only the manager changed that day — and replaying it as a change set reverts the raise for every date from April onward.

Salary figures are realistic rather than the source document's 10 and 20, since calendar dates invite a realistic scale; the structure of the scenario is unchanged and the trap fires identically.

**System time is monotonic.** New facts are recorded at the current clock, never before it: `systemTime >= max(log.systemTime)`, enforced in `core/log.ts` rather than in the form. Valid time is unconstrained in both directions — retroactive and pre-announced facts are the point. This asymmetry is not a simplification, it is the semantics: valid time is a claim about the world and can be revised, system time is the record of what we did and cannot.

**The reference query — the oracle.**

```ts
referenceQuery(log, attr, validTime, systemTime): Value | undefined
```

Filter to `systemTime <= s` and `validFrom <= v`, take the greatest `validFrom`, break ties by greatest `systemTime`. Deliberately slow and obviously correct. Every strategy is judged against it and nothing else.

**Strategy interface.** Adding a representation is one file.

```ts
interface Strategy {
  name: string
  materialize(log: Fact[]): State
  apply(state: State, fact: Fact): { state: State; ops: OpCounts }
  query(state: State, attr: Attr, v: Time, s: Time): Value | undefined
  cost: CostModel
}
```

| Strategy | Internal state | Read | Append | Retroactive fact |
|---|---|---|---|---|
| Deltas | the log, ordered | replay | append | append, all later reads replay further |
| Intervals | bitemporal rectangles | direct lookup | open interval | close and reopen every interval after `v` |
| Snapshots | full state every k ticks | nearest snapshot | write snapshot | invalidate and rebuild all snapshots after `v` |
| Hybrid | snapshots plus log | snapshot plus short replay | append | invalidate affected, partial replay |
| Snapshots, delta-read | same as snapshots | **snapshots folded as changes** | as above | **silently reverts** |

**Correctness as a property test.** For every strategy, for every coordinate in the valid × system grid, the result must equal the oracle. It runs in milliseconds over this scenario and it is the test an interviewer will actually read:

```ts
for (const s of strategies)
  for (const v of validRange)
    for (const t of systemRange)
      expect(s.query(state, attr, v, t)).toEqual(referenceQuery(log, attr, v, t))
```

The broken strategy is excluded from that sweep and gets its own inverted test, asserting it diverges at exactly the expected rectangle and nowhere else. The bug is pinned down as a specification, not left as an anecdote.

**Fuzzed, not just checked.** The sweep above runs over the fixed scenario, which will not catch an `apply()` that has quietly grown assumptions about that scenario's shape — and arbitrary injection will find exactly those. So the same sweep also runs over generated logs: random attributes, values and valid times under a monotonic system clock, materialized through every strategy and compared against the oracle at every coordinate. This is what makes hand-injected facts safe rather than nominally supported, and it is the cheapest credibility in the whole build.

**The intervals strategy is the plane.** Its internal state is a set of bitemporal rectangles, and the bitemporal plane is a picture of exactly those rectangles. One representation renders as the concept itself — worth making explicit in the interface rather than leaving for the reader to notice.

---

## 3. Interface

Three stacked bands, one scrolling column.

**Band 1 — logical history (shared).** Two cursors, valid time and system time. Twin timelines with each fact as a dot on both axes, joined by a connector that leans when the two disagree. The bitemporal plane beneath, shaded by the oracle's value, with divergence regions from the broken strategy overlaid in a warning colour. Clicking the plane moves both cursors.

**Band 2 — representations.** One row per strategy. Each row carries:

- its internal state, drawn natively — an ordered list for deltas, rectangles for intervals, a stack of full states for snapshots
- the value it returns at the current cursors
- agreement with the oracle, as a plain marker
- operations performed by the last applied fact: records written, records rewritten, snapshots invalidated, replay steps

Injecting a fact animates all five rows simultaneously. Side-by-side reaction to one input is the core interaction; nothing should require scrolling between rows to compare them.

**Band 3 — scale.** Asymptotic cost table, plus curves over history size with sliders for snapshot interval and correction depth. Labelled as a model throughout.

**Controls.** Prepared scenarios as entry points, and a sandbox alongside them:

- add a fact by attribute, value and valid time, recorded at the current clock
- advance the clock, which is how any multi-step history gets built
- snapshot interval as a slider, since every snapshot and hybrid cost is a function of it
- undo the last fact, and reset to a scenario

Internal-state panels scroll once a history outgrows them. Nothing in the interface assumes the scenario's size.

Visual language: one accent for retroactive, one for divergence, grey for settled. Light theme only.

**Vocabulary.** *Valid time* and *system time*, as in the source document — this audience already has the words.

---

## 4. Component separation

```
src/
  core/                    zero React imports
    types.ts
    log.ts                 fact log, scenarios
    reference.ts           the oracle
    strategies/
      index.ts             Strategy interface, registry
      deltas.ts
      intervals.ts
      snapshots.ts
      hybrid.ts
      snapshotDelta.ts     deliberately incorrect
    cost.ts                analytic cost model
    strategies.test.ts     property sweep against the oracle
    divergence.test.ts     the pinned bug
  ui/
    App.tsx
    Cursors.tsx
    TwinTimelines.tsx
    BitemporalPlane.tsx
    StrategyRow.tsx
    internals/             EventList, IntervalRects, SnapshotStack
    CostPanel.tsx
    AddFact.tsx
  state.ts                 one reducer: { log, validCursor, systemCursor, selection }
```

Two rules carry the architecture:

- `core/` never imports from `ui/`, knows nothing of React, and is where all five strategies, the oracle and the property tests live. It is the part worth reading.
- `ui/` never computes a value or a cost. Everything on screen comes from `core/` through memoised selectors.

A strategy is one file implementing one interface, registered in one place. That the broken strategy is a peer of the correct ones — not a special case threaded through the renderer — is what makes the comparison honest.

---

## 5. Deployment

- Vite, React, TypeScript. Vitest against `core/`.
- `npm run build` emits static files. No server, no environment variables, no network calls at runtime.
- GitHub Pages, published by a build-and-deploy Action on push to main. One public repository serves the demo and the source together.
- Works offline, and the built folder opens from the file system — a fallback if a live link fails mid-interview.

---

## 6. Order of work

| # | Step | Rough |
|---|------|-------|
| 1 | Types, log, oracle, deltas and intervals, property sweep, generated-log fuzzing | 60m |
| 2 | Snapshots, hybrid, the broken strategy, divergence test | 40m |
| 3 | Cursors, twin timelines, plane with divergence overlay | 45m |
| 4 | Strategy rows and the three internal-state renderers | 50m |
| 5 | Cost panel | 25m |
| 6 | Sandbox controls — add fact, clock, snapshot interval, undo, reset | 30m |
| 7 | Polish and deploy | 30m |

Steps 1 and 2 complete and green before any pixel exists. With five strategies and a correctness oracle, a working core is what makes the rest debuggable.

**Honest estimate: around four and a half hours, not two.** Chronoscope is roughly twice the original concept. If the clock runs short, cut in this order: the cost curves, keeping the asymptotic table — it carries most of that argument at a fraction of the work; then the hybrid strategy; then undo, leaving reset. The sandbox itself is no longer on the cut list, and the generated-log fuzzing never was: it is twenty minutes that makes every other claim in the build defensible.

---

## 7. Decisions

| Question | Settled on |
|---|---|
| Framing | Representation comparison, per `Chronoscope.md`, rather than a concept explainer. Assumes the audience knows what bitemporality is. |
| Strategies | Four correct, plus snapshot-read-as-deltas as a deliberately incorrect fifth. |
| Concept explainer | Plane and cursors retained as the shared logical view. Payroll aggregate, guided narrative and restatement panel all cut. |
| Time representation | Calendar dates in the interface, integer day offsets in the core. |
| Scale projections | Analytic cost models only — formulas plotted, no instrumentation. Faster to build; every figure is asserted rather than observed, so the panel is labelled as a model and the asymptotics need to hold up to questioning on their own. |
| Domain | Employee record — salary and manager, following the source document. |
| Deployment | GitHub Pages, public repository. |
| Arbitrary injection | First-class. Any fact, any valid time, recorded at an advanceable clock. |
| System time | Append-only and monotonic, enforced in the core. Valid time unconstrained in both directions. |
| Testing | Property sweep against the oracle over both the fixed scenario and generated logs. |
| Theme | Light only. |
