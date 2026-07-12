import { test, expect, type Locator, type Page } from "@playwright/test";

test.describe("Kitchen Timer Logic Tests", () => {
  let alarmBtn: Locator;
  let minusBtn: Locator;
  let plusBtn: Locator;
  let alarmIndicator: Locator;

  test.beforeEach(async ({ page }) => {
    // Install fake timers before loading the page so we control all intervals/timeouts
    await page.clock.install();

    await page.goto("/");

    // Cache locators once right after page initialization
    alarmBtn = page.locator("#btn-alarm");
    minusBtn = page.locator("#btn-minus");
    plusBtn = page.locator("#btn-plus");
    alarmIndicator = page.locator("#alarm-indicator");
  });

  test("Initial State: Displays current wall clock time and sets initial buttons", async ({
    page,
  }) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");

    // Assert the whole clock face
    await expectDigit(page, "d1", hours[0]);
    await expectDigit(page, "d2", hours[1]);
    await expectDigit(page, "d3", minutes[0]);
    await expectDigit(page, "d4", minutes[1]);

    // Verify Control Panel interaction rules in CLOCK mode
    await expect(minusBtn).toBeDisabled();
    await expect(plusBtn).toBeDisabled();
    await expect(alarmIndicator).not.toHaveClass(/on/);
  });

  test("Mode Toggling & 4-Second Inactivity Timeout", async ({ page }) => {
    // Click once to change mode from CLOCK to TIMER
    await alarmBtn.click();

    // Check that control buttons open up
    await expect(plusBtn).toBeEnabled();
    // Minus should still be disabled because timerMinutes starts at 0
    await expect(minusBtn).toBeDisabled();
    await expect(alarmIndicator).toHaveClass(/on/);

    // Fast-forward time by 3.9 seconds—mode should still be TIMER
    await page.clock.fastForward(3900);
    await expect(plusBtn).toBeEnabled();

    // Cross the 4-second threshold
    await page.clock.fastForward(150);
    // Should auto-return to CLOCK mode where buttons lock out
    await expect(plusBtn).toBeDisabled();
  });

  test("Timer modification (Plus / Minus mechanics)", async ({ page }) => {
    await alarmBtn.click();

    // Increment timer to 2 minutes
    await plusBtn.dispatchEvent("pointerdown");
    await plusBtn.dispatchEvent("pointerup");
    await plusBtn.dispatchEvent("pointerdown");
    await plusBtn.dispatchEvent("pointerup");

    // Both buttons should now be available
    await expect(minusBtn).toBeEnabled();

    // Verify timer reading 00:02 on 7-segment display elements
    // d3 (tens place of minutes) should be '0'
    await expectDigit(page, "d3", "0");
    // d4 (units place of minutes) should be '2'
    await expectDigit(page, "d4", "2");

    // Drop it down by 1 minute
    await minusBtn.dispatchEvent("pointerdown");
    await minusBtn.dispatchEvent("pointerup");

    // d4 should now reflect '1'
    await expectDigit(page, "d4", "1");
  });

  test("Long Press rapid adjustment acceleration", async ({ page }) => {
    await alarmBtn.click();

    // Simulate pressing and holding the plus button
    await plusBtn.dispatchEvent("pointerdown");

    // Advance past the initial delay threshold (500ms)
    await page.clock.fastForward(500);

    // Run through 3 ticks of the rapid repeat cycle (200ms each = 600ms total)
    await page.clock.fastForward(200);
    await page.clock.fastForward(200);
    await page.clock.fastForward(200);

    // Release pointer pressure
    await plusBtn.dispatchEvent("pointerup");

    // Total iterations: 1 (initial click) + 3 (intervals) = 4 minutes
    await expectDigit(page, "d4", "4");
  });

  test("Countdown execution sequence to ALARMING state", async ({ page }) => {
    await alarmBtn.click();

    // Add 1 minute
    await plusBtn.dispatchEvent("pointerdown");
    await plusBtn.dispatchEvent("pointerup");

    // Fast-forward through the 60-second countdown gate
    await page.clock.fastForward(60000);

    // The alarm triggers immediately, state updates to ALARMING
    await expect(minusBtn).toBeDisabled(); // As timer hits 00:00
    await expect(plusBtn).toBeEnabled();

    // Clicking the alarm button can dismiss it safely
    await alarmBtn.click();

    // System drops right back to default operational display state
    await expect(plusBtn).toBeDisabled();
  });
});

const DigitSegmentsRegistry: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "e", "d", "c", "g"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

async function expectDigit(page: Page, digitId: string, expectedChar: string) {
  const activeSegments = DigitSegmentsRegistry[expectedChar] || [];

  for (const segment of ["a", "b", "c", "d", "e", "f", "g"]) {
    const segmentLocator = page.locator(`#${digitId}-${segment}`);
    const shouldBeOn = activeSegments.includes(segment);

    const errorMessage = `Segment '${segment}' of digit '${digitId}' (expected '${expectedChar}') failed the check.`;

    if (shouldBeOn) {
      await expect(segmentLocator, errorMessage).toHaveClass(/on/);
    } else {
      await expect(segmentLocator, errorMessage).not.toHaveClass(/on/);
    }
  }
}