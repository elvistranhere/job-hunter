import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractText } from "unpdf";
import { env } from "~/env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY ?? "");

export interface ParsedSkill {
  name: string;
  tier: "core" | "strong" | "peripheral";
}

export interface ParsedProfile {
  rawText: string;
  skills: ParsedSkill[];
  titles: string[];
  keywords: string[];
  experience: { years: number; level: string } | null;
  suggestedLocations: string[];
  suggestedRoles: string[];
  aiResponse: string;
}

export interface ScoringWeights {
  skills: number;
  companyTier: number;
  location: number;
  titleMatch: number;
  sponsorship: number;
  recency: number;
  culture: number;
  quality: number;
}

const DEFAULT_LOCATIONS = ["Adelaide", "Sydney", "Melbourne"] as const;

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

type GeminiParsedResponse = {
  reasoning?: string;
  skills?: Array<{ name?: unknown; tier?: unknown }>;
  titles?: unknown;
  keywords?: unknown;
  experience?: { years: number; level: string } | null;
  suggestedLocations?: unknown;
  suggestedRoles?: unknown;
};

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is string => item.length > 0);
}

function normalizeTier(input: unknown): ParsedSkill["tier"] {
  if (input === "core" || input === "strong" || input === "peripheral") {
    return input;
  }
  return "peripheral";
}

export async function parseResumePdf(
  pdfBuffer: Buffer,
): Promise<ParsedProfile> {
  // Extract text from PDF using unpdf (serverless-compatible, no canvas needed)
  const result = await extractText(new Uint8Array(pdfBuffer));
  const rawText = Array.isArray(result.text)
    ? result.text.join("\n")
    : String(result.text);

  if (!rawText || rawText.trim().length < 50) {
    throw new Error(
      "Could not extract enough text from PDF. Please ensure your resume is text-based (not a scanned image).",
    );
  }

  // Gemini 2.5-flash-lite with intelligent reasoning config
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: `You are a senior technical recruiter and career analyst with deep knowledge of software engineering stacks. You don't just extract text - you REASON about a candidate's true skill profile.

When analyzing a resume:
- Infer implied skills: If someone builds React apps with TypeScript, they clearly know JavaScript, HTML, CSS, and likely npm/yarn - include these as strong/peripheral.
- Read between the lines: A ".NET + C# + SQL Server" stack implies understanding of Entity Framework, LINQ, and REST APIs even if not explicitly listed.
- Assess tier by IMPACT, not just frequency: A skill used to build the core product at a job is more important than one listed 3 times in a skills section.
- Think about what a hiring manager would search for when trying to find this candidate.`,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
  });

  const prompt = `Analyze this resume as a senior technical recruiter. Reason about the candidate's TRUE skill profile - not just what's written, but what's clearly implied by their experience.

Resume:
---
${rawText.slice(0, 8000)}
---

Return JSON matching this schema:
{
  "reasoning": "Brief analysis: who is this person, what's their core stack, what skills are implied but not listed",
  "skills": [{"name": "SkillName", "tier": "core|strong|peripheral"}],
  "titles": ["Professional Identity Title"],
  "keywords": ["keyword1", "keyword2"],
  "experience": {"years": N, "level": "intern|junior|mid|senior"},
  "suggestedLocations": ["City1", "City2"],
  "suggestedRoles": ["Role1", "Role2"]
}

SKILL INTELLIGENCE:
- Extract concrete technical skills: languages, frameworks, libraries, databases, cloud platforms, DevOps tools
- ALSO infer clearly implied skills (e.g., React developer → JavaScript, HTML, CSS; .NET developer → Entity Framework, REST APIs)
- Do NOT include: soft skills, methodologies, abstract concepts, job functions, or hardware/devices

TIER RULES (reason about each):
- "core" (3-5 MAX): The technologies CENTRAL to this person's professional identity - used prominently across multiple roles/projects. Ask: "What would a recruiter say this person specializes in?"
- "strong": Technologies with demonstrated hands-on use in at least one role or significant project, OR clearly implied by deep use of related tech.
- "peripheral": Technologies only listed without project evidence, used in coursework only, mentioned as secondary tools, or inferred but with minimal evidence.

TITLE: 1-2 titles that describe WHO this person IS (professional identity, not job history).
EXPERIENCE: Count cumulative professional work months (not education/projects). intern=only internships, junior=0-2yrs, mid=2-5yrs, senior=5+yrs.
LOCATIONS: Infer from university + work cities. AU names: Adelaide/Sydney/Melbourne/Brisbane/Perth/Canberra. Include "Remote" if any role was remote. Return 2-4.
ROLES: Search-friendly job titles a recruiter would use to find this person. Return 2-4.
KEYWORDS: 10-18 lowercase terms for job board searches. Include primary stack + implied technologies.`;

  let aiText = "";
  let parsedData: GeminiParsedResponse | null = null;

  for (let attempt = 0; attempt <= 2; attempt++) {
    const genResult = await model.generateContent(prompt);
    aiText = genResult.response.text();

    try {
      const jsonStr = aiText.replace(/```json\n?|\n?```/g, "").trim();
      parsedData = JSON.parse(jsonStr) as GeminiParsedResponse;
      break;
    } catch {
      if (attempt === 2) {
        throw new Error(
          "Failed to parse AI response as JSON after 3 attempts. Please try again.",
        );
      }
    }
  }

  const skills = (parsedData?.skills ?? [])
    .map((skill) => {
      const name = typeof skill.name === "string" ? skill.name.trim() : "";
      if (!name) {
        return null;
      }

      return {
        name,
        tier: normalizeTier(skill.tier),
      } satisfies ParsedSkill;
    })
    .filter((skill): skill is ParsedSkill => skill !== null);

  if (skills.length === 0) {
    throw new Error(
      "Resume parser returned no skills. Please upload a clearer, text-based resume and try again.",
    );
  }

  const titles = normalizeStringArray(parsedData?.titles);
  const keywords = normalizeStringArray(parsedData?.keywords);
  const suggestedLocations = normalizeStringArray(parsedData?.suggestedLocations);
  const suggestedRoles = normalizeStringArray(parsedData?.suggestedRoles);

  return {
    rawText,
    skills,
    titles,
    keywords,
    experience: parsedData?.experience ?? null,
    suggestedLocations:
      suggestedLocations.length > 0 ? suggestedLocations : [...DEFAULT_LOCATIONS],
    suggestedRoles: suggestedRoles.length > 0 ? suggestedRoles : titles,
    aiResponse: aiText,
  };
}

export function exportProfileJson(
  profile: ParsedProfile,
  weights?: ScoringWeights,
): string {
  const resolvedWeights: ScoringWeights = {
    ...DEFAULT_WEIGHTS,
    ...weights,
  };

  return JSON.stringify(
    {
      skills: profile.skills.map((skill) => ({
        name: skill.name,
        tier: normalizeTier(skill.tier),
      })),
      titles: profile.titles,
      keywords: profile.keywords,
      locations: profile.suggestedLocations,
      roles: profile.suggestedRoles,
      weights: resolvedWeights,
    },
    null,
    2,
  );
}
