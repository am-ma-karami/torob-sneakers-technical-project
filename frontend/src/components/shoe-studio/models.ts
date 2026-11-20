import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Model = {
  upper: string;
  sole: string;
  rubber: string;
  trim: string;
  laces: string;
  length: number;
  width: number;
  stack: number;
  rocker: number;
  heel: number;
  collar: number;
  sculpt: number;
};

const models: Record<number, Model> = {
  40586: {
    upper: "#27292c",
    sole: "#25282c",
    rubber: "#17191c",
    trim: "#383a40",
    laces: "#37393d",
    length: 1.49,
    width: 0.545,
    stack: 0.33,
    rocker: 0.17,
    heel: 0.1,
    collar: 0.48,
    sculpt: 0.022,
  },
  40390: {
    upper: "#24262b",
    sole: "#e1e1e3",
    rubber: "#202128",
    trim: "#393b41",
    laces: "#393b41",
    length: 1.46,
    width: 0.55,
    stack: 0.34,
    rocker: 0.122,
    heel: 0.17,
    collar: 0.51,
    sculpt: 0.048,
  },
  41349: {
    upper: "#dbd0bd",
    sole: "#e2d5ba",
    rubber: "#b2c681",
    trim: "#f0e1cb",
    laces: "#e9ddc5",
    length: 1.48,
    width: 0.59,
    stack: 0.42,
    rocker: 0.18,
    heel: 0.12,
    collar: 0.49,
    sculpt: 0.068,
  },
  40830: {
    upper: "#cbe747",
    sole: "#ece9dc",
    rubber: "#273b92",
    trim: "#b5d62a",
    laces: "#def267",
    length: 1.47,
    width: 0.56,
    stack: 0.37,
    rocker: 0.21,
    heel: 0.13,
    collar: 0.47,
    sculpt: 0.052,
  },
};

const turn = Math.PI * 2;
const mix = THREE.MathUtils.lerp;

/** The model coordinates are artistic proportions, independent of measured catalog values. */
function ringPoint(
  length: number,
  width: number,
  theta: number,
  center = 0,
  footShape = 1,
) {
  const t = Math.cos(theta);
  const waist =
    0.83 +
    0.19 * Math.exp(-((t - 0.48) ** 2) / 0.14) -
    0.18 * Math.exp(-((t + 0.17) ** 2) / 0.075);
  const offset = 0.085 * t + 0.03 * Math.sin(t * Math.PI);
  return new THREE.Vector3(
    center + length * t,
    0,
    width * Math.sin(theta) * mix(1, waist, footShape) + offset * footShape,
  );
}

function loft(
  rows: number,
  sample: (row: number, angle: number) => THREE.Vector3,
  unwrap = false,
) {
  const segments = 112;
  const columns = segments + Number(unwrap);
  const positions: number[] = [],
    uv: number[] = [],
    index: number[] = [];
  // Wrap the indices to keep smooth normals at the toe seam.
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x < columns; x++) {
      const p = sample(y / rows, (x / segments) * turn);
      positions.push(p.x, p.y, p.z);
      uv.push(
        unwrap ? x / segments : (p.x + 1.6) / 3.2,
        unwrap ? y / rows : (p.z + 0.7) / 1.4,
      );
      if (y === rows || x === segments) continue;
      const a = y * columns + x,
        b = y * columns + ((x + 1) % columns);
      index.push(a, a + columns, b, b, a + columns, b + columns);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  if (unwrap) {
    const normals = geometry.getAttribute("normal");
    const a = new THREE.Vector3(),
      b = new THREE.Vector3();
    for (let y = 0; y <= rows; y++) {
      const first = y * columns,
        last = first + segments;
      a.fromBufferAttribute(normals, first)
        .add(b.fromBufferAttribute(normals, last))
        .normalize();
      normals.setXYZ(first, a.x, a.y, a.z);
      normals.setXYZ(last, a.x, a.y, a.z);
    }
  }
  return geometry;
}

