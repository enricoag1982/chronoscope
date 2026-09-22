# Design rationale

## What it is

A playground for bitemporal modeling: every fact carries two timestamps, one for
when it became true in the world and one for when the system recorded it.

The concept takes a sentence. Implementing it does not. Once knowledge of the
past can change, the storage representation stops being an implementation
detail — events, intervals and snapshots describe the same history and behave
differently the moment a retroactive fact arrives.

## Approach

The obvious build is an explainer. This is the layer above: it assumes the
two-clock model and asks what it costs to store.

- **Every representation derives from one fact log.** `materialize` folds `apply`
  over an empty state, so the batch and incremental paths cannot drift, and the
  operation counts on screen are the ones a real write would pay.
- **Correctness comes from an oracle.** `core/reference.ts` is a deliberately
  slow, obviously correct scan. Every strategy is judged against it, nothing else.
- **One strategy is wrong, and is a peer.** Same interface, same materialization,
  same rendering; nothing special-cases it. It is the snapshot strategy missing
  its invalidation step, so a snapshot taken at a manager change keeps a salary a
  later retroactive fact should have replaced. The page establishes that by
  running it, not by captioning it.

## Decisions and tradeoffs

**The sweep is exhaustive, not sampled.** The value surface is piecewise constant
and changes only at recorded coordinates, so evaluating every breakpoint and its
neighbours visits every region. 374 tests in under two seconds, over the scenario
and generated histories.

**Events store absolute assignments, not differences.** A difference only encodes
numeric attributes, and `manager` is a string. It would also make each event
depend on every earlier one, so a retroactive insert would change what all of
them mean — the same failure class as the uninvalidated snapshot.

**System time has no input control.** The `addFact` action has no `systemTime`
field; the reducer stamps the clock. An illegal value is unexpressible rather
than validated. Valid time stays free in both directions, because retroactive and
pre-announced facts are the subject.

**The snapshot grid counts events, not days.** A calendar grid stops meaning
anything at scale. Counting events makes it grow with the history it indexes.

## What changed during the build

**The cost model contradicted the code.** It charged intervals `O(d·N)` for a
retroactive write. Measured, it is constant — three operations at eight facts,
three at thirty-two — because open-ended facts always land inside one row and are
clipped at the next boundary. `core/costClaims.test.ts` now compares every
modelled measure's growth against operations the code performs.

**Changing the grid changed an answer.** Moving hybrid from days to events made
its retroactive cost scale with N, where the calendar version was flat. The guard
test caught it.

**A render test caught a geometry bug.** The divergence calculation took
breakpoints from the queried attribute alone — true for the oracle, false for a
strategy, since a snapshot is a whole-entity record. The wrong region rendered
empty in exactly the case the tool exists to show.

**The clock destroyed an audit row.** It started on the last recording's system
time, so the first user-added fact closed an open interval row with a zero-width
system range: unreadable, therefore dropped.

**The interface lost more than it gained.** A two-dimensional heat map was built,
deployed and removed. Two cursor sliders became the timeline axes themselves.

## Known limits

- **The scale panel is modelled, not measured.** The guard test keeps its growth
  honest against the implementation; the constants are reasoned, not benchmarked.
- **Facts are open-ended** — `validFrom` with no `validTo`. This is why interval
  writes are constant here, and it understates their cost where a correction
  spans an explicit range.
- **Day granularity** lets two same-day recordings produce a zero-width system
  range no query can observe. Finer transaction timestamps avoid this.
- **One entity, two attributes.** Enough for whole-entity snapshot staleness, not
  for partitioning or cross-entity queries.

## Running it

```
npm install
npm test        # 374 tests
npm run dev
```

Deployed to GitHub Pages on push to main, gated on the suite.
