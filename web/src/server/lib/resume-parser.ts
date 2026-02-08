import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractText } from "unpdf";
import { env } from "~/env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY ?? "");

interface ParsedSkill {
  name: string;
  tier: "core" | "strong" | "peripheral";
}

interface ParsedProfile {
  rawText: string;
  skills: ParsedSkill[];
  titles: string[];
  keywords: string[];
  experience: { years: number; level: string } | null;
  suggestedLocations: string[];
  suggestedRoles: string[];
  aiResponse: string;
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
    systemInstruction: `You are a senior technical recruiter and career analyst with deep knowledge of software engineering stacks. You don't just extract text — you REASON about a candidate's true skill profile.

When analyzing a resume:
- Infer implied skills: If someone builds React apps with TypeScript, they clearly know JavaScript, HTML, CSS, and likely npm/yarn — include these as strong/peripheral.
- Read between the lines: A ".NET + C# + SQL Server" stack implies understanding of Entity Framework, LINQ, and REST APIs even if not explicitly listed.
- Assess tier by IMPACT, not just frequency: A skill used to build the core product at a job is more important than one listed 3 times in a skills section.
- Think about what a hiring manager would search for when trying to find this candidate.`,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
  });

  const prompt = `Analyze this resume as a senior technical recruiter. Reason about the candidate's TRUE skill profile — not just what's written, but what's clearly implied by their experience.

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
- "core" (3-5 MAX): The technologies CENTRAL to this person's professional identity — used prominently across multiple roles/projects. Ask: "What would a recruiter say this person specializes in?"
- "strong": Technologies with demonstrated hands-on use in at least one role or significant project, OR clearly implied by deep use of related tech.
- "peripheral": Technologies only listed without project evidence, used in coursework only, mentioned as secondary tools, or inferred but with minimal evidence.

TITLE: 1-2 titles that describe WHO this person IS (professional identity, not job history).
EXPERIENCE: Count cumulative professional work months (not education/projects). intern=only internships, junior=0-2yrs, mid=2-5yrs, senior=5+yrs.
LOCATIONS: Infer from university + work cities. AU names: Adelaide/Sydney/Melbourne/Brisbane/Perth/Canberra. Include "Remote" if any role was remote. Return 2-4.
ROLES: Search-friendly job titles a recruiter would use to find this person. Return 2-4.
KEYWORDS: 10-18 lowercase terms for job board searches. Include primary stack + implied technologies.`;

  const genResult = await model.generateContent(prompt);
  const aiText = genResult.response.text();

  // Parse the JSON response (responseMimeType ensures valid JSON, but be safe)
  let parsed_data: {
    reasoning?: string;
    skills: ParsedSkill[];
    titles: string[];
    keywords: string[];
    experience: { years: number; level: string } | null;
    suggestedLocations: string[];
    suggestedRoles: string[];
  };

  try {
    const jsonStr = aiText.replace(/```json\n?|\n?```/g, "").trim();
    parsed_data = JSON.parse(jsonStr) as typeof parsed_data;
  } catch {
    throw new Error("Failed to parse AI response. Please try again.");
  }

  return {
    rawText,
    skills: parsed_data.skills ?? [],
    titles: parsed_data.titles ?? [],
    keywords: parsed_data.keywords ?? [],
    experience: parsed_data.experience ?? null,
    suggestedLocations: parsed_data.suggestedLocations ?? [],
    suggestedRoles: parsed_data.suggestedRoles ?? [],
    aiResponse: aiText,
  };
}
