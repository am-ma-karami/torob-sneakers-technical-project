import type { Shoe } from "./types";
export type Mode = "assembled" | "profile" | "fit" | "exploded";
export type Layer = {
  key: string;
  name: string;
  material: string | null;
  keys: string[];
};
export function anatomyData(shoe: Shoe) {
  const s = shoe.summary,
    m = shoe.metrics;
  const numeric = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && v > 0;
  const layers: Layer[] = [
    {
      key: "upper",
      name: "رویه",
      material: s.upper_material,
      keys: ["breathability_br", "breathability_score_5", "tongue_padding_mm"],
    },
    {
      key: "insole",
      name: "کفی داخلی",
      material:
        s.removable_insole == null
          ? null
          : s.removable_insole
            ? "قابل جداسازی"
            : "ثابت",
      keys: ["insole_thickness_mm"],
    },
    {
      key: "midsole",
      name: "زیره میانی",
      material: s.foam,
      keys: [
        "heel_stack_mm",
        "forefoot_stack_mm",
        "midsole_firmness_asker_c",
        "midsole_softness_shore_a",
      ],
    },
    {
      key: "plate",
      name: "صفحه تقویتی",
      material:
        s.plate && !["none", "False", "false"].includes(s.plate)
          ? s.plate
          : null,
      keys: [],
    },
    {
      key: "outsole",
      name: "زیره خارجی",
      material: s.outsole_material,
      keys: [
        "outsole_thickness_mm",
        "lug_depth_mm",
        "outsole_wear_mm",
        "traction_coefficient",
      ],
    },
  ]
    .map((l) => ({ ...l, keys: l.keys.filter((k) => m[k]?.value != null) }))
    .filter((l) => l.material || l.keys.length);
  const profile = numeric(s.heel_stack_mm) && numeric(s.forefoot_stack_mm);
  const fit = [
    "interior_forefoot_width_mm",
    "toebox_width_mm",
    "toebox_height_mm",
    "internal_length_mm",
  ].filter((k) => numeric(m[k]?.value));
  const modes: Mode[] = [
    ...(profile && layers.length >= 2 ? ["assembled" as const] : []),
    ...(profile ? ["profile" as const] : []),
    ...(fit.length >= 2 ? ["fit" as const] : []),
    ...(layers.length >= 2 ? ["exploded" as const] : []),
  ];
  // The profile has a common 300 mm longitudinal reference and 2 SVG units/mm.
  // Stack heights remain physical lab measurements; estimated curves stay separate.
  const scale = 2,
    length = 600,
    toe = 80,
    heel = 680,
    ground = 320;
  const rocker = numeric(s.toe_rocker_pct) && numeric(s.toe_tip_height_mm);
  const bevel = numeric(s.heel_bevel_pct) && numeric(s.heel_bevel_height_mm);
  const rockerX = rocker ? toe + (length * s.toe_rocker_pct!) / 100 : toe;
  const bevelX = bevel ? heel - (length * s.heel_bevel_pct!) / 100 : heel;
  const tipY = rocker ? ground - s.toe_tip_height_mm! * scale : ground;
  const rearY = bevel ? ground - s.heel_bevel_height_mm! * scale : ground;
  const heelY = ground - (s.heel_stack_mm || 0) * scale,
    foreY = ground - (s.forefoot_stack_mm || 0) * scale;
  const toeTop = rocker ? tipY - 24 : foreY;
  const top = `M${toe} ${toeTop} C${toe + 55} ${toeTop} ${rockerX - 50} ${foreY} ${Math.max(rockerX, 260)} ${foreY} L${Math.min(bevelX, 610)} ${heelY} Q640 ${heelY - 3} ${heel} ${rearY - 28}`;
  const bottom = `L${heel} ${rearY} Q${heel - 40} ${ground} ${bevelX} ${ground} L${rockerX} ${ground} Q${toe + 70} ${ground} ${toe} ${tipY} Z`;
  return {
    layers,
    modes,
    fit,
    profile,
    scale,
    length,
    toe,
    heel,
    ground,
    rocker,
    bevel,
    rockerX,
    bevelX,
    tipY,
    rearY,
    heelY,
    foreY,
    toeTop,
    sole: top + bottom,
    top,
  };
}
