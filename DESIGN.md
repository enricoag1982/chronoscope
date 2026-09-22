# Design rationale

## What this is

Chronoscope is a playground for bitemporal modeling: giving every fact two
timestamps, one for when it became true in the world and one for when the system
recorded it.

The concept takes a sentence to state. Implementing it does not. Once knowledge
of the past can change, the choice of storage representation stops being an
implementation detail — events, validity intervals and snapshots describe the
same logical history and behave differently the moment a retroactive fact
arrives. The tool exists to make that difference visible.

## Approach

The obvious build is an explainer: teach someone what bitemporal means. I built
the layer above that instead. The page assumes you accept the two-clock model and
asks the question that follows — how do you store it, and what does each choice
cost when a correction lands.

Three things follow from that framing.

**Every representation is derived from one fact log.** `materialize` folds
`apply` over an empty state, so the batch path and the incremental path cannot
drift, and the operation counts shown in the interface are the ones a real write
would have paid.

**Correctness is established against an oracle, not by assertion.**
`core/reference.ts` is a deliberately slow, obviously correct scan of the log.
Every strategy is judged against it and nothing else.

**One strategy is deliberately wrong, and is a peer of the others.** It uses the
same interface, the same materialization and the same rendering. Nothing in the
code special-cases it. The only thing distinguishing it is that it returns wrong
answers, and the page establishes that by running it.

## Key decisions and their tradeoffs

**The incorrect strategy is demonstrated, not described.** It is the snapshot
strategy with invalidation narrowed to the single valid point being written.
A snapshot taken when the manager changed keeps a salary a later retroactive fact
should have replaced, and every read after that returns a superseded value with
no error raised. The tradeoff is that it costs a fifth row of screen space and a
fifth model in the cost panel. It earns that by being the failure people actually
ship.

**The sweep is exhaustive rather than sampled.** The value surface is piecewise
constant and changes only at recorded coordinates, so evaluating every breakpoint
and its neighbours visits every distinct region. This is why 374 tests run in
under two seconds while still covering the whole coordinate space, over both the
shipped scenario and generated random histories.

**Events store absolute assignments, not differences.** A difference only encodes
numeric attributes, and `manager` is a string. More importantly, a difference
makes each event's meaning depend on every earlier event being present and
applied exactly once, so a retroactive insert would change what every later event
means. That is the same failure class as the uninvalidated snapshot. The cost is
that the name "delta" no longer applies, which is why the strategy is called an
event log.

**System time has no input control.** The `addFact` action carries no
`systemTime` field; the reducer stamps the clock. An illegal system time is
unexpressible rather than validated after the fact. Valid time stays free in both
directions, because retroactive and pre-announced facts are the subject. The
asymmetry is the semantics: valid time is a claim about the world and can be
revised, system time is the record of what we did and cannot.

**The snapshot grid counts events, not days.** A grid pinned to a calendar stops
meaning anything once history is large. Counting events makes the grid grow with
the history it indexes, and removes the horizon from the hybrid cost model
entirely.

## What changed during the build

**The cost model contradicted the code.** It charged interval tables `O(d·N)` for
a retroactive write, inherited from the write-amplification story those tables
usually carry. Measured, it is constant — three operations at eight facts, three
at thirty-two — because facts here are open-ended, so a new fact always lands
inside exactly one row and is clipped at the next boundary. Amplification needs
facts carrying an explicit valid range, which this model does not have.
`core/costClaims.test.ts` now compares every modelled measure's growth against
operations the strategies actually perform.

**Changing the grid changed an answer.** Moving the hybrid grid from days to
events made its retroactive cost scale with the number of facts, where the
calendar version had been flat. The drift guard caught it. Two strategies now pay
for retroactive depth, not one.

**A render test caught a bug in the divergence geometry.** It derived breakpoints
from the queried attribute alone, which holds for the oracle and fails for a
strategy: a snapshot is a whole-entity record, so a stale one taken at a manager
change is exactly where a salary answer starts being wrong. The wrong region
rendered empty in precisely the case the tool exists to show.

**The clock destroyed an audit row.** It started on the last recording's system
time, so the first fact a user added closed an already-open interval row with a
zero-width system range — unreadable, therefore dropped. The audit trail lost an
entry at the moment a reader was watching for one to appear.

**The interface lost more than it gained.** A two-dimensional heat map of the
whole surface was built, deployed, and removed: a large panel for something the
strategy rows state directly. Two cursor sliders became the timeline axes
themselves. A second copy of the plane for the other attribute was cut before it
shipped.

## Known limits

- **The scale panel is modelled, not measured.** Closed-form functions of each
  strategy's mechanics, labelled as such in the interface. The guard test keeps
  the model's growth honest against the implementation, but the constants are
  reasoned rather than benchmarked.
- **Facts are open-ended.** They carry a `validFrom` and no `validTo`. This is
  why interval writes are constant here, and it understates the cost of interval
  tables in systems where a correction spans an explicit range.
- **Day granularity.** Two facts recorded on the same day can produce a
  zero-width system range that no query can observe. Real systems avoid this with
  finer transaction timestamps.
- **One entity, two attributes.** Enough to show whole-entity snapshot staleness;
  not enough to explore per-entity partitioning or cross-entity queries.

## Running it

```
npm install
npm test        # 374 tests
npm run dev
```

Deployed to GitHub Pages on push to main, gated on the suite.
