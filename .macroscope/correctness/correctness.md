---
requires:
  - check
  - linked-issue
  - pr-size
waitsForDiscoveryTimeout: 5
waitsForTimeout: 30
---

The review runs only after every CI check of the pull request has passed, because a review of a
red tree reviews code that will change again.
