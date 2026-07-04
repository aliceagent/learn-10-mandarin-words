import { serializeJsonLd } from "@/lib/seo";

/**
 * Renders a JSON-LD structured-data block. Server component: the script is part
 * of the statically rendered HTML so crawlers see it without running JS. The
 * value is escaped by `serializeJsonLd` before it reaches `dangerouslySetInnerHTML`.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }): React.JSX.Element {
  return (
    <script
      type="application/ld+json"
      // serializeJsonLd escapes "<" so data can't break out of the tag.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
