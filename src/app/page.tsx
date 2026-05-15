export default function Page() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Analysis Hub</h1>
        <p className="text-muted-foreground">Paste a job posting below to begin your analysis.</p>
      </header>

      <section className="space-y-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <label htmlFor="job-input" className="sr-only">Job Posting Input</label>
          <textarea
            id="job-input"
            placeholder="Paste the job description here..."
            className="w-full min-h-[200px] rounded-md border bg-transparent p-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <button
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Analyze Job Posting
        </button>
      </section>
    </div>
  );
}
