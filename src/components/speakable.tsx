import { Fragment, memo } from "react";
import { toPieces } from "@/lib/tts/text";

/**
 * Renders text with every word wrapped in `<span data-w={index}>`, so read-aloud can highlight
 * one word by toggling a class on that span (no React re-render). Spaces and punctuation are
 * kept as plain text, so the visible text is exactly the original string.
 */
export const Speakable = memo(function Speakable({ text }: { text: string }) {
  return (
    <>
      {toPieces(text).map((p, i) =>
        p.word === undefined ? (
          <Fragment key={i}>{p.text}</Fragment>
        ) : (
          <span key={i} data-w={p.word}>
            {p.text}
          </span>
        ),
      )}
    </>
  );
});
