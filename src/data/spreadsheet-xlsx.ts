import { inflateRawSync } from 'node:zlib'
import { readSheet } from 'read-excel-file/universal'
import { ApiError } from '../errors'
import { Parser } from 'saxen'

const expandedLimit = 16 * 1024 * 1024

function inspectArchive(bytes: Buffer) {
  const entries = new Map<string, Buffer>()
  let end = -1
  for (
    let index = bytes.length - 22;
    index >= Math.max(0, bytes.length - 65_557);
    index--
  ) {
    if (
      bytes.readUInt32LE(index) === 0x06054b50 &&
      index + 22 + bytes.readUInt16LE(index + 20) === bytes.length
    ) {
      end = index
      break
    }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6))
    throw new Error('Invalid archive')
  const count = bytes.readUInt16LE(end + 10)
  const directorySize = bytes.readUInt32LE(end + 12)
  const directoryStart = bytes.readUInt32LE(end + 16)
  if (
    !count ||
    count > 128 ||
    bytes.readUInt16LE(end + 8) !== count ||
    directoryStart + directorySize !== end
  )
    throw new Error('Archive entry limit exceeded')
  let cursor = directoryStart
  let expanded = 0
  const ranges: [number, number][] = []

  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error('Invalid archive')
    const flags = bytes.readUInt16LE(cursor + 8)
    const method = bytes.readUInt16LE(cursor + 10)
    const compressedSize = bytes.readUInt32LE(cursor + 20)
    const size = bytes.readUInt32LE(cursor + 24)
    const nameLength = bytes.readUInt16LE(cursor + 28)
    const extraLength = bytes.readUInt16LE(cursor + 30)
    const commentLength = bytes.readUInt16LE(cursor + 32)
    const local = bytes.readUInt32LE(cursor + 42)
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      size > expandedLimit - expanded ||
      cursor + 46 + nameLength + extraLength + commentLength > end
    )
      throw new Error('Archive expansion limit exceeded')
    const name = bytes
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString('utf8')
    if (
      !name ||
      entries.has(name) ||
      name.includes('..') ||
      name.includes('\\') ||
      name.startsWith('/') ||
      name
        .split('/')
        .some((part) =>
          ['__proto__', 'prototype', 'constructor'].includes(part),
        ) ||
      /vbaProject\.bin$/i.test(name)
    )
      throw new Error('Unsupported archive entry')
    if (
      local + 30 > directoryStart ||
      bytes.readUInt32LE(local) !== 0x04034b50 ||
      bytes.readUInt16LE(local + 6) !== flags ||
      bytes.readUInt16LE(local + 8) !== method
    )
      throw new Error('Invalid archive entry')
    const localNameLength = bytes.readUInt16LE(local + 26)
    const localExtraLength = bytes.readUInt16LE(local + 28)
    const start = local + 30 + localNameLength + localExtraLength
    const finish = start + compressedSize
    if (
      finish > directoryStart ||
      bytes
        .subarray(local + 30, local + 30 + localNameLength)
        .toString('utf8') !== name ||
      ranges.some(([a, b]) => local < b && finish > a)
    )
      throw new Error('Invalid archive entry')
    if (
      !(flags & 8) &&
      (bytes.readUInt32LE(local + 18) !== compressedSize ||
        bytes.readUInt32LE(local + 22) !== size)
    )
      throw new Error('Invalid archive size')
    ranges.push([local, finish])
    const compressed = bytes.subarray(start, finish)
    const content =
      method === 8
        ? inflateRawSync(compressed, {
            maxOutputLength: Math.max(1, expandedLimit - expanded),
          })
        : compressed
    if (content.length !== size)
      throw new Error('Invalid expanded archive size')
    expanded += content.length
    entries.set(name, content)
    cursor += 46 + nameLength + extraLength + commentLength
  }
  if (cursor !== end) throw new Error('Invalid archive directory')
  return entries
}

function xmlText(content: Buffer) {
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(content)
  if (/<!DOCTYPE|<!ENTITY|macroEnabled/i.test(xml))
    throw new Error('Unsupported XML content')
  return xml
}

