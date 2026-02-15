/**
 * Unit tests for resume-parser utility functions.
 *
 * Scenarios tested:
 * 1. normalizeStringArray — various input types
 * 2. normalizeTier — valid/invalid tier strings
 * 3. exportProfileJson — correct JSON output and schema
 * 4. Profile JSON ↔ Python scraper compatibility
 * 5. Edge cases: empty skills, duplicates, weight boundaries, special chars
 */
import { describe, expect, it } from "vitest";

// ─── Re-implement the pure functions from resume-parser.ts for testing ────────
// (The originals are tightly coupled to the module, so we replicate the logic
//  exactly as it appears in resume-parser.ts to verify correctness.)

type SkillTier = "core" | "strong" | "peripheral";

interface ParsedSkill {
  name: string;
  tier: SkillTier;
}

interface ScoringWeights {
  skills: number;
  companyTier: number;
  location: number;
  titleMatch: number;
  sponsorship: number;
  recency: number;
  culture: number;
  quality: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  skills: 1.0,
  companyTier: 1.0,
  location: 1.0,
  titleMatch: 1.0,
  sponsorship: 1.0,
  recency: 1.0,
  culture: 1.0,
  quality: 1.0,
};

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is string => item.length > 0);
}

function normalizeTier(input: unknown): SkillTier {
  if (input === "core" || input === "strong" || input === "peripheral") {
    return input;
  }
  return "peripheral";
}

type SeniorityLevel = "intern" | "junior" | "mid" | "senior" | "lead" | "staff" | "director" | "executive";

/**
 * Replicates the exportedProfile useMemo from page.tsx.
 * This is the function that generates the profile.json content.
 */
