/** Drop a second call that arrives while the first is still running. */
export function createSingleFlight() {
  let pending = false;
  return function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (pending) return Promise.resolve(undefined);
    pending = true;
    return task().finally(() => {
      pending = false;
    });
  };
}
