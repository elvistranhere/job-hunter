"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

export default function ConfirmationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        {/* Success icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 mb-8">
          <svg
            className="w-10 h-10 text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="checkmark-draw"
            />
          </svg>
        </div>

        <h1 className="font-serif text-4xl text-white mb-4 md:text-5xl">
          We&apos;re on it!
        </h1>

        <p className="font-sans text-lg text-navy-300 mb-2 leading-relaxed">
          Your custom job search is running in the background.
        </p>

        <p className="font-sans text-base text-navy-400 mb-10 leading-relaxed">
          We&apos;re scraping 5 job boards across Australia and scoring every
          listing against your profile. Results will land in your inbox in about
          15 minutes. Feel free to close this page.
        </p>

        {/* Submission ID card */}
        <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-5 mb-8 inline-block">
          <p className="font-sans text-xs text-navy-500 mb-1 tracking-wide uppercase">
            Submission ID
          </p>
          <p className="font-mono text-sm text-navy-300">{id}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link
            href={`/status/${id}`}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 border border-navy-600 text-navy-200 font-sans font-medium text-sm hover:border-navy-400 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6v4l3 3" />
            </svg>
            Track progress
          </Link>

          <Link
            href="/dashboard"
            className="font-sans text-sm text-navy-500 hover:text-navy-300 transition-colors"
          >
            View dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
