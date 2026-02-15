import { NextResponse } from "next/server";
import { env } from "~/env";
import { parseResumePdf } from "~/server/lib/resume-parser";

export async function POST(req: Request) {
  try {
    if (!env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured. Add it to web/.env - get one at https://aistudio.google.com/apikey" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as { resumeBase64?: string };

    if (!body.resumeBase64 || typeof body.resumeBase64 !== "string") {
      return NextResponse.json(
        { error: "resumeBase64 is required" },
        { status: 400 },
      );
    }

    const pdfBuffer = Buffer.from(body.resumeBase64, "base64");
    const profile = await parseResumePdf(pdfBuffer);

    return NextResponse.json(profile);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
