import { createLucideIcon } from "lucide-react";

export const TennisRacket = createLucideIcon("TennisRacket", [
  [
    "ellipse",
    {
      cx: "14.5",
      cy: "8.5",
      rx: "6",
      ry: "7.5",
      transform: "rotate(40 14.5 8.5)",
      key: "head",
    },
  ],
  ["path", { d: "m9 12-3 5 1 1 5-3M6 17l-4 4 1 1 4-4", key: "handle" }],
  ["path", { d: "m10 5 8 7m-6-9 8 7M10 11l7-8m-5 10 7-8", key: "strings" }],
]);

export const Basketball = createLucideIcon("Basketball", [
  ["circle", { cx: "12", cy: "12", r: "9", key: "ball" }],
  [
    "path",
    {
      d: "M3 12h18M12 3v18M5.6 5.6a9 9 0 0 1 0 12.8m12.8-12.8a9 9 0 0 0 0 12.8",
      key: "seams",
    },
  ],
]);
