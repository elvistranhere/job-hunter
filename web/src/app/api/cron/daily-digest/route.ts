import { type NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { env } from "~/env";
import { triggerWorker } from "~/server/lib/worker-client";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (env.CRON_SECRET && token !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 1. Expire overdue subscriptions
  await db.subscription.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  // 2. Find active subscriptions due for processing
  const dueSubscriptions = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
    },
    take: 50, // Process max 50 per cron run to avoid timeouts
  });

  let processed = 0;
  let failed = 0;

  for (const sub of dueSubscriptions) {
    try {
      // Create a run record
      const run = await db.subscriptionRun.create({
        data: {
          subscriptionId: sub.id,
          status: "queued",
        },
      });

      // Build profile from snapshot
      const skills = sub.skills as Array<{ name: string; tier: string }>;
      const titles = sub.titles as string[];
      const keywords = sub.keywords as string[];
      const locations = sub.locations as string[];
      const roles = sub.roles as string[];
      const scoringWeights = sub.scoringWeights as Record<string, number>;

      // Trigger the worker (same endpoint as one-off scrapes)
      await triggerWorker({
        submissionId: `sub_${sub.id}_${run.id}`, // Prefix to distinguish from one-off
        email: sub.email,
        profile: { skills, titles, keywords },
        preferences:
          locations.length > 0 || roles.length > 0
            ? {
                locations: locations.length > 0 ? locations : undefined,
                roles: roles.length > 0 ? roles : undefined,
              }
            : null,
        scoringWeights: scoringWeights as {
          companyTier: number;
          location: number;
          titleMatch: number;
          skills: number;
          sponsorship: number;
          recency: number;
          culture: number;
          quality: number;
        },
      });

      // Mark run as "running" — worker will update to "completed" via callback
      await db.subscriptionRun.update({
        where: { id: run.id },
        data: { status: "running" },
      });

      // Advance nextRunAt by 1 day
      const nextRun = new Date(sub.nextRunAt);
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);

      await db.subscription.update({
        where: { id: sub.id },
        data: {
          nextRunAt: nextRun,
          lastRunAt: now,
        },
      });

      processed++;
    } catch (error) {
      failed++;

      // Record the failure
      await db.subscriptionRun.updateMany({
        where: {
          subscriptionId: sub.id,
          status: "queued",
        },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      console.error(
        `[cron] Failed to process subscription ${sub.id}:`,
        error,
      );
    }
  }

  return NextResponse.json({
    processed,
    failed,
    expired: dueSubscriptions.length === 0 ? 0 : undefined,
    timestamp: now.toISOString(),
  });
}
