import {
  Box3,
  BufferAttribute,
  type BufferAttribute as BufferAttributeType,
  type InterleavedBufferAttribute,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';

/**
 * Kurallara uymayan hazır bir modeli (örn. Sketchfab dışa aktarımı) Blender'da yeniden adlandırmadan
 * oyuna uydurmak için araç başına eşleme: dönüşüm, gizlenecek parçalar, bölgesel boya ve materyal
 * adları. Eşleme yüklenen modelin KLONUNA uygulanır; ardından normal hat (analiz, yedek parça,
 * paylaşılan materyaller) değişmeden çalışır.
 */
export type ModelMap = {
  /** Tüm modele uygulanan ölçek (model metre değilse) */
  scale?: number;
  /** Ölçekten sonra uygulanan öteleme (m): zemin hizalama */
  offset?: [number, number, number];
  /** Adında (kendi ya da üst düğümlerinden birinde) bu parçalardan biri geçen mesh'ler kaldırılır (büyük/küçük harf duyarsız) */
  hide?: string[];
  /**
   * Boya bölgesi kuralları (ilk eşleşen kazanır): `material` adlı materyal, `nodes` (regex, mesh ve
   * üst düğüm adları üzerinde) eşleşen yerlerde `paint_<zone>` olur; `nodes` yoksa her yerde.
   */
  paint?: PaintRule[];
  /** Materyal adı -> paylaşılan materyal adı (ör. cam: "mat_glass") */
  materials?: Record<string, string>;
};

/**
 * Araç uzayında (ölçek/öteleme sonrası, m) bir kutu: üçgenin ağırlık merkezi içindeyse kural geçerli.
 * `absX`: |x| aralığı (sol/sağ simetrik). Tek mesh'te birleşik paneller (ör. tavan + bagaj + arka
 * çamurluk) bu sayede ayrı boya bölgelerine bölünür.
 */
export type PaintRegion = {
  absX?: [number, number];
  y?: [number, number];
  z?: [number, number];
};

export type PaintRule = {
  material: string;
  nodes?: string;
  zone: string;
  region?: PaintRegion;
  /**
   * true: yalnız bütünüyle bölgenin içinde kalan yüzey adaları (birbirine bağlı üçgen grupları,
   * ör. ayrı modellenmiş tavan paneli) bu bölgeye gider. Sınır panel kenarında temiz olur;
   * üçgen üçgen bölmede büyük üçgenler sınırda testere dişi yapar.
   */
  whole?: boolean;
};

const inRange = (v: number, r?: [number, number]) => !r || (v >= r[0] && v <= r[1]);
const inRegion = (p: Vector3, r: PaintRegion) =>
  inRange(Math.abs(p.x), r.absX) && inRange(p.y, r.y) && inRange(p.z, r.z);

/** Mesh'in kendi ve üst düğümlerinin adlarını birleştirir (eşleme kuralları buna bakar). */
function context(object: Object3D): string {
  const names: string[] = [];
  for (let o: Object3D | null = object; o; o = o.parent) if (o.name) names.push(o.name);
  return names.join(' ');
}

const isMesh = (o: Object3D): o is Mesh => 'isMesh' in o && o.isMesh === true;

/**
 * Eşlemeyi uygular ve kökü döndürür: model `body__main` adlı bir grup altına alınır (gövde sayılır),
 * ölçek/öteleme o grupta olur. Verilen kök değiştirilir (klon üzerinde çağır).
 */
export function applyModelMap(root: Object3D, map: ModelMap): Object3D {
  // 1) Gizlenecek parçaları kaldır (önce topla, sonra çıkar: gezinme sırasında değişmesin)
  const hide = (map.hide ?? []).map((h) => h.toLowerCase());
  if (hide.length > 0) {
    const doomed: Object3D[] = [];
    root.traverse((o) => {
      if (!isMesh(o)) return;
      const ctx = context(o).toLowerCase();
      if (hide.some((h) => ctx.includes(h))) doomed.push(o);
    });
    for (const o of doomed) o.parent?.remove(o);
  }

  // 2) Boya bölgeleri ve materyal adları: yer tutucu adlı materyaller (paylaşılanla sonra değişir)
  const placeholders = new Map<string, Material>();
  const placeholder = (name: string): Material => {
    let m = placeholders.get(name);
    if (!m) {
      m = new MeshStandardMaterial({ name });
      placeholders.set(name, m);
    }
    return m;
  };
  const rules = (map.paint ?? []).map((r) => ({
    ...r,
    test: r.nodes ? new RegExp(r.nodes) : null,
  }));
  // Bölge kuralları için: mesh -> araç uzayı (kök göreli matris, sonra ölçek/öteleme)
  root.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const toCar = (o: Object3D) => {
    const m = new Matrix4().multiplyMatrices(rootInverse, o.matrixWorld);
    const s = map.scale ?? 1;
    const t = map.offset ?? [0, 0, 0];
    return new Matrix4()
      .makeTranslation(t[0], t[1], t[2])
      .multiply(new Matrix4().makeScale(s, s, s))
      .multiply(m);
  };
  root.traverse((o) => {
    if (!isMesh(o)) return;
    const ctx = context(o);
    if (!Array.isArray(o.material) && splitByRegion(o, ctx, rules, toCar(o), placeholder)) return;
    const swap = (material: Material): Material => {
      const rule = rules.find(
        (r) => !r.region && r.material === material.name && (!r.test || r.test.test(ctx)),
      );
      if (rule) return placeholder(`paint_${rule.zone}`);
      const renamed = map.materials?.[material.name];
      return renamed ? placeholder(renamed) : material;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });

  // 3) Gövde grubu + dönüşüm
  const body = new Group();
  body.name = 'body__main';
  if (map.scale !== undefined) body.scale.setScalar(map.scale);
  if (map.offset) body.position.set(...map.offset);
  body.add(...root.children);
  root.add(body);
  return root;
}

type CompiledRule = PaintRule & { test: RegExp | null };

/**
 * Mesh'in materyaline bölgeli kural uyuyorsa üçgenleri ağırlık merkezlerine göre bölgelere
 * dağıtır: geometri klonlanır, üçgenler bölgeye göre sıralanıp gruplanır, mesh çoklu materyal
 * olur. Her üçgen ilk eşleşen bölgeli kurala, hiçbiri değilse bölgesiz kurala (yoksa kendi
 * materyaline) gider. Bölgeli kural yoksa false döner (normal eşleme yapılır).
 */
function splitByRegion(
  mesh: Mesh,
  ctx: string,
  rules: CompiledRule[],
  toCar: Matrix4,
  placeholder: (name: string) => Material,
): boolean {
  const material = mesh.material as Material;
  const applies = (r: CompiledRule) =>
    r.material === material.name && (!r.test || r.test.test(ctx));
  const regional = rules.filter((r) => r.region && applies(r));
  if (regional.length === 0) return false;
  const fallback = rules.find((r) => !r.region && applies(r));
  const fallbackMaterial = fallback ? placeholder(`paint_${fallback.zone}`) : material;

  const geometry = mesh.geometry.clone();
  const pos = geometry.getAttribute('position');
  const index = geometry.index
    ? Array.from(geometry.index.array)
    : Array.from({ length: pos.count }, (_, i) => i);
  const zones = [...new Set(regional.map((r) => r.zone))];
  const materials = [...zones.map((z) => placeholder(`paint_${z}`)), fallbackMaterial];
  const buckets: number[][] = materials.map(() => []);
  const islands = regional.some((r) => r.whole) ? islandBoxes(pos, index, toCar) : null;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let t = 0; t + 2 < index.length; t += 3) {
    const [i0, i1, i2] = [index[t] as number, index[t + 1] as number, index[t + 2] as number];
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    const centroid = a
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3)
      .applyMatrix4(toCar);
    const island = islands?.boxOf(t / 3);
    const rule = regional.find((r) =>
      r.whole
        ? island !== undefined &&
          inRegion(island.min, r.region as PaintRegion) &&
          inRegion(island.max, r.region as PaintRegion) &&
          inRegion(new Vector3(-island.max.x, island.max.y, island.max.z), r.region as PaintRegion)
        : inRegion(centroid, r.region as PaintRegion),
    );
    const slot = rule ? zones.indexOf(rule.zone) : materials.length - 1;
    (buckets[slot] as number[]).push(i0, i1, i2);
  }
  const ordered: number[] = [];
  geometry.clearGroups();
  buckets.forEach((bucket, i) => {
    if (bucket.length === 0) return;
    geometry.addGroup(ordered.length, bucket.length, i);
    ordered.push(...bucket);
  });
  const IndexArray = pos.count > 65535 ? Uint32Array : Uint16Array;
  geometry.setIndex(new BufferAttribute(new IndexArray(ordered), 1));
  mesh.geometry = geometry;
  mesh.material = materials;
  return true;
}

