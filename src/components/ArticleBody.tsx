import { splitHtmlAtParagraphs } from "@/lib/split-html";
import InlineSubscribeCta from "./InlineSubscribeCta";

export default function ArticleBody({ html }: { html: string }) {
  const { before, after } = splitHtmlAtParagraphs(html, 0.4);
  if (!after) {
    return <div className="prose-tellus mx-auto max-w-[700px]" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <div className="mx-auto max-w-[700px]">
      <div className="prose-tellus" dangerouslySetInnerHTML={{ __html: before }} />
      <InlineSubscribeCta />
      <div className="prose-tellus" dangerouslySetInnerHTML={{ __html: after }} />
    </div>
  );
}
