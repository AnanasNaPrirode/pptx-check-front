import { expect, type Page } from "@playwright/test";

export const checksFixture = [
  {
    id: "font_size_min",
    name: "Minimum font size",
    description: "Text smaller than 18 pt.",
    level: "warning",
    scope: "slide",
    default_enabled: true,
  },
  {
    id: "title_heuristic",
    name: "Title heuristic",
    description: "Title by position and size.",
    level: "warning",
    scope: "slide",
    default_enabled: false,
  },
  {
    id: "slide_duplicates",
    name: "Duplicate slides",
    description: "Slides with the same text.",
    level: "warning",
    scope: "presentation",
    default_enabled: true,
  },
];

const slide = {
  number: 1,
  width_emu: 12192000,
  height_emu: 6858000,
  elements: [
    {
      id: "s1-e1",
      type: "text",
      x: 457200,
      y: 274638,
      w: 8229600,
      h: 1143000,
      text: "Slide title",
      is_title: true,
    },
    {
      id: "s1-e2",
      type: "picture",
      x: 1000000,
      y: 2000000,
      w: 4000000,
      h: 2500000,
    },
  ],
  issues: [
    {
      check_id: "font_size_min",
      level: "warning",
      message: "Font size 14 pt is below the minimum (18 pt).",
      element_id: "s1-e1",
    },
  ],
};

export const reportWithIssues = {
  filename: "talk.pptx",
  slides_count: 2,
  applied_checks: ["font_size_min", "slide_duplicates"],
  presentation_issues: [
    {
      check_id: "slide_duplicates",
      level: "warning",
      message: "Slides 5 and 12 have the same text and objects.",
      slide_numbers: [5, 12],
    },
  ],
  slides: [slide, { ...slide, number: 2, issues: [], elements: [] }],
};

export const reportClean = {
  ...reportWithIssues,
  filename: "clean.pptx",
  presentation_issues: [],
  slides: [{ ...slide, issues: [] }],
  slides_count: 1,
};

export function pptxFile(name: string, size = 64) {
  return {
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: Buffer.alloc(size, 1),
  };
}

export async function mockChecks(page: Page) {
  await page.route("**/api/checks", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(checksFixture),
    }),
  );
}

export async function openApp(page: Page) {
  await mockChecks(page);
  await page.goto("/");
  await expect(page.getByTestId("dropzone")).toBeVisible();
}

export async function dropPptx(page: Page, name: string) {
  await page.locator("[data-testid=dropzone]").evaluate((zone, fileName) => {
    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], fileName, {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    for (const type of ["dragenter", "dragover", "drop"]) {
      zone.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
    }
  }, name);
}

export async function readDb(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("pptx-checker");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const read = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const request = tx.objectStore(store).getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as T[]);
      });
    return {
      history: await read<Record<string, unknown>>("history"),
      events: await read<{ type: string; payload: Record<string, unknown> }>("event_log"),
    };
  });
}
