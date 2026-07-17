import { config } from "../config";

export interface RankedSentence {
  text: string;
  index: number;
  score: number;
}

export interface ReadabilityScore {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  wordCount: number;
  sentenceCount: number;
}

export interface SummarizeResult {
  sentences: RankedSentence[];
  totalSentences: number;
  keywords: string[];
  originalReadability: ReadabilityScore;
  summaryReadability: ReadabilityScore;
}

interface PythonReadability {
  flesch_reading_ease: number;
  flesch_kincaid_grade: number;
  word_count: number;
  sentence_count: number;
}

function toReadability(r: PythonReadability): ReadabilityScore {
  return {
    fleschReadingEase: r.flesch_reading_ease,
    fleschKincaidGrade: r.flesch_kincaid_grade,
    wordCount: r.word_count,
    sentenceCount: r.sentence_count,
  };
}

/**
 * Calls the Python service's real TextRank summarizer. Unlike embeddings,
 * this has no in-process fallback — it's a standalone demo feature the
 * rest of the app doesn't depend on, so a clear error is preferable to a
 * silently degraded response if the service is unreachable.
 */
export async function summarizeText(text: string, sentenceCount = 3): Promise<SummarizeResult> {
  const res = await fetch(`${config.pythonEmbeddingServiceUrl}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sentence_count: sentenceCount }),
  });

  if (!res.ok) {
    throw new Error(`Summarization service responded ${res.status}`);
  }

  const data = (await res.json()) as {
    sentences: RankedSentence[];
    total_sentences: number;
    keywords: string[];
    original_readability: PythonReadability;
    summary_readability: PythonReadability;
  };

  return {
    sentences: data.sentences,
    totalSentences: data.total_sentences,
    keywords: data.keywords,
    originalReadability: toReadability(data.original_readability),
    summaryReadability: toReadability(data.summary_readability),
  };
}
