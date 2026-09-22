# Chronoscope — Exploring Bitemporal Data

I wanted to introduce a small dynamic page that allows the reader to visualize and understand some of the challenges of bitemporal modeling.

Bitemporal modeling is a data design approach that allows to record a piece of information using two separate time dimension: when the fact got registered in the system and when the fact happen (or will happen) from a business point of view. 
An example is for an HR system a salary, we want our system of record to be able to contain all the various changes in salary so it is possible for example to (re)calculate taxes at a specific point of time, amend errors, and preserve all the state of a fact.

I found interesting to create this small example as even working with an AI agent we managed to introduce few mistakes in the definition of the storage layer and the interaction with them.
Was also pretty cool to see how fast is to setup a typescript page running on gitHub pages.

The Agent did most of the work creating a strong iteration loop where a coordinator used some agents to work on the sub-parts, and then reused these sub-agents and their context to fast apply corrections.

## The real tool:

Real-world data is rarely static, and changes do not always arrive in chronological order.

Consider an employee record:

- At valid time `10`, Mark reports to Jim and earns `$10`.
- At valid time `40`, Mark starts reporting to Rob.
- Later, the system learns that Mark's salary actually changed to `$20` at valid time `30`.

The new information changes our understanding of the past without changing what the system previously knew.

This introduces two distinct notions of time:

- **Valid time** — when a fact was true in the real world.
- **System time** — when the system learned or recorded that fact.

Together, these form a **bitemporal model**.

## The problem

There are multiple ways to represent temporal data, each with different behavior and operational tradeoffs.

For example, we could store changes as:

- **Event log** — record each fact as it is learned and reconstruct state by replaying them.
- **Validity intervals** — store facts together with the periods during which they are valid.
- **Snapshots** — periodically store the complete state of an entity.
- **Hybrid approaches** — combine an authoritative event log with materialized snapshots or indexes.

These representations can describe the same logical history, but they behave very differently when new information arrives retroactively.

A snapshot at time `40`, for example, may contain:

```text
manager = Rob
salary = 10
```

even though only the manager changed at time `40`.

If we later discover that salary became `$20` at time `30`, blindly interpreting the snapshot as a set of changes would incorrectly revert salary back to `$10` at time `40`.

The representation therefore affects not only storage, but also how corrections, reconstruction, and derived state must be handled.

## The tool

Chronoscope is an interactive environment for exploring these behaviors.

The user sees the history of an entity as a timeline of facts. They can introduce new information either through prepared scenarios or by manually adding facts with:

- a value,
- a valid time,
- and a system/recorded time.

After each change, Chronoscope shows:

1. **The logical bitemporal history** — what we currently believe happened and what we believed at earlier system times.
2. **The underlying representation** for each storage strategy.
3. **How that representation must change** when retroactive facts are introduced.
4. **The reconstructed state** at selected valid-time and system-time coordinates.

The same change can therefore be applied to several models side-by-side.

For example:

```text
New fact recorded at system time 100:

salary = $20
valid from time 30
```

An interval representation may split an existing interval.

An event representation may append a new fact and require replay of subsequent events.

A snapshot-based representation may invalidate or require reconstruction of snapshots created after valid time `30`.

All approaches should ultimately represent the same intended history, while exposing different costs and failure modes.

## Exploring scale

Chronoscope also illustrates what happens as history grows from a handful of facts to thousands or millions of changes.

The tool projects characteristics such as:

- number of stored records,
- amount of duplicated state,
- work required to reconstruct current state,
- work required for point-in-time queries,
- records affected by a retroactive correction,
- snapshots or derived state requiring invalidation,
- and write amplification caused by interval modifications.

The goal is not to benchmark specific database implementations. Instead, the projections make the **asymptotic and architectural tradeoffs** visible.

For example:

```text
                     Read state     New fact       Historical correction

Event log            Replay         Append         Append + replay
Intervals            Direct query   Interval edit  Split/rewrite intervals
Snapshots            Direct query   New snapshot   Invalidate/rebuild
Hybrid                Short replay  Append         Invalidate + partial replay
```

As the amount of history increases, the user can see where each strategy pays its complexity cost.

## Goal

Chronoscope is not intended to prescribe one correct temporal storage model.

Its goal is to make an unintuitive systems-design problem tangible:

**When our knowledge of the past changes, how should the system represent history, reconstruct state, and maintain derived data?**

By manipulating the same facts under different representations, users can develop an intuition for bitemporal modeling that is difficult to acquire from static diagrams or explanations alone.