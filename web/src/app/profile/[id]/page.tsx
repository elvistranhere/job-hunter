"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";
import { SkillTierEditor } from "./_components/skill-tier-editor";
import { WeightSliders } from "./_components/weight-sliders";
import { PreferenceSelector } from "./_components/preference-selector";

type SkillTier = "core" | "strong" | "peripheral";

interface Skill {
  name: string;
  tier: string;
}

interface ScoringWeights {
  companyTier: number;
  location: number;
  titleMatch: number;
  skills: number;
  sponsorship: number;
  recency: number;
  culture: number;
  quality: number;
}

export default function ProfileEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const submissionId = params.id;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [weights, setWeights] = useState<ScoringWeights>({
    companyTier: 1,
    location: 1,
    titleMatch: 1,
    skills: 1,
    sponsorship: 1,
    recency: 1,
    culture: 1,
    quality: 1,
  });
  const [selectedLocations, setSelectedLocations] = useState<string[] | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);

  const { data: profileData, isLoading, isError } = api.submission.getProfile.useQuery(
    { submissionId },
  );

  // Initialize skills and AI suggestions from fetched profile
  useEffect(() => {
    if (profileData?.profile.skills) {
      setSkills(profileData.profile.skills);
    }
    if (profileData?.profile.suggestedLocations && selectedLocations === null) {
      setSelectedLocations(profileData.profile.suggestedLocations);
    }
    if (profileData?.profile.suggestedRoles && selectedRoles === null) {
      setSelectedRoles(profileData.profile.suggestedRoles);
    }
  }, [profileData, selectedLocations, selectedRoles]);

  const startScraping = api.submission.startScraping.useMutation({
    onSuccess: () => {
      router.push(`/confirmation/${submissionId}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const createSubscription = api.subscription.create.useMutation({
    onSuccess: (data) => {
      router.push(`/subscription/${data.id}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = () => {
    setError(null);
    const locs = selectedLocations ?? [];
    const roles = selectedRoles ?? [];
    startScraping.mutate({
      submissionId,
      customSkills: skills.map((s) => ({
        name: s.name,
        tier: s.tier as SkillTier,
      })),
      scoringWeights: weights,
      preferences:
        locs.length > 0 || roles.length > 0
          ? {
              locations: locs.length > 0 ? locs : undefined,
              roles: roles.length > 0 ? roles : undefined,
            }
          : undefined,
    });
  };

  const handleSubscribe = () => {
    setError(null);
    const locs = selectedLocations ?? [];
    const roles = selectedRoles ?? [];

    createSubscription.mutate({
      submissionId,
      duration: selectedDuration,
      customSkills: skills.map((s) => ({
        name: s.name,
        tier: s.tier as SkillTier,
      })),
      scoringWeights: weights,
      preferences:
        locs.length > 0 || roles.length > 0
          ? {
              locations: locs.length > 0 ? locs : undefined,
              roles: roles.length > 0 ? roles : undefined,
            }
          : undefined,
    });
  };

  const updateSkillTier = (skillName: string, newTier: SkillTier) => {
    setSkills((prev) =>
      prev.map((s) => (s.name === skillName ? { ...s, tier: newTier } : s)),
    );
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin w-8 h-8 text-amber-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray="31.4 31.4"
              strokeLinecap="round"
            />
          </svg>
          <p className="font-sans text-navy-400">Loading your profile...</p>
        </div>
      </main>
    );
  }

  if (isError || !profileData) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/15 border-2 border-rose-500/30 mb-4">
            <svg className="w-8 h-8 text-rose-400" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-white mb-2">Profile not found</h1>
          <p className="font-sans text-navy-400 mb-6">
            This submission may have expired or the resume hasn&apos;t finished parsing.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 bg-amber-500 text-navy-950 font-sans font-semibold text-sm hover:bg-amber-400 transition-all"
          >
            Try again
          </Link>
        </div>
      </main>
    );
  }

  const { profile } = profileData;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <nav className="sticky top-0 z-20 border-b border-navy-800 bg-navy-950/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/" className="font-serif text-lg text-white hover:text-amber-400 transition-colors">
              Job Hunter
            </Link>
            <span className="text-navy-600 mx-2">/</span>
            <span className="font-sans text-sm text-navy-400">Customize Scoring</span>
          </div>
          <span className="font-sans text-xs text-navy-500">
            {profileData.email}
          </span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Intro */}
        <div className="mb-10">
          <h1 className="font-serif text-3xl text-white mb-3 md:text-4xl">
            Your <span className="text-amber-400">profile</span> is ready
          </h1>
          <p className="font-sans text-base text-navy-300 max-w-2xl leading-relaxed">
            AI extracted your skills and experience. Review the tiers below, adjust scoring
            weights to match what matters to you, then hit &ldquo;Find My Jobs&rdquo; to start
            searching.
          </p>
        </div>

        {/* Profile Summary */}
        <section className="mb-10">
          <h2 className="font-serif text-xl text-white mb-4">Profile Summary</h2>
          <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-6">
            {profile.titles.length > 0 && (
              <div className="mb-5">
                <p className="font-sans text-xs font-medium text-navy-400 mb-2 tracking-wide uppercase">
                  Job Titles
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.titles.map((title) => (
                    <span
                      key={title}
                      className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-sans"
                    >
                      {title}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.experience && (
              <div>
                <p className="font-sans text-xs font-medium text-navy-400 mb-2 tracking-wide uppercase">
                  Experience
                </p>
                <p className="font-sans text-white">
                  {profile.experience.years} year{profile.experience.years !== 1 ? "s" : ""}{" "}
                  <span className="text-navy-400">·</span>{" "}
                  <span className="capitalize">{profile.experience.level}</span>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Skill Tier Editor */}
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="font-serif text-xl text-white mb-1">Skill Tiers</h2>
            <p className="font-sans text-sm text-navy-400">
              Change the dropdown on any skill to reclassify it. Core skills get the most
              weight when scoring jobs.
            </p>
          </div>
          <SkillTierEditor skills={skills} onUpdateTier={updateSkillTier} />
        </section>

        {/* Scoring Weight Sliders */}
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="font-serif text-xl text-white mb-1">Scoring Weights</h2>
            <p className="font-sans text-sm text-navy-400">
              Slide to adjust how much each factor matters. 1.0x is default, 0x disables it,
              2.0x doubles its importance.
            </p>
          </div>
          <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-6">
            <WeightSliders weights={weights} onWeightsChange={setWeights} />
          </div>
        </section>

        {/* Preferences */}
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="font-serif text-xl text-white mb-1">Preferences</h2>
            <p className="font-sans text-sm text-navy-400">
              AI-suggested from your resume. Toggle or add your own.
            </p>
          </div>
          <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-6">
            <PreferenceSelector
              selectedLocations={selectedLocations ?? []}
              selectedRoles={selectedRoles ?? []}
              suggestedLocations={profile.suggestedLocations ?? []}
              suggestedRoles={profile.suggestedRoles ?? []}
              onLocationsChange={setSelectedLocations}
              onRolesChange={setSelectedRoles}
            />
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <p className="font-sans text-sm text-rose-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={startScraping.isPending}
          className={`
            w-full rounded-xl px-8 py-4
            font-sans text-base font-semibold tracking-wide
            transition-all duration-300 ease-out
            ${
              startScraping.isPending
                ? "bg-navy-700 text-navy-400 cursor-not-allowed"
                : "bg-amber-500 text-navy-950 hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98]"
            }
          `}
        >
          {startScraping.isPending ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray="31.4 31.4"
                  strokeLinecap="round"
                />
              </svg>
              Starting job search...
            </span>
          ) : (
            "Find My Jobs"
          )}
        </button>

        <p className="mt-3 text-center font-sans text-sm text-navy-500">
          We&apos;ll scrape 5 job boards and email you ranked results in ~15 minutes.
        </p>

        {/* Subscribe to daily digests */}
        <div className="mt-10 pt-8 border-t border-navy-800">
          <div className="text-center mb-6">
            <p className="font-sans text-sm text-navy-400">
              &mdash; or get results delivered daily &mdash;
            </p>
          </div>

          <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-6">
            <h3 className="font-serif text-lg text-white mb-2">Daily Digest</h3>
            <p className="font-sans text-sm text-navy-400 mb-4">
              Subscribe to receive fresh job matches every morning. Same scoring,
              new listings daily.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { value: 7, label: "7 days" },
                { value: 14, label: "14 days" },
                { value: 30, label: "30 days" },
                { value: 0, label: "Indefinite" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedDuration(value)}
                  className={`
                    px-4 py-2 rounded-full font-sans text-sm font-medium
                    border transition-all duration-200
                    ${
                      selectedDuration === value
                        ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                        : "border-navy-600 bg-navy-800/60 text-navy-300 hover:border-navy-400 hover:text-navy-100"
                    }
                  `}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={handleSubscribe}
              disabled={createSubscription.isPending}
              className={`
                w-full rounded-xl px-6 py-3
                font-sans text-sm font-semibold tracking-wide
                transition-all duration-300 ease-out
                ${
                  createSubscription.isPending
                    ? "bg-navy-700 text-navy-400 cursor-not-allowed"
                    : "border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60 active:scale-[0.98]"
                }
              `}
            >
              {createSubscription.isPending
                ? "Setting up..."
                : `Subscribe for ${selectedDuration === 0 ? "daily digests" : `${selectedDuration} days`}`}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
