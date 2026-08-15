export interface SpatialPoint {
  readonly x: number
  readonly y: number
}

export class SpatialIndex<T extends SpatialPoint> {
  private readonly buckets = new Map<number, T[]>()
  private readonly activeBuckets: T[][] = []
  private readonly bucketPool: T[][] = []
  private cellSize = 1

  rebuild(items: readonly T[], cellSize: number): void {
    for (const bucket of this.activeBuckets) {
      bucket.length = 0
      this.bucketPool.push(bucket)
    }
    this.activeBuckets.length = 0
    this.buckets.clear()
    this.cellSize = Math.max(1, cellSize)
    for (const item of items) {
      const key = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize))
      let bucket = this.buckets.get(key)
      if (!bucket) {
        bucket = this.bucketPool.pop() ?? []
        this.buckets.set(key, bucket)
        this.activeBuckets.push(bucket)
      }
      bucket.push(item)
    }
  }

  queryInto(point: SpatialPoint, radius: number, output: T[]): readonly T[] {
    output.length = 0
    const minimumX = Math.floor((point.x - radius) / this.cellSize)
    const maximumX = Math.floor((point.x + radius) / this.cellSize)
    const minimumY = Math.floor((point.y - radius) / this.cellSize)
    const maximumY = Math.floor((point.y + radius) / this.cellSize)
    for (let cellX = minimumX; cellX <= maximumX; cellX += 1) {
      for (let cellY = minimumY; cellY <= maximumY; cellY += 1) {
        const bucket = this.buckets.get(this.key(cellX, cellY))
        if (!bucket) continue
        for (const item of bucket) output.push(item)
      }
    }
    return output
  }

  private key(cellX: number, cellY: number): number {
    return (cellX + 32768) * 65536 + cellY + 32768
  }
}
