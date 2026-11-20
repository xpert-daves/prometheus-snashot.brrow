export type RafThrottled<T extends (...args: unknown[]) => void> = ((
  ...args: Parameters<T>
) => void) & { cancel: () => void };

export function rafThrottle<T extends (...args: unknown[]) => void>(
  callback: T,
): RafThrottled<T> {
  let frame: number | null = null;
  let lastArgs: Parameters<T> | undefined;

  const throttled = (...args: Parameters<T>) => {
    lastArgs = args;
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (lastArgs) callback(...lastArgs);
    });
  };

  throttled.cancel = () => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };

  return throttled as RafThrottled<T>;
}
