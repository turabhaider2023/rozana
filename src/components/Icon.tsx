import type { ReactNode } from "react";

export type IconName =
  | "plus"
  | "close"
  | "left"
  | "right"
  | "trash"
  | "home"
  | "list"
  | "target"
  | "spark"
  | "download"
  | "search"
  | "alert";

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph(name)}
    </svg>
  );
}

function glyph(name: IconName): ReactNode {
  switch (name) {
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "close":
      return <path d="M6 6l12 12M18 6 6 18" />;
    case "left":
      return <path d="M15 5 8 12l7 7" />;
    case "right":
      return <path d="M9 5l7 7-7 7" />;
    case "trash":
      return <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" />;
    case "home":
      return <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />;
    case "list":
      return <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />;
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
        </>
      );
    case "spark":
      return <path d="m12 3 1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8z" />;
    case "download":
      return <path d="M12 4v10M8 10l4 4 4-4M5 19h14" />;
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </>
      );
    case "alert":
      return (
        <>
          <path d="M12 4 21 20H3z" />
          <path d="M12 10v4M12 16.5h.01" />
        </>
      );
  }
}
