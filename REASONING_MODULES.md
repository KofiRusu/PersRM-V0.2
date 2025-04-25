# 🧠 PersLM.UIUX — Reasoning Modules

## 1. `LayoutInterpreter`
Translates backend data structures and logic into visual layouts (e.g., tables, cards, modals, grids). Handles placement, flow, and responsiveness.

### Capabilities:
- Analyzes data schemas to determine optimal presentation layouts
- Maps entity relationships to hierarchical UI structures
- Implements responsive breakpoint strategies for different devices
- Balances information density with whitespace for readability
- Generates grid systems, flexbox layouts, and positioning rules

### Methods:
- `analyze_data_schema(schema)`: Examine data structures to suggest optimal layouts
- `generate_layout(data, context)`: Create layout structure based on data and usage context
- `apply_responsive_rules(layout)`: Add responsive behavior to layouts
- `optimize_information_hierarchy(layout)`: Arrange elements by importance and relationship

## 2. `ComponentSynthesizer`
Generates reusable UI components (e.g., buttons, dropdowns, sidebars) using Tailwind and shadcn/ui. Handles props, slots, and styling conventions.

### Capabilities:
- Transforms functional requirements into appropriate component selections
- Implements consistent styling and behavior patterns
- Manages component state, variants, and conditional rendering
- Optimizes component composition for reusability
- Generates TypeScript types and prop interfaces

### Methods:
- `select_component_type(requirement)`: Choose appropriate component based on requirement
- `generate_component_code(type, options)`: Create component implementation
- `define_component_api(component)`: Create props and event interface
- `apply_styling(component, theme)`: Apply styling according to theme
- `compose_components(components, layout)`: Arrange components in a coherent structure

## 3. `UXFlowDesigner`
Maps user interaction patterns and intent flows (e.g., onboarding, checkout, CRUD flows). Applies usability heuristics and interaction logic.

### Capabilities:
- Designs multi-step user journeys with appropriate feedback
- Implements navigation patterns and information architecture
- Applies cognitive load management techniques
- Creates interaction states (hover, focus, active, error, etc.)
- Optimizes for user intent completion and task success

### Methods:
- `map_user_journey(start_point, goal)`: Design complete user journey
- `define_interaction_states(component)`: Create state variations for components
- `optimize_task_completion(flow)`: Refine flow to reduce friction
- `implement_feedback_mechanisms(flow)`: Add appropriate user feedback
- `validate_against_heuristics(flow)`: Check against usability principles

## 4. `DesignSystemMapper`
Adapts output to match a target design system (e.g., Figma tokens, typography rules, theme palette). Ensures brand alignment.

### Capabilities:
- Converts abstract components to specific design system implementations
- Applies consistent tokens, spacing, and typography rules
- Manages theme variations (light/dark, brand themes)
- Ensures visual consistency across components
- Translates between different design systems when needed

### Methods:
- `load_design_system(source)`: Import design system specifications
- `apply_design_tokens(component)`: Apply appropriate tokens to component
- `generate_theme_variations(component)`: Create theme variants
- `validate_design_consistency(components)`: Check for visual consistency
- `translate_between_systems(component, source, target)`: Convert between systems

## 5. `AccessibilityEvaluator`
Ensures generated UIs are compliant with a11y standards — color contrast, ARIA roles, keyboard nav, semantic markup.

### Capabilities:
- Evaluates WCAG compliance across all generated components
- Implements proper semantic HTML structure
- Adds appropriate ARIA attributes and roles
- Ensures keyboard navigability and focus management
- Verifies color contrast and text readability

### Methods:
- `analyze_accessibility(component)`: Evaluate component for a11y issues
- `fix_accessibility_issues(component, issues)`: Resolve identified a11y problems
- `enhance_keyboard_navigation(flow)`: Improve keyboard interaction
- `verify_color_contrast(component)`: Check and fix contrast issues
- `implement_screen_reader_support(component)`: Add appropriate screen reader cues

## 6. `RationaleEngine`
Explains design decisions clearly. Compares alternatives. Can be queried for "why X over Y?" to support iterative feedback.

### Capabilities:
- Documents reasoning behind design and implementation choices
- Compares alternative approaches with pros/cons analysis
- Provides justifications based on UX principles and best practices
- Generates decision trees for complex design choices
- Adapts explanations to different stakeholder perspectives

### Methods:
- `explain_decision(component, decision)`: Provide rationale for a decision
- `compare_alternatives(options, criteria)`: Analyze different approaches
- `generate_decision_tree(problem)`: Create hierarchical decision structure
- `adapt_explanation(rationale, audience)`: Tailor explanation to audience
- `link_to_principles(decision)`: Connect decisions to established principles

## 7. `PerformanceOptimizer`
Ensures generated UI code follows performance best practices for rendering, animation, and resource loading.

### Capabilities:
- Analyzes component render efficiency
- Implements code-splitting and lazy loading strategies
- Optimizes animation performance and efficiency
- Manages asset loading and resource prioritization
- Applies memoization and virtualization where appropriate

### Methods:
- `analyze_render_performance(component)`: Identify performance bottlenecks
- `implement_code_splitting(component)`: Break down components for efficiency
- `optimize_animations(component)`: Improve animation performance
- `manage_asset_loading(resources)`: Create loading strategies
- `apply_virtualization(list_component)`: Implement virtualization for long lists

## 8. `StateManagementArchitect`
Designs and implements state management patterns appropriate to component complexity and data flow requirements.

### Capabilities:
- Determines appropriate state management approach based on complexity
- Implements local vs. global state separation
- Creates reducer patterns and actions for complex state
- Optimizes re-render behavior and state updates
- Manages side effects and asynchronous state changes

### Methods:
- `analyze_state_requirements(component)`: Determine state needs
- `implement_state_pattern(component, pattern)`: Apply state management
- `optimize_state_updates(component)`: Improve update efficiency
- `handle_side_effects(component)`: Manage async state changes
- `document_state_flows(component)`: Create state flow diagrams 