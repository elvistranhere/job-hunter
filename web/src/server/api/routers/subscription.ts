import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
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

const defaultScoringWeights = {
  companyTier: 1,
  location: 1,
  titleMatch: 1,
  skills: 1,
  sponsorship: 1,
  recency: 1,
  culture: 1,
  quality: 1,
};

export const subscriptionRouter = createTRPCRouter({
  // Create a subscription from a completed submission
  create: publicProcedure
    .input(
      z.object({
        submissionId: z.string(),
        duration: z.number().refine((v) => [0, 7, 14, 30].includes(v), {
          message: "Duration must be 0 (indefinite), 7, 14, or 30 days",
        }),
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

      if (!submission.resumeProfile) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No profile data found for this submission.",
        });
      }

      // Persist any latest profile customization before snapshotting subscription.
      if (input.customSkills) {
        await ctx.db.resumeProfile.update({
          where: { submissionId: input.submissionId },
          data: {
            customSkills: JSON.parse(JSON.stringify(input.customSkills)),
          },
        });
      }

      if (input.scoringWeights || input.preferences) {
        await ctx.db.submission.update({
          where: { id: input.submissionId },
          data: {
            scoringWeights: input.scoringWeights
              ? JSON.parse(JSON.stringify(input.scoringWeights))
              : undefined,
            preferences: input.preferences
              ? JSON.parse(JSON.stringify(input.preferences))
              : undefined,
          },
        });
      }

      const skills =
        input.customSkills ??
        ((submission.resumeProfile.customSkills ??
          submission.resumeProfile.skills) as Array<{
          name: string;
          tier: string;
        }>);

      // Compute next run: tomorrow at 7am AEST (UTC+10 -> 21:00 UTC previous day)
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
      nextRun.setUTCHours(21, 0, 0, 0); // 7am AEST = 21:00 UTC

      // Compute expiry
      const expiresAt =
        input.duration > 0
          ? new Date(now.getTime() + input.duration * 24 * 60 * 60 * 1000)
          : null;

      const preferences = (input.preferences ??
        submission.preferences ??
        {}) as Record<string, unknown>;
      const scoringWeights = input.scoringWeights ??
        ((submission.scoringWeights as Record<string, number> | null) ??
          defaultScoringWeights);

      const sub = await ctx.db.subscription.create({
        data: {
          email: submission.email,
          submissionId: input.submissionId,
          skills: skills as object,
          titles: submission.resumeProfile.titles as object,
          keywords: submission.resumeProfile.keywords as object,
          locations: JSON.parse(
            JSON.stringify(
              (preferences.locations as string[]) ?? [],
            ),
          ),
          roles: JSON.parse(
            JSON.stringify(
              (preferences.roles as string[]) ?? [],
            ),
          ),
          scoringWeights: JSON.parse(JSON.stringify(scoringWeights)) as object,
          duration: input.duration,
          nextRunAt: nextRun,
          expiresAt,
        },
      });

      return { id: sub.id };
    }),

  // Get subscription by ID
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const sub = await ctx.db.subscription.findUnique({
        where: { id: input.id },
        include: {
          runs: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return sub;
    }),

  // List subscriptions by email
  listByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.subscription.findMany({
        where: { email: input.email },
        orderBy: { createdAt: "desc" },
        include: {
          runs: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
    }),

  // Update subscription status (pause/resume/cancel)
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        email: z.string().email(), // Simple auth: must match
        status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.subscription.findUnique({
        where: { id: input.id },
      });

      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (sub.email !== input.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Email does not match subscription.",
        });
      }

      await ctx.db.subscription.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      return { ok: true };
    }),
});
