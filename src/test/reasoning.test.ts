import { extractStructuredResponse } from "../app/api/reasoning/utils";

// Mock reasoning response for testing
const mockReasoning = `
## Analysis
This is a test analysis section that discusses the problem.

## Approaches
1. First approach to solve the problem
2. Second approach which is different
3. Third alternative approach

## Best Practices
- Always follow this practice
- Never do this thing
- Consider this other thing

## Accessibility Considerations
- Make sure to have proper contrast
- Add appropriate ARIA attributes
- Support keyboard navigation

## Implementation
Here is some implementation guidance:
\`\`\`jsx
function TestComponent() {
  return <div>Test</div>;
}
\`\`\`

## Examples
Example 1: Some website does this well
Example 2: Another implementation to consider
`;

describe("Reasoning API Utilities", () => {
  test("extractStructuredResponse parses reasoning sections correctly", () => {
    const result = extractStructuredResponse(mockReasoning);

    // Check if all sections are extracted
    expect(result.analysis).toContain("test analysis section");
    expect(result.approaches).toHaveLength(3);
    expect(result.bestPractices).toHaveLength(3);
    expect(result.accessibility).toHaveLength(3);
    expect(result.implementation).toContain("implementation guidance");
    expect(result.examples).toContain("Example 1");
  });

  test("extractStructuredResponse handles missing sections gracefully", () => {
    const incompleteReasoning = `
## Analysis
Just an analysis with no other sections
    `;

    const result = extractStructuredResponse(incompleteReasoning);

    // Check if defaults are used for missing sections
    expect(result.analysis).toContain("Just an analysis");
    expect(result.approaches).toEqual(["No approaches could be extracted."]);
    expect(result.bestPractices).toEqual([
      "No best practices could be extracted.",
    ]);
    expect(result.accessibility).toEqual([
      "No accessibility considerations could be extracted.",
    ]);
    expect(result.implementation).toBe(
      "No implementation details could be extracted.",
    );
    expect(result.examples).toBe("No examples could be extracted.");
  });
});
