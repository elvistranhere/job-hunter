"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [searchEmail, setSearchEmail] = useState("");

  const { data: submissions, isLoading } =
    api.submission.listByEmail.useQuery(
      { email: searchEmail },
      { enabled: !!searchEmail },
    );

  const { data: subscriptions } =
    api.subscription.listByEmail.useQuery(
      { email: searchEmail },
      { enabled: !!searchEmail },
    );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchEmail(email.trim());
  };

  return (
    <main className="min-h-screen">
      <nav className="sticky top-0 z-20 border-b border-navy-800 bg-navy-950/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/" className="font-serif text-lg text-white hover:text-amber-400 transition-colors">
              Job Hunter
            </Link>
            <span className="text-navy-600 mx-2">/</span>
            <span className="font-sans text-sm text-navy-400">Dashboard</span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="font-serif text-3xl text-white mb-3 md:text-4xl">
            Your <span className="text-amber-400">dashboard</span>
          </h1>
          <p className="font-sans text-base text-navy-300">
            Enter your email to view past submissions and active subscriptions.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 mb-10">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="flex-1 px-4 py-3 rounded-xl bg-navy-800/80 border border-navy-600 text-white placeholder-navy-500 font-sans focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-amber-500 text-navy-950 font-sans font-semibold text-sm hover:bg-amber-400 transition-all"
          >
            View
          </button>
        </form>

        {searchEmail && isLoading && (
          <div className="text-center py-10">
            <svg className="animate-spin w-8 h-8 text-amber-500 mx-auto mb-4" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            </svg>
            <p className="font-sans text-navy-400">Loading...</p>
          </div>
        )}

        {searchEmail && !isLoading && (
          <>
            {/* Subscriptions */}
            {subscriptions && subscriptions.length > 0 && (
              <section className="mb-10">
                <h2 className="font-serif text-xl text-white mb-4">Active Subscriptions</h2>
                <div className="space-y-3">
                  {subscriptions.map((sub) => {
                    const statusColor =
                      sub.status === "ACTIVE"
                        ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
                        : sub.status === "PAUSED"
                          ? "text-amber-400 bg-amber-500/15 border-amber-500/30"
                          : "text-navy-400 bg-navy-700/50 border-navy-600";
                    return (
                      <Link
                        key={sub.id}
                        href={`/subscription/${sub.id}`}
                        className="block rounded-xl border border-navy-700 bg-navy-800/40 p-4 hover:border-navy-500 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-sans font-medium border ${statusColor}`}>
                              {sub.status}
                            </span>
                            <span className="font-sans text-sm text-navy-300">
                              {sub.duration === 0 ? "Indefinite" : `${sub.duration} days`}
                            </span>
                          </div>
                          <span className="font-sans text-xs text-navy-500">
                            {sub.runs[0]
                              ? `Last run: ${new Date(sub.runs[0].createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
                              : "No runs yet"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Submissions */}
            <section>
              <h2 className="font-serif text-xl text-white mb-4">Past Submissions</h2>
              {submissions && submissions.length > 0 ? (
                <div className="space-y-3">
                  {submissions.map((sub) => {
                    const statusColor =
                      sub.status === "COMPLETE"
                        ? "text-emerald-400"
                        : sub.status === "FAILED"
                          ? "text-rose-400"
                          : "text-amber-400";
                    return (
                      <Link
                        key={sub.id}
                        href={`/dashboard/${sub.id}`}
                        className="block rounded-xl border border-navy-700 bg-navy-800/40 p-4 hover:border-navy-500 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-sans text-sm font-medium ${statusColor}`}>
                            {sub.status}
                          </span>
                          <span className="font-sans text-xs text-navy-500">
                            {new Date(sub.createdAt).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {sub.jobCount > 0 && (
                          <div className="flex gap-4 font-sans text-sm">
                            <span className="text-navy-300">
                              {sub.jobCount} jobs
                            </span>
                            <span className="text-navy-400">
                              Top: {sub.topScore.toFixed(0)}
                            </span>
                            <span className="text-navy-400">
                              Avg: {sub.avgScore.toFixed(0)}
                            </span>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-6 text-center">
                  <p className="font-sans text-navy-400">No submissions found for this email.</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
