import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { ImagenMockupPreparada, LlammaService } from '../../../core/services/llamma.service';
import type { MockupDisenoData } from '../../../core/models/llamma.models';
import { ModalAccesibleDirective } from '../../../shared/modal-accesible.directive';

export interface CapaDiseño3D {
  id: number;
  nombre: string;
  dataUrl: string;
  imagen: HTMLImageElement;
  calidad: ImagenMockupPreparada['calidadImpresion'];
  // Para modelos procedurales (taza, lona, roll-up, etc.)
  x: number;
  y: number;
  // Común
  escala: number;
  rotacion: number;
  // Para modelos .glb con DecalGeometry (posición y normal en espacio 3D)
  punto3d?: THREE.Vector3;
  normal3d?: THREE.Vector3;
}

type TipoModelo3D = 'taza' | 'lona' | 'rollup' | 'tarjeta' | 'sticker' | 'totebag' | 'playera';

interface ConfigProducto3D {
  tipo: TipoModelo3D;
  texW: number;
  texH: number;
  defaultX: number;
  glbUrl: string;
  cameraZ: number;
  colores: { nombre: string; hex: string }[];
}

const CONFIG_PRODUCTOS: Record<string, ConfigProducto3D> = {
  'Taza cerámica sublimada': {
    tipo: 'taza',
    texW: 2048,
    texH: 820,
    defaultX: 78,
    glbUrl: 'assets/models/taza.glb',
    cameraZ: 5.1,
    colores: [
      { nombre: 'Blanca', hex: '#f8f8f6' },
      { nombre: 'Negra', hex: '#1e1e20' },
      { nombre: 'Cian', hex: '#00aeef' },
      { nombre: 'Amarilla', hex: '#f5df18' },
    ],
  },
  'Lona/Vinil': {
    tipo: 'lona',
    texW: 1800,
    texH: 1000,
    defaultX: 50,
    glbUrl: 'assets/models/lona.glb',
    cameraZ: 5.2,
    colores: [
      { nombre: 'Blanca', hex: '#fafaf8' },
      { nombre: 'Negra', hex: '#18181b' },
      { nombre: 'Cian', hex: '#00aeef' },
    ],
  },
  'Roll-up premium 85 × 200 cm': {
    tipo: 'rollup',
    texW: 850,
    texH: 2000,
    defaultX: 50,
    glbUrl: 'assets/models/rollup.glb',
    cameraZ: 5.8,
    colores: [
      { nombre: 'Blanco', hex: '#fafaf8' },
      { nombre: 'Negro', hex: '#18181b' },
      { nombre: 'Cian', hex: '#00aeef' },
    ],
  },
  'Tarjetas Couché 300g': {
    tipo: 'tarjeta',
    texW: 1620,
    texH: 900,
    defaultX: 50,
    glbUrl: 'assets/models/tarjetas.glb',
    cameraZ: 4.5,
    colores: [
      { nombre: 'Blanca', hex: '#ffffff' },
      { nombre: 'Negra', hex: '#18181b' },
      { nombre: 'Crema', hex: '#f3ede0' },
    ],
  },
  'Sticker troquelado': {
    tipo: 'sticker',
    texW: 1200,
    texH: 1200,
    defaultX: 50,
    glbUrl: 'assets/models/sticker.glb',
    cameraZ: 4.4,
    colores: [
      { nombre: 'Vinil blanco', hex: '#ffffff' },
      { nombre: 'Vinil negro', hex: '#1a1a1a' },
      { nombre: 'Amarillo', hex: '#fff200' },
    ],
  },
  'Tote bag de manta': {
    tipo: 'totebag',
    texW: 1200,
    texH: 1300,
    defaultX: 50,
    glbUrl: 'assets/models/totebag.glb',
    cameraZ: 5.2,
    colores: [
      { nombre: 'Manta cruda', hex: '#ebe3d0' },
      { nombre: 'Negra', hex: '#1f1f22' },
      { nombre: 'Blanca', hex: '#f7f7f5' },
    ],
  },
  'Playera DTF unisex': {
    tipo: 'playera',
    texW: 1200,
    texH: 1400,
    defaultX: 50,
    glbUrl: 'assets/models/playera.glb',
    cameraZ: 5.0,
    colores: [
      { nombre: 'Blanca', hex: '#f6f6f4' },
      { nombre: 'Negra', hex: '#1c1c1e' },
      { nombre: 'Gris', hex: '#8e9096' },
      { nombre: 'Cian', hex: '#00aeef' },
    ],
  },
};

