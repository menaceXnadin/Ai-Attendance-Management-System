import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge about the Fluent type ramp and shadow keys from
// tailwind.config.ts; otherwise `text-body text-text-primary` would be treated
// as two conflicting text colors and the font size would be dropped.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "title-2",
            "page-title",
            "section-title",
            "subheading",
            "body",
            "body-strong",
            "label",
            "caption",
            "caption-strong",
            "overline",
          ],
        },
      ],
      shadow: [
        { shadow: ["fluent-2", "fluent-4", "fluent-8", "fluent-16", "fluent-28", "fluent-64"] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
