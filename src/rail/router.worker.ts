import { plan, type PlanRequest } from "./router";
self.onmessage = (
  event: MessageEvent<{ id: number; request: PlanRequest }>,
) => {
  try {
    self.postMessage({ id: event.data.id, result: plan(event.data.request) });
  } catch {
    self.postMessage({ id: event.data.id, error: "経路計算に失敗しました。" });
  }
};
