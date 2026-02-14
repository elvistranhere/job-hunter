"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { PreferenceSelector } from "~/app/_components/preference-selector";
import { SkillTierEditor } from "~/app/_components/skill-tier-editor";
import { UploadForm } from "~/app/_components/upload-form";
import { WeightSliders } from "~/app/_components/weight-sliders";

type WizardStep = 1 | 2 | 3 | 4;
type SkillTier = "core" | "strong" | "peripheral";
type ProgressStatus = "pending" | "in-progress" | "complete";
type DeployTask =
  | "forking"
  | "committing"
  | "setting-secrets"
  | "enabling-workflow"
  | "triggering-run";

interface Skill {
  name: string;
  tier: SkillTier;
}

interface ParsedProfile {
  rawText: string;
  skills: Skill[];
  titles: string[];
  keywords: string[];
  experience: { years: number; level: string } | null;
  suggestedLocations: string[];
  suggestedRoles: string[];
  aiResponse: string;
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

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

interface GithubSetupSuccess {
  success: true;
  repoUrl: string;
  actionsUrl: string;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  companyTier: 1,
  location: 1,
  titleMatch: 1,
  skills: 1,
  sponsorship: 1,
  recency: 1,
  culture: 1,
  quality: 1,
};

const DEPLOY_TASK_ORDER: DeployTask[] = [
  "forking",
  "committing",
  "setting-secrets",
  "enabling-workflow",
  "triggering-run",
];

const DEPLOY_TASK_LABELS: Record<DeployTask, string> = {
  forking: "Forking repository",
  committing: "Committing profile.json",
  "setting-secrets": "Setting repository secrets",
  "enabling-workflow": "Enabling workflow",
  "triggering-run": "Triggering first run",
};

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="4"
        y="4"
        width="32"
        height="32"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 16h16M12 22h10M12 28h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4 20h32"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M15 14c0-2 3-4 5-4s5 2 5 4-1 3-3 4-4 2-4 4v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="28" r="1.5" fill="#f59e0b" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="4"
        y="8"
        width="32"
        height="24"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 11l16 10 16-10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="12" r="5" fill="#f59e0b" stroke="#060a14" strokeWidth="2" />
      <path d="M28.5 12l1 1 2-2" stroke="#060a14" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressDot({ status }: { status: ProgressStatus }) {
  if (status === "complete") {
    return <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />;
  }

  if (status === "in-progress") {
    return <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />;
  }

  return <span className="h-2.5 w-2.5 rounded-full bg-navy-600" />;
}

function StepIndicator({ step }: { step: WizardStep }) {
  const items: { id: WizardStep; label: string }[] = [
    { id: 1, label: "Upload" },
    { id: 2, label: "Edit" },
    { id: 3, label: "Export" },
    { id: 4, label: "Automate" },
  ];

  return (
    <div className="relative z-10 border-b border-navy-800 bg-navy-900/60">
      <div className="mx-auto flex max-w-4xl items-center gap-2 overflow-x-auto px-6 py-4">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                step === item.id
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : step > item.id
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "bg-navy-800 text-navy-400 border border-navy-700"
              }`}
            >
              {item.label}
            </span>
            {idx < items.length - 1 && <span className="text-navy-600">&rarr;</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function createPendingDeployState(): Record<DeployTask, ProgressStatus> {
  return {
    forking: "pending",
    committing: "pending",
    "setting-secrets": "pending",
    "enabling-workflow": "pending",
    "triggering-run": "pending",
  };
}

export default function Home() {
  const [step, setStep] = useState<WizardStep>(1);
  const [profile, setProfile] = useState<ParsedProfile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState<number>(5);
  const [isRequestingDeviceCode, setIsRequestingDeviceCode] = useState(false);
  const [isPollingToken, setIsPollingToken] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [gmailUser, setGmailUser] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [emailTo, setEmailTo] = useState("");

  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<GithubSetupSuccess | null>(null);
  const [deployTaskStatus, setDeployTaskStatus] = useState<Record<DeployTask, ProgressStatus>>(
    createPendingDeployState(),
  );

  const tokenPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deployProgressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tokenPollTimer.current) {
        clearTimeout(tokenPollTimer.current);
      }
      if (deployProgressTimer.current) {
        clearInterval(deployProgressTimer.current);
      }
    };
  }, []);

  const exportedProfile = useMemo(() => {
    if (!profile) {
      return null;
    }

    return {
      skills: skills.map((skill) => ({ name: skill.name, tier: skill.tier })),
      titles: profile.titles,
      keywords: profile.keywords,
      locations: selectedLocations,
      roles: selectedRoles,
      weights,
    };
  }, [profile, selectedLocations, selectedRoles, skills, weights]);

  const profileJson = useMemo(() => {
    if (!exportedProfile) {
      return "";
    }

    return JSON.stringify(exportedProfile, null, 2);
  }, [exportedProfile]);

  const handleParsed = (parsedProfile: ParsedProfile) => {
    setProfile(parsedProfile);
    setSkills(parsedProfile.skills);
    setWeights(DEFAULT_WEIGHTS);
    setSelectedLocations(parsedProfile.suggestedLocations ?? []);
    setSelectedRoles(parsedProfile.suggestedRoles ?? []);

    setStep(2);
    setCopyState("idle");

    setDeviceCode(null);
    setGithubToken(null);
    setPollingIntervalSeconds(5);
    setIsRequestingDeviceCode(false);
    setIsPollingToken(false);
    setConnectError(null);

    setGmailUser("");
    setGmailAppPassword("");
    setEmailTo("");

    setIsDeploying(false);
    setDeployError(null);
    setDeployResult(null);
    setDeployTaskStatus(createPendingDeployState());
  };

  const updateSkillTier = (skillName: string, newTier: SkillTier) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.name === skillName ? { ...skill, tier: newTier } : skill,
      ),
    );
  };

  useEffect(() => {
    if (!isPollingToken || !deviceCode || githubToken) {
      return;
    }

    let isCancelled = false;

    const pollToken = async () => {
      try {
        const res = await fetch("/api/github/poll-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_code: deviceCode.device_code }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message =
            typeof data.error === "string"
              ? data.error
              : "Failed to poll GitHub token.";
          setConnectError(message);
          setIsPollingToken(false);
          return;
        }

        if (typeof data.access_token === "string") {
          setGithubToken(data.access_token);
          setConnectError(null);
          setIsPollingToken(false);
          return;
        }

        if (typeof data.error === "string") {
          if (
            data.error === "authorization_pending" ||
            data.error === "slow_down"
          ) {
            const nextInterval =
              typeof data.interval === "number"
                ? data.interval
                : pollingIntervalSeconds;
            setPollingIntervalSeconds(nextInterval);

            if (!isCancelled) {
              tokenPollTimer.current = setTimeout(
                pollToken,
                nextInterval * 1000,
              );
            }

            return;
          }

          setConnectError(data.error);
          setIsPollingToken(false);
          return;
        }

        setConnectError("Unexpected response while polling GitHub token.");
        setIsPollingToken(false);
      } catch (error) {
        setConnectError(
          error instanceof Error
            ? error.message
            : "Failed to connect to GitHub.",
        );
        setIsPollingToken(false);
      }
    };

    tokenPollTimer.current = setTimeout(
      pollToken,
      pollingIntervalSeconds * 1000,
    );

    return () => {
      isCancelled = true;
      if (tokenPollTimer.current) {
        clearTimeout(tokenPollTimer.current);
      }
    };
  }, [deviceCode, githubToken, isPollingToken, pollingIntervalSeconds]);

  const requestDeviceCode = async () => {
    setConnectError(null);
    setIsRequestingDeviceCode(true);

    try {
      const res = await fetch("/api/github/device-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to start GitHub device flow.");
      }

      setDeviceCode(data as DeviceCodeResponse);
      setPollingIntervalSeconds(
        typeof data.interval === "number" ? data.interval : 5,
      );
      setIsPollingToken(true);
    } catch (error) {
      setConnectError(
        error instanceof Error
          ? error.message
          : "Failed to start GitHub device flow.",
      );
    } finally {
      setIsRequestingDeviceCode(false);
    }
  };

  const downloadProfileJson = () => {
    if (!profileJson) {
      return;
    }

    const blob = new Blob([profileJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "profile.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyProfileJson = async () => {
    try {
      await navigator.clipboard.writeText(profileJson);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
    }
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipients = emailTo
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const emailConfigValid =
    emailRegex.test(gmailUser.trim()) &&
    gmailAppPassword.trim().length > 0 &&
    recipients.length > 0 &&
    recipients.every((recipient) => emailRegex.test(recipient));

  const connectStatus: ProgressStatus = githubToken
    ? "complete"
    : isRequestingDeviceCode || isPollingToken || !!deviceCode
      ? "in-progress"
      : "pending";

  const configureStatus: ProgressStatus = emailConfigValid
    ? "complete"
    : gmailUser || gmailAppPassword || emailTo
      ? "in-progress"
      : "pending";

  const deployStatus: ProgressStatus = deployResult
    ? "complete"
    : isDeploying
      ? "in-progress"
      : "pending";

  const handleDeploy = async () => {
    if (!githubToken || !profileJson || !emailConfigValid) {
      return;
    }

    setDeployError(null);
    setDeployResult(null);
    setIsDeploying(true);

    if (deployProgressTimer.current) {
      clearInterval(deployProgressTimer.current);
    }

    setDeployTaskStatus(createPendingDeployState());

    let currentIndex = 0;

    const applyTaskState = (activeIdx: number) => {
      setDeployTaskStatus(() => {
        const next = createPendingDeployState();

        DEPLOY_TASK_ORDER.forEach((task, idx) => {
          if (idx < activeIdx) {
            next[task] = "complete";
          } else if (idx === activeIdx) {
            next[task] = "in-progress";
          }
        });

        if (activeIdx >= DEPLOY_TASK_ORDER.length) {
          DEPLOY_TASK_ORDER.forEach((task) => {
            next[task] = "complete";
          });
        }

        return next;
      });
    };

    applyTaskState(currentIndex);

    deployProgressTimer.current = setInterval(() => {
      currentIndex += 1;
      if (currentIndex < DEPLOY_TASK_ORDER.length) {
        applyTaskState(currentIndex);
      }
    }, 1200);

    try {
      const res = await fetch("/api/github/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: githubToken,
          profileJson,
          gmailUser: gmailUser.trim(),
          gmailAppPassword: gmailAppPassword.trim(),
          emailTo: emailTo.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        throw new Error(data.error || "GitHub setup failed.");
      }

      applyTaskState(DEPLOY_TASK_ORDER.length);
      setDeployResult(data as GithubSetupSuccess);
    } catch (error) {
      setDeployError(
        error instanceof Error ? error.message : "GitHub setup failed.",
      );
    } finally {
      if (deployProgressTimer.current) {
        clearInterval(deployProgressTimer.current);
      }
      setIsDeploying(false);
    }
  };

  return (
    <main className="relative min-h-screen">
      {/* Top bar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12 lg:px-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-navy-950" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-serif text-xl text-white">Job Hunter</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/elvistranhere/job-hunter"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-sm text-navy-400 hover:text-navy-200 transition-colors"
          >
            GitHub
          </a>
        </div>
      </nav>

      {step > 1 && <StepIndicator step={step} />}

      {step === 1 && (
        <>
          {/* Hero */}
          <section className="relative z-10 mx-auto max-w-3xl px-6 pt-12 pb-8 md:pt-20 md:pb-12 text-center">
            <p className="font-sans text-xs font-semibold tracking-[0.2em] uppercase text-amber-500 mb-6">
              5 job boards. 3 cities. One email.
            </p>

            <h1 className="font-serif text-5xl leading-[1.1] tracking-tight text-white md:text-7xl">
              Your resume.
              <br />
              <span className="text-amber-400">Every Australian</span>
              <br />
              job board.
            </h1>

            <p className="mt-6 font-sans text-lg text-navy-300 max-w-lg mx-auto leading-relaxed md:text-xl">
              Upload your PDF and AI will parse your skills instantly. Customize
              your scoring priorities, then we scrape 5 job boards and email you
              ranked results.
            </p>
          </section>

          {/* Upload form section */}
          <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20">
            <UploadForm onParsed={handleParsed} />
          </section>

          {/* How it works */}
          <section className="relative z-10 border-t border-navy-800 bg-navy-900/50">
            <div className="mx-auto max-w-4xl px-6 py-20 md:py-28">
              <h2 className="font-serif text-3xl text-white text-center mb-4 md:text-4xl">
                How it works
              </h2>
              <p className="font-sans text-navy-400 text-center mb-16 text-base">
                Three steps. Zero effort.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 stagger-children">
                <div className="group relative rounded-2xl border border-navy-700/60 bg-navy-800/40 p-8 transition-all duration-300 hover:border-navy-600 hover:bg-navy-800/70">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-sans text-xs font-bold text-amber-500 tracking-widest">
                      01
                    </span>
                    <div className="h-px flex-1 bg-navy-700" />
                  </div>
                  <ScanIcon className="w-10 h-10 text-navy-300 mb-4 group-hover:text-amber-400 transition-colors duration-300" />
                  <h3 className="font-serif text-xl text-white mb-2">Upload &amp; Parse</h3>
                  <p className="font-sans text-sm text-navy-400 leading-relaxed">
                    Drop your resume PDF. AI extracts skills, experience, and
                    job titles in ~10 seconds.
                  </p>
                </div>

                <div className="group relative rounded-2xl border border-navy-700/60 bg-navy-800/40 p-8 transition-all duration-300 hover:border-navy-600 hover:bg-navy-800/70">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-sans text-xs font-bold text-amber-500 tracking-widest">
                      02
                    </span>
                    <div className="h-px flex-1 bg-navy-700" />
                  </div>
                  <BrainIcon className="w-10 h-10 text-navy-300 mb-4 group-hover:text-amber-400 transition-colors duration-300" />
                  <h3 className="font-serif text-xl text-white mb-2">
                    Customize
                  </h3>
                  <p className="font-sans text-sm text-navy-400 leading-relaxed">
                    Review your parsed profile, adjust skill tiers and scoring
                    weights to match what matters to you.
                  </p>
                </div>

                <div className="group relative rounded-2xl border border-navy-700/60 bg-navy-800/40 p-8 transition-all duration-300 hover:border-navy-600 hover:bg-navy-800/70">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-sans text-xs font-bold text-amber-500 tracking-widest">
                      03
                    </span>
                    <div className="h-px flex-1 bg-navy-700" />
                  </div>
                  <MailIcon className="w-10 h-10 text-navy-300 mb-4 group-hover:text-amber-400 transition-colors duration-300" />
                  <h3 className="font-serif text-xl text-white mb-2">
                    Get results
                  </h3>
                  <p className="font-sans text-sm text-navy-400 leading-relaxed">
                    We scrape 5 job boards, score every listing with your custom
                    weights, and email ranked results in ~15 min.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {step > 1 && !profile && (
        <section className="relative z-10 mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-2xl border border-navy-700 bg-navy-800/40 p-8 text-center">
            <h2 className="font-serif text-2xl text-white mb-2">No profile loaded</h2>
            <p className="font-sans text-navy-400 mb-6">
              Upload your resume first to continue through the wizard.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl bg-amber-500 px-6 py-3 font-sans text-sm font-semibold text-navy-950 hover:bg-amber-400 transition-colors"
            >
              Back to Upload
            </button>
          </div>
        </section>
      )}

      {step === 2 && profile && (
        <section className="relative z-10 mx-auto max-w-4xl px-6 py-10">
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
                    <span className="text-navy-400">&middot;</span>{" "}
                    <span className="capitalize">{profile.experience.level}</span>
                  </p>
                </div>
              )}
            </div>
          </section>

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

          <section className="mb-10">
            <div className="mb-4">
              <h2 className="font-serif text-xl text-white mb-1">Preferences</h2>
              <p className="font-sans text-sm text-navy-400">
                AI-suggested from your resume. Toggle or add your own.
              </p>
            </div>
            <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-6">
              <PreferenceSelector
                selectedLocations={selectedLocations}
                selectedRoles={selectedRoles}
                suggestedLocations={profile.suggestedLocations ?? []}
                suggestedRoles={profile.suggestedRoles ?? []}
                onLocationsChange={setSelectedLocations}
                onRolesChange={setSelectedRoles}
              />
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-navy-600 bg-navy-800/60 px-6 py-3 font-sans text-sm font-semibold text-navy-200 hover:border-navy-500 transition-colors"
            >
              Back to Upload
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-xl bg-amber-500 px-6 py-3 font-sans text-sm font-semibold text-navy-950 hover:bg-amber-400 transition-colors"
            >
              Continue to Export
            </button>
          </div>
        </section>
      )}

      {step === 3 && profile && (
        <section className="relative z-10 mx-auto max-w-4xl px-6 py-10">
          <div className="mb-8">
            <h1 className="font-serif text-3xl text-white mb-2 md:text-4xl">
              Export your <span className="text-amber-400">profile.json</span>
            </h1>
            <p className="font-sans text-navy-300 max-w-2xl">
              This file drives the scraper. It includes your skill tiers, location and role
              preferences, and scoring weights.
            </p>
          </div>

          <div className="rounded-2xl border border-navy-700 bg-navy-800/40 p-6 mb-6">
            <p className="font-sans text-xs uppercase tracking-wide text-navy-400 mb-3">
              profile.json preview
            </p>
            <pre className="max-h-[520px] overflow-auto rounded-xl border border-navy-700 bg-navy-950/70 p-4 text-xs text-navy-100 font-mono leading-relaxed">
              {profileJson}
            </pre>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={downloadProfileJson}
              className="rounded-xl bg-amber-500 px-6 py-3 font-sans text-sm font-semibold text-navy-950 hover:bg-amber-400 transition-colors"
            >
              Download profile.json
            </button>
            <button
              type="button"
              onClick={copyProfileJson}
              className="rounded-xl border border-navy-600 bg-navy-800/60 px-6 py-3 font-sans text-sm font-semibold text-navy-200 hover:border-navy-500 transition-colors"
            >
              {copyState === "copied" ? "Copied" : "Copy to clipboard"}
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl border border-navy-600 bg-navy-800/60 px-6 py-3 font-sans text-sm font-semibold text-navy-200 hover:border-navy-500 transition-colors"
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-6 py-3 font-sans text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              Set Up Daily Automation
            </button>
          </div>

          {copyState === "error" && (
            <p className="mt-3 font-sans text-sm text-rose-400">
              Could not copy to clipboard. Please copy manually from the preview.
            </p>
          )}
        </section>
      )}

      {step === 4 && profile && (
        <section className="relative z-10 mx-auto max-w-4xl px-6 py-10">
          <div className="mb-8">
            <h1 className="font-serif text-3xl text-white mb-2 md:text-4xl">
              GitHub <span className="text-amber-400">Automation Setup</span>
            </h1>
            <p className="font-sans text-navy-300 max-w-2xl">
              Connect GitHub with Device Flow OAuth, configure email delivery,
              then deploy a daily workflow that runs with your profile.
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-navy-700 bg-navy-800/40 p-5">
            <p className="mb-4 font-sans text-xs uppercase tracking-wide text-navy-400">
              Setup Progress
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: "Connect GitHub", status: connectStatus },
                { label: "Configure Email", status: configureStatus },
                { label: "Deploy Automation", status: deployStatus },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg border border-navy-700 bg-navy-900/50 px-4 py-3"
                >
                  <ProgressDot status={item.status} />
                  <span className="font-sans text-sm text-navy-100">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-navy-700 bg-navy-800/40 p-6">
              <div className="mb-4 flex items-center gap-3">
                <ProgressDot status={connectStatus} />
                <h2 className="font-serif text-2xl text-white">1. Connect GitHub</h2>
              </div>

              {!githubToken && (
                <button
                  type="button"
                  onClick={requestDeviceCode}
                  disabled={isRequestingDeviceCode || isPollingToken}
                  className={`rounded-xl px-5 py-3 font-sans text-sm font-semibold transition-colors ${
                    isRequestingDeviceCode || isPollingToken
                      ? "bg-navy-700 text-navy-400 cursor-not-allowed"
                      : "bg-amber-500 text-navy-950 hover:bg-amber-400"
                  }`}
                >
                  {isRequestingDeviceCode
                    ? "Requesting Device Code..."
                    : isPollingToken
                      ? "Waiting for Authorization..."
                      : "Connect GitHub"}
                </button>
              )}

              {deviceCode && !githubToken && (
                <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="font-sans text-xs uppercase tracking-wide text-amber-300 mb-2">
                    Enter this code on GitHub
                  </p>
                  <p className="font-mono text-2xl font-bold text-white tracking-[0.25em] mb-3">
                    {deviceCode.user_code}
                  </p>
                  <a
                    href={deviceCode.verification_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-sans text-sm text-amber-300 underline underline-offset-4 hover:text-amber-200"
                  >
                    Open GitHub verification page
                  </a>
                  <p className="mt-3 font-sans text-xs text-navy-300">
                    Polling every {pollingIntervalSeconds}s until authorization completes.
                  </p>
                </div>
              )}

              {githubToken && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="font-sans text-sm text-emerald-300">
                    GitHub connected successfully.
                  </p>
                </div>
              )}

              {connectError && (
                <p className="mt-3 font-sans text-sm text-rose-400">{connectError}</p>
              )}
            </div>

            <div className="rounded-2xl border border-navy-700 bg-navy-800/40 p-6">
              <div className="mb-4 flex items-center gap-3">
                <ProgressDot status={configureStatus} />
                <h2 className="font-serif text-2xl text-white">2. Configure Email</h2>
              </div>

              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-2 block font-sans text-sm text-navy-300">Gmail Address</span>
                  <input
                    type="email"
                    value={gmailUser}
                    onChange={(event) => setGmailUser(event.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full rounded-xl border border-navy-600 bg-navy-900/70 px-4 py-3 font-sans text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-amber-500/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block font-sans text-sm text-navy-300">Gmail App Password</span>
                  <input
                    type="password"
                    value={gmailAppPassword}
                    onChange={(event) => setGmailAppPassword(event.target.value)}
                    placeholder="16-character app password"
                    className="w-full rounded-xl border border-navy-600 bg-navy-900/70 px-4 py-3 font-sans text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-amber-500/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block font-sans text-sm text-navy-300">
                    Recipient Emails (comma-separated)
                  </span>
                  <input
                    type="text"
                    value={emailTo}
                    onChange={(event) => setEmailTo(event.target.value)}
                    placeholder="you@gmail.com, team@company.com"
                    className="w-full rounded-xl border border-navy-600 bg-navy-900/70 px-4 py-3 font-sans text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-amber-500/60"
                  />
                </label>
              </div>

              <p className="mt-4 font-sans text-xs text-navy-400">
                Need an app password?{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-300 underline underline-offset-4 hover:text-amber-200"
                >
                  Generate one in Google Account settings
                </a>
                .
              </p>
            </div>

            <div className="rounded-2xl border border-navy-700 bg-navy-800/40 p-6">
              <div className="mb-4 flex items-center gap-3">
                <ProgressDot status={deployStatus} />
                <h2 className="font-serif text-2xl text-white">3. Deploy</h2>
              </div>

              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying || !githubToken || !emailConfigValid || !profileJson}
                className={`rounded-xl px-5 py-3 font-sans text-sm font-semibold transition-colors ${
                  isDeploying || !githubToken || !emailConfigValid || !profileJson
                    ? "bg-navy-700 text-navy-400 cursor-not-allowed"
                    : "bg-amber-500 text-navy-950 hover:bg-amber-400"
                }`}
              >
                {isDeploying ? "Deploying Automation..." : "Deploy Automation"}
              </button>

              <div className="mt-5 space-y-2">
                {DEPLOY_TASK_ORDER.map((task) => (
                  <div
                    key={task}
                    className="flex items-center gap-3 rounded-lg border border-navy-700 bg-navy-900/50 px-4 py-2.5"
                  >
                    <ProgressDot status={deployTaskStatus[task]} />
                    <span className="font-sans text-sm text-navy-200">
                      {DEPLOY_TASK_LABELS[task]}
                    </span>
                  </div>
                ))}
              </div>

              {deployError && (
                <p className="mt-4 font-sans text-sm text-rose-400">{deployError}</p>
              )}

              {deployResult?.success && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="mb-3 font-sans text-sm text-emerald-300">
                    Automation deployed successfully.
                  </p>
                  <div className="flex flex-col gap-2 font-sans text-sm">
                    <a
                      href={deployResult.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300 underline underline-offset-4 hover:text-amber-200"
                    >
                      Open forked repository
                    </a>
                    <a
                      href={deployResult.actionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300 underline underline-offset-4 hover:text-amber-200"
                    >
                      Open GitHub Actions
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-xl border border-navy-600 bg-navy-800/60 px-6 py-3 font-sans text-sm font-semibold text-navy-200 hover:border-navy-500 transition-colors"
            >
              Back to Export
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-6 py-3 font-sans text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              Start Over
            </button>
          </div>
        </section>
      )}

      <footer className="relative z-10 border-t border-navy-800">
        <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg text-white">Job Hunter</span>
            <span className="text-navy-600">|</span>
            <span className="font-sans text-xs text-navy-500">
              Open source
            </span>
          </div>
          <p className="font-sans text-xs text-navy-500">
            Built with Next.js + Python
          </p>
        </div>
      </footer>
    </main>
  );
}
