---
name: run-and-verify
description: "Use at the start of work in a project, before saying a change works, or when nobody has written down how the project runs. Triggers: how do I run this, start the app, does it work, verify the change, where are the logs, where is the config, set up this project locally, rozjed to, over to, how is this project started, smoke test."
---

# Run and verify

A change is done when you saw the running system do what was asked, not when the build passes.
Decide before the change what you will look at (a response, a row, a log line), run the real path
where the user runs it, and quote what you saw. Say what you could not run, first.

Find how the project runs in the README, the scripts and the instruction files. When none of them
says, work it out from the code and run it; ask only when two readings are possible.
