"use client";

type SearchInputProps = {
  query: string;
  isDarkMode: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
};

export const SearchInput = ({
  query,
  isDarkMode,
  onQueryChange,
  onSubmit,
}: SearchInputProps) => {
  return (
    <section className="absolute inset-x-0 bottom-3 z-[1000] mx-auto flex w-full max-w-2xl items-center gap-2 px-4">
      <label htmlFor="nlp-input" className="sr-only">
        Natural language query
      </label>
      <input
        id="nlp-input"
        aria-label="Natural language query input"
        className={
          isDarkMode
            ? "w-full rounded-xl border border-white/20 bg-slate-900/85 px-4 py-3 text-sm text-white shadow-xl outline-none ring-cyan-300 placeholder:text-slate-400 focus:ring-2"
            : "w-full rounded-xl border border-slate-300 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-xl outline-none ring-cyan-300 placeholder:text-slate-500 focus:ring-2"
        }
        placeholder="Try: Emergency surgery in rural Bihar with high reliability"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit();
          }
        }}
      />
      <button
        aria-label="Apply natural language query"
        className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        onClick={onSubmit}
        type="button"
      >
        Parse
      </button>
    </section>
  );
};
