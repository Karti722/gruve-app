import { TextbookPage } from "@/components/TextbookPage";
import { Analogy } from "@/components/Analogy";

export default function IntroductionPage() {
  return (
    <div className="space-y-10">
      <TextbookPage
        eyebrow="Introduction"
        title="Why This Guide Exists"
        pageNumber="Page ii"
        nextPage={{ href: "/tokenizer", label: "Chapter 1: Tokenization and the Cost of a Request" }}
      >
        <p>
          Every job that touches software now touches AI in some form, not as a future
          possibility, but as a thing already sitting in the product, the internal tooling and the
          interview loop. Chapter 8 documents some of that directly: real companies, publicly
          reporting real production systems built on the exact concepts this guide covers. That
          isn't a hypothetical anyone gets to opt out of by waiting for it to blow over. Knowing
          that "AI can do X" is now table stakes; knowing <em>how</em> (well enough to reason about
          what a retrieval pipeline actually retrieves, why an agent chose one tool over another, or
          what a request actually costs) is the part that's still genuinely rare, and genuinely
          learnable.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          A Real Gap, Not a Manufactured One
        </h2>
        <p>
          University curricula move on a multi-year cycle: a course has to be designed, reviewed,
          scheduled, staffed and taught, often by faculty whose research interests set the syllabus
          long before a new technology reaches industry at all. That pace made sense when the
          underlying field itself moved slowly. It doesn't fit what's happened since: a general-
          purpose chat interface to a large language model only reached the public in very late
          2022; the Model Context Protocol covered in Chapter 4 didn't exist until November 2024.
          Most computer science degrees still center on the material that has always belonged
          there (algorithms, systems, theory and a foundational pass at classical machine
          learning) because that material is genuinely foundational and doesn't go stale. What it
          rarely includes yet is the applied layer this guide is about: prompt design at a system
          level, retrieval architecture, agent tool-use and the operational discipline (token
          economics, caching, evaluation) that separates a working prototype from something a
          company will actually run.
        </p>
        <p>
          The result is a real gap, not a manufactured one. Students and working engineers alike
          are largely left to close it themselves, through scattered blog posts, vendor
          documentation and a lot of trial and error: sources that are individually fine but
          rarely combine a clear conceptual explanation with real, inspectable, working code in one
          place. Bootcamps and short courses fill part of that space, unevenly; some are excellent,
          many trade depth for speed and few let a learner actually open the code behind the demo
          and see precisely how it works.
        </p>

        <Analogy>
          It's the difference between a driving manual and a car with the hood welded shut. Reading
          about how retrieval-augmented generation works is the manual. This guide hands over the
          keys and leaves the hood open: every "Try it yourself" section runs against the exact code
          described next to it, so nothing here has to be taken on faith.
        </Analogy>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          What This Guide Tries to Do
        </h2>
        <p>
          AI Nexus was built to sit in that gap directly: a textbook's worth of explanation,
          attached to a real, running application instead of a slide deck. Every chapter follows
          the same shape: a live demo first, then the concept behind it, explained from first
          principles and tied back to a real, cited source wherever one exists. Nothing is
          simulated to make a point look cleaner than it is. The agent in Chapter 4 calls a tool
          server over the actual Model Context Protocol; the summarizer in Chapter 5 runs a real
          graph-ranking algorithm over real embeddings; the cost estimate in Chapter 1 is computed
          from Claude's own real token count, not an estimate. Chapter 9 goes one level
          further and explains the system doing all of this, and Chapter 10 explains how the whole
          thing was actually built, so curiosity about the guide itself is answered by the guide
          itself, rather than left as an exercise.
        </p>
        <p>
          The goal by the end isn't just recognizing these terms in a job posting. It's having
          personally driven a real conversation with a language model, watched a retrieval pipeline
          pick its sources, traced an agent's reasoning step by step and estimated what a request
          actually costs before ever writing a line of this kind of system from scratch, the same
          hands-on grounding a good internship gives someone, compressed into something anyone can
          work through on their own, for free, without needing anyone's permission to start.
        </p>

        <p>
          One practical note on order: the chapters ahead are sequenced deliberately, each one
          building on ideas the last one introduced, starting from the smallest unit (a single
          token) up through full systems and how real companies run them. Reading in order is the
          most direct path through, though every chapter's demo works on its own if you'd rather
          jump straight to whatever you're most curious about.
        </p>
      </TextbookPage>
    </div>
  );
}