function worksheetPaths(entries: Map<string, Buffer>) {
  const relationships = entries.get('xl/_rels/workbook.xml.rels')
  if (!relationships) throw new Error('Workbook relationships are missing')

  const paths = new Set<string>()
  const parser = new Parser()
  parser.on('error', (error) => {
    throw error
  })
  parser.on('warn', (error) => {
    throw error
  })
  parser.on('openTag', (tag, attributes, decode) => {
    if (tag.split(':').at(-1) !== 'Relationship') return
    const attrs = Object.fromEntries(
      Object.entries(attributes()).map(([key, value]) => [
        key.split(':').at(-1)!,
        decode(value),
      ]),
    )
    if (
      ![
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
        'http://purl.oclc.org/ooxml/officeDocument/relationships/worksheet',
      ].includes(attrs.Type)
    )
      return

    const target = attrs.Target
    if (!target) throw new Error('Worksheet target is missing')
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    if (!entries.has(path)) throw new Error('Worksheet target is missing')
    paths.add(path)
  })
  parser.parse(xmlText(relationships))
  return paths
}

function inspectXml(entries: Map<string, Buffer>) {
  const selectedPaths = worksheetPaths(entries)
  let sheetName = 'Sheet 1'
  let foundSheet = false
  for (const [name, content] of entries) {
    if (
      !selectedPaths.has(name) &&
      !/\.(xml|rels)$/i.test(name) &&
      !content.toString('utf8').trimStart().startsWith('<')
    )
      continue
    const xml = xmlText(content)
    let root = true
    let worksheet = false
    let formula = false
    let value = false
    let inValue = false
    let rowCount = 0
    let cells = 0
    const parser = new Parser()
    parser.on('error', (error) => {
      throw error
    })
    parser.on('warn', (error) => {
      throw error
    })
    parser.on('openTag', (tag, attributes, decode) => {
      const local = tag.split(':').at(-1)
      if (root) {
        // Workbook relationships may point to worksheet XML at any archive path.
        worksheet = local === 'worksheet'
        if (selectedPaths.has(name) && !worksheet)
          throw new Error('Worksheet document has an invalid root')
        root = false
      }
      const attrs = Object.fromEntries(
        Object.entries(attributes())
          .filter(([key]) => !key.startsWith('xmlns'))
          .map(([key, value]) => [key.split(':').at(-1)!, decode(value)]),
      )
      if (name === 'xl/workbook.xml' && local === 'sheet' && !foundSheet) {
        sheetName = attrs.name ?? 'Sheet 1'
        foundSheet = true
      }
      if (!worksheet) return
      if (local === 'row') {
        if (++rowCount > 5001)
          throw new ApiError(400, 'Use at most 5000 data rows')
        const coordinate = attrs.r ?? String(rowCount)
        if (
          !/^\d+$/.test(coordinate) ||
          Number(coordinate) < 1 ||
          Number(coordinate) > 5001
        )
          throw new ApiError(400, 'Use at most 5000 data rows')
        cells = 0
      }
      if (local === 'c') {
        formula = false
        value = false
        if (++cells > 64) throw new ApiError(400, 'Use at most 64 columns')
        const coordinate = attrs.r ?? ''
        const address = coordinate.match(/^([A-Z]+)(\d+)$/)
        if (!address) throw new Error('Invalid cell coordinate')
        let column = 0
        for (const character of address[1])
          column = column * 26 + character.charCodeAt(0) - 64
        if (column > 64 || Number(address[2]) < 1 || Number(address[2]) > 5001)
          throw new ApiError(400, 'Use at most 5000 data rows and 64 columns')
      }
      if (local === 'f') formula = true
      if (local === 'v') inValue = true
    })
    parser.on('text', (text) => {
      if (inValue && text.trim()) value = true
    })
    parser.on('closeTag', (tag) => {
      const local = tag.split(':').at(-1)
      if (local === 'v') inValue = false
      if (local === 'c' && formula && !value)
        throw new ApiError(
          400,
          'A formula has no saved result. Open the workbook in Excel, calculate formulas, and save before importing.',
        )
    })
    parser.parse(xml)
  }
  return sheetName
}

export async function readExcel(file: File) {
  try {
    const bytes = Buffer.from(await file.arrayBuffer())
    const entries = inspectArchive(bytes)
    const sheetName = inspectXml(entries)
    const data = await readSheet(new Uint8Array(bytes).buffer, { trim: false })
    return { data, sheetName }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      400,
      'This Excel file is invalid, encrypted, macro-enabled, or exceeds safe workbook limits. Upload a plain .xlsx file.',
    )
  }
}
