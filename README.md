# Chronoscope

**A bitemporal modeling playground.** Two clocks per fact, and why one is never enough.

Live: https://enricoag1982.github.io/chronoscope/

Bitemporal modeling gives every fact two timestamps — when it became true in the
world, and when the system found out. Facts are recorded rather than overwritten,
so the store can answer both "what is true?" and "what did we believe, and when?".

The idea is simple; the primitives are not. Pick the wrong ones and a fact dated
in the past silently swallows every later change, or a cached view keeps serving
a value corrected months ago, or amending an entry means editing history in place
— at which point the audit trail you built it all for is gone. These failures are
quiet. Nothing throws.

Chronoscope stores one small history five ways and lets you drop facts into the
past to see what each representation costs, and which one gets it wrong.

## The five representations

| | Read | Write | Retroactive write |
|---|---|---|---|
| Deltas | replay | append | append |
| Intervals | direct lookup | close and reopen | close and reopen |
| Snapshots | direct lookup | write snapshot | invalidate and rebuild |
| Hybrid | snapshot + bounded replay | append | rebuild affected grid points |
| Snapshots, uninvalidated | direct lookup | write snapshot | **nothing — and that is the bug** |

The fifth is a deliberately incorrect peer of the others: same interface, same
materialisation, same rendering. It skips invalidation, so a snapshot taken
before a retroactive fact keeps a value that fact should have replaced, and it
answers confidently and wrongly forever after. The tool demonstrates the failure
rather than describing it.

## How correctness is established

`core/reference.ts` is a deliberately slow, obviously correct scan of the fact
log — the oracle. Every strategy is judged against it and nothing else.

The value surface is piecewise constant and breaks only at recorded coordinates,
so sweeping those breakpoints and their neighbours visits every distinct region.
That sweep runs against the shipped scenario and against generated histories, for
every strategy, at every coordinate. The incorrect strategy gets an inverted test
pinning exactly where it diverges and asserting it agrees everywhere else.

`core/costClaims.test.ts` holds the cost model to the implementations: it
compares how each modelled measure grows against operations the strategies
actually perform. It has already caught one real drift.

## Running it

```
npm install
npm test        # 374 tests
npm run dev
npm run build
```

Deploys to GitHub Pages on push to main, gated on the test suite.

## Design notes

See [PLAN.md](PLAN.md) for the build plan and [Chronoscope.md](Chronoscope.md)
for the original concept.
