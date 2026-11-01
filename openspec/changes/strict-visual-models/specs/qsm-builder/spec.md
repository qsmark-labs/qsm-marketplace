## ADDED Requirements

### Requirement: The lens shows the models

The lens SHALL show, on a plugin's page, a Models section with every SVG of the plugin's `models/`,
and on the overview the marketplace's C4 container view and one entry per change on main that is not
archived, with the first screen of its proposal and its pictures. A BPMN file SHALL open in a
pan-and-zoom viewer the lens serves from its own pinned copy, so the page still requests nothing
outside 127.0.0.1. A plugin with no models SHALL show the section saying so.

#### Scenario: The owner reads a feature in flight

- **WHEN** the owner opens the lens while `feature-flow` is in flight
- **THEN** the overview lists it with its proposal's first screen and its pictures, and clicking
  `flow.bpmn` opens it in the viewer with no request outside 127.0.0.1

#### Scenario: The owner asks for a change to a model (path p-c46882)

- **WHEN** the owner reads a model in the lens and it does not say what he wants
- **THEN** a pen edit on it becomes one task in the task tool, and the model is changed, linted and
  rendered again before he reads it once more

#### Scenario: A plugin without models

- **WHEN** a plugin has no `models/` directory
- **THEN** its Models section says it has no models yet, and the page renders
