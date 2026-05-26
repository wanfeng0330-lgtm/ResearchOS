export class Semaphore {
  private queue: Array<() => void> = []
  private running = 0

  constructor(private maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    this.running--
    if (this.queue.length > 0) {
      this.running++
      const next = this.queue.shift()!
      next()
    }
  }

  get pending(): number {
    return this.queue.length
  }

  get active(): number {
    return this.running
  }
}

const llmSemaphore = new Semaphore(6)

export function getLLMSemaphore(): Semaphore {
  return llmSemaphore
}
