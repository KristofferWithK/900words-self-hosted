import assert from 'node:assert/strict'

// Emit actual DOM measurements before asserting, so failed parent runs retain
// the exact viewport/font, footer widths and overflowing labels.
//
// Since the owner's approved finish/inspect design of 2026-09-11 this also
// pins the SHAPE of the surface, not just its controls: it fills the phone,
// its three regions tile it with no gap, the middle region is the only thing
// on it that may scroll, and nothing of a finish screen is rendered outside
// it — since the owner's follow-up of the same evening it IS the finish
// screen, for every round and every city, and the band summary it used to
// replace at City 1 is gone from the code. Those four are the whole geometry
// claim of the design, and each of them is a way the old screens could come
// back.
export async function measureReviewGeometry(panel, scenario) {
  const measurement = await panel.evaluate(el => {
    const rect = node => node.getBoundingClientRect().toJSON()
    // The surface's CONTROLS: pills, disclosure rows, the transcript link, a
    // sentence card. The collected words in the header are inline speak
    // buttons in a running line of text, sized as text on purpose.
    const buttons = [...el.querySelectorAll('.btn, .city1-review-toggle, .log-toggle, .sentence-hear')]
      .filter(b => b.getClientRects().length && !b.hidden)
    const region = selector => {
      const node = el.querySelector(selector)
      return node ? rect(node) : null
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      fontSize: getComputedStyle(document.documentElement).fontSize,
      panel: { bounds: rect(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth },
      surface: {
        context: region('.city1-review-context'),
        reader: region('.city1-review-scroll'),
        footer: region('.city1-review-actions'),
        background: getComputedStyle(el).backgroundColor,
      },
      // Every scroller INSIDE the surface, by class. The reader is allowed to
      // be one; nothing else is, and the document never is.
      scrollers: [...el.querySelectorAll('*')].filter(node => {
        const overflow = getComputedStyle(node).overflowY
        return (overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight + 1
      }).map(node => `${node.className}(${node.scrollHeight}>${node.clientHeight})`),
      documentHeight: document.documentElement.scrollHeight,
      // What a finish screen is made of, found OUTSIDE the surface: the
      // outcome, the exits, the transcript link, the token line. All of it
      // rides the surface now; anything found underneath is the old band
      // summary coming back.
      underlying: [...document.querySelectorAll('.outcome-banner, .summary-actions, .log-toggle, .earned-section, .sentence-review')]
        .filter(node => !el.contains(node)).map(node => node.className),
      footer: rect(el.querySelector('.city1-review-actions')),
      buttons: buttons.map(button => {
        const range = document.createRange(); range.selectNodeContents(button)
        return { label: button.textContent, bounds: rect(button), text: range.getBoundingClientRect().toJSON(),
          scrollWidth: button.scrollWidth, clientWidth: button.clientWidth }
      }),
      overflowing: [...el.querySelectorAll('*')].filter(node => node.scrollWidth > node.clientWidth && node.clientWidth > 0)
        .map(node => ({ tag: node.tagName, className: node.className, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth })),
    }
  })
  console.log(JSON.stringify({ scenario, ...measurement }))
  const { viewport, panel: box, surface } = measurement
  // 1. THE finish screen: full-bleed and opaque, with nothing of a finish
  //    screen left underneath it to tab into or read past.
  assert.ok(box.bounds.top <= 0.5 && box.bounds.left <= 0.5 &&
    box.bounds.right >= viewport.width - 0.5 && box.bounds.bottom >= viewport.height - 0.5,
    `${scenario}: the finish screen must fill the phone — ${JSON.stringify(box.bounds)} of ${JSON.stringify(viewport)}`)
  assert.ok(/^rgb\(/.test(surface.background), `${scenario}: opaque surface, got ${surface.background}`)
  assert.deepEqual(measurement.underlying, [], `${scenario}: nothing of a finish screen may render outside the surface`)
  // 2. Three regions, tiling the surface in order with no gap and no overlap.
  assert.ok(surface.context && surface.reader && surface.footer, `${scenario}: context, reader and footer`)
  assert.ok(Math.abs(surface.reader.top - surface.context.bottom) <= 0.5,
    `${scenario}: reader starts where the context ends — ${surface.context.bottom} vs ${surface.reader.top}`)
  assert.ok(Math.abs(surface.footer.top - surface.reader.bottom) <= 0.5,
    `${scenario}: footer starts where the reader ends — ${surface.reader.bottom} vs ${surface.footer.top}`)
  assert.ok(surface.footer.bottom <= viewport.height + 0.5,
    `${scenario}: the footer is anchored on the phone — ${surface.footer.bottom} of ${viewport.height}`)
  // 3. The reader is the only scroller, and the document is not one.
  assert.ok(measurement.scrollers.every(name => name.startsWith('city1-review-scroll')),
    `${scenario}: only the reader may scroll — ${measurement.scrollers.join(', ')}`)
  assert.ok(measurement.documentHeight <= viewport.height + 1,
    `${scenario}: the document must not scroll — ${measurement.documentHeight} of ${viewport.height}`)
  assert.ok(box.scrollWidth <= box.clientWidth, `${scenario}: no horizontal overflow`)
  // 4. Every control is a real target carrying a readable label.
  for (const button of measurement.buttons) {
    assert.ok(button.bounds.height >= 44 && button.bounds.width >= 44, `${button.label}: touch floor`)
    assert.ok(button.scrollWidth <= button.clientWidth, `${button.label}: horizontal label overflow`)
    assert.ok(button.text.left >= button.bounds.left && button.text.right <= button.bounds.right &&
      button.text.top >= button.bounds.top && button.text.bottom <= button.bounds.bottom, `${button.label}: readable label inside control`)
  }
  return measurement
}

/**
 * What the finish screen's reader is showing, for a drive whose evidence that
 * "the round's sentences are shown" used to be the P1 sentence band. Since PR
 * #216 that band renders only when `boardCityIndex !== 0`, so on City 1 the
 * reader IS the evidence and `.sentence-row` count 0 is City 1's pin. The
 * surface is always open at the end of a round; `danish` is empty and
 * `empty` true for a round whose clues produced no reviewable sentence —
 * which is a fact about the round, and the screen says so in place.
 */
export async function city1ReaderState(page) {
  const reader = page.locator('.city1-review-dialog')
  if ((await reader.count()) === 0) return { open: false, danish: '', progress: '', empty: false }
  const danish = reader.locator('.city1-review-sentence')
  const progress = reader.locator('.city1-review-progress')
  return {
    open: true,
    danish: ((await danish.count()) ? (await danish.first().textContent()) ?? '' : '').trim(),
    progress: ((await progress.count()) ? (await progress.textContent()) ?? '' : '').trim(),
    empty: (await reader.locator('.city1-review-empty').count()) === 1,
  }
}
