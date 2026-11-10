import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { defaultRehypePlugins, type StreamdownProps } from "streamdown";

// Keep Streamdown's filters, allowing item links to reach the chat card renderer.
const chatSanitizePlugin: NonNullable<
  StreamdownProps["rehypePlugins"]
>[number] = [
  rehypeSanitize,
  {
    ...defaultSchema,
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href ?? []), "item"],
    },
  },
];

export const chatRehypePlugins = Object.values({
  ...defaultRehypePlugins,
  sanitize: chatSanitizePlugin,
});