function textile(
  id: number,
  model: Model,
  sample: (row: number, angle: number) => THREE.Vector3,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.scale(canvas.width / 100, canvas.height / 100);
  const fill = (path: string, color: string) => {
    ctx.fillStyle = color;
    ctx.fill(new Path2D(path));
  };
  const seam = (path: string, color: string, width = 0.7) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(path));
  };
  fill("M0 5 L15 25 Q17 53 28 68 L31 100 H0Z", model.trim);
  seam("M12 28 Q15 49 25 59 T28 90", model.upper);
  seam("M76 70 Q88 61 98 64", model.trim, 1.2);
  if (id === 40586) {
    for (let i = 0; i < 3; ++i) {
      ctx.save();
      ctx.translate(i * 13, i * 2.8);
      fill("M22 74 L57 42 L65 44 L34 77Z", "#f0f1ef");
      ctx.restore();
    }
  } else if (id === 40390) {
    fill(
      "M39 44 C32 52 31 62 38 64 C44 66 55 59 70 50 L82 42 L52 53 C41 57 36 53 39 44 Z",
      "#f3f3ef",
    );
    seam("M12 58 L19 59 M85 69 L90 67", "#757779", 1.3);
  } else if (id === 41349) {
    seam(
      "M15 45 C30 47 40 58 60 50 C69 47 76 52 83 68 M16 51 C30 51 40 64 59 56 Q70 52 77 72",
      "#9a6b5f",
      2.35,
    );
    seam("M51 39 Q42 55 42 67 M59 42 Q53 54 55 71", "#9a6b5f", 2.25);
  } else {
    fill(
      "M17 41 Q33 55 48 53 T66 41 Q70 43 78 49 Q71 47 64 51 Q49 68 38 58 Q27 55 17 41Z",
      "#375291",
    );
    seam("M19 43 Q38 60 54 54 T70 44", "#c5d770", 1.35);
    for (let n = 0; n < 3; n++) {
      ctx.beginPath();
      ctx.ellipse(47 + n * 5, 56 - n * 3.4, 1.6, 2.1, 0, 0, turn);
      ctx.stroke();
    }
  }
  ctx.restore();
  const { width, height } = canvas;
  const decals = ctx.getImageData(0, 0, width, height).data;
  const atlas = ctx.createImageData(width, height);
  const base = model.upper
    .slice(1)
    .match(/../g)!
    .map((channel) => parseInt(channel, 16));
  const profile = new THREE.Vector3();
  for (let y = 0; y < height; y++) {
    const row = 1 - y / (height - 1);
    for (let x = 0; x < width; x++) {
      const angle = (x / (width - 1)) * turn;
      profile.copy(sample(row, angle));
      const px = Math.min(
        width - 1,
        Math.max(0, Math.round(((profile.x + 1.6) / 3.2) * width)),
      );
      const py = Math.min(
        height - 1,
        Math.max(0, Math.round((1 - (profile.y + 0.16) / 0.8) * height)),
      );
      const decal = (py * width + px) * 4;
      const opacity =
        (decals[decal + 3] / 255) *
        THREE.MathUtils.smoothstep(Math.abs(Math.sin(angle)), 0.2, 0.58) *
        (1 - THREE.MathUtils.smoothstep(row, 0.81, 0.98));
      const weave = Math.sin(x * 2.2 + y * 1.4) * Math.cos(y * 2.13) * 13;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; ++c)
        atlas.data[i + c] =
          mix(base[c], decals[decal + c], opacity) +
          weave * (1 - 0.78 * opacity);
      atlas.data[i + 3] = 255;
    }
  }
  ctx.putImageData(atlas, 0, 0);
  const color = new THREE.CanvasTexture(canvas);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 4;
  return color;
}

