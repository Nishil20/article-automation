import type { ChildProcess } from 'child_process';

// Track the active pipeline child process globally so it can be killed on abort/cancel
const globalForChild = globalThis as unknown as { __activeChild?: ChildProcess | null };

export function setActiveChild(child: ChildProcess | null): void {
  globalForChild.__activeChild = child;
}

export function killActiveChild(): void {
  if (globalForChild.__activeChild) {
    globalForChild.__activeChild.kill('SIGTERM');
    globalForChild.__activeChild = null;
  }
}
