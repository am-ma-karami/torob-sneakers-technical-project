"""Bake the four introductory GLBs from the product photography in photos.json.

Install Pillow and NumPy, then run:
  python scripts/studio/build_models.py /path/to/originals
The input directory contains one folder per product slug with the original
lateral, medial, top, outsole and heel files, named by view (e.g. top.jpg).
For entries with a front reference in photos.json also supply front.jpg.
No image-processing dependencies or camera reconstruction run in the browser.
"""

import argparse
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "frontend/public"
MANIFEST = ROOT / "frontend/src/components/shoe-studio/photos.json"
# Rotate the plan views so the longitudinal axis always runs heel to toe.
# The floor guides are measured on a 400px reference of the uncropped source.
CALIBRATION = {
    "40586": {"top_rotation": -90, "heel_oblique": True, "side_projections": True},
    "40390": {"top_rotation": 90, "top_crop": "left", "heel_crop": "left", "sole_flip": True},
    "41349": {
        "top_rotation": 90,
        "sole_rotation": -90,
        "top_crop": "left",
        "sole_crop": "left",
        "heel_crop": "left",
        "lateral_floor": [
            (34, 217),
            (40, 234),
            (50, 252),
            (60, 260),
            (75, 267),
            (95, 269),
            (120, 268),
            (150, 262),
            (175, 261),
            (190, 263),
            (211, 269),
            (230, 270),
            (252, 270),
            (280, 266),
            (300, 263),
            (320, 257),
            (340, 246),
            (350, 236),
            (360, 221),
            (364, 210),
        ],
        "medial_floor": [
            (34, 215),
            (40, 223),
            (50, 234),
            (70, 250),
            (90, 259),
            (115, 266),
            (140, 270),
            (165, 270),
            (200, 267),
            (230, 266),
            (260, 268),
            (300, 270),
            (325, 270),
            (340, 268),
            (350, 261),
            (356, 251),
            (365, 220),
        ],
    },
    "40830": {
        "side_projections": True,
        "top_flip_vertical": True,
        "top_crop": "upper",
        "heel_crop": "left",
        "lateral_floor": [
            (14, 270),
            (20, 282),
            (30, 292),
            (40, 298),
            (60, 305),
            (80, 309),
            (103, 311),
            (135, 311),
            (153, 310),
            (167, 306),
            (190, 306),
            (201, 307),
            (217, 311),
            (242, 313),
            (265, 313),
            (280, 312),
            (300, 308),
            (320, 301),
            (340, 292),
            (360, 279),
            (372, 268),
            (380, 257),
            (385, 244),
        ],
        "medial_floor": [
            (13, 247),
            (20, 262),
            (30, 273),
            (50, 289),
            (70, 301),
            (90, 308),
            (111, 313),
            (135, 313),
            (156, 312),
            (178, 310),
            (200, 310),
            (235, 310),
            (265, 311),
            (290, 312),
            (312, 312),
            (332, 310),
            (350, 304),
            (370, 291),
            (382, 280),
            (386, 272),
        ],
    },
}


# Camera yaw, elevation and roll of the toe-facing reference shots (degrees).
# The polygons isolate the nearer shoe in a pair, in a 600-pixel-wide source.
FRONT_VIEWS = {
    "40586": {"angles": (48.5, 20, 3), "flip": True},
    "40830": {
        "angles": (49, 3.5, 0),
        "outline": [
            (24, 403),
            (36, 381),
            (51, 328),
            (58, 299),
            (60, 252),
            (66, 243),
            (82, 240),
            (98, 244),
            (113, 258),
            (120, 243),
            (130, 237),
            (152, 233),
            (184, 233),
            (200, 238),
            (208, 251),
            (222, 263),
            (241, 288),
            (254, 297),
            (280, 307),
            (302, 325),
            (327, 341),
            (352, 345),
            (375, 351),
            (386, 360),
            (395, 378),
            (400, 399),
            (399, 413),
            (388, 429),
            (372, 442),
            (346, 451),
            (303, 457),
            (257, 462),
            (212, 467),
            (177, 471),
            (148, 468),
            (130, 455),
            (116, 451),
            (99, 453),
            (64, 449),
            (44, 445),
            (29, 433),
            (24, 417),
        ],
    },
    "41349": {
        "angles": (47.5, 12.5, -7.5),
        "outline": [
            (50, 299),
            (64, 286),
            (72, 280),
            (78, 225),
            (82, 204),
            (81, 186),
            (88, 177),
            (102, 174),
            (122, 180),
            (149, 205),
            (155, 197),
            (157, 175),
            (166, 159),
            (178, 156),
            (198, 161),
            (218, 175),
            (234, 187),
            (245, 202),
            (261, 216),
            (279, 239),
            (302, 253),
            (326, 269),
            (361, 283),
            (391, 292),
            (422, 294),
            (437, 300),
            (444, 312),
            (448, 330),
            (446, 346),
            (435, 360),
            (415, 374),
            (387, 386),
            (350, 401),
            (309, 416),
            (274, 421),
            (233, 421),
            (205, 418),
            (179, 401),
            (166, 386),
            (141, 382),
            (99, 381),
            (77, 376),
            (64, 368),
            (57, 356),
            (53, 339),
        ],
    },
}


