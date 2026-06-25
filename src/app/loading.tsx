// Shown automatically while any page's server data loads on navigation (App Router
// Suspense fallback). The Nav lives in the root layout, so only the content area swaps
// to this spinner when flipping between pages.
export default function Loading() {
  return (
    <main className="shell">
      <div className="page-loading" role="status" aria-live="polite" aria-label="Loading">
        <span className="page-spinner" aria-hidden />
      </div>
    </main>
  );
}
