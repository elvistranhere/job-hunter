import { UploadForm } from "~/app/_components/upload-form";

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

export default function Home() {
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
            href="/dashboard"
            className="font-sans text-sm text-navy-400 hover:text-navy-200 transition-colors"
          >
            Dashboard
          </a>
          <a
            href="https://github.com/elvistran/job-hunter"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-sm text-navy-400 hover:text-navy-200 transition-colors"
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pt-12 pb-8 md:pt-20 md:pb-12 text-center">
        {/* Eyebrow */}
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
        <UploadForm />
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
            {/* Step 1 */}
            <div className="group relative rounded-2xl border border-navy-700/60 bg-navy-800/40 p-8 transition-all duration-300 hover:border-navy-600 hover:bg-navy-800/70">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-sans text-xs font-bold text-amber-500 tracking-widest">
                  01
                </span>
                <div className="h-px flex-1 bg-navy-700" />
              </div>
              <ScanIcon className="w-10 h-10 text-navy-300 mb-4 group-hover:text-amber-400 transition-colors duration-300" />
              <h3 className="font-serif text-xl text-white mb-2">Upload & Parse</h3>
              <p className="font-sans text-sm text-navy-400 leading-relaxed">
                Drop your resume PDF. AI extracts skills, experience, and
                job titles in ~10 seconds.
              </p>
            </div>

            {/* Step 2 */}
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

            {/* Step 3 */}
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

      {/* Footer */}
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
            Built with Next.js + FastAPI
          </p>
        </div>
      </footer>
    </main>
  );
}
