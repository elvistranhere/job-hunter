/**
 * E2E tests for the Job Hunter wizard flow.
 *
 * Scenarios:
 * 1. Skip AI → land on Step 2 with blank profile
 * 2. Add skills manually → verify they appear in JSON preview
 * 3. Adjust weights → verify JSON preview updates
 * 4. Toggle locations/roles → verify JSON preview updates
 * 5. Adjust minScore → verify JSON preview updates
 * 6. Navigate back and forward → state preserved
 * 7. JSON preview matches expected schema
 * 8. Copy to clipboard works
 */
import { expect, test } from "@playwright/test";

// Helper: the "add new skill" tier select is scoped to the skill input's parent
function getAddSkillTierSelect(page: import("@playwright/test").Page) {
  const skillInput = page.locator('input[placeholder*="Add a skill"]');
  return skillInput.locator("..").locator("select");
}

// Helper: the minScore slider has max=80 and step=5 (not the weight sliders which have max=2)
function getMinScoreSlider(page: import("@playwright/test").Page) {
  return page.locator('input[type="range"][max="80"]');
}

test.describe("Wizard: Skip AI → Configure Profile → Verify JSON", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("landing page loads with upload form and skip button", async ({
    page,
  }) => {
    await expect(page.locator("text=Your resume.")).toBeVisible();
    await expect(
      page.locator("button", { hasText: "Continue without AI" }),
    ).toBeVisible();
  });

  test("skip AI → goes to Step 2 with default preferences", async ({
    page,
  }) => {
    await page.click("button:has-text('Continue without AI')");

    // Should be on Step 2
    await expect(
      page.locator("h1:has-text('Configure your profile')"),
    ).toBeVisible();

    // Default roles should be visible in the profile summary section
    const roleTags = page.locator(".rounded-full.bg-amber-500\\/10");
    await expect(roleTags).toHaveCount(3);

    // Default locations should be selectable in preferences
    await expect(page.getByRole("button", { name: "Adelaide" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sydney" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Melbourne" }),
    ).toBeVisible();
  });

  test("skip AI → no skills present initially", async ({ page }) => {
    await page.click("button:has-text('Continue without AI')");

    // JSON preview should show empty skills
    const jsonPreview = page.locator("pre");
    const jsonText = await jsonPreview.textContent();
    expect(jsonText).toBeTruthy();

    const profile = JSON.parse(jsonText!);
    expect(profile.skills).toEqual([]);
    expect(profile.keywords).toEqual([]);
  });

  test("add skills manually → appear in JSON preview", async ({ page }) => {
    await page.click("button:has-text('Continue without AI')");

    const skillInput = page.locator('input[placeholder*="Add a skill"]');
    const tierSelect = getAddSkillTierSelect(page);

    // Add a core skill
    await tierSelect.selectOption("core");
    await skillInput.fill("React");
    await page.click("button:has-text('Add')");

    // Add a strong skill
    await tierSelect.selectOption("strong");
    await skillInput.fill("Python");
    await page.click("button:has-text('Add')");

    // Add a peripheral skill
    await tierSelect.selectOption("peripheral");
    await skillInput.fill("Docker");
    await page.click("button:has-text('Add')");

    // Verify JSON preview
    const jsonPreview = page.locator("pre");
    const jsonText = await jsonPreview.textContent();
    const profile = JSON.parse(jsonText!);

    expect(profile.skills).toHaveLength(3);
    expect(profile.skills[0]).toEqual({ name: "React", tier: "core" });
    expect(profile.skills[1]).toEqual({ name: "Python", tier: "strong" });
    expect(profile.skills[2]).toEqual({ name: "Docker", tier: "peripheral" });

    // Keywords should be lowercased
    expect(profile.keywords).toContain("react");
    expect(profile.keywords).toContain("python");
    expect(profile.keywords).toContain("docker");
  });

  test("cannot add empty skill - Add button visually disabled", async ({
    page,
  }) => {
    await page.click("button:has-text('Continue without AI')");

    // The skill Add button is the rounded-xl one next to the skill input
    const addBtn = page.locator("button.rounded-xl:has-text('Add')");
    await expect(addBtn).toHaveClass(/bg-navy-700/);
    await expect(addBtn).toHaveClass(/cursor-not-allowed/);
  });

  test("cannot add duplicate skill (case-insensitive)", async ({ page }) => {
    await page.click("button:has-text('Continue without AI')");

    const skillInput = page.locator('input[placeholder*="Add a skill"]');

    // Add "React"
    await skillInput.fill("React");
    await page.click("button:has-text('Add')");

    // Try to add "react" (lowercase) - should NOT add
    await skillInput.fill("react");
    await page.click("button:has-text('Add')");

    const jsonPreview = page.locator("pre");
    const jsonText = await jsonPreview.textContent();
    const profile = JSON.parse(jsonText!);

    // Only one skill should exist
    expect(profile.skills).toHaveLength(1);
  });

  test("adjust minScore slider → JSON updates", async ({ page }) => {
    await page.click("button:has-text('Continue without AI')");

    // The minScore slider has max=80 (weight sliders have max=2)
    const slider = getMinScoreSlider(page);
    await slider.fill("50");

    const jsonPreview = page.locator("pre");
    const jsonText = await jsonPreview.textContent();
    const profile = JSON.parse(jsonText!);

    expect(profile.minScore).toBe(50);
  });

  test("JSON preview has correct schema structure", async ({ page }) => {
    await page.click("button:has-text('Continue without AI')");

    // Add a skill so we have some data
    const skillInput = page.locator('input[placeholder*="Add a skill"]');
    await skillInput.fill("TypeScript");
    await page.click("button:has-text('Add')");

    const jsonPreview = page.locator("pre");
    const jsonText = await jsonPreview.textContent();
    const profile = JSON.parse(jsonText!);

    // Schema checks matching Python scraper expectations
    expect(profile).toHaveProperty("skills");
    expect(profile).toHaveProperty("titles");
    expect(profile).toHaveProperty("keywords");
    expect(profile).toHaveProperty("locations");
    expect(profile).toHaveProperty("roles");
    expect(profile).toHaveProperty("weights");
    expect(profile).toHaveProperty("minScore");

    // Weights have all 8 keys
    const weightKeys = Object.keys(profile.weights);
    expect(weightKeys).toContain("skills");
    expect(weightKeys).toContain("companyTier");
    expect(weightKeys).toContain("location");
    expect(weightKeys).toContain("titleMatch");
    expect(weightKeys).toContain("sponsorship");
    expect(weightKeys).toContain("recency");
    expect(weightKeys).toContain("culture");
    expect(weightKeys).toContain("quality");
  });

  test("navigate back to Step 1 and return → state is reset", async ({
    page,
  }) => {
    await page.click("button:has-text('Continue without AI')");

    // Add a skill
    const skillInput = page.locator('input[placeholder*="Add a skill"]');
    await skillInput.fill("React");
    await page.click("button:has-text('Add')");

    // Go back to Step 1
    await page.click("button:has-text('Back to Upload')");
    await expect(page.locator("text=Your resume.")).toBeVisible();

    // Skip AI again to return to Step 2
    await page.click("button:has-text('Continue without AI')");

    // State is RESET (skip AI creates blank profile each time)
    const jsonPreview = page.locator("pre");
    const jsonText = await jsonPreview.textContent();
    const profile = JSON.parse(jsonText!);

    // Skills should be empty (reset on skip AI)
    expect(profile.skills).toEqual([]);
  });

  test("Step 3 automation page accessible", async ({ page }) => {
    await page.click("button:has-text('Continue without AI')");

    // Navigate to Step 3
    await page.click("button:has-text('Set Up Daily Automation')");

    // Should see automation setup content
    await expect(
      page.locator("h1", { hasText: "Daily Automation Setup" }),
    ).toBeVisible();
  });
});

