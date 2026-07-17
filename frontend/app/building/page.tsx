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

        <p>
          The process looked like the ReAct loop from Chapter 4, just running on source code instead
          of a single question. The author described what they wanted in plain language: a working
          demo of these concepts, then a friendlier rewrite aimed at complete beginners, then a
          different visual identity entirely, then two more chapters covering real-world use and the
          system's own architecture. The assistant read the existing code, planned a change, wrote
          it, and the result was reviewed before moving to the next step: think, act, observe,
          repeated for every feature on this site, not just once.
        </p>

        <p>
          The visual design in particular went through several complete passes, not one. It started
          as a dark, modern app-style interface. That was rebuilt from scratch around the "printed
          textbook" identity you're reading right now (serif type, chapter numbers, page footers,
          the works) after a review made clear the first version didn't fit a tutorial. Even within
          that redesign, individual pieces changed again: chat bubbles became the question-and-answer
          transcript in Chapter 2, and boxed cards became the footnote-style citations in Chapter 3.
          None of it arrived finished on the first attempt.
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
          real-world examples in Chapter 8 were credible enough to include) was made by a person,
          checked against real sources where it mattered and revised repeatedly until it was right.
          The assistant did the typing. The judgment stayed human.
        </p>
      </TextbookPage>
    </div>
  );
}
