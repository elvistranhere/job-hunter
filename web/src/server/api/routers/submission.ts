import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { parseResumePdf } from "~/server/lib/resume-parser";
import { triggerWorker } from "~/server/lib/worker-client";
import { TRPCError } from "@trpc/server";

const scoringWeightsSchema = z.object({
  companyTier: z.number().min(0).max(2).default(1),
  location: z.number().min(0).max(2).default(1),
  titleMatch: z.number().min(0).max(2).default(1),
  skills: z.number().min(0).max(2).default(1),
  sponsorship: z.number().min(0).max(2).default(1),
  recency: z.number().min(0).max(2).default(1),
  culture: z.number().min(0).max(2).default(1),
  quality: z.number().min(0).max(2).default(1),
});

const skillSchema = z.object({
  name: z.string(),
  tier: z.enum(["core", "strong", "peripheral"]),
});

export const submissionRouter = createTRPCRouter({
  // Phase 1: Upload PDF + parse resume (synchronous — waits ~10s for AI parsing)
  parseResume: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        resumeBase64: z.string().min(1),
        fileName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit: max 3 submissions per email per 24h
      const recentCount = await ctx.db.submission.count({
        where: {
          email: input.email,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      if (recentCount >= 3) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Maximum 3 submissions per email per 24 hours. Please try again later.",
        });
      }

      // Create submission
      const submission = await ctx.db.submission.create({
        data: {
          email: input.email,
          status: "PARSING",
        },
      });

      try {
        // Parse resume with AI (synchronous — ~10s)
        const pdfBuffer = Buffer.from(input.resumeBase64, "base64");
        const profile = await parseResumePdf(pdfBuffer);

        await ctx.db.resumeProfile.create({
          data: {
            submissionId: submission.id,
            rawText: profile.rawText,
            skills: JSON.parse(JSON.stringify(profile.skills)),
            titles: JSON.parse(JSON.stringify(profile.titles)),
            keywords: JSON.parse(JSON.stringify(profile.keywords)),
            experience: profile.experience
              ? JSON.parse(JSON.stringify(profile.experience))
              : undefined,
            suggestedLocations: profile.suggestedLocations.length > 0
              ? JSON.parse(JSON.stringify(profile.suggestedLocations))
              : undefined,
            suggestedRoles: profile.suggestedRoles.length > 0
              ? JSON.parse(JSON.stringify(profile.suggestedRoles))
              : undefined,
            aiResponse: profile.aiResponse,
          },
        });

        await ctx.db.submission.update({
          where: { id: submission.id },
          data: { status: "AWAITING_REVIEW" },
        });

        return { id: submission.id };
      } catch (error) {
        await ctx.db.submission.update({
          where: { id: submission.id },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to parse resume. Please try again.",
        });
      }
    }),

  // Phase 2: Get parsed profile for the scoring editor
  getProfile: publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.submission.findUnique({
        where: { id: input.submissionId },
        include: {
          resumeProfile: {
            select: {
              skills: true,
              customSkills: true,
              titles: true,
              keywords: true,
              experience: true,
              suggestedLocations: true,
              suggestedRoles: true,
            },
          },
        },
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (!submission.resumeProfile) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Resume has not been parsed yet.",
        });
      }

      return {
        id: submission.id,
        email: submission.email,
        status: submission.status,
        profile: {
          skills: (submission.resumeProfile.customSkills ??
            submission.resumeProfile.skills) as Array<{
            name: string;
            tier: string;
          }>,
          titles: submission.resumeProfile.titles as string[],
          keywords: submission.resumeProfile.keywords as string[],
          experience: submission.resumeProfile.experience as {
            years: number;
            level: string;
          } | null,
          suggestedLocations: (submission.resumeProfile.suggestedLocations ?? []) as string[],
          suggestedRoles: (submission.resumeProfile.suggestedRoles ?? []) as string[],
        },
      };
    }),

  // Phase 3: Start scraping with custom weights
  startScraping: publicProcedure
    .input(
      z.object({
        submissionId: z.string(),
        customSkills: z.array(skillSchema).optional(),
        scoringWeights: scoringWeightsSchema.optional(),
        preferences: z
          .object({
            locations: z.array(z.string()).optional(),
            roles: z.array(z.string()).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.submission.findUnique({
        where: { id: input.submissionId },
        include: { resumeProfile: true },
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (
        submission.status !== "AWAITING_REVIEW" &&
        submission.status !== "FAILED"
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot start scraping from status: ${submission.status}`,
        });
      }

      // Save custom skills if provided
      if (input.customSkills && submission.resumeProfile) {
        await ctx.db.resumeProfile.update({
          where: { submissionId: input.submissionId },
          data: {
            customSkills: JSON.parse(JSON.stringify(input.customSkills)),
          },
        });
      }

      // Save scoring weights and preferences, update status
      await ctx.db.submission.update({
        where: { id: input.submissionId },
        data: {
          status: "SCRAPING",
          error: null,
          scoringWeights: input.scoringWeights
            ? JSON.parse(JSON.stringify(input.scoringWeights))
            : undefined,
          preferences: input.preferences
            ? JSON.parse(JSON.stringify(input.preferences))
            : undefined,
        },
      });

      // Use custom skills if provided, otherwise original
      const skills = (input.customSkills ??
        (submission.resumeProfile?.skills as Array<{
          name: string;
          tier: string;
        }>) ??
        []) as Array<{ name: string; tier: string }>;

      // Trigger worker (fire-and-forget)
      void triggerWorker({
        submissionId: input.submissionId,
        email: submission.email,
        profile: {
          skills,
          titles:
            (submission.resumeProfile?.titles as string[] | undefined) ?? [],
          keywords:
            (submission.resumeProfile?.keywords as string[] | undefined) ?? [],
        },
        preferences: (input.preferences as Record<string, unknown>) ?? null,
        scoringWeights: input.scoringWeights ?? null,
      }).catch(async (error) => {
        console.error(`Worker trigger failed for ${input.submissionId}:`, error);
        await ctx.db.submission.update({
          where: { id: input.submissionId },
          data: {
            status: "FAILED",
            error:
              error instanceof Error ? error.message : "Worker trigger failed",
          },
        });
      });

      return { ok: true };
    }),

  // Cancel a running job
  cancelJob: publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.submission.findUnique({
        where: { id: input.submissionId },
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (
        submission.status === "COMPLETE" ||
        submission.status === "FAILED"
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Job is already finished.",
        });
      }

      await ctx.db.submission.update({
        where: { id: input.submissionId },
        data: {
          status: "FAILED",
          error: "Cancelled by user",
        },
      });

      return { ok: true };
    }),

  // Keep existing getStatus for backward compat + status page
  getStatus: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.submission.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          status: true,
          error: true,
          createdAt: true,
          jobResults: { select: { id: true }, take: 1 },
        },
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return {
        id: submission.id,
        status: submission.status,
        error: submission.error,
        createdAt: submission.createdAt,
        hasResults: submission.jobResults.length > 0,
      };
    }),

  getResults: publicProcedure
    .input(
      z.object({
        id: z.string(),
        limit: z.number().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.submission.findUnique({
        where: { id: input.id },
        include: {
          jobResults: {
            orderBy: { score: "desc" },
            take: input.limit,
          },
          resumeProfile: {
            select: { skills: true, titles: true },
          },
        },
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return {
        id: submission.id,
        email: submission.email,
        status: submission.status,
        jobs: submission.jobResults,
        profile: submission.resumeProfile,
        createdAt: submission.createdAt,
      };
    }),

  // List all submissions for an email (dashboard)
  listByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const submissions = await ctx.db.submission.findMany({
        where: { email: input.email },
        orderBy: { createdAt: "desc" },
        include: {
          jobResults: {
            select: { score: true },
            orderBy: { score: "desc" },
          },
        },
      });

      return submissions.map((s) => ({
        id: s.id,
        status: s.status,
        createdAt: s.createdAt,
        jobCount: s.jobResults.length,
        topScore: s.jobResults[0]?.score ?? 0,
        avgScore:
          s.jobResults.length > 0
            ? s.jobResults.reduce((sum, j) => sum + j.score, 0) /
              s.jobResults.length
            : 0,
      }));
    }),

  // Get aggregated stats for a submission (dashboard detail)
  getStats: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.submission.findUnique({
        where: { id: input.id },
        include: {
          jobResults: {
            orderBy: { score: "desc" },
          },
        },
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const jobs = submission.jobResults;
      const scores = jobs.map((j) => j.score);

      // Score distribution buckets: 0-19, 20-39, 40-59, 60-79, 80+
      const buckets = [
        { label: "0–19", min: 0, max: 19, count: 0 },
        { label: "20–39", min: 20, max: 39, count: 0 },
        { label: "40–59", min: 40, max: 59, count: 0 },
        { label: "60–79", min: 60, max: 79, count: 0 },
        { label: "80+", min: 80, max: Infinity, count: 0 },
      ];

      for (const score of scores) {
        for (const bucket of buckets) {
          if (score >= bucket.min && score <= bucket.max) {
            bucket.count++;
            break;
          }
        }
      }

      // Tier breakdown
      const tierCounts: Record<string, number> = {};
      for (const job of jobs) {
        const tier = job.tier ?? "Unknown";
        tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
      }

      // Location breakdown (top 5)
      const locationCounts: Record<string, number> = {};
      for (const job of jobs) {
        const loc = job.location ?? "Unknown";
        locationCounts[loc] = (locationCounts[loc] ?? 0) + 1;
      }
      const topLocations = Object.entries(locationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      return {
        totalJobs: jobs.length,
        topScore: scores[0] ?? 0,
        avgScore:
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0,
        above50: scores.filter((s) => s >= 50).length,
        distribution: buckets.map((b) => ({
          label: b.label,
          count: b.count,
        })),
        tierBreakdown: tierCounts,
        topLocations,
      };
    }),
});
