import { ChatWindow } from "@/components/ChatWindow";
import { Analogy } from "@/components/Analogy";
import { TextbookPage } from "@/components/TextbookPage";
import { Sources } from "@/components/Sources";

export default function ChatPage() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
          Try it yourself
        </h2>
        <ChatWindow />
      </div>

      <TextbookPage eyebrow="Chapter 1" title="Large Language Models" pageNumber="Page 1">
        <p>
          A large language model, or LLM, is a type of AI system trained on enormous amounts of
          text to learn the statistical patterns of language. Its core task is deceptively simple:
          given a sequence of text, predict what small piece of text — called a{" "}
          <strong>token</strong>, often a whole word or a few characters — is most likely to come
          next. Producing a full response is just this single step, repeated: predict one token,
          add it to the text so far, and predict the next one based on everything up to that point,
          continuing until the response is complete. Trained on a large and varied enough body of
          text, this simple, repeated mechanism turns out to be powerful enough to answer questions,
          explain ideas, write code, and hold a conversation, without ever being explicitly
          programmed to do any of those things.
        </p>

        <p>
          A single reply only requires the model to look at the conversation so far and continue
          it — which is also how multi-turn conversation works. Every time you send a new message,
          the entire conversation up to that point — everything you and the model have said — is
          given back to the model as input, so it can respond as though it remembers what came
          before. The model itself has no memory between requests; the illusion of memory comes
          entirely from re-sending the whole conversation each time.
        </p>

        <Analogy>
          Generating text this way is like an extreme version of the autocomplete on your phone's
          keyboard. Ordinary autocomplete suggests one likely next word from simple, short-range
          patterns. A language model does the same basic thing — guess what's next, one piece at a
          time — but has learned far deeper and longer-range patterns from far more text, so token
          after token, the result reads as a coherent, reasoned answer rather than a string of
          vaguely plausible words.
        </Analogy>

        <p>
          One consequence of this design: a language model can only draw on two things when
          answering — what it learned during training, and whatever text is included in the current
          conversation. It has no way to look anything up on its own. Asked about something outside
          both of those, it will still produce a fluent, confident-sounding answer, but that answer
          may be entirely made up, a failure mode usually called hallucination. That limitation is
          the starting point for the next two chapters of this tutorial.
        </p>

        <p>
          Above is a live conversation with a language model. Send a message, read the reply, then
          ask a follow-up that only makes sense in light of what you already discussed — you should
          see the model respond as though it remembers, for exactly the reason explained above.
        </p>

        <Sources
          items={[
            {
              label: "Vaswani et al., \"Attention Is All You Need\" (2017) — the paper that introduced the Transformer architecture almost every modern LLM is built on",
              href: "https://arxiv.org/abs/1706.03762",
            },
            {
              label: "Ji et al., \"Survey of Hallucination in Natural Language Generation\" (2022)",
              href: "https://arxiv.org/abs/2202.03629",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