def bounds(mask):
    valid = mask.any(axis=0)
    left, right = np.flatnonzero(valid)[[0, -1]]
    xs = np.arange(left, right + 1)
    first = np.interp(xs, np.flatnonzero(valid), np.argmax(mask, axis=0)[valid])
    last = np.interp(xs, np.flatnonzero(valid), mask.shape[0] - 1 - np.argmax(mask[::-1], axis=0)[valid])
    return xs, first, last


def smooth(values, radius):
    kernel = np.exp(-0.5 * (np.arange(-radius, radius + 1) / (radius / 2)) ** 2)
    return np.convolve(np.pad(values, radius, mode="edge"), kernel / kernel.sum(), mode="valid")


class Projection:
    def __init__(
        self, path, *, crop=None, rotation=0, flip=False, flip_vertical=False, floor=None, outline=None
    ):
        photo = Image.open(path).convert("RGBA")
        photo.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        w, h = photo.size
        if crop == "left":
            photo = photo.crop((0, 0, w // 2, h))
        if crop == "upper":
            photo = photo.crop((0, 0, w, h // 2))
        if rotation:
            photo = photo.rotate(rotation, expand=True)
        if flip_vertical:
            photo = photo.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        a = np.array(photo)
        rgb = a[:, :, :3].astype(float)
        if a[:, :, 3].min() < 200:
            mask = a[:, :, 3] >= 235  # retailer PNGs include translucent floor shadows
        else:
            mask = (rgb.min(axis=2) < 227) | (np.ptp(rgb, axis=2) > 14)
        if outline:
            foreground = Image.new("1", photo.size)
            ImageDraw.Draw(foreground).polygon([(px * w / 600, py * w / 600) for px, py in outline], fill=1)
            mask &= np.asarray(foreground)
        if floor:
            xx, yy = np.asarray(floor).T * (w / 400)
            floor_y = np.interp(np.arange(w), xx, yy)
            mask &= (np.arange(w) >= xx[0]) & (np.arange(w) <= xx[-1])
            mask &= np.arange(h)[:, None] <= floor_y
        if flip:
            rgb, mask = rgb[:, ::-1], mask[:, ::-1]
        # Reject disconnected highlights and floor speckles before extracting the silhouette.
        mask = np.asarray(Image.fromarray(mask).convert("L").filter(ImageFilter.MedianFilter(5))) > 127
        xs, lo, hi = bounds(mask)
        y0, y1 = int(lo.min()), int(hi.max()) + 1
        self.rgb = rgb[y0:y1, xs[0] : xs[-1] + 1].astype(np.uint8)
        self.lo = smooth(lo - y0, 3)
        self.hi = np.maximum(self.lo + 1, smooth(hi - y0, 3))
        self.length = len(xs)
        self.height = y1 - y0
        # The floor mask may exclude white foam inside the shoe. Use the filled
        # side silhouette for end curves so highlights cannot notch the heel wall.
        y = np.arange(self.height)[:, None]
        _, first, _ = bounds(((y >= np.floor(self.lo)) & (y <= np.ceil(self.hi))).T)
        self.rear = smooth(first, 4) / (self.length - 1)
        self.crown = smooth(self.lo, max(5, int(0.022 * self.length)))

    def edges(self, u):
        indices = np.arange(self.length)
        x = u * (self.length - 1)
        return np.interp(x, indices, self.lo), np.interp(x, indices, self.hi)

    def sample(self, u, depth):
        lo, hi = self.edges(u)
        # Sample just inside the cut line to avoid white matting along UV seams.
        margin = np.minimum(2.5, (hi - lo) * 0.2)
        y = lo + margin + np.clip(depth, 0, 1) * (hi - lo - 2 * margin)
        x = np.broadcast_to(u * (self.length - 1), y.shape)
        x0, y0 = x.astype(int), np.clip(y.astype(int), 0, self.height - 1)
        x1, y1 = np.minimum(x0 + 1, self.length - 1), np.minimum(y0 + 1, self.height - 1)
        fx, fy = (x - x0)[..., None], (y - y0)[..., None]
        return (1 - fy) * ((1 - fx) * self.rgb[y0, x0] + fx * self.rgb[y0, x1]) + fy * (
            (1 - fx) * self.rgb[y1, x0] + fx * self.rgb[y1, x1]
        )

    def project(self, u, y):
        """Project a point in normalized image space onto original photo pixels."""
        u = np.clip(u, 0, 1)
        lo, hi = self.edges(u)
        return self.sample(u, (y * (self.height - 1) - lo) / np.maximum(1, hi - lo))

    def poster(self, target):
        y = np.arange(self.height)[:, None]
        alpha = np.clip(np.minimum(y - self.lo, self.hi - y) + 0.5, 0, 1)
        img = Image.fromarray(self.rgb)
        img.putalpha(Image.fromarray((255 * alpha).astype("uint8")))
        img.thumbnail((1152, 780), Image.Resampling.LANCZOS)
        out = Image.new("RGBA", (1200, 800))
        out.paste(img, ((out.width - img.width) // 2, (out.height - img.height) // 2))
        out.save(target, quality=94, method=6)


def ease(low, high, x):
    t = np.clip((x - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def surface(views, u, v, cfg):
    # Lofts follow the upper and outsole separately, including toe spring, asymmetric
    # forefoot, flared heel and the dip of the collar visible in the side profile.
    side, top, sole = (views[key] for key in ("lateral", "top", "outsole"))
    a = np.minimum(v, 1 - v) * 2
    sign = np.where(v <= 0.5, 1, -1)
    angle = a * np.pi
    height = (1 + np.sign(np.cos(angle)) * np.abs(np.cos(angle)) ** 0.91) / 2
    radius = np.sin(angle).clip(0, 1) ** 0.55 * (0.92 + 0.08 * (1 - height))
    xs = np.arange(side.length) / (side.length - 1)
    # Rear collar and front toe occupy different longitudinal stations at each height.
    # Mapping their end curves onto the measured side silhouette gives a rounded
    # heel wall instead of closing every ring on one pointed rear vertex.
    heel_peak = xs[: side.length // 4][side.crown[: side.length // 4].argmin()]
    toe = ease(0.62, 0.76, u)
    crown_u = u + heel_peak * (1 - ease(0, 0.32, u))
    upper = np.interp(crown_u, xs, side.crown)
    roof, _ = side.edges(u)
    upper += toe * (roof - upper)
    _, floor = side.edges((1 - toe) * (0.019 + 0.961 * u) + toe * u)
    y = (side.height - floor + height * (floor - upper)) / side.length
    pixel_y = side.height - y * side.length
    lines = np.arange(len(side.rear))
    x = u + np.minimum(heel_peak, np.interp(pixel_y, lines, side.rear)) * (1 - ease(0, 0.26, u))
    width_lo, width_hi = top.edges(u)
    sole_lo, sole_hi = sole.edges(u)
    top_width = (width_hi - width_lo) / top.length
    sole_width = (sole_hi - sole_lo) / sole.length
    # Both sides meet on the end curves. Inside the footprint, retain the measured width.
    taper = np.sqrt(np.minimum(1, u / 0.012))
    width = (sole_width + (top_width - sole_width) * height) * taper
    offset = ((width_hi + width_lo) / 2 - top.height / 2) / top.length
    if cfg.get("side_projections"):
        # A fitted upper sits inside the flared midsole. The studio top views
        # locate the collar rim and the recessed footbed from heel to tongue.
        radius = radius * (1 - 0.115 * ease(0.36, 0.86, height) * (1 - ease(0.38, 0.62, x)))
        collar_radius = np.sqrt(((x - 0.246) / 0.192) ** 2 + (radius / 0.78) ** 2)
        opening = 1 - ease(0.68, 1.0, collar_radius)
        footbed = (side.height - floor) / side.length + 0.09
        y -= np.maximum(0, y - footbed) * opening * height**2
    else:
        opening = np.exp(-(((x - 0.205) / 0.115) ** 4)) * np.exp(-((radius / 0.63) ** 4))
        y -= 0.065 * opening * height**4
    # At the toe, side and overhead silhouettes constrain the *same* station.
    # Rescaling x independently for each height used to fold the rubber over
    # itself. Let the plan outline supply the taper and the side outline the rise.
    cap_radius = np.sin(angle).clip(0, 1) ** np.where(height > 0.5, 0.82, 0.53)
    radius = radius + toe * (cap_radius - radius)
    width = width + toe * (top_width - width)
    close = np.sqrt(np.minimum(1, (1 - u) * (side.length - 1)))
    middle = (side.height - (roof + floor) / 2) / side.length
    y = middle + close * (y - middle)
    z = radius * sign * width * close / 2 + offset
    return np.stack(np.broadcast_arrays(x - 0.5, y - 0.19, z), axis=-1), height, radius * sign


def front_camera(vertices, angles):
    yaw, elevation, roll = np.deg2rad(angles)
    forward = np.array([np.sin(yaw) * np.cos(elevation), np.sin(elevation), np.cos(yaw) * np.cos(elevation)])
    right = np.array([np.cos(yaw), 0, -np.sin(yaw)])
    up = np.cross(forward, right)
    axes = np.stack(
        (right * np.cos(roll) + up * np.sin(roll), up * np.cos(roll) - right * np.sin(roll)), axis=-1
    )
    silhouette = vertices @ axes
    return axes, silhouette.min(axis=0), np.ptp(silhouette, axis=0), forward


def projected_edges(vertices, triangles, camera):
    # Register both edges in each column, so rubber that wraps over the front
    # lip stays above the tread and a neighboring shoe cannot bleed into it.
    axes, origin, extent, _ = camera
    size = 512
    coords = (vertices @ axes - origin) / extent
    coords[:, 1] = 1 - coords[:, 1]
    coords = np.rint(coords * (size - 1)).astype(int)
    mask = Image.new("1", (size, size))
    draw = ImageDraw.Draw(mask)
    for triangle in coords[triangles.reshape(-1, 3)]:
        draw.polygon([tuple(p) for p in triangle], fill=1)
    xs, lo, hi = bounds(np.asarray(mask))
    return xs / (size - 1), lo / (size - 1), hi / (size - 1)


def atlas(views, cfg, vertices, triangles, front):
    w, h = 1536, 896
    u = (np.arange(w)[None, :] + 0.5) / w
    rows = []
    toe_camera = front_camera(vertices, front["angles"]) if front else None
    if toe_camera is not None:
        columns, roofline, groundline = projected_edges(vertices, triangles, toe_camera)
    rear_view = None
    if cfg.get("heel_oblique"):
        # This catalog frame looks forward from the outer rear quarter. Register
        # its axes against the mesh bounds before projecting the heel counter.
        right = np.array([0.70, 0, 0.714])
        up = np.array([0.20, 0.960, -0.196])
        screen = np.stack((right, up), axis=-1)
        corners = vertices @ screen
        origin, extent = corners.min(axis=0), np.ptp(corners, axis=0)
        rear_view = (screen, origin, extent)
    for row in range(0, h, 32):
        v = (np.arange(row, min(h, row + 32))[:, None] + 0.5) / h
        pos, height, across = surface(views, u, v, cfg)
        x = np.clip(pos[:, :, 0] + 0.5, 0, 1)
        world_y = pos[:, :, 1] + 0.19
        side = views["lateral"]
        image_y = 1 - world_y * side.length / side.height
        outer = side.project(x, image_y)
        inner = views["medial"].project(x, image_y)
        color = np.where((v < 0.5)[..., None], outer, inner)
        for view, depth, weight in [
            ("top", 0.5 + 0.5 * across, ease(0.82, 0.96, height)),
            ("outsole", 0.5 - 0.5 * across, 1 - ease(0.01, 0.055, height)),
        ]:
            weight = weight[..., None]
            plan_x = x
            if view == "top" and cfg.get("side_projections"):
                # Register the visible tongue against the top photo; the raised
                # tongue otherwise inherits lettering from the recessed insole.
                tongue = 0.51 if cfg.get("heel_oblique") else 0.47
                plan_x = np.interp(x, [0, 0.16, 0.395, 0.70, 1], [0, 0.16, tongue, 0.72, 1])
            color = (1 - weight) * color + weight * views[view].sample(plan_x, depth)
        if not cfg.get("heel_oblique"):
            heel = views["heel"]
            heel_width = 0.31
            heel_height = heel_width * heel.height / heel.length
            heel_u = 0.5 + pos[:, :, 2] / heel_width
            rear = heel.project(heel_u, 1 - world_y / heel_height)
            weight = ((1 - ease(0.035, 0.17, u)) * (1 - ease(0.92, 1, height)))[..., None]
            color = color * (1 - weight) + rear * weight
        normal = np.cross(np.gradient(pos, axis=0), np.gradient(pos, axis=1))
        normal /= np.maximum(1e-9, np.linalg.norm(normal, axis=2, keepdims=True))
        if rear_view is not None:
            screen, origin, extent = rear_view
            pixels = (pos @ screen - origin) / extent
            heel_color = views["heel"].project(pixels[:, :, 0], 1 - pixels[:, :, 1])
            weight = ((1 - ease(0.11, 0.26, x)) * ease(0.03, 0.62, -normal[:, :, 0]))[..., None]
            color = color * (1 - weight) + heel_color * weight
        if toe_camera is not None:
            axes, origin, extent, forward = toe_camera
            pixels = (pos @ axes - origin) / extent
            column = np.clip(pixels[:, :, 0], 0, 1)
            roof = np.interp(column, columns, roofline)
            floor = np.interp(column, columns, groundline)
            depth = (1 - pixels[:, :, 1] - roof) / np.maximum(floor - roof, 1 / 512)
            front_color = views["front"].sample(column, depth)
            visibility = ease(-0.16, 0.20, normal @ forward)
            # Carry the continuous forefoot markings from the same photograph
            # across the outer vamp, before they reach the toe bumper.
            weight = (ease(0.25, 0.46, x) * visibility)[..., None]
            color += weight * (front_color - color)
        else:
            # The Pegasus set has no toe-facing photo. Wrap the photographed
            # toe mesh and outsole around the pole; the reflective side mark
            # belongs only on the side wall.
            plan_x = np.minimum(x, 0.981)
            z = pos[:, :, 2]
            top, sole = views["top"], views["outsole"]
            upper = top.project(plan_x, 0.5 + z * top.length / top.height)
            tread = sole.project(plan_x, 0.5 - z * sole.length / sole.height)
            lower_face = (1 - ease(0.055, 0.20, height))[..., None]
            toe_color = upper + lower_face * (tread - upper)
            crown = 1 - ease(0.42, 0.88, np.abs(across))
            center = crown + (1 - crown) * ease(0.985, 0.999, x)
            weight = (ease(0.90, 0.984, x) * center)[..., None]
            color += weight * (toe_color - color)
        rows.append(np.clip(color, 0, 255).astype(np.uint8))
    projection = None
    if cfg.get("side_projections"):
        # The viewer can sample the original sides through the moving geometry.
        # Leave the baked UV island valid for ordinary, unmodified glTF viewers.
        photo_rows = 624
        for view in ("lateral", "medial"):
            image = views[view]
            for row in range(0, photo_rows, 32):
                y = (np.arange(row, min(row + 32, photo_rows))[:, None] + 0.5) / photo_rows
                rows.append(image.project(np.broadcast_to(u, (len(y), w)), y).clip(0, 255).astype(np.uint8))
        total = h + 2 * photo_rows
        projection = dict(
            base=h / total,
            band=photo_rows / total,
            heights=[views[v].height / views[v].length for v in ("lateral", "medial")],
        )
    output = io.BytesIO()
    Image.fromarray(np.concatenate(rows)).save(output, "JPEG", quality=92, subsampling=0, optimize=True)
    return output.getvalue(), projection


def export_glb(path, views, cfg, front):
    # Concentrate stations near the ends so heel and toe have round silhouettes.
    n, m = 118, 88
    u = (1 - np.cos(np.linspace(0, np.pi, n))) / 2
    v = np.linspace(0, 1, m + 1)
    uu, vv = np.meshgrid(u, v, indexing="ij")
    pos, _, _ = surface(views, uu, vv, cfg)
    du = np.gradient(pos, axis=0)
    dv = np.roll(pos[:, :-1], -1, axis=1) - np.roll(pos[:, :-1], 1, axis=1)
    dv = np.concatenate((dv, dv[:, :1]), axis=1)
    normals = np.cross(dv, du)
    normals /= np.maximum(np.linalg.norm(normals, axis=2, keepdims=True), 1e-10)
    normals[0], normals[-1] = [-1, 0, 0], [1, 0, 0]
    i, j = np.meshgrid(np.arange(n - 1), np.arange(m), indexing="ij")
    a = i * (m + 1) + j
    b = a + m + 1
    indices = np.stack((a, a + 1, b, b, a + 1, b + 1), axis=-1).astype("<u2").ravel()
    positions = pos.reshape(-1, 3).astype("<f4")
    texture, projection = atlas(views, cfg, positions, indices, front)
    base_v = vv * projection["base"] if projection else vv
    chunks = [
        positions.tobytes(),
        normals.astype("<f4").tobytes(),
        np.stack((uu, base_v), axis=-1).astype("<f4").tobytes(),
        indices.tobytes(),
        texture,
    ]
    blob = bytearray()
    buffers = []
    for chunk in chunks:
        buffers.append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(chunk)})
        blob.extend(chunk)
        blob.extend(bytes(-len(blob) % 4))
    access = [
        {"bufferView": i, "componentType": 5126, "count": len(positions), "type": t}
        for i, t in enumerate(["VEC3", "VEC3", "VEC2"])
    ]
    access[0].update(min=positions.min(axis=0).tolist(), max=positions.max(axis=0).tolist())
    access.append({"bufferView": 3, "componentType": 5123, "count": len(indices), "type": "SCALAR"})
    gltf = {
        "asset": {"version": "2.0", "generator": "Rad photographic silhouette loft"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [
            {
                "primitives": [
                    {"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": 3, "material": 0}
                ]
            }
        ],
        "materials": [
            {
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "roughnessFactor": 1,
                    "metallicFactor": 0,
                }
            }
        ],
        "textures": [{"source": 0, "sampler": 0}],
        "images": [{"bufferView": 4, "mimeType": "image/jpeg"}],
        "samplers": [{"wrapS": 33071, "wrapT": 33071, "minFilter": 9987, "magFilter": 9729}],
        "accessors": access,
        "bufferViews": buffers,
        "buffers": [{"byteLength": len(blob)}],
    }
    if projection:
        gltf["scenes"][0]["extras"] = {"sideProjection": projection}
    meta = json.dumps(gltf, separators=(",", ":")).encode()
    meta += b" " * (-len(meta) % 4)
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2, 28 + len(meta) + len(blob))
        + struct.pack("<I4s", len(meta), b"JSON")
        + meta
        + struct.pack("<I4s", len(blob), b"BIN\0")
        + blob
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("originals", type=Path)
    args = parser.parse_args()
    for key, entry in json.loads(MANIFEST.read_text()).items():
        folder = Path(entry["shots"][0]["src"]).parent
        source = args.originals / folder.name
        cfg = CALIBRATION[key]
        views = {}
        for view in ("lateral", "medial", "top", "outsole", "heel"):
            opts = "sole" if view == "outsole" else view
            views[view] = Projection(
                next(source.glob(view + ".*")),
                crop=cfg.get(opts + "_crop"),
                rotation=cfg.get(opts + "_rotation", 0),
                flip=(view == "medial" or cfg.get(opts + "_flip", False)),
                floor=cfg.get(opts + "_floor"),
                flip_vertical=cfg.get(opts + "_flip_vertical", False),
            )
        front = FRONT_VIEWS.get(key)
        if front:
            views["front"] = Projection(
                next(source.glob("front.*")), flip=front.get("flip", False), outline=front.get("outline")
            )
        target = PUBLIC / folder.relative_to("/")
        views["lateral"].poster(target / "lateral.webp")
        export_glb(target / "shoe.glb", views, cfg, front)
        print(folder.name, (target / "shoe.glb").stat().st_size)


if __name__ == "__main__":
    main()
