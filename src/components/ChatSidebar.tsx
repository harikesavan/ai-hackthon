"use client";

import { useEffect, useRef, useState } from "react";

type ChatSidebarProps = {
  isDarkMode: boolean;
  onSelectFacility?: (facilityId: string) => void;
  onFlyToLocation?: (lat: number, lng: number) => void;
};

type ReasoningStep = { step: string; text: string };

type Recommendation = {
  facilityId: number;
  name: string;
  type?: string;
  district?: string;
  state?: string;
  lat: number;
  lon: number;
  trustMin: number;
  reason: string;
};

type Warning = {
  facilityId: number;
  name: string;
  lat?: number;
  lon?: number;
  trustMin: number;
  reason: string;
};

const suggestedQueries = [
  "Hospital near Patna for emergency C-section",
  "Cardiac care in Rajasthan",
  "Surgery facility in Chennai",
];

const SparkleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 2.75L13.9 8.1L19.25 10L13.9 11.9L12 17.25L10.1 11.9L4.75 10L10.1 8.1L12 2.75ZM18 15L18.85 17.15L21 18L18.85 18.85L18 21L17.15 18.85L15 18L17.15 17.15L18 15ZM6 14L6.7 15.8L8.5 16.5L6.7 17.2L6 19L5.3 17.2L3.5 16.5L5.3 15.8L6 14Z"
      fill="currentColor"
    />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M6 6L18 18M18 6L6 18"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 11.5L19 4L14 20L11.3 13.9L4 11.5Z"
      fill="currentColor"
    />
  </svg>
);

