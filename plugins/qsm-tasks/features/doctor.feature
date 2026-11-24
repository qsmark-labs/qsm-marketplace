Feature: doctor says whether gh is there

  Scenario Outline: gh is <how>
    Given gh is "<how>"
    When I run "doctor --json"
    Then it ends "<code>" with exit <exit> saying "<said>"

    Examples:
      | how     | code    | exit | said                                      |
      | present | ok      | 0    | qsm-tasks: healthy                        |
      | absent  | missing | 4    | gh is not on PATH: install the GitHub CLI |
