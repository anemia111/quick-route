import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import App from "./App";
import { STORAGE_KEY, loadStations } from "./stations";
it("validates, saves, reloads, edits and swaps stations", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "保存してはじめる" }));
  expect(screen.getByRole("alert")).toHaveTextContent("両方入力");
  await user.type(screen.getByLabelText("最寄り駅"), "東京");
  await user.type(screen.getByLabelText("目的地駅"), "東京");
  await user.click(screen.getByRole("button", { name: "保存してはじめる" }));
  expect(screen.getByRole("alert")).toHaveTextContent("同じ駅");
  await user.clear(screen.getByLabelText("目的地駅"));
  await user.type(screen.getByLabelText("目的地駅"), "新宿");
  const shinkansen = () =>
    screen.getByRole("checkbox", { name: "新幹線を利用する" });
  expect(shinkansen()).toBeChecked();
  await user.click(shinkansen());
  await user.click(screen.getByRole("button", { name: "保存してはじめる" }));
  expect(loadStations().stations).toEqual({
    nearby: "東京",
    destination: "新宿",
    useShinkansen: false,
    useLimitedExpress: true,
  });
  view.unmount();
  render(<App />);
  expect(screen.getByRole("button", { name: /新宿へ/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /東京へ/ })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "設定を開く" }));
  expect(shinkansen()).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: /駅を入れ替え/ }));
  expect(screen.getByLabelText("最寄り駅")).toHaveValue("新宿");
  await user.click(screen.getByRole("button", { name: "変更を保存" }));
  expect(loadStations().stations).toEqual({
    nearby: "新宿",
    destination: "東京",
    useShinkansen: false,
    useLimitedExpress: true,
  });
});
it.each([undefined, true, false])("carries over the legacy paid train preference %s", (usePaidTrains) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ nearby: "東京", destination: "新宿", usePaidTrains }),
  );
  expect(loadStations().stations).toMatchObject({
    useShinkansen: usePaidTrains ?? true,
    useLimitedExpress: usePaidTrains ?? true,
  });
});
it("recovers from corrupt storage", () => {
  localStorage.setItem(STORAGE_KEY, "{broken");
  render(<App />);
  expect(screen.getByRole("alert")).toHaveTextContent("再登録");
});
it("reports failed storage without claiming success", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByLabelText("最寄り駅"), "東京");
  await user.type(screen.getByLabelText("目的地駅"), "新宿");
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  await user.click(screen.getByRole("button", { name: "保存してはじめる" }));
  expect(screen.getByRole("alert")).toHaveTextContent("保存できません");
  spy.mockRestore();
});
