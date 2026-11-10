import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Streamdown } from "streamdown";
import { chatRehypePlugins } from "./chat-markdown";

function renderMarkdown(markdown: string) {
  return renderToStaticMarkup(
    <Streamdown mode="static" rehypePlugins={chatRehypePlugins}>
      {markdown}
    </Streamdown>,
  );
}

test("item links reach the custom chat renderer with their ID and label", () => {
  const links: { href?: string; label: string }[] = [];
  const html = renderToStaticMarkup(
    <Streamdown
      mode="static"
      rehypePlugins={chatRehypePlugins}
      components={{
        a: ({ href, children }) => {
          links.push({ href, label: String(children) });
          return (
            <a href={`/servers/1/library/${href?.replace("item://", "")}`}>
              {children}
            </a>
          );
        },
      }}
    >
      {"[Spirited Away](item://abc123)"}
    </Streamdown>,
  );

  expect(links).toEqual([{ href: "item://abc123", label: "Spirited Away" }]);
  expect(html).toContain('href="/servers/1/library/abc123"');
  expect(html).not.toContain("[blocked]");
});

test.each(["https://example.com/movie", "/servers/1/library/abc123"])(
  "preserves ordinary links: %s",
  (url) => {
    const html = renderMarkdown(`[Movie](${url})`);
    expect(html).toContain(`href="${url}"`);
    expect(html).not.toContain("[blocked]");
  },
);

test.each([
  "javascript:alert(1)",
  "data:text/html,unsafe",
  "file:///etc/passwd",
  "vbscript:msgbox(1)",
  "unknown://abc123",
])("keeps unsafe and unsupported links blocked: %s", (url) => {
  const html = renderMarkdown(`[Unsafe](<${url}>)`);
  expect(html).toContain("[blocked]");
  expect(html).not.toContain("<a ");
  expect(html).not.toContain("href=");
});

test("continues stripping scripts and event handlers from raw HTML", () => {
  const html = renderMarkdown(
    '<script>alert(1)</script><a href="item://abc123" onclick="alert(1)">Movie</a>',
  );
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onclick");
  expect(html).not.toContain("alert(1)");
  expect(html).toContain('href="item://abc123"');
});

test("does not allow item URLs as image sources", () => {
  const html = renderMarkdown("![Poster](item://abc123)");
  expect(html).not.toContain('src="item://');
  expect(html).toContain("[Image blocked:");
});

test("leaves Streamdown's default sanitizer unchanged outside chat", () => {
  const html = renderToStaticMarkup(
    <Streamdown mode="static">{"[Movie](item://abc123)"}</Streamdown>,
  );
  expect(html).toContain("[blocked]");
});
