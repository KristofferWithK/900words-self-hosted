import { createHash } from 'node:crypto'
export const EXTENSION_MANIFEST_SHA256 = '4550fc50d5831e6dcba93ed651a65a2da35376692402e269a704c36a9bcfd908'
export const EXTENSION_FILES = ['scope.json', 'board-sentences.json', 'review-sentences.json', 'board-editorial.md', 'review-editorial.md', 'changed-row.json', 'reviewed-originals/board-sentences.json', 'reviewed-originals/review-sentences.json']
export function validateExtensionManifest(raw) {
  if (createHash('sha256').update(raw).digest('hex') !== EXTENSION_MANIFEST_SHA256) throw Error('extension accepted manifest checkpoint drift')
  const manifest = JSON.parse(raw)
  if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify([...EXTENSION_FILES].sort())) throw Error('extension accepted manifest keyset drift')
  return manifest
}
