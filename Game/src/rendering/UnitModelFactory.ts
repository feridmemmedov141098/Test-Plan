import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { UNIT_MODEL_URL } from '../game/province/provinceTypes'

export class UnitModelFactory {
  private template: THREE.Object3D | null = null

  async load(): Promise<void> {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(UNIT_MODEL_URL)
    const unitObject = gltf.scene.getObjectByName('Unit_A')

    if (!unitObject) {
      throw new Error('Unit_A.glb does not contain a Unit_A object')
    }

    this.template = unitObject.clone(true)
    this.template.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return
      }

      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = false

      if (Array.isArray(object.material)) {
        object.material = object.material.map((material) => material.clone())
      } else {
        object.material = object.material.clone()
      }
    })
  }

  create(color: number): THREE.Group {
    if (!this.template) {
      throw new Error('Unit model factory must be loaded before creating units')
    }

    const group = new THREE.Group()
    const clone = this.template.clone(true)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.35, 0.32, 24),
      new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.04 }),
    )
    base.position.y = 0.16
    base.castShadow = true
    base.receiveShadow = true
    base.userData.isUnitHitMesh = true
    clone.position.y = 0.28
    clone.scale.setScalar(70)
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return
      }

      object.userData.isUnitHitMesh = true

      if (object.material instanceof THREE.MeshStandardMaterial) {
        object.material = object.material.clone()
        object.material.color.setHex(color)
        object.material.roughness = 0.58
        object.material.metalness = 0.03
      }
    })
    group.add(base, clone)

    return group
  }
}
