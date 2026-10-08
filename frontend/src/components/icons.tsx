import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
  focusable: false,
};

export const PlayIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path
      d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10.4-6.4a.8.8 0 0 0 0-1.4L9.2 4.9A.8.8 0 0 0 8 5.6Z"
      fill="currentColor"
    />
  </svg>
);

export const PauseIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="6.5" y="5" width="4" height="14" rx="1.3" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.3" fill="currentColor" />
  </svg>
);

export const SkipNextIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path
      d="M6 6.3v11.4a.7.7 0 0 0 1.1.6l8.2-5.7a.7.7 0 0 0 0-1.2L7.1 5.7A.7.7 0 0 0 6 6.3Z"
      fill="currentColor"
    />
    <rect x="17" y="5.5" width="2.2" height="13" rx="1.1" fill="currentColor" />
  </svg>
);

export const SkipPrevIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <g transform="matrix(-1 0 0 1 24 0)">
      <path
        d="M6 6.3v11.4a.7.7 0 0 0 1.1.6l8.2-5.7a.7.7 0 0 0 0-1.2L7.1 5.7A.7.7 0 0 0 6 6.3Z"
        fill="currentColor"
      />
      <rect x="17" y="5.5" width="2.2" height="13" rx="1.1" fill="currentColor" />
    </g>
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const TrashIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path
      d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m-7.5 0 .8 11a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MusicNoteIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path
      d="M9 18V6.5l9-2V16M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm9-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const GripIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <g fill="currentColor">
      <circle cx="9" cy="6.5" r="1.4" />
      <circle cx="15" cy="6.5" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="17.5" r="1.4" />
      <circle cx="15" cy="17.5" r="1.4" />
    </g>
  </svg>
);

export const UploadIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path
      d="M12 15.5V5m0 0L8 9m4-4 4 4M5 14.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-3.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WavesIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path
      d="M3 8.5c2.2-2 3.8-2 6 0s3.8 2 6 0 3.8-2 6 0M3 13c2.2-2 3.8-2 6 0s3.8 2 6 0 3.8-2 6 0M3 17.5c2.2-2 3.8-2 6 0s3.8 2 6 0 3.8-2 6 0"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const ShuffleIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path
      d="M4 7h3c1.4 0 2.6.7 3.4 1.8l3.2 4.4c.8 1.1 2 1.8 3.4 1.8H20m0 0-2.5-2.5M20 15l-2.5 2.5M4 17h3c1.4 0 2.6-.7 3.4-1.8M13.6 8.8C14.4 7.7 15.6 7 17 7h3m0 0-2.5-2.5M20 7l-2.5 2.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
