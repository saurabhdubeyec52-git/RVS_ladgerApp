import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { randomUUID } from 'crypto'

const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp'
}
const EXT_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp'
}

function attachmentsDir() {
  const dir = join(app.getPath('userData'), 'attachments')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Saves a base64 data URL (data:image/...;base64,XXXX) to disk and returns the
 * stored filename. Throws on an unsupported / malformed image.
 */
export function saveAttachment(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || '')
  if (!match) throw new Error('Unsupported image format')
  const mime = match[1].toLowerCase()
  const ext = MIME_EXT[mime]
  if (!ext) throw new Error('Only image files are supported')

  const filename = `${randomUUID()}.${ext}`
  writeFileSync(join(attachmentsDir(), filename), Buffer.from(match[2], 'base64'))
  return filename
}

/** Reads a stored attachment back into a data URL for display, or null. */
export function readAttachment(filename) {
  if (!filename) return null
  const path = join(attachmentsDir(), filename)
  if (!existsSync(path)) return null
  const ext = filename.split('.').pop().toLowerCase()
  const mime = EXT_MIME[ext] || 'application/octet-stream'
  const data = readFileSync(path).toString('base64')
  return `data:${mime};base64,${data}`
}
