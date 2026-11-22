import {
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
  Vector4,
  MathUtils,
  type Group,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function disposeModel(model: Group) {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial) material.map?.dispose();
      material.dispose();
    }
  });
}

// On broadside views, project the real lateral/medial photograph onto the
// silhouette. Oblique views retain the continuous, baked 3D surface.
function fitSidePhotographs(group: Group) {
  const layout = group.userData.sideProjection;
  if (!layout) return;
  const strength = { value: 1 };
  const regions = new Vector4(
    layout.base,
    layout.band,
    ...(layout.heights as [number, number]),
  );
  group.traverse((object) => {
    if (
      !(object instanceof Mesh) ||
      !(object.material instanceof MeshStandardMaterial)
    )
      return;
    object.material.onBeforeCompile = (shader) => {
      shader.uniforms.sideStrength = strength;
      shader.uniforms.sideRegions = { value: regions };
      shader.vertexShader =
        "varying vec2 sidePosition; varying vec2 sideNormal;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nsidePosition = position.xy + vec2(.5, .19); sideNormal = normal.yz;",
        );
      shader.fragmentShader =
        "varying vec2 sidePosition; varying vec2 sideNormal; uniform float sideStrength; uniform vec4 sideRegions;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        float medial = step(sideStrength, -0.0001);
        float py = clamp(1.0 - sidePosition.y/mix(sideRegions.z, sideRegions.w, medial), .001, .999);
        vec2 uvPhoto = vec2(clamp(sidePosition.x,.001,.999), sideRegions.x + (medial+py)*sideRegions.y);
        float facing = sideNormal.y * (1.0 - 2.0*medial);
        float blend = abs(sideStrength) * smoothstep(-.15,.38,facing) * smoothstep(-.94,-.55,sideNormal.x);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * texture2D(map, uvPhoto).rgb, blend);`,
        );
    };
  });
  return strength;
}

export function createOrbit(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 8);
  camera.position.z = 2;
  scene.add(new HemisphereLight(0xffffff, 0xe0e6ee, 2.7));
  const key = new DirectionalLight(0xfff5eb, 0.85);
  key.position.set(-2, 3, 4);
  scene.add(key);

  const loader = new GLTFLoader();
  const models = new Map<string, Promise<Group>>();
  const projectionStrength = new WeakMap<Group, { value: number }>();
  let active: Group | null = null;
  let requested = "";
  let disposed = false;
  let incoming: Group | null = null;
  let angle = 0;
  let handoff = 0;

  function load(url: string) {
    let model = models.get(url);
    if (!model) {
      model = loader.loadAsync(url).then(({ scene: group }) => {
        const strength = fitSidePhotographs(group);
        if (strength) projectionStrength.set(group, strength);
        return group;
      });
      models.set(url, model);
      model.catch(() => models.delete(url));
    }
    return model;
  }

  function draw() {
    if (!active) return;
    const phase = 2 * Math.PI * angle;
    const mix = incoming ? handoff * handoff * (3 - 2 * handoff) : 0;
    active.rotation.set(
      0.065 +
        0.32 * Math.sin(phase) ** 2 +
        0.12 * Math.sin(phase) -
        0.32 * Math.max(0, -Math.cos(phase)) ** 2,
      -0.065 - phase,
      -0.009,
    );
    const strength = projectionStrength.get(active);
    if (strength) {
      const broadside =
        Math.cos(active.rotation.y) * Math.cos(active.rotation.x);
      strength.value =
        Math.sign(broadside) *
        MathUtils.smoothstep(Math.abs(broadside), 0.42, 0.94);
    }
    // Two meshes share one camera. Their positions are derived solely from input.
    const travel = camera.right + 0.57;
    active.position.x = -travel * mix;
    if (incoming) {
      incoming.visible = mix > 0;
      const strength = projectionStrength.get(incoming);
      if (strength) strength.value = 1;
      incoming.rotation.set(0.065, -0.065, -0.009);
      incoming.position.x = travel * (1 - mix);
    }
    renderer.render(scene, camera);
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    const halfWidth = Math.max(0.56, (0.46 * w) / h);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = (halfWidth * h) / w;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    draw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return {
    async show(url: string, next?: string) {
      requested = url;
      const model = await load(url);
      if (disposed || requested !== url) return;
      if (active) scene.remove(active);
      if (incoming) scene.remove(incoming);
      active = model;
      active.visible = true;
      incoming = null;
      scene.add(model);
      draw();
      if (next)
        void load(next)
          .then((neighbor) => {
            if (disposed || requested !== url) return;
            incoming = neighbor;
            scene.add(neighbor);
            draw();
          })
          .catch(() => {
            /* The active chapter retries and handles its own load failure. */
          });
    },
    pose(turn: number, transition: number) {
      angle = turn;
      handoff = transition;
      draw();
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      // Release pending loads as well as groups already held in the cache.
      for (const promise of models.values()) {
        void promise.then(
          (model) => disposeModel(model),
          () => {},
        );
      }
      models.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
