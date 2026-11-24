Feature: list the open issues with their Status

  Scenario Outline: a line per open issue
    Given gh lists the recorded issues
    When I run "list"
    Then issue "<number>" prints status "<status>" and title "<title>"

    Examples:
      | number | status    | title                                                     |
      | 187    | Todo      | qsm-tasks: the binary lists the open work with its Status |
      | 190    | no status | qsm-tasks pilot: throwaway issue of the live run          |

  Scenario Outline: a title stays in one cell
    Given gh answers '<raw>'
    When I run "list"
    Then issue "1" prints status "no status" and title "<title>"

    Examples:
      | raw                                              | title |
      | [{"number":1,"title":"a\\nb","projectItems":[]}]   | a b   |
      | [{"number":1,"title":"a\\r\\nb","projectItems":[]}] | a b   |
      | [{"number":1,"title":"a\\tb","projectItems":[]}]   | a b   |

  Scenario Outline: the data of the same list
    Given gh lists the recorded issues
    When I run "list --json"
    Then the data of issue "<number>" has status "<status>"

    Examples:
      | number | status |
      | 187    | Todo   |
      | 190    | null   |

  Scenario Outline: gh cannot answer
    Given gh is "<how>" printing "<stderr>" on stderr
    When I run "list --json"
    Then it ends "<code>" with exit <exit> saying "<said>"

    Examples:
      | how     | stderr                   | code    | exit | said                     |
      | failing | HTTP 401: Bad credentials | failed  | 1    | HTTP 401: Bad credentials |
      | absent  |                          | missing | 4    | gh                       |

  Scenario Outline: gh answers in a shape the list does not know
    Given gh answers '<raw>'
    When I run "list --json"
    Then it ends "failed" with exit 1 saying "<said>"

    Examples:
      | raw                                                              | said                              |
      | {}                                                               | output is not an array            |
      | [1]                                                              | [0] is not                        |
      | [{"number":"1","title":"t","projectItems":[]}]                   | [0] is not                        |
      | [{"number":1,"title":2,"projectItems":[]}]                       | [0] is not                        |
      | [{"number":1,"title":"t","projectItems":{}}]                     | [0] is not                        |
      | [{"number":1,"title":"t","projectItems":[1]}]                    | [0].projectItems[0].status.name   |
      | [{"number":1,"title":"t","projectItems":[{"status":1}]}]         | [0].projectItems[0].status.name   |
      | [{"number":1,"title":"t","projectItems":[{"status":{"name":1}}]}] | [0].projectItems[0].status.name   |
      | [{"number":1,"title":"t","projectItems":[]},{}]                  | [1] is not                        |
