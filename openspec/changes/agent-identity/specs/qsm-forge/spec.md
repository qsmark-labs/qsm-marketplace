## ADDED Requirements

### Requirement: Agents write to GitHub under their own identity

Pull requests an agent opens and reviews an agent posts SHALL be made with the organization's
App identity, and the owner's approval SHALL be the one GitHub requires before a merge into main
or into `feature/*`.

#### Scenario: The review agent posts a review

- **WHEN** the review agent submits its review of a task pull request
- **THEN** the review shows the App as its author, and the pull request still needs the owner's
  approval to merge
