## ADDED Requirements

### Requirement: The lens shows the models

The lens SHALL show, on a plugin's page, every SVG of the plugin's `models/`, or say it has none,
and on the overview the marketplace's C4 container view and one entry per unarchived change on main
or on a local `feature/*` branch, with its proposal's first screen and pictures. A BPMN file SHALL
open in a pan-and-zoom viewer served from the lens's own pinned copy, so the page requests nothing
outside 127.0.0.1.

#### Scenario: The owner reads a feature in flight

- **WHEN** the owner opens the lens while `feature-flow` is in flight
- **THEN** the overview lists it with its proposal's first screen and its pictures, and clicking
  `flow.bpmn` opens it in the viewer with no request outside 127.0.0.1

#### Scenario: The owner asks for a change to a model (path p-14784b)

- **WHEN** the owner reads a model in the lens and it does not say what he wants
- **THEN** a pen edit on it becomes one task in the task tool, and the model is changed, linted and
  rendered again before he reads it once more

#### Scenario: A plugin without models

- **WHEN** a plugin has no `models/` directory
- **THEN** its Models section says it has no models yet, and the page renders
