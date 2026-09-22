# Chronoscope

**A bitemporal modeling playground.** Two clocks per fact, and why one is never enough.

Live: https://enricoag1982.github.io/chronoscope/

Bitemporal modeling gives every fact two timestamps — when it became true in the
world, and when the system found out. Facts are recorded rather than overwritten,
so the store can answer both "what is true?" and "what did we believe, and when?".

The difficulty is in the primitives rather than the concept. Depending on how
history is stored, a fact dated in the past can overwrite later changes, a
materialised view can keep serving a value that was corrected months ago, and
amending an entry can mean editing history in place, which removes the audit
trail. None of these raise an error.

Chronoscope stores one small history five ways and lets you add facts dated in
the past to compare what each representation costs and which one returns the
wrong answer.

## The five representations

Every event carries an absolute assignment (`salary := 72,000`) rather than a
difference. A difference only encodes numeric attributes, and it makes each
event's meaning depend on every earlier one, so a retroactive insert would
change what every later event means.

| | Read | Write | Retroactive write |
|---|---|---|---|
| Event log | replay | append | append |
| Intervals | direct lookup | close and reopen | close and reopen |
| Snapshots | direct lookup | write snapshot | invalidate and rebuild |
| Hybrid | snapshot + bounded replay | append | rebuild affected grid points |
| Snapshots, uninvalidated | direct lookup | write snapshot | **nothing — and that is the bug** |

The fifth is a deliberately incorrect peer of the others: same interface, same
materialisation, same rendering. It skips invalidation, so a snapshot taken
before a retroactive fact keeps a value that fact should have replaced, and every
later read returns the superseded value. The tool runs the strategy and shows
where it diverges rather than describing the failure.

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

[DESIGN.md](DESIGN.md) covers the approach, the key decisions and their
tradeoffs, what changed during the build, and the known limits.
[PLAN.md](PLAN.md) is the build plan and [Chronoscope.md](Chronoscope.md) the
original concept.
