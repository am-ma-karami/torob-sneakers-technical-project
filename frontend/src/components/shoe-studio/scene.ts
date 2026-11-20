import * as THREE from "three";
import { buildShoe } from "./models";
import { studioFrame } from "./sequence";

function shadow() {
  const image = document.createElement("canvas");
  image.width = image.height = 64;
  const ctx = image.getContext("2d")!;
  const falloff = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  falloff.addColorStop(0, "#000c");
  falloff.addColorStop(0.55, "#0006");
  falloff.addColorStop(1, "#0000");
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(image);
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.4), material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.64;
  return ground;
}

export function createShoeScene(canvas: HTMLCanvasElement, ids: number[]) {
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  if (!context) throw new Error("WebGL2 unavailable");
  const renderer = new THREE.WebGLRenderer({
    context,
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  scene.add(new THREE.HemisphereLight("#d6e6ff", "#746459", 1.3));
  const light = (
    color: string,
    intensity: number,
    position: [number, number, number],
  ) => {
    const directional = new THREE.DirectionalLight(color, intensity);
    directional.position.set(...position);
    scene.add(directional);
    return directional;
  };
  const key = light("#fff0df", 3.3, [2, 4, 4]);
  light("#ceecff", 1.35, [-3, 1.8, 3]);
  light("#9ec9ff", 3.7, [-2, 3, -4]);
  light("#dce4ff", 2.2, [0, -2, 2]);
  const ground = shadow();
  scene.add(ground);
  const shoes: (THREE.Group | undefined)[] = [];
  function prepare(i: number) {
    const existing = shoes[i];
    if (existing) return existing;
    const shoe = buildShoe(ids[i]);
    const pivot = new THREE.Group();
    pivot.add(shoe);
    pivot.visible = false;
    scene.add(pivot);
    shoes[i] = pivot;
    return pivot;
  }

  const initial = studioFrame(0, ids.length);
  let lastWidth = 0,
    lastHeight = 0;
  function draw(progress: number) {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    if (width !== lastWidth || height !== lastHeight) {
      lastWidth = width;
      lastHeight = height;
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, width < 600 ? 1.35 : 1.65),
      );
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    const { index, blend, yaw, tilt, turn } = studioFrame(progress, ids.length);
    const distance =
      Math.max(5.18, 6.12 / camera.aspect) + Math.abs(tilt) * 0.51;
    camera.position.set(0, 0.47 + Math.sin(turn * Math.PI) * 0.13, distance);
    camera.lookAt(0, -0.02, 0);
    key.position.x = 2.6 - Math.sin(turn * Math.PI) * 2.2;
    shoes.forEach((shoe) => {
      if (shoe) shoe.visible = false;
    });

    const outgoing = prepare(index);
    outgoing.visible = true;
    outgoing.rotation.x = tilt - 0.3 * blend;
    outgoing.children[0].rotation.y = yaw + 0.44 * blend;
    outgoing.position.set(-blend * 2.65, -0.58 * blend, -2.2 * blend);
    outgoing.scale.setScalar(1 - blend ** 2);

    if (blend > 0) {
      const incoming = prepare(index + 1);
      const remaining = 1 - blend;
      incoming.visible = true;
      incoming.rotation.x = initial.tilt + 0.26 * remaining;
      incoming.children[0].rotation.y = initial.yaw - 0.52 * remaining;
      incoming.position.set(
        remaining * 2.55,
        0.42 * remaining,
        -2.1 * remaining,
      );
      incoming.scale.setScalar(1 - remaining ** 2);
    }
    ground.scale.setScalar(1 - 0.21 * Math.sin(blend * Math.PI));
    ground.material.opacity =
      0.8 - 0.35 * Math.abs(Math.sin(turn * Math.PI * 2));
    renderer.render(scene, camera);
  }
  return {
    draw,
    prepare,
    dispose() {
      scene.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        part.geometry.dispose();
        const mat = part.material as THREE.MeshStandardMaterial;
        mat.map?.dispose();
        mat.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