export default function ChatSidebar({
  isDarkMode,
  onSelectFacility,
  onFlyToLocation,
}: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [query, setQuery] = useState("");
  const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [finalErrorMessage, setFinalErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const floatingQueryRef = useRef<HTMLTextAreaElement>(null);
  const panelQueryRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const maxHeight = lineHeight * 5 + paddingTop + paddingBottom;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reasoningSteps.length, recommendation]);

  useEffect(() => {
    resizeTextarea(floatingQueryRef.current);
    resizeTextarea(panelQueryRef.current);
  }, [query, isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = async (nextQuery?: string) => {
    const message = (nextQuery ?? query).trim();
    if (!message) {
      return;
    }

    setIsOpen(true);
    setHasInteracted(true);
    setReasoningSteps([]);
    setRecommendation(null);
    setWarnings([]);
    setIsDetailsExpanded(false);
    setFinalErrorMessage(null);
    setIsSubmittingQuery(true);
    setQuery("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to fetch chat response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case "reasoning":
                  setReasoningSteps((prev) => [...prev, data as ReasoningStep]);
                  break;
                case "recommendation":
                  setRecommendation(data as Recommendation);
                  break;
                case "warnings":
                  setWarnings(data as Warning[]);
                  break;
              }
            } catch {
              // skip malformed JSON
            }
            currentEvent = "";
          }
        }
      }
    } catch {
      const errorMessage =
        "Something went wrong while streaming the analysis. Please try again.";
      setReasoningSteps((prev) => [
        ...prev,
        {
          step: "warning",
          text: errorMessage,
        },
      ]);
      setFinalErrorMessage(errorMessage);
    } finally {
      setIsSubmittingQuery(false);
    }
  };

  const panelClass = isDarkMode
    ? "bg-slate-900/95 border-l border-white/10 text-white shadow-2xl"
    : "bg-white/95 border-l border-slate-200/50 text-slate-900 shadow-2xl";

  const borderClass = isDarkMode ? "border-white/10" : "border-slate-200";
  const mutedTextClass = isDarkMode ? "text-slate-400" : "text-slate-500";

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-5 left-1/2 z-[1100] flex -translate-x-1/2 flex-col items-center gap-3">
          {!hasInteracted && (
            <div className="flex items-center gap-2">
              {suggestedQueries.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  style={{ animationDelay: `${index * 100}ms` }}
                  className={
                    "animate-fade-in-up cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium shadow-lg transition-all duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 " +
                    (isDarkMode
                      ? "border border-cyan-500/25 bg-slate-900/80 text-cyan-300 hover:bg-slate-800/90"
                      : "border border-cyan-200 bg-white/80 text-cyan-700 hover:bg-white/95")
                  }
                  onClick={() => {
                    setQuery(item);
                    void handleSubmit(item);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div
              style={{ width: "min(38rem, calc(100vw - 14rem))" }}
              className={
                "flex items-center gap-2 rounded-2xl px-4 py-3 shadow-xl transition-shadow focus-within:ring-2 focus-within:ring-cyan-500/40 " +
                (isDarkMode
                  ? "border border-white/10 bg-slate-900/90 text-white"
                  : "border border-slate-200 bg-white/90 text-slate-900")
              }
            >
              <svg className="h-4 w-4 shrink-0 opacity-40" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="9" cy="9" r="6" />
                <path d="M14 14l4 4" />
              </svg>
              <textarea
                ref={floatingQueryRef}
                value={query}
                rows={1}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resizeTextarea(event.currentTarget);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="Ask about healthcare facilities..."
                className={
                  "w-full resize-none bg-transparent text-sm leading-5 outline-none " +
                  (isDarkMode ? "placeholder:text-slate-500" : "placeholder:text-slate-400")
                }
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmittingQuery || !query.trim()}
              className="h-12 shrink-0 cursor-pointer whitespace-nowrap rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-xl transition-colors hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ask AI
            </button>
            {hasInteracted && (
              <button
                type="button"
                aria-label="Reopen chat"
                onClick={() => setIsOpen(true)}
                className={
                  "h-12 w-12 shrink-0 cursor-pointer rounded-2xl p-3 shadow-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 " +
                  (isDarkMode
                    ? "border border-white/10 bg-slate-900/90 text-cyan-400 hover:bg-slate-800"
                    : "border border-slate-200 bg-white/90 text-cyan-600 hover:bg-white")
                }
              >
                <SparkleIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label="Close chat overlay"
        onClick={() => setIsOpen(false)}
        className={
          "fixed inset-0 z-[1100] bg-black/10 transition-opacity duration-300 " +
          (isOpen ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />

      <aside
        className={
          `fixed inset-y-0 right-0 z-[1200] flex w-[420px] max-w-full flex-col transition-transform duration-300 ease-out ${panelClass} ` +
          (isOpen ? "translate-x-0" : "translate-x-full")
        }
        aria-hidden={!isOpen}
      >
        <header
          className={`sticky top-0 flex items-center gap-3 border-b px-4 py-3 ${borderClass} ${isDarkMode ? "bg-slate-900/95" : "bg-white/95"}`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-400">
            <SparkleIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">AI Analysis</p>
            <p className={`text-[11px] ${mutedTextClass}`}>One answer card with optional reasoning details</p>
          </div>
          <div
            role="group"
            aria-label="Agent mode"
            className={
              "flex items-center rounded-full p-0.5 text-[10px] font-semibold uppercase tracking-wider " +
              (isDarkMode ? "bg-slate-800/80 border border-white/10" : "bg-slate-100 border border-slate-200")
            }
          >
            <button
              type="button"
              onClick={() => setMode("demo")}
              className={
                "rounded-full px-2.5 py-1 transition-colors cursor-pointer " +
                (mode === "demo"
                  ? isDarkMode
                    ? "bg-cyan-500 text-slate-950"
                    : "bg-cyan-500 text-white"
                  : isDarkMode
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-800")
              }
            >
              Demo
            </button>
            <button
              type="button"
              onClick={() => setMode("live")}
              className={
                "rounded-full px-2.5 py-1 transition-colors cursor-pointer " +
                (mode === "live"
                  ? isDarkMode
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-emerald-500 text-white"
                  : isDarkMode
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-800")
              }
            >
              Live
            </button>
          </div>
          <button
            type="button"
            aria-label="Close AI analysis"
            onClick={() => setIsOpen(false)}
            className={
              "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 " +
              (isDarkMode ? "hover:bg-white/8" : "hover:bg-slate-900/6")
            }
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {reasoningSteps.length === 0 && !recommendation && !isSubmittingQuery && (
            <section className="space-y-3">
              <p className={`text-xs ${mutedTextClass}`}>Try asking:</p>
              <div className="flex flex-col gap-2">
                {suggestedQueries.map((item, index) => (
                  <button
                    key={item}
                    type="button"
                    style={{ animationDelay: `${index * 90}ms` }}
                    className={
                      "animate-fade-in-up cursor-pointer whitespace-nowrap rounded-full px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 " +
                      (isDarkMode
                        ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                        : "border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100")
                    }
                    onClick={() => {
                      setQuery(item);
                      void handleSubmit(item);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
          )}

          {isSubmittingQuery && reasoningSteps.length === 0 && (
            <div
              className={
                "inline-flex items-center gap-1.5 rounded-2xl px-4 py-3 animate-fade-in " +
                (isDarkMode ? "bg-slate-800" : "bg-slate-100")
              }
            >
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 rounded-full bg-cyan-400 animate-typing-dot"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          )}

          {(recommendation || reasoningSteps.length > 0 || warnings.length > 0) && (
            <article
              className={
                "animate-message-in rounded-2xl p-4 " +
                (isDarkMode
                  ? "bg-slate-800/40"
                  : "bg-slate-100/70")
              }
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-500">
                  Final answer
                </p>
                {isSubmittingQuery && (
                  <span className={`text-[11px] ${mutedTextClass}`}>Updating...</span>
                )}
              </div>

              {recommendation ? (
                <>
                  <p className="mt-2 text-sm font-bold">{recommendation.name}</p>
                  <p className="mt-1 text-xs opacity-80">
                    {[recommendation.type, recommendation.district, recommendation.state]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                  <p
                    className={
                      "mt-1 text-xs font-medium " +
                      (recommendation.trustMin >= 0.75
                        ? "text-emerald-500"
                        : "text-amber-500")
                    }
                  >
                    Confidence: {Math.round(recommendation.trustMin * 100)}%
                  </p>
                  <p className="mt-2 text-xs opacity-75">{recommendation.reason}</p>
                  {(onSelectFacility || onFlyToLocation) && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFacility?.(String(recommendation.facilityId));
                        onFlyToLocation?.(recommendation.lat, recommendation.lon);
                      }}
                      className="mt-3 cursor-pointer whitespace-nowrap rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                    >
                      View on map
                    </button>
                  )}
                </>
              ) : finalErrorMessage ? (
                <p className="mt-2 text-xs text-red-500">{finalErrorMessage}</p>
              ) : (
                <p className={`mt-2 text-xs ${mutedTextClass}`}>
                  {isSubmittingQuery
                    ? "The model is still reasoning. Expand details to see interim steps."
                    : "No recommendation available for this query."}
                </p>
              )}

              {(reasoningSteps.length > 0 || warnings.length > 0) && (
                <section className="mt-3">
                  <button
                    type="button"
                    aria-label={isDetailsExpanded ? "Hide reasoning and steps" : "Show reasoning and steps"}
                    onClick={() => setIsDetailsExpanded((prev) => !prev)}
                    className={
                      "inline-flex cursor-pointer items-center gap-2 text-xs font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 " +
                      (isDarkMode
                        ? "text-slate-300 hover:opacity-80"
                        : "text-slate-600 hover:opacity-80")
                    }
                  >
                    <span className="text-[10px]">
                      {isDetailsExpanded ? "▼" : "▶"}
                    </span>
                    <span>
                      {isDetailsExpanded ? "Hide" : "Show"} reasoning and steps
                      {reasoningSteps.length > 0 ? ` (${reasoningSteps.length})` : ""}
                    </span>
                  </button>

                  {isDetailsExpanded && (
                    <div
                      className={
                        "mt-2 space-y-2 border-l pl-3 " +
                        (isDarkMode ? "border-white/10" : "border-slate-300/70")
                      }
                    >
                      {reasoningSteps.map((step, index) => {
                        const isWarning = step.step === "warning";
                        const isRecommend = step.step === "recommend";
                        const dotClass = isWarning
                          ? "bg-red-400"
                          : isRecommend
                            ? "bg-emerald-400"
                            : "bg-cyan-400";
                        const textClass = isWarning
                          ? isDarkMode
                            ? "text-red-200"
                            : "text-red-700"
                          : isDarkMode
                            ? "text-slate-200"
                            : "text-slate-700";

                        return (
                          <article
                            key={`${step.step}-${index}-${step.text}`}
                            className="flex gap-2 py-0.5 text-xs leading-relaxed"
                          >
                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider opacity-60">
                                {step.step}
                              </p>
                              <p className={textClass}>{step.text}</p>
                            </div>
                          </article>
                        );
                      })}

                      {warnings.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {warnings.map((warning, index) => (
                            <article
                              key={`${warning.facilityId}-${index}`}
                              className="text-xs leading-relaxed"
                            >
                              <p className="font-semibold text-red-500">{warning.name}</p>
                              <p className="text-red-500/90">
                                Confidence: {Math.round(warning.trustMin * 100)}%
                              </p>
                              <p className={isDarkMode ? "text-red-200/90" : "text-red-700"}>
                                {warning.reason}
                              </p>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </article>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div
          className={
            `shrink-0 border-t px-4 py-3 ${borderClass} ${isDarkMode ? "bg-slate-900/50" : "bg-white/50"}`
          }
        >
          <div className="flex items-center gap-2">
            <label htmlFor="chat-sidebar-query" className="sr-only">
              Ask about healthcare facilities
            </label>
            <textarea
              ref={panelQueryRef}
              id="chat-sidebar-query"
              value={query}
              rows={1}
              onChange={(event) => {
                setQuery(event.target.value);
                resizeTextarea(event.currentTarget);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Ask about healthcare facilities..."
              className={
                "flex-1 resize-none rounded-xl px-4 py-2.5 text-sm leading-5 outline-none transition-shadow focus:ring-2 focus:ring-cyan-500/40 " +
                (isDarkMode
                  ? "border border-white/10 bg-slate-800/80 text-white placeholder:text-slate-500"
                  : "border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400")
              }
            />
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmittingQuery || !query.trim()}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>Ask AI</span>
              <SendIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
