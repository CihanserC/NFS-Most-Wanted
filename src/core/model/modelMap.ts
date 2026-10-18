import { Group, MeshStandardMaterial, type Material, type Mesh, type Object3D } from 'three';

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
  paint?: { material: string; nodes?: string; zone: string }[];
  /** Materyal adı -> paylaşılan materyal adı (ör. cam: "mat_glass") */
  materials?: Record<string, string>;
};

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
  root.traverse((o) => {
    if (!isMesh(o)) return;
    const ctx = context(o);
    const swap = (material: Material): Material => {
      const rule = rules.find((r) => r.material === material.name && (!r.test || r.test.test(ctx)));
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