// El catálogo público usa estos nombres; ambos comparten el modelo DTF.
CONFIG_PRODUCTOS['Playera DTF 29 × 29 cm'] = CONFIG_PRODUCTOS['Playera DTF unisex'];
CONFIG_PRODUCTOS['Playera DTF menor a 29 × 29 cm'] = CONFIG_PRODUCTOS['Playera DTF unisex'];
// Compatibilidad con pedidos/solicitudes previos al renombre.
CONFIG_PRODUCTOS['Lona Frontlit impresa'] = CONFIG_PRODUCTOS['Lona/Vinil'];

@Component({
  selector: 'app-cotizar-mockup-3d',
  imports: [ModalAccesibleDirective],
  templateUrl: './cotizar-mockup-3d.component.html',
  styleUrl: './cotizar-mockup-3d.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizarMockup3dComponent implements AfterViewInit, OnDestroy {
  private readonly service = inject(LlammaService);
  private readonly viewportRef = viewChild.required<ElementRef<HTMLDivElement>>('viewport3d');

  readonly productoNombre = input<string>('Taza cerámica sublimada');
  readonly productoId = input<number | null>(null);
  readonly material = input<string | null>(null);
  readonly medidas = input<{ ancho: number; alto: number } | null>(null);
  readonly cerrar = output<void>();
  readonly adjuntarCaptura = output<{ archivo: File; datos: MockupDisenoData }>();

  readonly configActual = computed<ConfigProducto3D>(
    () => CONFIG_PRODUCTOS[this.productoNombre()] ?? CONFIG_PRODUCTOS['Taza cerámica sublimada'],
  );

  readonly colores = computed(() => this.configActual().colores);
  readonly colorBase = signal<string>('#f8f8f6');
  readonly quitarFondo = signal(true);
  readonly autoRotar = signal(false);

  // true cuando se cargó un .glb y las imágenes se pegan con DecalGeometry en cualquier parte
  readonly modoDecal = signal(false);
  // true cuando el cliente activa arrastrar para deslizar la imagen sobre el 3D
  readonly modoArrastrarImagen = signal(false);

  readonly capas = signal<CapaDiseño3D[]>([]);
  readonly capaActivaId = signal<number | null>(null);
  readonly procesando = signal(false);
  readonly error = signal<string | null>(null);
  readonly cargandoModelo = signal(true);
  readonly modeloAproximado = signal(false);
  readonly capturaGuardada = signal(false);

  readonly capaActiva = computed(
    () => this.capas().find((c) => c.id === this.capaActivaId()) ?? null,
  );

  private nextId = 1;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private frameId = 0;
  private resizeObserver?: ResizeObserver;

  private texCanvas?: HTMLCanvasElement;
  private texCtx?: CanvasRenderingContext2D;
  private wrapTexture?: THREE.CanvasTexture;
  private baseMaterial?: THREE.MeshStandardMaterial;

  // Para DecalGeometry sobre modelos .glb
  private decalTargets: THREE.Mesh[] = [];
  private decalGroup?: THREE.Group;
  private readonly decalTextures = new Map<number, THREE.Texture>();
  private readonly raycaster = new THREE.Raycaster();
  private pointerDownPos = { x: 0, y: 0 };
  private arrastrandoDecal = false;

  private readonly onPointerDownBound = (e: PointerEvent) => this.onPointerDown(e);
  private readonly onPointerMoveBound = (e: PointerEvent) => this.onPointerMove(e);
  private readonly onPointerUpBound = (e: PointerEvent) => this.onPointerUp(e);

  ngAfterViewInit(): void {
    this.colorBase.set(this.configActual().colores[0].hex);
    this.initScene();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();

    const dom = this.renderer?.domElement;
    if (dom) {
      dom.removeEventListener('pointerdown', this.onPointerDownBound);
      dom.removeEventListener('pointermove', this.onPointerMoveBound);
      dom.removeEventListener('pointerup', this.onPointerUpBound);
    }

    this.limpiarDecalsEscena();
    this.decalTextures.forEach((tex) => tex.dispose());
    this.decalTextures.clear();

    this.controls?.dispose();
    this.wrapTexture?.dispose();
    this.scene?.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.renderer?.dispose();
  }

  private initScene(): void {
    const cfg = this.configActual();
    const container = this.viewportRef().nativeElement;
    const width = container.clientWidth || 560;
    const height = container.clientHeight || 360;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f0eb');
    this.scene = scene;

    const decalGroup = new THREE.Group();
    scene.add(decalGroup);
    this.decalGroup = decalGroup;

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 0.45, cfg.cameraZ);
    this.camera = camera;

    const renderer = (() => {
      try {
        return new THREE.WebGLRenderer({
          antialias: true,
          preserveDrawingBuffer: true,
        });
      } catch {
        return null;
      }
    })();

    if (!renderer) {
      this.cargandoModelo.set(false);
      this.error.set(
        'Tu navegador no pudo iniciar WebGL. Actualiza el navegador o activa la aceleración por hardware.',
      );
      return;
    }
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    renderer.domElement.addEventListener('pointerdown', this.onPointerDownBound);
    renderer.domElement.addEventListener('pointermove', this.onPointerMoveBound);
    renderer.domElement.addEventListener('pointerup', this.onPointerUpBound);

    // Iluminación de estudio
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xeef6ff, 0.55);
    fillLight.position.set(-5, 2, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, -3, 3);
    scene.add(rimLight);

    // Canvas 2D (solo para modelos procedurales sin .glb)
    const texCanvas = document.createElement('canvas');
    texCanvas.width = cfg.texW;
    texCanvas.height = cfg.texH;
    this.texCanvas = texCanvas;
    this.texCtx = texCanvas.getContext('2d') ?? undefined;

    const wrapTexture = new THREE.CanvasTexture(texCanvas);
    wrapTexture.colorSpace = THREE.SRGBColorSpace;
    wrapTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.wrapTexture = wrapTexture;

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.colorBase()),
      roughness: cfg.tipo === 'totebag' || cfg.tipo === 'playera' ? 0.82 : 0.24,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    this.baseMaterial = baseMaterial;

    const wrapMaterial = new THREE.MeshStandardMaterial({
      map: wrapTexture,
      roughness: cfg.tipo === 'totebag' || cfg.tipo === 'playera' ? 0.78 : 0.26,
      metalness: 0.03,
      transparent: true,
    });

    // Intenta cargar .glb de Blender; si existe, usa DecalGeometry en toda la superficie
    const loader = new GLTFLoader();
    loader.load(
      cfg.glbUrl,
      (gltf) => {
        const modelo = gltf.scene;
        this.decalTargets = [];

        modelo.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = baseMaterial;
            this.decalTargets.push(child);
          }
        });

        // Centrar y escalar automáticamente el .glb
        const box = new THREE.Box3().setFromObject(modelo);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const escala = 2.6 / maxDim;
        modelo.scale.setScalar(escala);
        modelo.position.sub(center.multiplyScalar(escala));
        scene.add(modelo);
        modelo.updateMatrixWorld(true);

        this.modoDecal.set(true);
        this.modeloAproximado.set(false);
        this.cargandoModelo.set(false);
        this.reconstruirDecals();
      },
      undefined,
      () => {
        this.modoDecal.set(false);
        this.modeloAproximado.set(true);
        this.cargandoModelo.set(false);
        scene.add(this.construirModeloBase(cfg.tipo, baseMaterial, wrapMaterial));
      },
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 8.5;
    this.controls = controls;

    this.redibujarTextura();

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.renderer || !this.camera) return;
      const w = container.clientWidth || 560;
      const h = container.clientHeight || 360;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.resizeObserver.observe(container);

    const animate = () => {
      this.frameId = requestAnimationFrame(animate);
      controls.enabled = !this.modoArrastrarImagen();
      controls.autoRotate = this.autoRotar() && !this.modoArrastrarImagen();
      controls.autoRotateSpeed = 1.6;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }

  private onPointerDown(e: PointerEvent): void {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    if (this.modoDecal() && this.modoArrastrarImagen() && this.capaActivaId() !== null) {
      this.arrastrandoDecal = true;
      this.colocarCapaActivaEnCursor(e);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.arrastrandoDecal) {
      this.colocarCapaActivaEnCursor(e);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.arrastrandoDecal) {
      this.arrastrandoDecal = false;
      return;
    }
    // Clic corto (sin arrastrar cámara) mueve la imagen activa a ese punto del 3D
    if (!this.modoDecal() || this.capaActivaId() === null) return;
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist < 6) {
      this.colocarCapaActivaEnCursor(e);
    }
  }

  private colocarCapaActivaEnCursor(e: PointerEvent): void {
    const id = this.capaActivaId();
    if (id === null || !this.renderer || !this.camera || !this.decalTargets.length) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );

    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.decalTargets, false);
    if (!hits.length) return;

    const hit = hits[0];
    if (!hit.face) return;

    const normalWorld = hit.face.normal
      .clone()
      .transformDirection(hit.object.matrixWorld)
      .normalize();

    // Asegura que la normal apunte hacia la cámara (por si la malla tiene normales invertidas)
    const haciaCamara = this.camera.position.clone().sub(hit.point).normalize();
    if (normalWorld.dot(haciaCamara) < 0) {
      normalWorld.negate();
    }

    const punto = hit.point.clone();
    this.capas.update((lista) =>
      lista.map((c) => (c.id === id ? { ...c, punto3d: punto, normal3d: normalWorld } : c)),
    );
    this.reconstruirDecals();
  }

  private obtenerPuntoInicialPecho(): { punto: THREE.Vector3; normal: THREE.Vector3 } | null {
    if (!this.decalTargets.length || !this.camera) return null;

    const caja = new THREE.Box3();
    this.decalTargets.forEach((mesh) => caja.expandByObject(mesh));
    const centro = caja.getCenter(new THREE.Vector3());

    // Rayo desde la cámara al centro del modelo: garantiza impactar la cara frontal.
    const origen = this.camera.position.clone();
    const direccion = centro.clone().sub(origen).normalize();
    this.raycaster.set(origen, direccion);
    const hits = this.raycaster.intersectObjects(this.decalTargets, false);
    if (hits.length && hits[0].face) {
      const hit = hits[0];
      const normal = hit
        .face!.normal.clone()
        .transformDirection(hit.object.matrixWorld)
        .normalize();
      const haciaCamara = this.camera.position.clone().sub(hit.point).normalize();
      if (normal.dot(haciaCamara) < 0) normal.negate();
      return { punto: hit.point.clone(), normal };
    }

    // Fallback: plano frontal de la caja envolvente.
    return {
      punto: new THREE.Vector3(centro.x, centro.y, caja.max.z),
      normal: new THREE.Vector3(0, 0, 1),
    };
  }

  private limpiarDecalsEscena(): void {
    if (!this.decalGroup) return;
    while (this.decalGroup.children.length > 0) {
      const child = this.decalGroup.children[0];
      this.decalGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  private reconstruirDecals(): void {
    if (!this.modoDecal() || !this.decalGroup || !this.decalTargets.length) return;
    this.limpiarDecalsEscena();

    const helper = new THREE.Object3D();

    this.capas().forEach((capa, idx) => {
      const inicial = !capa.punto3d || !capa.normal3d ? this.obtenerPuntoInicialPecho() : null;
      const punto = capa.punto3d ?? inicial?.punto;
      const normal = capa.normal3d ?? inicial?.normal;
      if (!punto || !normal) return;

      let tex = this.decalTextures.get(capa.id);
      if (!tex) {
        tex = new THREE.Texture(capa.imagen);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        this.decalTextures.set(capa.id, tex);
      }

      const aspect = (capa.imagen.naturalWidth || 1) / (capa.imagen.naturalHeight || 1);
      const alto = (capa.escala / 100) * 1.15;
      const ancho = alto * aspect;
      // Profundidad acotada para que NUNCA atraviese hasta la espalda
      const profundidad = 0.28;

      helper.position.copy(punto);
      helper.up.set(0, 1, 0);
      helper.lookAt(punto.clone().add(normal));
      helper.rotateZ((-capa.rotacion * Math.PI) / 180);

      const orientacion = helper.rotation.clone();
      const tamano = new THREE.Vector3(ancho, alto, profundidad);

      const decalMat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.1,
        roughness: 0.72,
        metalness: 0.02,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4 - idx,
        polygonOffsetUnits: -1,
        toneMapped: false,
      });

      for (const mesh of this.decalTargets) {
        mesh.updateWorldMatrix(true, false);
        const geo = new DecalGeometry(mesh, punto, orientacion, tamano);
        const posAttr = geo.attributes['position'];
        if (posAttr && posAttr.count > 0) {
          this.decalGroup!.add(new THREE.Mesh(geo, decalMat));
        } else {
          geo.dispose();
        }
      }
    });
  }

  private construirModeloBase(
    tipo: TipoModelo3D,
    baseMat: THREE.MeshStandardMaterial,
    wrapMat: THREE.MeshStandardMaterial,
  ): THREE.Group {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xb8bcc2,
      roughness: 0.28,
      metalness: 0.85,
    });

    if (tipo === 'taza') {
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.0, 2.25, 64, 1, true), baseMat));
      const innerMat = new THREE.MeshStandardMaterial({
        color: 0xf4f4f0,
        roughness: 0.28,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.91, 2.2, 48, 1, true), innerMat));
      const innerBottom = new THREE.Mesh(new THREE.CircleGeometry(0.91, 48), innerMat);
      innerBottom.rotation.x = -Math.PI / 2;
      innerBottom.position.y = -1.04;
      group.add(innerBottom);

      const outerBottom = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), baseMat);
      outerBottom.rotation.x = Math.PI / 2;
      outerBottom.position.y = -1.125;
      group.add(outerBottom);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.995, 0.048, 18, 64), baseMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.12;
      group.add(rim);

      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.105, 20, 48, Math.PI), baseMat);
      handle.rotation.z = -Math.PI / 2;
      handle.position.set(0.98, 0.02, 0);
      group.add(handle);

      group.add(
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            1.046,
            1.006,
            1.86,
            64,
            1,
            true,
            Math.PI * 0.62,
            Math.PI * 1.76,
          ),
          wrapMat,
        ),
      );
      return group;
    }

    if (tipo === 'lona') {
      group.add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.78, 0.03), baseMat));
      const frente = new THREE.Mesh(new THREE.PlaneGeometry(3.04, 1.62), wrapMat);
      frente.position.z = 0.018;
      group.add(frente);
      const ojilloGeo = new THREE.TorusGeometry(0.055, 0.016, 12, 24);
      for (const [x, y] of [
        [-1.48, 0.77],
        [1.48, 0.77],
        [-1.48, -0.77],
        [1.48, -0.77],
      ]) {
        const ojillo = new THREE.Mesh(ojilloGeo, metalMat);
        ojillo.position.set(x, y, 0.018);
        group.add(ojillo);
      }
      return group;
    }

    if (tipo === 'rollup') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 0.34), metalMat);
      base.position.y = -1.45;
      group.add(base);
      const barraSup = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.06, 0.05), metalMat);
      barraSup.position.y = 1.48;
      group.add(barraSup);
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.9, 16), metalMat);
      poste.position.set(0, 0.02, -0.08);
      group.add(poste);
      group.add(new THREE.Mesh(new THREE.BoxGeometry(1.34, 2.86, 0.015), baseMat));
      const frente = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 2.82), wrapMat);
      frente.position.z = 0.01;
      group.add(frente);
      return group;
    }

    if (tipo === 'tarjeta') {
      group.add(new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.5, 0.035), baseMat));
      const frente = new THREE.Mesh(new THREE.PlaneGeometry(2.64, 1.44), wrapMat);
      frente.position.z = 0.02;
      group.add(frente);
      return group;
    }

    if (tipo === 'sticker') {
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.03, 64), baseMat));
      const frente = new THREE.Mesh(new THREE.CircleGeometry(1.12, 64), wrapMat);
      frente.position.y = 0.018;
      frente.rotation.x = -Math.PI / 2;
      group.add(frente);
      group.rotation.x = Math.PI / 2;
      return group;
    }

    if (tipo === 'totebag') {
      group.add(new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.1, 0.34), baseMat));
      const frente = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), wrapMat);
      frente.position.set(0, -0.05, 0.175);
      group.add(frente);
      const asaGeo = new THREE.TorusGeometry(0.45, 0.055, 14, 36, Math.PI);
      for (const z of [0.12, -0.12]) {
        const asa = new THREE.Mesh(asaGeo, baseMat);
        asa.position.set(0, 1.05, z);
        group.add(asa);
      }
      return group;
    }

    group.add(new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.35, 0.38), baseMat));
    const pecho = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.45), wrapMat);
    pecho.position.set(0, 0.12, 0.195);
    group.add(pecho);
    return group;
  }

  cambiarColorBase(hex: string): void {
    this.colorBase.set(hex);
    this.baseMaterial?.color.set(hex);
    this.redibujarTextura();
  }

  toggleQuitarFondo(evento: Event): void {
    this.quitarFondo.set((evento.target as HTMLInputElement).checked);
  }

  toggleAutoRotar(): void {
    this.autoRotar.update((v) => !v);
  }

  toggleModoArrastrar(): void {
    this.modoArrastrarImagen.update((v) => !v);
  }

  subirImagenes(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    if (!archivos.length) return;

    this.error.set(null);
    archivos.forEach((archivo) => this.procesarArchivoConPython(archivo));
  }

  private procesarArchivoConPython(archivo: File): void {
    this.procesando.set(true);
    const cfg = this.configActual();
    this.service
      .prepararImagenMockup(archivo, {
        quitarFondo: this.quitarFondo(),
        recortar: true,
      })
      .subscribe({
        next: (resp) => {
          const img = new Image();
          img.onload = () => {
            const desplazamiento = (this.capas().length % 3) * 6 - 6;
            const inicial = this.modoDecal() ? this.obtenerPuntoInicialPecho() : null;
            const nueva: CapaDiseño3D = {
              id: this.nextId++,
              nombre: archivo.name,
              dataUrl: resp.dataUrl,
              imagen: img,
              calidad: resp.calidadImpresion,
              x: Math.min(92, Math.max(8, cfg.defaultX + desplazamiento)),
              y: 50,
              escala: this.modoDecal() ? 55 : 55,
              rotacion: 0,
              punto3d: inicial?.punto,
              normal3d: inicial?.normal,
            };
            this.capas.update((lista) => [...lista, nueva]);
            this.capaActivaId.set(nueva.id);
            this.procesando.set(false);
            if (this.modoDecal()) {
              this.reconstruirDecals();
            } else {
              this.redibujarTextura();
            }
          };
          img.onerror = () => {
            this.error.set(`No pudimos mostrar "${archivo.name}".`);
            this.procesando.set(false);
          };
          img.src = resp.dataUrl;
        },
        error: () => {
          this.error.set(
            'No pudimos procesar la imagen en el servidor. Revisa que Flask esté activo.',
          );
          this.procesando.set(false);
        },
      });
  }

  seleccionarCapa(id: number): void {
    this.capaActivaId.set(id);
  }

  actualizarCapa(campo: 'x' | 'y' | 'escala' | 'rotacion', evento: Event): void {
    const id = this.capaActivaId();
    const valor = Number((evento.target as HTMLInputElement).value);
    if (id === null || Number.isNaN(valor)) return;

    this.capas.update((lista) =>
      lista.map((capa) => (capa.id === id ? { ...capa, [campo]: valor } : capa)),
    );

    if (this.modoDecal()) {
      this.reconstruirDecals();
    } else {
      this.redibujarTextura();
    }
  }

  centrarCapaActiva(): void {
    const id = this.capaActivaId();
    if (id === null) return;

    if (this.modoDecal()) {
      const inicial = this.obtenerPuntoInicialPecho();
      this.capas.update((lista) =>
        lista.map((capa) =>
          capa.id === id
            ? {
                ...capa,
                punto3d: inicial?.punto,
                normal3d: inicial?.normal,
                escala: 55,
                rotacion: 0,
              }
            : capa,
        ),
      );
      this.reconstruirDecals();
      return;
    }

    const defaultX = this.configActual().defaultX;
    this.capas.update((lista) =>
      lista.map((capa) =>
        capa.id === id ? { ...capa, x: defaultX, y: 50, escala: 55, rotacion: 0 } : capa,
      ),
    );
    this.redibujarTextura();
  }

  eliminarCapa(id: number): void {
    this.decalTextures.get(id)?.dispose();
    this.decalTextures.delete(id);

    this.capas.update((lista) => lista.filter((c) => c.id !== id));
    if (this.capaActivaId() === id) {
      const restantes = this.capas();
      this.capaActivaId.set(restantes.length ? restantes[restantes.length - 1].id : null);
    }

    if (this.modoDecal()) {
      this.reconstruirDecals();
    } else {
      this.redibujarTextura();
    }
  }

  private redibujarTextura(): void {
    const ctx = this.texCtx;
    const canvas = this.texCanvas;
    if (!ctx || !canvas || !this.wrapTexture) return;

    const texW = canvas.width;
    const texH = canvas.height;
    ctx.clearRect(0, 0, texW, texH);

    for (const capa of this.capas()) {
      const img = capa.imagen;
      if (!img.naturalWidth || !img.naturalHeight) continue;

      const aspect = img.naturalWidth / img.naturalHeight;
      const drawH = (capa.escala / 100) * texH;
      const drawW = drawH * aspect;
      const cx = (capa.x / 100) * texW;
      const cy = (capa.y / 100) * texH;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((capa.rotacion * Math.PI) / 180);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    this.wrapTexture.needsUpdate = true;
  }

  guardarCapturaEnSolicitud(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    if (!this.capas().length) {
      this.error.set('Sube una imagen y colócala en el producto antes de adjuntar la vista 3D.');
      return;
    }

    // Render explícito para que el buffer tenga el último cuadro aunque el modal esté quieto.
    this.renderer.render(this.scene, this.camera);
    const nombre = `diseno-${this.slugProducto()}-3d.jpg`;

    this.renderer.domElement.toBlob(
      (blob) => {
        if (!blob) {
          this.error.set('No pudimos exportar la vista 3D. Intenta de nuevo.');
          return;
        }
        const archivo = new File([blob], nombre, { type: 'image/jpeg' });
        this.adjuntarCaptura.emit({ archivo, datos: this.datosMockup() });
        this.capturaGuardada.set(true);
        setTimeout(() => this.capturaGuardada.set(false), 2500);
      },
      'image/jpeg',
      0.9,
    );
  }

  private datosMockup(): MockupDisenoData {
    return {
      productoId: this.productoId(),
      productoNombre: this.productoNombre(),
      vista: '3d',
      color: this.colorBase(),
      material: this.material(),
      medidas: this.medidas(),
      capas: this.capas().map((capa) => ({
        nombre: capa.nombre,
        x: capa.x,
        y: capa.y,
        escala: capa.escala,
        rotacion: capa.rotacion,
      })),
      capturadoEn: new Date().toISOString(),
    };
  }

  private slugProducto(): string {
    return (
      this.productoNombre()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'producto'
    );
  }
}
