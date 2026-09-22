# Design rationale

## The problem

I decided to follow the theme:

> Theme 1: Exploration & Understanding
> Complex systems, technical concepts, and unfamiliar artifacts are hard to understand through static explanation. Build a tool that helps users develop deep understanding—whether that's a simulation of emergent dynamics, an explainer for a technical concept, or a tool for exploring codebases, datasets, or documents.

In my prototype I wanted to help the reader understand bitemporal modeling.

## What it is

I created a small dynamic page that lets the reader visualize and understand some
of the challenges of bitemporal modeling.

Bitemporal modeling is a data design approach that records a piece of information
along two separate time dimensions: when the fact was registered in the system,
and when the fact happened (or will happen) from a business point of view. Take a
salary in an HR system: we want our system of record to hold every change to that
salary, so that it is possible to recalculate taxes at a specific point in time,
amend errors, and preserve the full history of a fact.

I found it interesting to build this small example because, even working with an
AI agent, we managed to introduce a few mistakes in the definition of the storage
layer and in the interaction with it. Bitemporal modeling has a lot of small
nuances, and in massively scalable systems, designing it right from the start is
a big advantage.

It was also pretty cool to see how fast it is to set up a TypeScript page running
on GitHub Pages.

## Approach

I drew on my own experience and researched online to gather some key points to
start the conversation, and worked heavily with an agent to get the best set of
concepts in before touching any code.

After that I worked with an agent to plan the overall work and discuss tradeoffs
in terms of the breadth of the example: whether to add real storage, whether to
support future-dated cases, which language and deployable runtime to use, and so
on.

Once we had a good plan, I set up the agent to do most of the work autonomously,
creating a strong iteration loop in which a coordinator used sub-agents to work
on the separate parts.

We then iterated on it to find small bugs and improvements, reusing those
sub-agents and their context to apply corrections quickly.

## Result

The result is a relatively simple page that lets you visualize facts on a
timeline and create new ones, in order to see interactively how each storage
approach handles that piece of information.

For each storage approach you can see a short explanation of the pros and cons,
and at the bottom a small representation of how well each approach scales with
the number of data points.
