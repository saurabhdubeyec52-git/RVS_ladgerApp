import { app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import yazl from 'yazl'
import yauzl from 'yauzl'
import { getDb } from '../db/connection.js'

const BACKUP_FORMAT = 'rvs-ledger-backup'
const BACKUP_VERSION = 1
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024
const MAX_DATA_BYTES = 256 * 1024 * 1024
const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024
const SAFE_ATTACHMENT = /^attachments\/[0-9a-f-]{36}\.(png|jpg|gif|webp|bmp)$/i
const TABLES = ['users', 'transactions', 'pending_payments', 'promise_history']
const ATTACHMENT_ROOT = app.getPath('userData')

const selectRows = (db, table) => db.prepare(`SELECT * FROM ${table}`).all()
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = (value, nullable = true) =>
  (nullable && value == null) || typeof value === 'string'
const isId = (value) => Number.isSafeInteger(value) && value > 0
const isMoney = (value, allowZero = true) =>
  typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
const isDateText = (value) => typeof value === 'string' && value.length > 0 && value.length <= 40

function snapshotData() {
  const db = getDb()
  return db.transaction(() => ({
    users: selectRows(db, 'users'),
    transactions: selectRows(db, 'transactions'),
    pending_payments: selectRows(db, 'pending_payments'),
    promise_history: selectRows(db, 'promise_history')
  })).deferred()
}

function zipToFile(entries, destination) {
  const zip = new yazl.ZipFile()
  const output = fs.createWriteStream(destination, { flags: 'wx' })
  const writing = pipeline(zip.outputStream, output)
  for (const entry of entries) {
    if (entry.buffer) zip.addBuffer(entry.buffer, entry.name)
    else zip.addFile(entry.path, entry.name)
  }
  zip.end()
  return writing
}

/** Creates one portable backup containing business records and referenced photos. */
export async function createBackupFile(destination) {
  const data = snapshotData()
  const dataBuffer = Buffer.from(JSON.stringify(data), 'utf8')
  if (dataBuffer.length > MAX_DATA_BYTES) {
    throw new Error('Ledger data exceeds the maximum supported backup size.')
  }
  const imageNames = [...new Set(data.transactions.map((row) => row.image_path).filter(Boolean))]
  const attachmentEntries = []
  let totalAttachmentBytes = 0

  for (const filename of imageNames) {
    if (typeof filename !== 'string' || path.basename(filename) !== filename || !/^[0-9a-f-]{36}\.(png|jpg|gif|webp|bmp)$/i.test(filename)) {
      throw new Error('The database contains an invalid attachment reference; backup was not created.')
    }
    const filePath = path.join(ATTACHMENT_ROOT, 'attachments', filename)
    const stat = await fs.promises.stat(filePath).catch(() => null)
    if (!stat?.isFile() || stat.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Attachment ${filename} is missing or exceeds the backup size limit.`)
    }
    totalAttachmentBytes += stat.size
    if (totalAttachmentBytes > MAX_ARCHIVE_BYTES) {
      throw new Error('Transaction photos exceed the maximum supported backup size.')
    }
    attachmentEntries.push({ path: filePath, name: `attachments/${filename}` })
  }

  const manifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    includes: [...TABLES, 'referenced attachments'],
    excludes: ['admin credentials', 'super-admin credentials', 'license and device metadata']
  }
  const entries = [
    { buffer: Buffer.from(JSON.stringify(manifest), 'utf8'), name: 'manifest.json' },
    { buffer: dataBuffer, name: 'data.json' },
    ...attachmentEntries
  ]

  try {
    await zipToFile(entries, destination)
    const stat = await fs.promises.stat(destination)
    if (stat.size > MAX_ARCHIVE_BYTES) throw new Error('Backup exceeds the maximum supported size.')
    return { path: destination, size: stat.size, createdAt: manifest.createdAt }
  } catch (error) {
    await fs.promises.rm(destination, { force: true }).catch(() => {})
    throw error
  }
}

function openZip(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, {
      lazyEntries: true,
      autoClose: true,
      decodeStrings: true,
      validateEntrySizes: true,
      strictFileNames: true
    }, (error, zip) => error ? reject(error) : resolve(zip))
  })
}

function readEntry(zip, entry, maximumBytes) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) return reject(error)
      const chunks = []
      let bytes = 0
      stream.on('data', (chunk) => {
        bytes += chunk.length
        if (bytes > maximumBytes) {
          stream.destroy(new Error('Backup entry exceeds its size limit.'))
          return
        }
        chunks.push(chunk)
      })
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks, bytes)))
    })
  })
}

async function readBackupArchive(filePath, stageAttachments) {
  const stat = await fs.promises.stat(filePath)
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_ARCHIVE_BYTES) {
    throw new Error('Backup file is empty or exceeds the 1 GB size limit.')
  }

  const zip = await openZip(filePath)
  const seen = new Set()
  const contents = { manifest: null, data: null, attachmentNames: new Set() }
  let entryCount = 0
  let uncompressedBytes = 0

  return new Promise((resolve, reject) => {
    let finished = false
    const fail = (error) => {
      if (finished) return
      finished = true
      zip.close()
      reject(error)
    }
    zip.on('error', fail)
    zip.on('end', () => {
      if (finished) return
      finished = true
      resolve(contents)
    })
    zip.on('entry', (entry) => {
      ;(async () => {
        const name = entry.fileName
        if (++entryCount > 100000) throw new Error('Backup contains too many entries.')
        uncompressedBytes += entry.uncompressedSize
        if (uncompressedBytes > MAX_ARCHIVE_BYTES) throw new Error('Backup expands beyond the 1 GB size limit.')
        if (seen.has(name)) throw new Error('Backup contains duplicate file entries.')
        seen.add(name)

        if (name === 'manifest.json') {
          if (entry.uncompressedSize > 64 * 1024) throw new Error('Backup manifest is too large.')
          contents.manifest = JSON.parse((await readEntry(zip, entry, 64 * 1024)).toString('utf8'))
        } else if (name === 'data.json') {
          if (entry.uncompressedSize > MAX_DATA_BYTES) throw new Error('Backup data is too large.')
          contents.data = JSON.parse((await readEntry(zip, entry, MAX_DATA_BYTES)).toString('utf8'))
        } else if (SAFE_ATTACHMENT.test(name)) {
          if (entry.uncompressedSize > MAX_ATTACHMENT_BYTES) throw new Error('An attachment exceeds the 100 MB size limit.')
          const filename = path.basename(name)
          const destination = path.join(stageAttachments, filename)
          await pipeline(
            await new Promise((resolveStream, rejectStream) => {
              zip.openReadStream(entry, (error, stream) => error ? rejectStream(error) : resolveStream(stream))
            }),
            fs.createWriteStream(destination, { flags: 'wx' })
          )
          contents.attachmentNames.add(filename)
        } else {
          throw new Error(`Unexpected or unsafe file in backup: ${name}`)
        }
      })().then(() => zip.readEntry(), fail)
    })
    zip.readEntry()
  })
}

function validateBackup(contents) {
  const { manifest, data } = contents
  if (!isRecord(manifest) || manifest.format !== BACKUP_FORMAT || manifest.formatVersion !== BACKUP_VERSION) {
    throw new Error('This is not a supported RVS Ledger backup file.')
  }
  if (!isRecord(data) || TABLES.some((table) => !Array.isArray(data[table]))) {
    throw new Error('Backup data is incomplete or invalid.')
  }

  const userIds = new Set()
  for (const user of data.users) {
    if (!isRecord(user) || !isId(user.id) || userIds.has(user.id) || typeof user.name !== 'string' || !user.name.trim()) {
      throw new Error('Backup contains an invalid or duplicate customer.')
    }
    if (!isText(user.phone) || !isText(user.email) || !isText(user.address) || !isText(user.area) || !isText(user.notes) || !isText(user.archived_at) || !isDateText(user.created_at) || !isDateText(user.updated_at)) {
      throw new Error('Backup contains invalid customer fields.')
    }
    userIds.add(user.id)
  }

  const transactionIds = new Set()
  const referencedAttachments = new Set()
  for (const transaction of data.transactions) {
    if (!isRecord(transaction) || !isId(transaction.id) || transactionIds.has(transaction.id) || !userIds.has(transaction.user_id)) {
      throw new Error('Backup contains an invalid or duplicate transaction.')
    }
    if (!['credit', 'debit'].includes(transaction.type) || !isMoney(transaction.amount, false) || !isText(transaction.description) || !isDateText(transaction.txn_date) || !isDateText(transaction.created_at) || !isText(transaction.archived_at)) {
      throw new Error('Backup contains invalid transaction fields.')
    }
    if (transaction.image_path != null) {
      if (typeof transaction.image_path !== 'string' || !/^[0-9a-f-]{36}\.(png|jpg|gif|webp|bmp)$/i.test(transaction.image_path)) {
        throw new Error('Backup contains an invalid attachment reference.')
      }
      referencedAttachments.add(transaction.image_path)
    }
    transactionIds.add(transaction.id)
  }

  const pendingIds = new Set()
  for (const promise of data.pending_payments) {
    if (!isRecord(promise) || !isId(promise.id) || pendingIds.has(promise.id) || !userIds.has(promise.user_id)) {
      throw new Error('Backup contains an invalid or duplicate promise.')
    }
    if (!isMoney(promise.amount, false) || !isDateText(promise.promised_date) || !['pending', 'overdue', 'paid'].includes(promise.status) || !isText(promise.notified_at) || !isText(promise.settled_at) || !isDateText(promise.created_at)) {
      throw new Error('Backup contains invalid promise fields.')
    }
    pendingIds.add(promise.id)
  }

  const historyIds = new Set()
  for (const history of data.promise_history) {
    if (!isRecord(history) || !isId(history.id) || historyIds.has(history.id) || !userIds.has(history.user_id) || (history.pending_id != null && !pendingIds.has(history.pending_id))) {
      throw new Error('Backup contains an invalid or duplicate promise history entry.')
    }
    for (const amount of [history.old_amount, history.new_amount]) {
      if (amount != null && !isMoney(amount)) throw new Error('Backup contains an invalid history amount.')
    }
    if (!isText(history.old_date) || !isText(history.new_date) || !isText(history.action) || !isDateText(history.changed_at)) {
      throw new Error('Backup contains invalid promise history fields.')
    }
    historyIds.add(history.id)
  }

  if (referencedAttachments.size !== contents.attachmentNames.size || [...referencedAttachments].some((name) => !contents.attachmentNames.has(name))) {
    throw new Error('Backup is missing a referenced photo or contains unreferenced attachments.')
  }

  return { manifest, data, counts: Object.fromEntries(TABLES.map((table) => [table, data[table].length])) }
}

export async function inspectBackupFile(filePath, stageAttachments) {
  const contents = await readBackupArchive(filePath, stageAttachments)
  return validateBackup(contents)
}

function replaceAttachmentFolder(stageAttachments) {
  const target = path.join(ATTACHMENT_ROOT, 'attachments')
  const previous = path.join(ATTACHMENT_ROOT, `.attachments-before-restore-${process.pid}-${Date.now()}`)
  const hadTarget = fs.existsSync(target)
  if (hadTarget) fs.renameSync(target, previous)
  try {
    fs.renameSync(stageAttachments, target)
  } catch (error) {
    if (hadTarget) fs.renameSync(previous, target)
    throw error
  }
  return { target, previous, hadTarget }
}

/** Replaces business records only; local admin, super-admin and license remain on this device. */
export async function restoreBackupFile(filePath, beforeRestore) {
  const root = await fs.promises.mkdtemp(path.join(ATTACHMENT_ROOT, '.restore-stage-'))
  const stageAttachments = path.join(root, 'attachments')
  await fs.promises.mkdir(stageAttachments)
  let folderSwap = null

  try {
    const contents = await readBackupArchive(filePath, stageAttachments)
    const { data } = validateBackup(contents)
    if (beforeRestore) await beforeRestore()
    const currentDb = getDb()

    const restore = currentDb.transaction(() => {
      currentDb.prepare('DELETE FROM promise_history').run()
      currentDb.prepare('DELETE FROM pending_payments').run()
      currentDb.prepare('DELETE FROM transactions').run()
      currentDb.prepare('DELETE FROM users').run()

      const insertUser = currentDb.prepare(
        `INSERT INTO users (id, name, phone, email, address, notes, created_at, updated_at, archived_at, area)
         VALUES (@id, @name, @phone, @email, @address, @notes, @created_at, @updated_at, @archived_at, @area)`
      )
      const insertTransaction = currentDb.prepare(
        `INSERT INTO transactions (id, user_id, type, amount, description, txn_date, created_at, archived_at, image_path)
         VALUES (@id, @user_id, @type, @amount, @description, @txn_date, @created_at, @archived_at, @image_path)`
      )
      const insertPromise = currentDb.prepare(
        `INSERT INTO pending_payments (id, user_id, amount, promised_date, status, notified_at, settled_at, created_at)
         VALUES (@id, @user_id, @amount, @promised_date, @status, @notified_at, @settled_at, @created_at)`
      )
      const insertHistory = currentDb.prepare(
        `INSERT INTO promise_history (id, pending_id, user_id, old_amount, new_amount, old_date, new_date, action, changed_at)
         VALUES (@id, @pending_id, @user_id, @old_amount, @new_amount, @old_date, @new_date, @action, @changed_at)`
      )

      for (const row of data.users) insertUser.run(row)
      for (const row of data.transactions) insertTransaction.run(row)
      for (const row of data.pending_payments) insertPromise.run(row)
      for (const row of data.promise_history) insertHistory.run(row)

      folderSwap = replaceAttachmentFolder(stageAttachments)
    })

    try {
      restore()
    } catch (error) {
      if (folderSwap) {
        fs.rmSync(folderSwap.target, { recursive: true, force: true })
        if (folderSwap.hadTarget && fs.existsSync(folderSwap.previous)) {
          fs.renameSync(folderSwap.previous, folderSwap.target)
        }
        folderSwap = null
      }
      throw error
    }

    if (folderSwap?.hadTarget) await fs.promises.rm(folderSwap.previous, { recursive: true, force: true })
    return { counts: Object.fromEntries(TABLES.map((table) => [table, data[table].length])) }
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true }).catch(() => {})
  }
}

export function createTemporaryBackupPath() {
  return path.join(os.tmpdir(), `rvs-ledger-${process.pid}-${Date.now()}.rvsbackup`)
}

export function createAutomaticBackupPath() {
  const directory = path.join(ATTACHMENT_ROOT, 'backups')
  fs.mkdirSync(directory, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join(directory, `before-restore-${stamp}.rvsbackup`)
}

export async function saveUploadedBackup(req, destination) {
  let bytes = 0
  const limit = MAX_ARCHIVE_BYTES
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length
      if (bytes > limit) callback(new Error('Backup file exceeds the 1 GB size limit.'))
      else callback(null, chunk)
    }
  })
  await pipeline(req, meter, fs.createWriteStream(destination, { flags: 'wx' }))
  return bytes
}
