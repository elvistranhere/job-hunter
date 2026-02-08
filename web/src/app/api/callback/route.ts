import { type NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { env } from "~/env";

interface JobResultPayload {
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  site: string;
  score: number;
  tier?: string | null;
  seniority?: string | null;
  datePosted?: string | null;
  description?: string | null;
  salary?: string | null;
  workType?: string | null;
  workArrangement?: string | null;
  isRemote?: boolean;
}

export async function POST(request: NextRequest) {
  // Verify auth
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (env.WORKER_SECRET && token !== env.WORKER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    submissionId: string;
    status: string;
    jobCount?: number;
    error?: string;
    jobResults?: JobResultPayload[];
  };

  const { submissionId, status, error, jobResults } = body;

  if (!submissionId || !status) {
    return NextResponse.json(
      { error: "Missing submissionId or status" },
      { status: 400 },
    );
  }

  const dbStatus =
    status === "completed"
      ? "COMPLETE"
      : status === "failed"
        ? "FAILED"
        : "SCRAPING";

  // Store results + update status in a transaction (atomic — no partial state)
  await db.$transaction(async (tx) => {
    if (jobResults && jobResults.length > 0) {
      // Delete any existing results for this submission (in case of retry)
      await tx.jobResult.deleteMany({
        where: { submissionId },
      });

      // Insert all job results
      await tx.jobResult.createMany({
        data: jobResults.map((job) => ({
          submissionId,
          title: job.title,
          company: job.company,
          location: job.location,
          jobUrl: job.jobUrl,
          site: job.site,
          score: job.score,
          tier: job.tier ?? null,
          seniority: job.seniority ?? null,
          datePosted: job.datePosted ?? null,
          description: job.description ?? null,
          salary: job.salary ?? null,
          workType: job.workType ?? null,
          workArrangement: job.workArrangement ?? null,
          isRemote: job.isRemote ?? false,
        })),
      });
    }

    await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: dbStatus as "COMPLETE" | "FAILED" | "SCRAPING",
        error: error ?? null,
      },
    });
  });

  return NextResponse.json({ ok: true, jobsStored: jobResults?.length ?? 0 });
}
