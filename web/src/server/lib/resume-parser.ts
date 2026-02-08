import Anthropic from "@anthropic-ai/sdk";
import { extractText } from "unpdf";
import { env } from "~/env";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

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

  // Send to Claude for structured extraction
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are a resume parser. Extract structured data from this resume text. Return ONLY valid JSON, no markdown fences.

Resume text:
---
${rawText.slice(0, 8000)}
---

Return this exact JSON structure:
{
  "skills": [
    {"name": "React", "tier": "core"},
    {"name": "Python", "tier": "strong"},
    {"name": "Redis", "tier": "peripheral"}
  ],
  "titles": ["Software Engineer", "Frontend Developer"],
  "keywords": ["typescript", "react", "next.js", "docker", "aws"],
  "experience": {"years": 3, "level": "junior"},
  "suggestedLocations": ["Sydney", "Melbourne", "Remote"],
  "suggestedRoles": ["Full Stack Developer", "Software Engineer", "Frontend Developer"]
}

Rules for "tier":
- "core": Skills prominently featured, used across multiple roles/projects, or listed as primary expertise
- "strong": Skills used in at least one role or significant project
- "peripheral": Skills mentioned briefly, in education only, or as secondary tools

Rules for "experience.level":
- "intern": student/intern, 0 years
- "junior": 0-2 years, or recent graduate
- "mid": 2-5 years
- "senior": 5+ years

Rules for "suggestedLocations":
- Infer from work history addresses, university locations, or stated preferences
- Use short city names: "Adelaide", "Sydney", "Melbourne", "Brisbane", "Perth", "Canberra", "Gold Coast", "Hobart"
- If remote work is mentioned in any role, include "Remote"
- If unclear, default to ["Sydney", "Melbourne", "Remote"]
- Always return 2-4 locations

Rules for "suggestedRoles":
- Derive from job titles held and primary skill stack
- Use search-friendly terms like "Software Engineer", "Full Stack Developer", "Frontend Developer", "Backend Developer", "DevOps Engineer", "Data Engineer", "ML Engineer"
- Include the most specific match first, then broader terms
- Always return 2-4 roles

Extract ALL technical skills, programming languages, frameworks, tools, and platforms. Be thorough.`,
      },
    ],
  });

  const aiText =
    message.content[0]?.type === "text" ? message.content[0].text : "";

  // Parse the JSON response
  let parsed_data: {
    skills: ParsedSkill[];
    titles: string[];
    keywords: string[];
    experience: { years: number; level: string } | null;
    suggestedLocations: string[];
    suggestedRoles: string[];
  };

  try {
    // Strip markdown fences if present
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
