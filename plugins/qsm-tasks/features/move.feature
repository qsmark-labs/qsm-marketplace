Feature: move sets the Status of an issue

  Scenario Outline: the Status is set on the board the issue is on
    Given gh answers the board query of issue "187" with the recorded board "qsm-marketplace"
    And gh sets the Status "<status>" on the recorded board
    When I run "move 187 '<status>' --json"
    Then it ends "ok" with exit 0 saying "#187 <status>"
    And gh received "board"
    And gh received "mutation"

    Examples:
      | status    |
      | In Dev    |
      | Done      |

  Scenario Outline: the Status is refused before anything is written
    Given gh answers the board query of issue "187" with the recorded board "<boards>"
    When I run "move 187 '<status>' --json"
    Then it ends "failed" with exit 1 saying "<said>"

    Examples:
      | boards       | status | said                                                                                            |
      |              | Done   | issue #187 is on no board                                                                       |
      | first,second | Done   | issue #187 is on several boards: first, second                                                  |
      | board        | Nope   | Status Nope is not on the board; its Statuses: Todo, In Dev, Agent Review, Ready For Human, Human Review, Done |
      | board        | done   | Status done is not on the board; its Statuses: Todo, In Dev                                     |

  Scenario Outline: gh answers the board query in a shape move does not know
    Given gh answers the board query of issue "187" with '<raw>'
    When I run "move 187 Todo --json"
    Then it ends "failed" with exit 1 saying "<said>"

    Examples:
      | raw                                                                                                                      | said                               |
      | {}                                                                                                                       | projectItems.nodes is not a list   |
      | {"data":{"repository":{"issue":{"projectItems":{"nodes":[{"project":{"title":"t"}}]}}}}}                                 | field.options is not a list        |
      | {"data":{"repository":{"issue":{"projectItems":{"nodes":[{"project":{"title":"t","field":{"options":[{}]}}}]}}}}}        | options[0].id is not text          |
      | {"data":{"repository":{"issue":{"projectItems":{"nodes":[{"project":{"title":"t","field":{"options":[{"id":"a"}]}}}]}}}}} | options[0].name is not text        |
      | {"data":{"repository":{"issue":{"projectItems":{"nodes":[{"project":{"title":"t","field":{"options":[{"id":"a","name":"Todo"}]}}}]}}}}} | project.id is not text |
      | {"data":{"repository":{"issue":{"projectItems":{"nodes":[{"project":{"id":"p","title":"t","field":{"options":[{"id":"a","name":"Todo"}]}}}]}}}}} | node.id is not text |
      | {"data":{"repository":{"issue":{"projectItems":{"nodes":[{"id":"i","project":{"id":"p","title":"t","field":{"options":[{"id":"a","name":"Todo"}]}}}]}}}}} | field.id is not text |
