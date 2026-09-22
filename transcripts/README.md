# Build transcripts

The complete record of how this project was built, start to finish, with an
agent. Kept because the process is part of what the project is arguing: the
mistakes made along the way are the same class of mistake the tool demonstrates.

- `session-1.md`, `session-2.md` — readable renderings of the conversation.
  Assistant reasoning and raw tool output are omitted; tool calls appear as a
  name and a one-line summary.
- `session-1.jsonl`, `session-2.jsonl` — the complete raw logs, including tool
  results.
- `subagents/` — logs for each parallel agent, named by the session that
  spawned it.

Absolute home directory paths have been replaced with `~`. No credentials appear
in these files.

Some things worth finding in here:

- the cost model being caught contradicting the implementation it described
- a render test catching a geometry bug that made the tool's central
  demonstration render empty
- the snapshot grid being changed from calendar days to events, which changed one
  of the project's own answers
- the interface losing a two-dimensional visualization that had already been
  built and deployed
