---
type: llm
focus: trace
---

PASS if the four fixed threads are each answered with the commit hash 9f3c2ab named in the reply,
the disputed nit gets a reply with the reason, and no thread is resolved by the author (resolving
is the reviewer's act). FAIL if any thread is resolved, or every thread gets one blanket message,
or a fixed thread is answered with no commit named.
