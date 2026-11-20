const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => clamp(v) ** 2 * (3 - 2 * clamp(v));

export function studioFrame(progress: number, count: number) {
  const t = clamp(progress) * count;
  const index = Math.min(count - 1, Math.floor(t));
  const phase = t - index;
  const turn = smooth(phase / 0.84);
  const blend = index < count - 1 ? smooth((phase - 0.8) / 0.2) : 0;
  return {
    index,
    turn,
    blend,
    active: index + Number(blend >= 0.5),
    yaw: 0.37 + turn * Math.PI * 2,
    tilt: 0.24 + Math.sin(turn * Math.PI * 2) * 1.01,
  };
}

export function chapterStart(index: number, count: number) {
  return (index + 0.045) / count;
}
