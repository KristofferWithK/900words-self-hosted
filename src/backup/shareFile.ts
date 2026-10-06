/**
 * Hand a file to the phone. The share sheet is the only route that reliably
 * reaches Files or a mail app from an installed iOS PWA or the iOS shell's
 * WKWebView, so try it first; Android's shell defines navigator.share for one
 * file (BackupSharePlugin.java). The anchor download is the desktop path.
 *
 * Shared by the collection backup (apply.ts) and the hidden performance log
 * (src/ui/diagnostics).
 */
export async function shareOrDownload(text: string, filename: string, title: string): Promise<'shared' | 'downloaded'> {
  const file = new File([text], filename, { type: 'application/json' })

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean
    share?: (data: { files?: File[]; title?: string }) => Promise<void>
  }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      // A cancelled share is not a failure worth reporting; fall through to
      // the download so the button always does something.
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
