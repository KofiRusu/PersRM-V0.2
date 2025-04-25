import { test, expect } from '@playwright/test';

test.describe('UI Generator E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the UI Generator page
    await page.goto('/ui-generator');
  });

  test('should load the UI Generator page', async ({ page }) => {
    // Verify page has loaded correctly
    await expect(page).toHaveTitle(/UI Generator/);
    
    // Check that main UI elements are visible
    await expect(page.locator('text=UI Generator')).toBeVisible();
    await expect(page.locator('button:has-text("Prompt")')).toBeVisible();
    await expect(page.locator('button:has-text("Schema")')).toBeVisible();
  });

  test('should generate UI component from prompt', async ({ page }) => {
    // Fill in the prompt
    await page.locator('textarea[placeholder*="Describe the UI component"]').fill(
      'Create a login form with username and password fields, a remember me checkbox, and a submit button'
    );
    
    // Click generate button
    await page.locator('button:has-text("Generate")').click();
    
    // Wait for component to be generated
    await page.waitForSelector('pre code', { timeout: 30000 });
    
    // Verify a component was generated
    const codeBlock = page.locator('pre code');
    await expect(codeBlock).toBeVisible();
    
    // Check that the generated code includes expected elements
    const codeContent = await codeBlock.textContent();
    expect(codeContent).toContain('form');
    expect(codeContent).toContain('input');
    expect(codeContent).toContain('password');
    expect(codeContent).toContain('checkbox');
    expect(codeContent).toContain('button');
  });

  test('should toggle the reasoning assistant', async ({ page }) => {
    // Find and click the reasoning assistant toggle button
    await page.locator('button[aria-label="Toggle reasoning assistant"]').click();
    
    // Verify the reasoning assistant panel appears
    await expect(page.locator('text=UI Reasoning Assistant')).toBeVisible();
    
    // Enter a question in the reasoning assistant
    await page.locator('textarea[placeholder*="Ask about UI/UX patterns"]').fill(
      'When should I use tabs vs. accordion?'
    );
    
    // Click the get reasoning button
    await page.locator('button:has-text("Get Reasoning")').click();
    
    // Wait for reasoning to be generated
    await page.waitForSelector('text=Analysis', { timeout: 30000 });
    
    // Verify reasoning sections appear
    await expect(page.locator('text=Analysis')).toBeVisible();
    await expect(page.locator('text=Approaches')).toBeVisible();
    
    // Close the reasoning assistant
    await page.locator('button[aria-label="Toggle reasoning assistant"]').click();
    
    // Verify it's gone
    await expect(page.locator('text=UI Reasoning Assistant')).not.toBeVisible();
  });

  test('should save component to library', async ({ page }) => {
    // Generate a component first
    await page.locator('textarea[placeholder*="Describe the UI component"]').fill(
      'Create a notification banner with an icon, message, and close button'
    );
    
    await page.locator('button:has-text("Generate")').click();
    
    // Wait for component to be generated
    await page.waitForSelector('pre code', { timeout: 30000 });
    
    // Click the save to library button
    await page.locator('button:has-text("Save to Library")').click();
    
    // Fill in component details
    await page.locator('input[placeholder="Component name"]').fill('NotificationBanner');
    await page.locator('textarea[placeholder="Component description"]').fill('A reusable notification banner component');
    await page.locator('input[placeholder="Enter tags"]').fill('notification, alert');
    await page.keyboard.press('Enter');
    
    // Submit save form
    await page.locator('button:has-text("Save Component")').click();
    
    // Verify success message
    await expect(page.locator('text=Component saved successfully')).toBeVisible();
  });

  test('handles errors gracefully', async ({ page }) => {
    // Try to generate with an empty prompt
    await page.locator('button:has-text("Generate")').click();
    
    // Verify error message
    await expect(page.locator('text=Please enter a prompt')).toBeVisible();
    
    // Try with a very short prompt (presumed to be invalid)
    await page.locator('textarea[placeholder*="Describe the UI component"]').fill('button');
    await page.locator('button:has-text("Generate")').click();
    
    // Verify the appropriate error message
    await expect(page.locator('text=Please provide more details')).toBeVisible();
  });
}); 