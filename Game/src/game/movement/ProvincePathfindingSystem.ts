import type { Province } from '../province/provinceTypes'

interface HeapNode {
  provinceId: number
  priority: number
}

export class ProvincePathfindingSystem {
  private readonly provinces: Province[]

  constructor(provinces: Province[]) {
    this.provinces = provinces
  }

  findPath(startProvinceId: number, targetProvinceId: number): number[] {
    return this.findPathWhere(startProvinceId, targetProvinceId, () => true)
  }

  findPathWhere(startProvinceId: number, targetProvinceId: number, canEnter: (province: Province) => boolean): number[] {
    if (startProvinceId === targetProvinceId) {
      return [startProvinceId]
    }

    const frontier = new MinHeap()
    const cameFrom = new Int32Array(this.provinces.length)
    const costSoFar = new Float32Array(this.provinces.length)

    cameFrom.fill(-1)
    costSoFar.fill(Number.POSITIVE_INFINITY)
    cameFrom[startProvinceId] = startProvinceId
    costSoFar[startProvinceId] = 0
    frontier.push({ provinceId: startProvinceId, priority: 0 })

    while (frontier.length > 0) {
      const current = frontier.pop()

      if (!current) {
        break
      }

      if (current.provinceId === targetProvinceId) {
        return reconstructPath(cameFrom, startProvinceId, targetProvinceId)
      }

      const currentProvince = this.provinces[current.provinceId]

      for (const neighborId of currentProvince.neighbors) {
        const neighbor = this.provinces[neighborId]

        if (neighborId !== targetProvinceId && !canEnter(neighbor)) {
          continue
        }

        const nextCost = costSoFar[current.provinceId] + currentProvince.centerWorld.distanceTo(neighbor.centerWorld)

        if (nextCost < costSoFar[neighborId]) {
          costSoFar[neighborId] = nextCost
          cameFrom[neighborId] = current.provinceId
          frontier.push({
            provinceId: neighborId,
            priority: nextCost + this.heuristic(neighborId, targetProvinceId),
          })
        }
      }
    }

    return []
  }

  private heuristic(provinceId: number, targetProvinceId: number): number {
    return this.provinces[provinceId].centerWorld.distanceTo(this.provinces[targetProvinceId].centerWorld)
  }
}

function reconstructPath(cameFrom: Int32Array, startProvinceId: number, targetProvinceId: number): number[] {
  const path = [targetProvinceId]
  let current = targetProvinceId

  while (current !== startProvinceId) {
    current = cameFrom[current]

    if (current < 0) {
      return []
    }

    path.push(current)
  }

  return path.reverse()
}

class MinHeap {
  private readonly values: HeapNode[] = []

  get length(): number {
    return this.values.length
  }

  push(node: HeapNode): void {
    this.values.push(node)
    this.bubbleUp(this.values.length - 1)
  }

  pop(): HeapNode | undefined {
    const root = this.values[0]
    const end = this.values.pop()

    if (this.values.length > 0 && end) {
      this.values[0] = end
      this.sinkDown(0)
    }

    return root
  }

  private bubbleUp(index: number): void {
    let currentIndex = index
    const node = this.values[currentIndex]

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2)
      const parent = this.values[parentIndex]

      if (node.priority >= parent.priority) {
        break
      }

      this.values[parentIndex] = node
      this.values[currentIndex] = parent
      currentIndex = parentIndex
    }
  }

  private sinkDown(index: number): void {
    let currentIndex = index
    const length = this.values.length
    const node = this.values[currentIndex]

    while (true) {
      const leftIndex = currentIndex * 2 + 1
      const rightIndex = leftIndex + 1
      let swapIndex: number | null = null

      if (leftIndex < length && this.values[leftIndex].priority < node.priority) {
        swapIndex = leftIndex
      }

      if (
        rightIndex < length &&
        this.values[rightIndex].priority < (swapIndex === null ? node.priority : this.values[leftIndex].priority)
      ) {
        swapIndex = rightIndex
      }

      if (swapIndex === null) {
        break
      }

      this.values[currentIndex] = this.values[swapIndex]
      this.values[swapIndex] = node
      currentIndex = swapIndex
    }
  }
}
