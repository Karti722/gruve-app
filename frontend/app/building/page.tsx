import { TextbookPage } from "@/components/TextbookPage";
import { Analogy } from "@/components/Analogy";

export default function BuildingPage() {
  return (
    <div className="space-y-10">
      <TextbookPage eyebrow="Chapter 10" title="How This Tutorial Was Built" pageNumber="Page 10">
        <p>
          Chapter 9 walked through what runs behind these pages. This one is about how it came to
          exist in the first place: every chapter, every diagram and every part of the system
          described in Chapter 9 was built through an extended conversation between a person and an
          AI coding assistant, the same agent pattern taught in Chapter 4, pointed at a real
          codebase instead of a calculator.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">10.1</span> An Iterative Loop, Not a Single Prompt
        </h2>
        <p>
          The process looked like the ReAct loop from Chapter 4, just running on source code instead
          of a single question, over roughly two weeks and about thirty commits, not one long
          session. The author described what they wanted in plain language: a working demo of these
          concepts, then a friendlier rewrite aimed at complete beginners, then a different visual
          identity entirely, then several more chapters covering real-world use and the system's own
          architecture. The assistant read the existing code, planned a change, wrote it, and the
          result was reviewed before moving to the next step: think, act, observe, repeated for
          every feature on this site, not just once. The current codebase is around five thousand
          lines of TypeScript and Python spread across roughly seventy files, but the actual history
          of changes behind it is considerably larger than that, because entire pieces were rebuilt
          rather than patched once a better approach became clear, not because the first attempt was
          sloppy.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">10.2</span> The Visual Identity, Twice
        </h2>
        <p>
          The visual design in particular went through several complete passes, not one. It started
          as a dark, modern app-style interface. That was rebuilt from scratch around the "printed
          textbook" identity you're reading right now (serif type, chapter numbers, page footers,
          the works) after a review made clear the first version didn't fit a tutorial. Even within
          that redesign, individual pieces changed again: chat bubbles became the question-and-answer
          transcript in Chapter 2, and boxed cards became the footnote-style citations in Chapter 3.
          None of it arrived finished on the first attempt.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">10.3</span> Chapters Added in Batches, Not All at Once
        </h2>
        <p>
          The chapter list didn't exist in its current form from the start either. Early work
          established the core demo, chat, RAG and the agent, on top of a first retrieval store
          that used SQLite, later replaced outright with the real pgvector-backed Postgres database
          described in Chapter 9 once it was clear a toy database undersold what a real one looks
          like. Chapters 4 and 5 (agents and summarization) were added together as one batch, then
          Chapter 6 and the glossary as another. The three "applied AI engineering" chapters,
          tokenization and cost estimation, semantic caching and output evaluation, arrived later
          still, as a deliberate addition to the Python service specifically to cover the parts of
          real AI engineering that aren't a single model call: caching to avoid paying for the same
          question twice, and evaluation to know whether a change actually helped. Adding them meant
          renumbering every chapter that came after, and later still, an Introduction chapter was
          added and the whole sequence was reordered by dependency (tokenization and cost before a
          conversation with a model, RAG before agents that search it, caching and evaluation only
          after there's something worth caching or evaluating) rather than the order features
          happened to get built in.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">10.4</span> Real Bugs, Found by Actually Running the System
        </h2>
        <p>
          A meaningful share of the work wasn't adding chapters at all, it was fixing things a first
          pass got wrong, the same way real engineering work usually splits. A security pass scoped
          the backend's CORS policy down from allowing any website to call it to only the
          configured frontend origin, closing off a real way a stranger's website could otherwise
          have spent this app's Anthropic budget from a visitor's own browser. A process-management
          bug meant Ctrl-C didn't always clean up every server the local dev script had started,
          leaving orphaned processes holding onto ports; the fix taught the shutdown script to catch
          those stragglers specifically, not just the processes it started directly. A correctness
          pass on RAG and the semantic cache deduped embeddings that were being computed and stored
          more than once, made the from-scratch embedding scheme (since replaced, see Chapter 9) aware
          of stopwords and domain acronyms it was mishandling, and removed a silent fallback that
          could have quietly corrupted the vector store on a transient failure instead of surfacing
          an honest error. Chapter 5's summarizer had its own bug: sentences with zero real
          similarity to anything else in a document were settling at an uninformative "average"
          importance score instead of correctly ranking low, a genuine off-by-one-idea in a hand-
          rolled PageRank-style graph, fixed by explicitly redistributing disconnected sentences'
          rank instead of leaving it to default incorrectly.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">10.5</span> The Most Recent Chapter of This Story
        </h2>
        <p>
          The tokenizer and embeddings you can try in Chapters 1 and 3 right now used to be
          from-scratch implementations too: a hand-trained byte-pair tokenizer and a hashing-based
          embedding scheme, both real algorithms, honestly labeled as approximate. Replacing them
          with real calls to Anthropic's own token-counting endpoint and Voyage AI's embedding model
          was its own small version of this same loop, including its own real bugs. The Python
          service turned out to have never actually loaded this project's shared configuration file
          locally at all, a gap invisible for months because every setting it read happened to have
          a working fallback value, until the new embeddings key, deliberately built with no
          fallback, was the first one to expose it. Fixing that surfaced a second issue immediately
          behind it: the embedding provider's free tier allows only a few requests per minute, and
          several features here had been quietly making one request per sentence, or per query,
          in a loop, rather than one batched request for everything at once, exactly the kind of
          bug that only shows up once you actually run the feature against a real account instead
          of reasoning about whether the code looks correct. Both were found the same way every
          other fix in 10.4 was: by running the real system, watching it fail, and reading the
          actual error closely enough to find the real cause instead of the first plausible guess.
        </p>

        <Analogy>
          Building software this way is less like dictation and more like working with an extremely
          fast, extremely literal collaborator. You can describe an entire chapter, or a full visual
          redesign, in a sentence and get a working draft back in moments, but you still have to
          look closely at what comes back, notice the parts that miss the mark and say so clearly.
          That review step is doing most of the real work, the same way Chapter 4's "observe" step is
          what makes an agent loop useful instead of just fast.
        </Analogy>

        <p>
          None of this should be read as "no one designed this." Every structural decision (what to
          teach and in what order, what to explain about the system versus keep simple, which
          real-world examples in Chapter 8 were credible enough to include, which of the fixes in
          10.4 and 10.5 were worth explaining here rather than leaving as an invisible patch) was
          made by a person, checked against real sources or a real running system where it mattered,
          and revised repeatedly until it was right. The assistant did the typing, ran the commands
          and reported back what actually happened. The judgment, and the decision to trust or
          double-check any of it, stayed human.
        </p>
      </TextbookPage>
    </div>
  );
}
