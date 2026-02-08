"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";

export default function DashboardDetailPage() {
  const params = useParams<{ id: string }>();

  const { data: results, isLoading: resultsLoading } =
    api.submission.getResults.useQuery({ id: params.id });

  const { data: stats, isLoading: statsLoading } =
    api.submission.getStats.useQuery({ id: params.id });

  const isLoading = resultsLoading || statsLoading;

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin w-8 h-8 text-amber-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
          </svg>
          <p className="font-sans text-navy-400">Loading results...</p>
        </div>
      </main>
    );
  }

  if (!results || !stats) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-2xl text-white mb-2">Not found</h1>
          <p className="font-sans text-navy-400 mb-6">This submission could not be found.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl px-6 py-3 bg-amber-500 text-navy-950 font-sans font-semibold text-sm hover:bg-amber-400 transition-all">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const maxBucket = Math.max(...stats.distribution.map((d) => d.count), 1);

  return (
    <main className="min-h-screen">
      <nav className="sticky top-0 z-20 border-b border-navy-800 bg-navy-950/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/" className="font-serif text-lg text-white hover:text-amber-400 transition-colors">
              Job Hunter
            </Link>
            <span className="text-navy-600 mx-2">/</span>
            <Link href="/dashboard" className="font-sans text-sm text-navy-400 hover:text-navy-200 transition-colors">
              Dashboard
            </Link>
            <span className="text-navy-600 mx-2">/</span>
            <span className="font-sans text-sm text-navy-400">Results</span>
          </div>
          <span className="font-sans text-xs text-navy-500">{results.email}</span>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl text-white mb-2">
              Job <span className="text-amber-400">results</span>
            </h1>
            <p className="font-sans text-sm text-navy-400">
              {new Date(results.createdAt).toLocaleDateString("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <Link
            href={`/profile/${params.id}`}
            className="px-4 py-2 rounded-lg border border-navy-600 bg-navy-800/60 font-sans text-sm text-navy-300 hover:border-navy-400 hover:text-navy-100 transition-all"
          >
            Edit weights &amp; re-run
          </Link>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Jobs", value: stats.totalJobs.toString() },
            { label: "Top Score", value: stats.topScore.toFixed(0) },
            { label: "Avg Score", value: stats.avgScore.toFixed(0) },
            { label: "Score 50+", value: stats.above50.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-navy-700 bg-navy-800/40 p-4 text-center">
              <p className="font-sans text-2xl font-semibold text-white">{value}</p>
              <p className="font-sans text-xs text-navy-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Score distribution */}
        <section className="mb-8">
          <h2 className="font-serif text-lg text-white mb-4">Score Distribution</h2>
          <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-6">
            <div className="flex items-end gap-3 h-32">
              {stats.distribution.map((bucket) => (
                <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="font-sans text-xs text-navy-300">{bucket.count}</span>
                  <div
                    className="w-full rounded-t bg-amber-500/70 transition-all"
                    style={{
                      height: `${(bucket.count / maxBucket) * 100}%`,
                      minHeight: bucket.count > 0 ? "4px" : "0",
                    }}
                  />
                  <span className="font-sans text-[10px] text-navy-500">{bucket.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Location breakdown */}
        {stats.topLocations.length > 0 && (
          <section className="mb-8">
            <h2 className="font-serif text-lg text-white mb-4">Top Locations</h2>
            <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-6">
              <div className="space-y-3">
                {stats.topLocations.map(([location, count]) => {
                  const pct = (count / stats.totalJobs) * 100;
                  return (
                    <div key={location}>
                      <div className="flex justify-between mb-1">
                        <span className="font-sans text-sm text-navy-200">{location}</span>
                        <span className="font-sans text-xs text-navy-400">{count}</span>
                      </div>
                      <div className="w-full h-1.5 bg-navy-700 rounded-full">
                        <div
                          className="h-full bg-amber-500/60 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Job results table */}
        <section>
          <h2 className="font-serif text-lg text-white mb-4">
            All Jobs ({results.jobs.length})
          </h2>
          <div className="rounded-xl border border-navy-700 bg-navy-800/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy-700">
                    <th className="px-4 py-3 text-left font-sans text-xs font-medium text-navy-400 uppercase tracking-wide">Score</th>
                    <th className="px-4 py-3 text-left font-sans text-xs font-medium text-navy-400 uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left font-sans text-xs font-medium text-navy-400 uppercase tracking-wide">Company</th>
                    <th className="px-4 py-3 text-left font-sans text-xs font-medium text-navy-400 uppercase tracking-wide">Location</th>
                    <th className="px-4 py-3 text-left font-sans text-xs font-medium text-navy-400 uppercase tracking-wide">Site</th>
                  </tr>
                </thead>
                <tbody>
                  {results.jobs.map((job) => {
                    const scoreColor =
                      job.score >= 60
                        ? "text-emerald-400 bg-emerald-500/15"
                        : job.score >= 40
                          ? "text-amber-400 bg-amber-500/15"
                          : "text-navy-300 bg-navy-700/50";
                    return (
                      <tr key={job.id} className="border-b border-navy-800 hover:bg-navy-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded font-sans text-xs font-semibold ${scoreColor}`}>
                            {job.score.toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={job.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-sans text-sm text-white hover:text-amber-400 transition-colors"
                          >
                            {job.title}
                          </a>
                        </td>
                        <td className="px-4 py-3 font-sans text-sm text-navy-300">
                          {job.company}
                          {job.tier && (
                            <span className="ml-2 text-[10px] text-amber-500/70">
                              {job.tier}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-sans text-sm text-navy-400">{job.location}</td>
                        <td className="px-4 py-3 font-sans text-xs text-navy-500">{job.site}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
