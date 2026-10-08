import { crc32 } from 'node:zlib'

// The archive has already passed size, path, structure, and expansion checks.
// Stored entries avoid Bun's incompatible asynchronous browser decompressor.
export function storedWorkbook(entries: Map<string, Buffer>) {
  const files: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0
  let directorySize = 0
  for (const [path, bytes] of entries) {
    const name = Buffer.from(path, 'utf8')
    const checksum = crc32(bytes)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(bytes.length, 18)
    local.writeUInt32LE(bytes.length, 22)
    local.writeUInt16LE(name.length, 26)
    files.push(local, name, bytes)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x800, 8)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(bytes.length, 20)
    central.writeUInt32LE(bytes.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    directory.push(central, name)
    directorySize += central.length + name.length
    offset += local.length + name.length + bytes.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.size, 8)
  end.writeUInt16LE(entries.size, 10)
  end.writeUInt32LE(directorySize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...files, ...directory, end])
}
