import type { RoutingResult } from "./model";
import type { PlanRequest } from "./router";
import { matchingStops } from "./router";
let worker: Worker | undefined;
let serial = 0;
const pending = new Map<
  number,
  {
    resolve: (r: RoutingResult) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
export async function calculate(request: PlanRequest): Promise<RoutingResult> {
  request = {
    ...request,
    packages: request.packages.filter(
      (p) =>
        matchingStops(p, request.from).length &&
        matchingStops(p, request.to).length,
    ),
  };
  if (typeof Worker === "undefined")
    return (await import("./router")).plan(request);
  if (!worker) {
    worker = new Worker(new URL("./router.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(e.data.id);
      if (e.data.error) p.reject(Error(e.data.error));
      else p.resolve(e.data.result);
    };
    worker.onerror = () => {
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(Error("Worker failed"));
      }
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  const id = ++serial;
  return new Promise<RoutingResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error("Routing timeout"));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    worker!.postMessage({ id, request });
  }).catch(async () => (await import("./router")).plan(request));
}