export function buildShoe(id: number) {
  const model = models[id];
  const shoe = new THREE.Group();
  const material = (color: string, roughness = 0.87) =>
    new THREE.MeshStandardMaterial({ color, roughness });
  const foam = material(model.sole, 0.72);
  const rubber = material(model.rubber);
  const trim = material(model.trim);
  const lining = material(
    id === 40830 ? "#294da3" : id === 41349 ? "#c5b69d" : "#282a30",
  );
  const lace = material(model.laces, 0.78);
  const soleTop = (x: number) =>
    -0.09 + (0.085 * (1 - x)) / 2 + 0.06 * Math.max(0, x) ** 4;
  const soleBottom = (x: number) =>
    soleTop(x) -
    model.stack +
    0.05 * x +
    model.rocker * Math.max(0, x) ** 5 +
    model.heel * Math.max(0, -x) ** 6;
  function mesh(
    name: string,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
  ) {
    const part = new THREE.Mesh(geometry, mat);
    part.name = name;
    shoe.add(part);
  }

  // Outsole, rounded foam wall, and cap all share one last so the join stays closed.
  const midsoles = id === 40830 ? [0, 0.74, 1] : [0, 1];
  for (let i = 0; i < midsoles.length - 1; i++) {
    mesh(
      "Sculpted midsole",
      loft(16, (row, theta) => {
        const t = Math.cos(theta);
        const v = mix(midsoles[i], midsoles[i + 1], row);
        const bevel = 0.93 + Math.sin(v * Math.PI) * 0.09;
        const p = ringPoint(model.length * bevel, model.width * bevel, theta);
        const wave = Math.sin(t * (id === 41349 ? 11 : 5.2) + 1) * model.sculpt;
        p.y = mix(soleBottom(t), soleTop(t), v) + Math.sin(Math.PI * v) * wave;
        p.z +=
          Math.sign(p.z) * wave * Math.sin(Math.PI * v) * Math.sin(theta) ** 2;
        return p;
      }),
      i === 0 ? foam : trim,
    );
  }
  mesh(
    "Outsole rubber",
    loft(12, (v, theta) => {
      const t = Math.cos(theta);
      // Sweep from the center of the sole out to the rubber edge, then up to the foam.
      const radius = mix(0.002, 0.93, Math.min(1, v * 1.4));
      const p = ringPoint(
        model.length * radius,
        model.width * radius,
        theta,
        0,
        radius,
      );
      p.y =
        soleBottom(v < 0.72 ? p.x / (model.length * 0.93) : t) -
        0.026 * Math.min(1, (1 - v) / 0.28);
      return p;
    }),
    rubber,
  );
  mesh(
    "Last top",
    loft(8, (v, theta) => {
      const radius = mix(0.93, 0.002, v);
      const p = ringPoint(
        model.length * radius,
        model.width * radius,
        theta,
        0,
        radius,
      );
      p.y = soleTop(Math.cos(theta)) - 0.001;
      return p;
    }),
    foam,
  );

  const tread: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const x = -0.86 + i * 0.149;
    for (const side of [-1, 1]) {
      const width =
        model.width * Math.sqrt(1 - x * x) * (Math.abs(x) < 0.33 ? 0.41 : 0.53);
      const pad = new THREE.BoxGeometry(
        (id === 40390 ? 0.116 : 0.143) - 0.033 * Math.abs(x),
        id === 40830 ? 0.018 : 0.025,
        width * (id === 40586 && Math.abs(x) < 0.32 ? 0.57 : 1),
      );
      pad.rotateY(side * (id === 40390 ? 0.14 : 0.3));
      pad.translate(
        x * model.length * 0.93,
        soleBottom(x) - 0.026,
        side * width * 0.68 + 0.085 * x,
      );
      tread.push(pad);
    }
  }
  const treadMat = material(
    id === 40586 ? "#36383b" : id === 41349 ? "#9bac71" : model.rubber,
  );
  mesh("Segmented tread", mergeGeometries(tread), treadMat);
  tread.forEach((g) => g.dispose());

  const rings = [
    // Heel, toe, half-width, height at heel / sides / toe.
    [-1.33, 1.37, model.width * 0.89, -0.009, -0.009, -0.009],
    [-1.31, 1.35, model.width * 0.87, 0.13, 0.065, 0.068],
    [-1.27, 1.3, model.width * 0.79, 0.31, 0.124, 0.117],
    [-1.24, 1.2, model.width * 0.6, model.collar, 0.21, 0.151],
    [-1.13, 0.94, model.width * 0.41, model.collar + 0.044, 0.295, 0.167],
    [-1.0, 0.58, model.width * 0.42, model.collar - 0.023, 0.32, 0.241],
    [-0.92, -0.19, model.width * 0.53, model.collar - 0.042, 0.279, 0.424],
  ];
  function upperPoint(v: number, theta: number) {
    const step = v * (rings.length - 1),
      lower = Math.min(rings.length - 2, Math.floor(step));
    const at = (i: number) => {
      const p0 = rings[Math.max(0, lower - 1)][i],
        p1 = rings[lower][i];
      const p2 = rings[lower + 1][i],
        p3 = rings[Math.min(rings.length - 1, lower + 2)][i];
      const a = step - lower;
      return (
        p1 +
        0.5 *
          a *
          (p2 -
            p0 +
            a *
              (2 * p0 - 5 * p1 + 4 * p2 - p3 + a * (3 * p1 - p0 - 3 * p2 + p3)))
      );
    };
    const heel = at(0),
      toe = at(1),
      t = Math.cos(theta);
    const p = ringPoint(
      (toe - heel) / 2,
      at(2),
      theta,
      (heel + toe) / 2,
      1 - v * 0.9,
    );
    const a = t < 0 ? at(3) : at(5);
    p.y =
      mix(at(4), a, Math.abs(t) ** (t < 0 ? 2.1 : 1.35)) +
      soleTop(p.x / model.length) * (1 - v);
    return p;
  }
  const knit = new THREE.MeshStandardMaterial({
    map: textile(id, model, upperPoint),
    roughness: 0.92,
  });
  mesh("Woven upper", loft(36, upperPoint, true), knit);
  mesh(
    "Recessed collar lining",
    loft(16, (v, theta) => {
      const p = upperPoint(1, theta);
      const inset = Math.min(1, v * 5) * 0.13 + Math.max(0, v - 0.32) * 1.278;
      p.x = mix(p.x, -0.52, inset);
      p.z = mix(p.z, -0.04, inset);
      p.y = mix(p.y, 0.006, Math.min(1, v * 1.4));
      return p;
    }),
    lining,
  );

  const tubes: THREE.BufferGeometry[] = [];
  const piping: THREE.BufferGeometry[] = [];
  const curve = (points: THREE.Vector3[], radius: number, segments = 16) =>
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      segments,
      radius,
      7,
      false,
    );
  const collar = Array.from({ length: 33 }, (_, i) =>
    upperPoint(1, (i * turn) / 32),
  );
  piping.push(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(collar.slice(0, -1), true),
      84,
      id === 40390 ? 0.026 : 0.019,
      8,
      true,
    ),
  );
  // Follow the dorsal contour to keep cross-laces against the tongue during an orbit.
  for (let i = 0; i < 7; i++) {
    const v = 0.63 + i * 0.049;
    const left = upperPoint(v, 0.37),
      right = upperPoint(v, -0.37);
    const end = upperPoint(v + 0.027, -0.37);
    const peak = upperPoint(v + 0.013, 0).add(new THREE.Vector3(0, 0.024, 0));
    tubes.push(curve([left, peak, end], 0.014));
    tubes.push(
      curve(
        [
          right,
          peak.clone().add(new THREE.Vector3(0.014, -0.008, 0)),
          upperPoint(v + 0.027, 0.37),
        ],
        0.012,
      ),
    );
    for (const tip of [left, right]) {
      const eyelet = new THREE.TorusGeometry(0.024, 0.007, 6, 16);
      eyelet.rotateX(-Math.PI / 2);
      eyelet.translate(tip.x, tip.y + 0.005, tip.z);
      piping.push(eyelet);
    }
  }
  const knot = upperPoint(0.963, 0).add(new THREE.Vector3(0.03, 0.032, 0));
  for (const side of [-1, 1]) {
    tubes.push(
      curve(
        [
          knot,
          knot.clone().add(new THREE.Vector3(-0.073, 0.023, side * 0.14)),
          knot.clone().add(new THREE.Vector3(0.045, 0.03, side * 0.114)),
          knot,
        ],
        0.011,
      ),
    );
  }
  mesh("Laces", mergeGeometries(tubes), lace);
  mesh("Eyelets and padded collar", mergeGeometries(piping), lining);
  tubes.concat(piping).forEach((g) => g.dispose());
  shoe.name = "Reference-based volumetric reconstruction";
  return shoe;
}
