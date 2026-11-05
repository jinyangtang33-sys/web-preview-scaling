// Use a fresh page per scenario. All callbacks operate through the product UI.
// Project adapters choose meaningful actions, wait for settled navigation and
// verify the result; a visible rectangle alone does not establish usability.
async function checkResponsiveReturn(page, { from, to, openList, enterDetail, returnToList,
  control, disclosure, exercise, touch = false, timeout = 3000 }) {
  await page.setViewportSize(from);
  await openList(page);
  await enterDetail(page);
  await page.setViewportSize(to);
  await returnToList(page);

  const target = control(page);
  let openedDisclosure = false;
  if (!await target.isVisible()) {
    const toggle = disclosure?.(page);
    if (!toggle || !await toggle.isVisible()) {
      throw new Error('Control is hidden after return and has no visible disclosure');
    }
    await toggle[touch ? 'tap' : 'click']({ timeout });
    openedDisclosure = true;
  }
  await target[touch ? 'tap' : 'click']({ trial: true, timeout }); // Hit testing and scrolling.
  await exercise(page, target); // Change a condition/use a link and assert the outcome.
  return { from, to, openedDisclosure };
}

module.exports = { checkResponsiveReturn };
