# Chronoscope

An interactive environment for comparing bitemporal storage representations.

Real-world facts arrive out of order. A salary change effective 1 March may only be
recorded on 10 June — after a manager change effective 1 April has already been
written. Once history is mutable, how you *represent* it stops being an
implementation detail: deltas, validity intervals and snapshots can describe the
same logical history and behave completely differently when a retroactive fact
lands.

Chronoscope applies the same facts to five representations side by side and shows
what each one costs — including one deliberately incorrect strategy whose bug the
tool demonstrates rather than describes.

See [PLAN.md](PLAN.md) for the design, and [Chronoscope.md](Chronoscope.md) for the
concept it is built from.

## Status

In development.