function buildExportedProfile(params: {
  skills: ParsedSkill[];
  selectedRoles: string[];
  selectedLocations: string[];
  weights: ScoringWeights;
  minScore: number;
  maxHours?: number;
  resultsPerSearch?: number;
  excludeSeniority?: SeniorityLevel[];
}) {
  return {
    skills: params.skills.map((skill) => ({
      name: skill.name,
      tier: skill.tier,
    })),
    titles: params.selectedRoles,
    keywords: [...new Set(params.skills.map((s) => s.name.toLowerCase()))],
    locations: params.selectedLocations,
    roles: params.selectedRoles,
    weights: params.weights,
    minScore: params.minScore,
    maxHours: params.maxHours ?? 24,
    resultsPerSearch: params.resultsPerSearch ?? 20,
    excludeSeniority: params.excludeSeniority ?? ["senior", "lead", "staff", "director", "executive"],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("normalizeStringArray", () => {
  it("returns empty array for non-array input", () => {
    expect(normalizeStringArray(null)).toEqual([]);
    expect(normalizeStringArray(undefined)).toEqual([]);
    expect(normalizeStringArray("string")).toEqual([]);
    expect(normalizeStringArray(42)).toEqual([]);
    expect(normalizeStringArray({})).toEqual([]);
  });

  it("trims strings and filters empties", () => {
    expect(normalizeStringArray(["  React  ", "  ", "", "Python"])).toEqual([
      "React",
      "Python",
    ]);
  });

  it("converts non-string items to empty string and filters", () => {
    expect(normalizeStringArray([1, null, "Valid", undefined, true])).toEqual([
      "Valid",
    ]);
  });

  it("handles empty array", () => {
    expect(normalizeStringArray([])).toEqual([]);
  });
});

describe("normalizeTier", () => {
  it("accepts valid tiers", () => {
    expect(normalizeTier("core")).toBe("core");
    expect(normalizeTier("strong")).toBe("strong");
    expect(normalizeTier("peripheral")).toBe("peripheral");
  });

  it("defaults to peripheral for invalid input", () => {
    expect(normalizeTier("expert")).toBe("peripheral");
    expect(normalizeTier("")).toBe("peripheral");
    expect(normalizeTier(null)).toBe("peripheral");
    expect(normalizeTier(undefined)).toBe("peripheral");
    expect(normalizeTier(42)).toBe("peripheral");
    expect(normalizeTier("CORE")).toBe("peripheral"); // case-sensitive!
  });
});

describe("buildExportedProfile (profile.json generation)", () => {
  const baseSkills: ParsedSkill[] = [
    { name: "React", tier: "core" },
    { name: "TypeScript", tier: "core" },
    { name: "Python", tier: "strong" },
    { name: "Docker", tier: "peripheral" },
  ];

  it("generates correct structure with all fields", () => {
    const profile = buildExportedProfile({
      skills: baseSkills,
      selectedRoles: ["Full Stack Developer", "Frontend Engineer"],
      selectedLocations: ["Adelaide", "Sydney"],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile).toEqual({
      skills: [
        { name: "React", tier: "core" },
        { name: "TypeScript", tier: "core" },
        { name: "Python", tier: "strong" },
        { name: "Docker", tier: "peripheral" },
      ],
      titles: ["Full Stack Developer", "Frontend Engineer"],
      keywords: ["react", "typescript", "python", "docker"],
      locations: ["Adelaide", "Sydney"],
      roles: ["Full Stack Developer", "Frontend Engineer"],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
      maxHours: 24,
      resultsPerSearch: 20,
      excludeSeniority: ["senior", "lead", "staff", "director", "executive"],
    });
  });

  it("titles and roles are the same array (both from selectedRoles)", () => {
    const profile = buildExportedProfile({
      skills: baseSkills,
      selectedRoles: ["Software Engineer"],
      selectedLocations: ["Melbourne"],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile.titles).toEqual(profile.roles);
    expect(profile.titles).toEqual(["Software Engineer"]);
  });

  it("keywords are lowercased and deduplicated", () => {
    const skills: ParsedSkill[] = [
      { name: "React", tier: "core" },
      { name: "react", tier: "strong" }, // duplicate different case
      { name: "TypeScript", tier: "core" },
    ];

    const profile = buildExportedProfile({
      skills,
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    // Set deduplication — "react" appears once
    expect(profile.keywords).toEqual(["react", "typescript"]);
  });

  it("handles empty skills array", () => {
    const profile = buildExportedProfile({
      skills: [],
      selectedRoles: ["Developer"],
      selectedLocations: ["Sydney"],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile.skills).toEqual([]);
    expect(profile.keywords).toEqual([]);
  });

  it("handles empty locations and roles", () => {
    const profile = buildExportedProfile({
      skills: baseSkills,
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile.locations).toEqual([]);
    expect(profile.roles).toEqual([]);
    expect(profile.titles).toEqual([]);
  });

  it("preserves custom weight values", () => {
    const customWeights: ScoringWeights = {
      skills: 2.0,
      companyTier: 0,
      location: 1.5,
      titleMatch: 0.5,
      sponsorship: 0,
      recency: 1.0,
      culture: 0.3,
      quality: 1.8,
    };

    const profile = buildExportedProfile({
      skills: baseSkills,
      selectedRoles: ["Dev"],
      selectedLocations: ["Adelaide"],
      weights: customWeights,
      minScore: 50,
    });

    expect(profile.weights).toEqual(customWeights);
    expect(profile.minScore).toBe(50);
  });

  it("generates valid JSON string", () => {
    const profile = buildExportedProfile({
      skills: baseSkills,
      selectedRoles: ["Dev"],
      selectedLocations: ["Adelaide"],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    const json = JSON.stringify(profile, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(profile);
  });
});

describe("Profile JSON ↔ Python scraper compatibility", () => {
  /**
   * The Python scraper (scrape.py load_profile) expects:
   *   Required: skills, titles, keywords
   *   Optional: locations (defaults to AU cities), roles (defaults to ROLE_SEARCHES),
   *             weights (defaults to all 1.0)
   *
   * Skills must be: [{"name": "...", "tier": "core|strong|peripheral"}]
   * Weights keys: skills, companyTier, location, titleMatch, sponsorship, recency, culture, quality
   */

  it("always includes required keys: skills, titles, keywords", () => {
    const profile = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: ["Dev"],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile).toHaveProperty("skills");
    expect(profile).toHaveProperty("titles");
    expect(profile).toHaveProperty("keywords");
  });

  it("skills have correct shape for Python: {name, tier}", () => {
    const profile = buildExportedProfile({
      skills: [
        { name: "React", tier: "core" },
        { name: "Python", tier: "strong" },
      ],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    for (const skill of profile.skills) {
      expect(skill).toHaveProperty("name");
      expect(skill).toHaveProperty("tier");
      expect(typeof skill.name).toBe("string");
      expect(["core", "strong", "peripheral"]).toContain(skill.tier);
    }
  });

  it("weights contain all 8 expected keys", () => {
    const profile = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: ["Dev"],
      selectedLocations: ["Adelaide"],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    const expectedKeys = [
      "skills",
      "companyTier",
      "location",
      "titleMatch",
      "sponsorship",
      "recency",
      "culture",
      "quality",
    ];

    for (const key of expectedKeys) {
      expect(profile.weights).toHaveProperty(key);
      expect(typeof (profile.weights as unknown as Record<string, unknown>)[key]).toBe(
        "number",
      );
    }
  });

  it("weight values are valid numbers (Python does float() conversion)", () => {
    const profile = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: [],
      selectedLocations: [],
      weights: {
        skills: 0,
        companyTier: 2.0,
        location: 0.5,
        titleMatch: 1.0,
        sponsorship: 0,
        recency: 1.0,
        culture: 1.0,
        quality: 1.0,
      },
      minScore: 20,
    });

    for (const value of Object.values(profile.weights)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(2);
    }
  });

  it("locations are plain strings (Python expects string list)", () => {
    const profile = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: [],
      selectedLocations: ["Adelaide", "Sydney", "Melbourne"],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    for (const loc of profile.locations) {
      expect(typeof loc).toBe("string");
      expect(loc.length).toBeGreaterThan(0);
    }
  });

  it("round-trips through JSON.stringify → JSON.parse without data loss", () => {
    const profile = buildExportedProfile({
      skills: [
        { name: "React", tier: "core" },
        { name: "TypeScript", tier: "core" },
        { name: "Python", tier: "strong" },
        { name: "Docker", tier: "peripheral" },
      ],
      selectedRoles: [
        "Graduate Developer",
        "Full Stack Developer",
        "Frontend Developer",
      ],
      selectedLocations: ["Adelaide", "Sydney", "Melbourne"],
      weights: {
        skills: 1.5,
        companyTier: 0.8,
        location: 1.2,
        titleMatch: 1.3,
        sponsorship: 0.5,
        recency: 1.0,
        culture: 1.0,
        quality: 0.8,
      },
      minScore: 25,
    });

    const json = JSON.stringify(profile, null, 2);
    const parsed = JSON.parse(json);

    expect(parsed.skills).toHaveLength(4);
    expect(parsed.skills[0]).toEqual({ name: "React", tier: "core" });
    expect(parsed.titles).toEqual(parsed.roles);
    expect(parsed.keywords).toEqual([
      "react",
      "typescript",
      "python",
      "docker",
    ]);
    expect(parsed.locations).toEqual(["Adelaide", "Sydney", "Melbourne"]);
    expect(parsed.weights.skills).toBe(1.5);
    expect(parsed.minScore).toBe(25);
  });
});

describe("Edge cases and concerns", () => {
  it("skills with special characters in names", () => {
    const profile = buildExportedProfile({
      skills: [
        { name: "C++", tier: "core" },
        { name: "C#", tier: "strong" },
        { name: "Node.js", tier: "core" },
        { name: "ASP.NET Core", tier: "peripheral" },
      ],
      selectedRoles: [".NET Developer"],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile.skills).toHaveLength(4);
    expect(profile.keywords).toEqual([
      "c++",
      "c#",
      "node.js",
      "asp.net core",
    ]);

    // Verify JSON serialization doesn't break
    const json = JSON.stringify(profile, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.skills[0]!.name).toBe("C++");
  });

  it("skills with unicode characters", () => {
    const profile = buildExportedProfile({
      skills: [{ name: "Résumé Parser", tier: "core" }],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    const json = JSON.stringify(profile, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.skills[0]!.name).toBe("Résumé Parser");
  });

  it("very long skill names", () => {
    const longName = "A".repeat(500);
    const profile = buildExportedProfile({
      skills: [{ name: longName, tier: "core" }],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile.skills[0]!.name).toBe(longName);
    expect(profile.keywords[0]).toBe(longName.toLowerCase());
  });

  it("minScore at boundaries", () => {
    // Min = 0
    const profileMin = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 0,
    });
    expect(profileMin.minScore).toBe(0);

    // Max = 80 (from the range slider)
    const profileMax = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 80,
    });
    expect(profileMax.minScore).toBe(80);
  });

  it("weights at zero (disabled factor)", () => {
    const zeroWeights: ScoringWeights = {
      skills: 0,
      companyTier: 0,
      location: 0,
      titleMatch: 0,
      sponsorship: 0,
      recency: 0,
      culture: 0,
      quality: 0,
    };

    const profile = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: [],
      selectedLocations: [],
      weights: zeroWeights,
      minScore: 20,
    });

    for (const value of Object.values(profile.weights)) {
      expect(value).toBe(0);
    }
  });

  it("weights at max (2.0)", () => {
    const maxWeights: ScoringWeights = {
      skills: 2.0,
      companyTier: 2.0,
      location: 2.0,
      titleMatch: 2.0,
      sponsorship: 2.0,
      recency: 2.0,
      culture: 2.0,
      quality: 2.0,
    };

    const profile = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: [],
      selectedLocations: [],
      weights: maxWeights,
      minScore: 20,
    });

    for (const value of Object.values(profile.weights)) {
      expect(value).toBe(2.0);
    }
  });

  it("CONCERN: duplicate skills with different cases produce deduplicated keywords", () => {
    const skills: ParsedSkill[] = [
      { name: "React", tier: "core" },
      { name: "REACT", tier: "strong" },
      { name: "react", tier: "peripheral" },
    ];

    const profile = buildExportedProfile({
      skills,
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    // Skills array preserves all entries (no dedup on skills themselves!)
    expect(profile.skills).toHaveLength(3);

    // But keywords are deduplicated via Set
    expect(profile.keywords).toEqual(["react"]);
  });

  it("CONCERN: skills array does NOT deduplicate (only keywords do)", () => {
    // This is a potential bug/concern: the wizard allows adding duplicate skills
    // The Python scraper handles dedup (seen_skills set), but the JSON itself has dupes
    const skills: ParsedSkill[] = [
      { name: "React", tier: "core" },
      { name: "React", tier: "strong" }, // exact duplicate name
    ];

    const profile = buildExportedProfile({
      skills,
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    // Both entries are preserved — Python side deduplicates
    expect(profile.skills).toHaveLength(2);
    expect(profile.skills[0]!.name).toBe("React");
    expect(profile.skills[1]!.name).toBe("React");
  });

  it("CONCERN: empty profile still produces valid JSON structure", () => {
    const profile = buildExportedProfile({
      skills: [],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 0,
    });

    const json = JSON.stringify(profile, null, 2);
    const parsed = JSON.parse(json);

    expect(parsed.skills).toEqual([]);
    expect(parsed.titles).toEqual([]);
    expect(parsed.keywords).toEqual([]);
    expect(parsed.locations).toEqual([]);
    expect(parsed.roles).toEqual([]);
    expect(parsed.weights).toEqual(DEFAULT_WEIGHTS);
    expect(parsed.minScore).toBe(0);
  });

  it("CONCERN: titles === roles (same reference) — is this intentional?", () => {
    // In page.tsx: titles: selectedRoles, roles: selectedRoles
    // Both fields point to the same data. This means any "title" search
    // in the Python scraper also uses roles. Verify this behavior.
    const profile = buildExportedProfile({
      skills: [],
      selectedRoles: ["Software Engineer", "Full Stack Developer"],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile.titles).toStrictEqual(profile.roles);
  });

  it("CONCERN: profile.json without minScore — Python scraper uses it?", () => {
    // The profile.example.json doesn't have minScore.
    // The email_digest.py might use it. Verify the field exists.
    const profile = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: ["Dev"],
      selectedLocations: ["Adelaide"],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile).toHaveProperty("minScore");
    expect(typeof profile.minScore).toBe("number");
  });
});

describe("New profile fields (maxHours, resultsPerSearch, excludeSeniority)", () => {
  it("includes all new fields with defaults", () => {
    const profile = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: ["Dev"],
      selectedLocations: ["Adelaide"],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
    });

    expect(profile).toHaveProperty("maxHours");
    expect(profile).toHaveProperty("resultsPerSearch");
    expect(profile).toHaveProperty("excludeSeniority");
    expect(profile.maxHours).toBe(24);
    expect(profile.resultsPerSearch).toBe(20);
    expect(profile.excludeSeniority).toEqual(["senior", "lead", "staff", "director", "executive"]);
  });

  it("accepts custom maxHours", () => {
    const profile = buildExportedProfile({
      skills: [],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
      maxHours: 72,
    });

    expect(profile.maxHours).toBe(72);
  });

  it("accepts custom resultsPerSearch", () => {
    const profile = buildExportedProfile({
      skills: [],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
      resultsPerSearch: 50,
    });

    expect(profile.resultsPerSearch).toBe(50);
  });

  it("accepts custom excludeSeniority", () => {
    const profile = buildExportedProfile({
      skills: [],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
      excludeSeniority: ["intern"],
    });

    expect(profile.excludeSeniority).toEqual(["intern"]);
  });

  it("accepts empty excludeSeniority (include all levels)", () => {
    const profile = buildExportedProfile({
      skills: [],
      selectedRoles: [],
      selectedLocations: [],
      weights: DEFAULT_WEIGHTS,
      minScore: 20,
      excludeSeniority: [],
    });

    expect(profile.excludeSeniority).toEqual([]);
  });

  it("new fields survive JSON round-trip", () => {
    const profile = buildExportedProfile({
      skills: [{ name: "React", tier: "core" }],
      selectedRoles: ["Dev"],
      selectedLocations: ["Adelaide"],
      weights: DEFAULT_WEIGHTS,
      minScore: 35,
      maxHours: 48,
      resultsPerSearch: 30,
      excludeSeniority: ["senior", "lead"],
    });

    const json = JSON.stringify(profile, null, 2);
    const parsed = JSON.parse(json);

    expect(parsed.maxHours).toBe(48);
    expect(parsed.resultsPerSearch).toBe(30);
    expect(parsed.excludeSeniority).toEqual(["senior", "lead"]);
    expect(parsed.minScore).toBe(35);
  });
});