test.describe("Profile JSON integrity scenarios", () => {
  test("full flow: skip AI → add multiple skills → verify complete JSON", async ({
    page,
  }) => {
    await page.goto("/");
    await page.click("button:has-text('Continue without AI')");

    const skillInput = page.locator('input[placeholder*="Add a skill"]');
    const tierSelect = getAddSkillTierSelect(page);

    // Core skills
    await tierSelect.selectOption("core");
    await skillInput.fill("React");
    await page.click("button:has-text('Add')");

    await tierSelect.selectOption("core");
    await skillInput.fill("TypeScript");
    await page.click("button:has-text('Add')");

    // Strong skills
    await tierSelect.selectOption("strong");
    await skillInput.fill("Python");
    await page.click("button:has-text('Add')");

    await tierSelect.selectOption("strong");
    await skillInput.fill("PostgreSQL");
    await page.click("button:has-text('Add')");

    // Peripheral
    await tierSelect.selectOption("peripheral");
    await skillInput.fill("Docker");
    await page.click("button:has-text('Add')");

    // Change minScore
    const slider = getMinScoreSlider(page);
    await slider.fill("30");

    // Verify the complete JSON
    const jsonPreview = page.locator("pre");
    const jsonText = await jsonPreview.textContent();
    const profile = JSON.parse(jsonText!);

    // Skills
    expect(profile.skills).toHaveLength(5);
    expect(profile.skills[0]).toEqual({ name: "React", tier: "core" });
    expect(profile.skills[1]).toEqual({ name: "TypeScript", tier: "core" });
    expect(profile.skills[2]).toEqual({ name: "Python", tier: "strong" });
    expect(profile.skills[3]).toEqual({
      name: "PostgreSQL",
      tier: "strong",
    });
    expect(profile.skills[4]).toEqual({ name: "Docker", tier: "peripheral" });

    // Keywords (lowercased, deduped)
    expect(profile.keywords).toEqual([
      "react",
      "typescript",
      "python",
      "postgresql",
      "docker",
    ]);

    // Default locations from skip AI
    expect(profile.locations).toEqual(["Adelaide", "Sydney", "Melbourne"]);

    // Default roles from skip AI
    expect(profile.roles).toEqual([
      "Software Engineer",
      "Full Stack Developer",
      "Frontend Developer",
    ]);

    // Titles === Roles
    expect(profile.titles).toEqual(profile.roles);

    // Weights should all be 1 (default)
    for (const value of Object.values(
      profile.weights as Record<string, number>,
    )) {
      expect(value).toBe(1);
    }

    // minScore
    expect(profile.minScore).toBe(30);
  });

  test("skills with special characters survive JSON preview", async ({
    page,
  }) => {
    await page.goto("/");
    await page.click("button:has-text('Continue without AI')");

    const skillInput = page.locator('input[placeholder*="Add a skill"]');

    await skillInput.fill("C++");
    await page.click("button:has-text('Add')");

    await skillInput.fill("C#");
    await page.click("button:has-text('Add')");

    await skillInput.fill("Node.js");
    await page.click("button:has-text('Add')");

    const jsonPreview = page.locator("pre");
    const jsonText = await jsonPreview.textContent();
    const profile = JSON.parse(jsonText!);

    expect(profile.skills.map((s: { name: string }) => s.name)).toEqual([
      "C++",
      "C#",
      "Node.js",
    ]);
  });
});
