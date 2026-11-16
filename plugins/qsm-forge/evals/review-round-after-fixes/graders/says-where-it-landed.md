---
type: llm
focus: trace
---

The sandbox has no forge, so judge the planned commands and replies the answer writes out.

PASS if all of these hold:

- The push of 9f3c2ab comes before the first reply or resolve.
- Each of the four fixed threads is answered with the commit hash 9f3c2ab (the same text on those
  four is fine).
- The two threads whose fix has a test are resolved with a message that names the commit and the
  test; the two without a test get a reply and stay open.
- The disputed nit gets its own reply that gives the reason or a marked place for the user's reason
  (the prompt does not say it), and stays open.

FAIL if any reply or resolve is planned before the push, a thread without a test is resolved, one
message is posted on all five threads including the nit, or a fixed thread is answered with no
commit named.