/**
 * Yüzey adaları: konumu aynı köşeler kaynaştırılarak (UV dikişleri adayı bölmesin) birbirine bağlı
 * üçgen grupları; her adanın araç uzayındaki sınır kutusu. Üçgen sırası -> ada kutusu.
 */
function islandBoxes(
  pos: BufferAttributeType | InterleavedBufferAttribute,
  index: number[],
  toCar: Matrix4,
): { boxOf: (triangle: number) => Box3 | undefined } {
  const ids = new Map<string, number>();
  const weld = Array.from({ length: pos.count }, (_, i) => {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    let id = ids.get(k);
    if (id === undefined) {
      id = ids.size;
      ids.set(k, id);
    }
    return id;
  });
  const parent = Array.from({ length: ids.size }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x] as number] as number;
      x = parent[x] as number;
    }
    return x;
  };
  for (let t = 0; t + 2 < index.length; t += 3) {
    const root = find(weld[index[t] as number] as number);
    for (const j of [1, 2]) parent[find(weld[index[t + j] as number] as number)] = root;
  }
  const boxes = new Map<number, Box3>();
  const rootOf: number[] = [];
  const v = new Vector3();
  for (let t = 0; t + 2 < index.length; t += 3) {
    const root = find(weld[index[t] as number] as number);
    rootOf.push(root);
    let box = boxes.get(root);
    if (!box) {
      box = new Box3();
      boxes.set(root, box);
    }
    for (const j of [0, 1, 2])
      box.expandByPoint(v.fromBufferAttribute(pos, index[t + j] as number).applyMatrix4(toCar));
  }
  return { boxOf: (triangle) => boxes.get(rootOf[triangle] as number) };
}
