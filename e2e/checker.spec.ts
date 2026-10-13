import { expect, test } from "@playwright/test";
import {
  dropPptx,
  mockChecks,
  openApp,
  pptxFile,
  readDb,
  reportClean,
  reportWithIssues,
} from "./fixtures";

test("uploads by file picker and drag-and-drop, then shows the report", async ({ page }) => {
  await page.route("**/api/check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(reportWithIssues),
    }),
  );
  await openApp(page);

  const dropped = page.waitForRequest("**/api/check");
  await dropPptx(page, "dropped.pptx");
  expect((await dropped).postData() ?? "").toContain("dropped.pptx");
  await expect(page.getByTestId("report")).toBeVisible();
  await expect(page.getByText("Font size 14 pt is below the minimum (18 pt).")).toBeVisible();
  await expect(page.getByTestId("slide-schematic").first()).toBeVisible();

  await page.getByTestId("new-check").click();
  await expect(page.getByTestId("dropzone")).toBeVisible();

  const picked = page.waitForRequest("**/api/check");
  await page.getByTestId("file-input").setInputFiles(pptxFile("talk.pptx"));
  await picked;
  await expect(page.getByTestId("report")).toContainText("talk.pptx");
});

test("blocks the dropzone while the request is in flight", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/check", async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(reportWithIssues),
    });
  });
  await openApp(page);
  await page.getByTestId("checks-toggle").click();
  await page.getByTestId("file-input").setInputFiles(pptxFile("talk.pptx"));
  await expect(page.getByTestId("checking")).toBeVisible();
  await expect(page.getByTestId("file-input")).toBeDisabled();
  await expect(page.getByTestId("check-switch-font_size_min")).toBeDisabled();
  release();
  await expect(page.getByTestId("report")).toBeVisible();
});

test("does not send an invalid format or an oversized file", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/check", () => {
    calls += 1;
  });
  await openApp(page);

  await page.getByTestId("file-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByTestId("file-error")).toHaveText("Only the .pptx format is allowed");

  await page.getByTestId("file-input").setInputFiles(pptxFile("big.pptx", 5 * 1024 * 1024 + 1));
  await expect(page.getByTestId("file-error")).toHaveText("The file is larger than 5 MB");
  expect(calls).toBe(0);
});

test("shows rate limit, timeout and internal error messages", async ({ page }) => {
  const cases = [
    {
      status: 429,
      body: { error: { code: "RATE_LIMITED", message: "slow" } },
      headers: { "retry-after": "12" },
      text: "Too many requests, try again in 12 s",
    },
    {
      status: 504,
      body: { error: { code: "TIMEOUT", message: "slow" } },
      headers: {} as Record<string, string>,
      text: "The presentation is too large, split it into several files",
    },
    {
      status: 500,
      body: { error: { code: "INTERNAL_ERROR", message: "boom" } },
      headers: {} as Record<string, string>,
      text: "Could not check the file",
    },
  ];

  await openApp(page);
  for (const item of cases) {
    await page.unroute("**/api/check").catch(() => undefined);
    await page.route("**/api/check", (route) =>
      route.fulfill({
        status: item.status,
        contentType: "application/json",
        headers: item.headers,
        body: JSON.stringify(item.body),
      }),
    );
    await page.getByTestId("file-input").setInputFiles(pptxFile("talk.pptx"));
    await expect(page.getByTestId("file-error")).toHaveText(item.text);
    await expect(page.getByTestId("dropzone")).toBeVisible();
  }
});

test("persists switches and omits disabled checks from the request", async ({ page }) => {
  await page.route("**/api/check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(reportClean),
    }),
  );
  await openApp(page);
  await page.getByTestId("checks-toggle").click();
  await page.getByTestId("check-switch-font_size_min").click();
  await page.getByTestId("check-switch-title_heuristic").click();
  await page.reload();
  await expect(page.getByTestId("dropzone")).toBeVisible();
  await page.getByTestId("checks-toggle").click();
  await expect(page.getByTestId("check-switch-font_size_min")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("check-switch-title_heuristic")).toHaveAttribute("aria-checked", "true");

  const request = page.waitForRequest("**/api/check");
  await page.getByTestId("file-input").setInputFiles(pptxFile("talk.pptx"));
  const body = (await request).postData() ?? "";
  expect(body).toContain("title_heuristic");
  expect(body).toContain("slide_duplicates");
  expect(body).not.toContain("font_size_min");
});

