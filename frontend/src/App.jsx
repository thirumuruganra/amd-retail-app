import { useState } from 'react'

function App() {
  const [reviewText, setReviewText] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

  const sentimentPalette = {
    Positive: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    Neutral: 'bg-stone-200 text-stone-900 border-stone-300',
    Negative: 'bg-rose-100 text-rose-900 border-rose-300',
  }

  const onSubmit = async (event) => {
    event.preventDefault()

    const trimmed = reviewText.trim()
    if (!trimmed) {
      setErrorMessage('Paste a customer review before running analysis.')
      setAnalysis(null)
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ review_text: trimmed }),
      })

      if (!response.ok) {
        let reason = 'Analysis failed. Please retry.'
        try {
          const payload = await response.json()
          reason = payload?.detail || reason
        } catch {
          // Keep fallback error string when JSON parsing fails.
        }

        throw new Error(reason)
      }

      const result = await response.json()
      setAnalysis(result)
    } catch (error) {
      setAnalysis(null)
      setErrorMessage(error instanceof Error ? error.message : 'Unexpected error.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onReset = () => {
    setReviewText('')
    setAnalysis(null)
    setErrorMessage('')
  }

  const confidenceScore = analysis
    ? `${Math.round(Number(analysis.confidence_score || 0) * 100)}%`
    : '--'

  const sentimentTone = analysis
    ? sentimentPalette[analysis.sentiment] || sentimentPalette.Neutral
    : sentimentPalette.Neutral

  const hasReview = reviewText.trim().length > 0

  return (
    <main className="relative min-h-dvh overflow-hidden bg-canvas px-4 py-8 text-ink sm:px-8 sm:py-10">
      <div className="pointer-events-none absolute -left-24 top-10 size-52 rounded-xl border border-ink-200 bg-paper-100/40"></div>
      <div className="pointer-events-none absolute -right-20 bottom-12 size-64 rounded-2xl border border-ink-200 bg-terracotta-100/35"></div>

      <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-ink-200 bg-paper-100/95 p-4 shadow-sm sm:p-8">
        <header className="reveal-up border-b border-ink-200 pb-5 sm:pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-500">
            Smart Review Vibe Checker
          </p>
          <h1 className="mt-3 max-w-3xl text-balance font-display text-4xl leading-tight text-ink sm:text-5xl">
            Read customer feedback in seconds, and answer in their language.
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm text-ink-600 sm:text-base">
            Paste a review to detect sentiment, classify the issue, route ownership,
            and generate a ready-to-send reply draft.
          </p>
        </header>

        <div className="mt-6 grid gap-4 sm:mt-8 lg:grid-cols-[1.2fr_1fr]">
          <form
            className="reveal-up delay-1 rounded-2xl border border-ink-200 bg-paper-200 p-4 sm:p-6"
            onSubmit={onSubmit}
          >
            <label
              htmlFor="review"
              className="mb-3 block text-sm font-semibold text-ink-700"
            >
              Customer Review
            </label>
            <textarea
              id="review"
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Example: El pedido llego tarde y la caja vino rota, pero el soporte fue muy amable..."
              rows={12}
              className="w-full resize-y rounded-xl border border-ink-300 bg-white px-3 py-3 text-sm text-ink shadow-inner outline-none ring-0 placeholder:text-ink-400 focus:border-ink-500 sm:text-base"
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !hasReview}
                className="inline-flex items-center rounded-lg border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-ink-300 disabled:bg-ink-300"
              >
                {isSubmitting ? 'Analyzing...' : 'Analyze Review'}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center rounded-lg border border-ink-300 bg-paper-100 px-5 py-2.5 text-sm font-semibold text-ink"
              >
                Reset
              </button>
            </div>

            {errorMessage && (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {errorMessage}
              </p>
            )}
          </form>

          <aside className="reveal-up delay-2 rounded-2xl border border-ink-200 bg-paper-200 p-4 sm:p-6">
            <h2 className="text-base font-semibold text-ink sm:text-lg">
              AI Summary Panel
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-ink-200 bg-paper-100 p-3">
                <p className="text-ink-500">Confidence</p>
                <p className="mt-1 font-semibold tabular-nums text-ink">{confidenceScore}</p>
              </div>
              <div className="rounded-xl border border-ink-200 bg-paper-100 p-3">
                <p className="text-ink-500">Language</p>
                <p className="mt-1 font-semibold text-ink">
                  {analysis?.detected_language || '--'}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-ink-200 bg-paper-100 p-3">
                <p className="text-ink-500">Category</p>
                <p className="mt-1 font-semibold text-ink">{analysis?.category || '--'}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-ink-200 bg-paper-100 p-3">
                <p className="text-ink-500">Department</p>
                <p className="mt-1 font-semibold text-ink">{analysis?.department || '--'}</p>
              </div>
            </div>
          </aside>
        </div>

        <section className="reveal-up delay-3 mt-4 rounded-2xl border border-ink-200 bg-paper-200 p-4 sm:mt-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-ink">Result Dashboard</h3>
            <p
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${sentimentTone}`}
            >
              {analysis?.sentiment || 'Neutral'}
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-ink-200 bg-paper-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-500">
                Internal Summary
              </p>
              <p className="mt-2 text-pretty text-sm text-ink-700 sm:text-base">
                {analysis?.summary ||
                  'Run an analysis to view a one-line English summary for your internal team.'}
              </p>
            </article>

            <article className="rounded-xl border border-ink-200 bg-paper-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-500">
                Suggested Reply
              </p>
              <p className="mt-2 whitespace-pre-wrap text-pretty text-sm text-ink-700 sm:text-base">
                {analysis?.reply_draft ||
                  'The drafted customer response will appear here in the original review language.'}
              </p>
            </article>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
