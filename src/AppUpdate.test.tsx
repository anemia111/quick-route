import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { useRegisterSW, type RegisterSWOptions } from "virtual:pwa-register/react";
import AppUpdate from "./AppUpdate";

it("offers a reload after activation and protects in-progress work", () => {
  let callbacks: RegisterSWOptions = {};
  vi.mocked(useRegisterSW).mockImplementation((options) => {
    callbacks = options!;
    return {} as ReturnType<typeof useRegisterSW>;
  });
  localStorage.setItem("quick-route.stations.v1", '{"nearby":"東京","destination":"新宿"}');
  const view = render(<AppUpdate busy={true} />);
  act(() => callbacks.onNeedReload?.());
  expect(screen.getByRole("button", { name: "最新版を表示" })).toBeDisabled();
  view.rerender(<AppUpdate busy={false} />);
  expect(screen.getByRole("button", { name: "最新版を表示" })).toBeEnabled();
  expect(localStorage.getItem("quick-route.stations.v1")).toContain("東京");
});

it("checks the existing registration on request and visibility without deleting storage", async () => {
  let callbacks: RegisterSWOptions = {};
  vi.mocked(useRegisterSW).mockImplementation((options) => {
    callbacks = options!;
    return {} as ReturnType<typeof useRegisterSW>;
  });
  const update = vi.fn().mockResolvedValue(undefined);
  const view = render(<AppUpdate busy={false} />);
  act(() => callbacks.onRegisteredSW?.("/quick-route/sw.js", { update } as unknown as ServiceWorkerRegistration));
  await userEvent.click(screen.getByRole("button", { name: "最新版を確認" }));
  expect(update).toHaveBeenCalledTimes(1);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(update).toHaveBeenCalledTimes(2);
  view.unmount();
  document.dispatchEvent(new Event("visibilitychange"));
  expect(update).toHaveBeenCalledTimes(2);
});
