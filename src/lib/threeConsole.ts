import { setConsoleFunction } from "three";

/**
 * @react-three/fiber 9 builds its store with `new THREE.Clock()`, which three
 * r183+ flags as deprecated on every Canvas mount. Our code never touches the
 * clock, so drop that one message and pass every other three.js log through
 * as three would print it. Delete this file once fiber moves to THREE.Timer.
 */
const SILENCED = "THREE.Clock: This module has been deprecated.";

type Level = "log" | "warn" | "error";
type StackTrace = { isStackTrace: true; getError(message: string): Error };

setConsoleFunction((type: Level, message: string, ...params: unknown[]) => {
  if (message.startsWith(SILENCED)) return;

  const first = params[0] as StackTrace | undefined;
  if (first?.isStackTrace) console[type](first.getError(message));
  else console[type](message, ...params);
});