test("new check clears the report", async ({ page }) => {
  await page.route("**/api/check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(reportWithIssues),
    }),
  );
  await openApp(page);
  await page.getByTestId("file-input").setInputFiles(pptxFile("talk.pptx"));
  await expect(page.getByTestId("report")).toBeVisible();
  await page.getByTestId("new-check").click();
  await expect(page.getByTestId("report")).toHaveCount(0);
  await expect(page.getByTestId("dropzone")).toBeVisible();
});

test("writes history and the event log after a successful check", async ({ page }) => {
  await page.route("**/api/check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(reportWithIssues),
    }),
  );
  await openApp(page);
  await page.getByTestId("file-input").setInputFiles(pptxFile("talk.pptx"));
  await expect(page.getByTestId("report")).toBeVisible();
  const db = await readDb(page);
  expect(db.history).toHaveLength(1);
  expect(db.history[0]?.filename).toBe("talk.pptx");
  expect(db.events.map((event) => event.type)).toEqual(
    expect.arrayContaining(["upload_started", "check_success"]),
  );
  const success = db.events.find((event) => event.type === "check_success");
  expect(success?.payload.slidesCount).toBe(2);
  expect(success?.payload.issuesCount).toBe(2);
});

test("switches theme and language", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("theme", "light");
  });
  await mockChecks(page);
  await page.goto("/");
  await expect(page.getByTestId("dropzone")).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  const title = page.getByRole("heading", { level: 1 });
  const before = await title.innerText();
  await page.getByTestId("locale-toggle").click();
  await expect(title).not.toHaveText(before);
  await page.reload();
  await expect(page.getByTestId("dropzone")).toBeVisible();
  await expect(title).not.toHaveText(before);

  const db = await readDb(page);
  expect(db.events.map((event) => event.type)).toEqual(
    expect.arrayContaining(["theme_changed", "locale_changed"]),
  );
});

test("has no horizontal scroll and no overlapping slide columns", async ({ page }) => {
  await page.route("**/api/check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...reportWithIssues,
        slides: [
          {
            ...reportWithIssues.slides[0],
            issues: [
              {
                check_id: "font_size_min",
                level: "error",
                message: "A".repeat(180),
                element_id: "s1-e1",
              },
            ],
          },
        ],
      }),
    }),
  );
  await openApp(page);
  await page.getByTestId("file-input").setInputFiles(pptxFile("talk.pptx"));
  await expect(page.getByTestId("report")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const schematic = await page.getByTestId("slide-schematic").boundingBox();
  const issues = await page.getByTestId("slide-issues").boundingBox();
  const viewport = page.viewportSize();
  expect(schematic).not.toBeNull();
  expect(issues).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!schematic || !issues || !viewport) return;
  if (viewport.width >= 1024) {
    expect(schematic.x + schematic.width).toBeLessThanOrEqual(issues.x + 2);
  } else {
    expect(schematic.y + schematic.height).toBeLessThanOrEqual(issues.y + 2);
  }
  await expect(page.getByTestId("new-check")).toBeInViewport();
});

test("shows general issues only when the report has them", async ({ page }) => {
  await page.route("**/api/check", async (route) => {
    const body = route.request().postData() ?? "";
    const report = body.includes("clean.pptx") ? reportClean : reportWithIssues;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(report),
    });
  });
  await openApp(page);
  await page.getByTestId("file-input").setInputFiles(pptxFile("clean.pptx"));
  await expect(page.getByTestId("report")).toBeVisible();
  await expect(page.getByText("No issues").first()).toBeVisible();
  await expect(page.getByTestId("presentation-issues")).toHaveCount(0);

  await page.getByTestId("new-check").click();
  await page.getByTestId("file-input").setInputFiles(pptxFile("talk.pptx"));
  await expect(page.getByTestId("presentation-issues")).toBeVisible();
  await expect(page.getByText("Slides 5, 12")).toBeVisible();
});
