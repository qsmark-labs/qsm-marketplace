Feature: add files an issue

  Scenario Outline: a new issue
    Given gh creates the issue titled "a title" from "body.md" and prints "<out>"
    When I run "add 'a title' --body-file body.md --json"
    Then the data is the number <number>
    And gh received "create"

    Examples:
      | out                                         | number |
      | https://github.com/owner/repo/issues/190    | 190    |
      | https://github.com/owner/repo/issues/191\\n | 191    |

  Scenario: a new sub-issue
    Given gh creates the issue titled "a title" from "body.md" and prints "https://github.com/owner/repo/issues/190"
    And gh gives the id "9001\n" of issue "190"
    And gh accepts the sub-issue id "9001" under issue "186"
    When I run "add 'a title' --body-file body.md --parent 186 --json"
    Then the data is the number 190
    And gh received "create"
    And gh received "id"
    And gh received "sub-issue"

  Scenario: the issue is filed and the sub-issue step fails
    Given gh creates the issue titled "a title" from "body.md" and prints "https://github.com/owner/repo/issues/190"
    And gh gives the id "9001" of issue "190"
    When I run "add 'a title' --body-file body.md --parent 186 --json"
    Then it ends "failed" with exit 1 saying "issue #190 was created; making it a sub-issue of #186 failed: unexpected gh call"

  Scenario Outline: gh answers in a shape add does not know
    Given gh creates the issue titled "a title" from "body.md" and prints "<out>"
    And gh gives the id "<id>" of issue "190"
    When I run "add 'a title' --body-file body.md --parent 186 --json"
    Then it ends "failed" with exit 1 saying "<said>"

    Examples:
      | out                                      | id  | said                  |
      | created it                               | 1   | no issue URL in       |
      | https://github.com/owner/repo/issues/190 | abc | id is not a number    |
      | https://github.com/owner/repo/issues/190 | 12a | id is not a number    |
      | https://github.com/owner/repo/issues/190 | a12 | id is not a number    |
      | https://github.com/owner/repo/issues/190 created | 1 | no issue URL in |

  Scenario: the body file is required
    When I run "add 'a title' --json"
    Then it ends "usage" with exit 2 saying "body-file"
