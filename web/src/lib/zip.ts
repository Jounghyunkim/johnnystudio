/**
 * 작은 zip 읽기 (소개 자료 묶음용, ADR-0013). 브라우저의 DecompressionStream("deflate-raw") 을 쓴다 (의존성 없음).
 *
 * - 저장(0)·deflate(8) 만 읽는다. 암호·zip64·여러 디스크는 받지 않는다
 * - 압축 폭탄을 막으려고 항목 수와, 꺼내는 항목의 크기를 센다. 선언된 크기를 믿지 않고 풀면서 센다
 * - 서버에는 zip 을 보내지 않는다. 여기서 꺼낸 글·그림을 양식에 채우고, 그림은 서버가 다시 그린다
 */
// Microsoft Store 용 큰 그림(ms/ 폴더, 4K)이 함께 들어 있어도 zip 은 열 수 있게 파일 크기는 넉넉히 두고,
// 항목 크기는 실제로 꺼낼 때만 막는다 (사이트가 쓰는 그림은 5MB 까지)
export const ZIP_LIMITS = { fileBytes: 200 * 1024 * 1024, entries: 300, entryBytes: 12 * 1024 * 1024 };

export class ZipError extends Error {}

export type ZipEntry = { name: string; size: number; read: () => Promise<Uint8Array> };

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** zip 의 파일 목록 (폴더 항목은 뺀다). 이름은 / 로 나눈 경로 */
export function listZip(buf: ArrayBuffer, limits = ZIP_LIMITS): ZipEntry[] {
  if (buf.byteLength > limits.fileBytes) throw new ZipError(`zip 파일이 너무 큽니다 (${Math.round(limits.fileBytes / 1024 / 1024)}MB 까지).`);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("zip 파일이 아니거나 깨졌습니다.");
  if (view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) throw new ZipError("여러 조각으로 나뉜 zip 은 읽을 수 없습니다.");
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new ZipError("zip64 형식은 읽을 수 없습니다. 일반 zip 으로 다시 묶어 주세요.");
  if (count > limits.entries) throw new ZipError(`zip 안의 파일이 너무 많습니다 (${limits.entries}개까지).`);
  if (cdOffset + cdSize > eocd) throw new ZipError("zip 파일이 깨졌습니다.");

  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > eocd || view.getUint32(p, true) !== CENTRAL) throw new ZipError("zip 목록이 깨졌습니다.");
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, "/");
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    if (flags & 1) throw new ZipError("암호를 건 zip 은 읽을 수 없습니다.");
    if (method !== 0 && method !== 8) throw new ZipError(`${name}: 이 압축 방식은 읽을 수 없습니다 (저장·Deflate 만).`);
    if (size === 0xffffffff || compSize === 0xffffffff) throw new ZipError("zip64 형식은 읽을 수 없습니다.");
    const tooBig = new ZipError(`${name}: 파일이 너무 큽니다 (${Math.round(limits.entryBytes / 1024 / 1024)}MB 까지).`);
    entries.push({
      name,
      size,
      read: () => (size > limits.entryBytes ? Promise.reject(tooBig) : readEntry(buf, view, localOffset, compSize, method, limits.entryBytes, name)),
    });
  }
  return entries;
}

async function readEntry(buf: ArrayBuffer, view: DataView, offset: number, compSize: number, method: number, cap: number, name: string): Promise<Uint8Array> {
  if (offset + 30 > buf.byteLength || view.getUint32(offset, true) !== LOCAL) throw new ZipError(`${name}: zip 항목이 깨졌습니다.`);
  const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
  if (start + compSize > buf.byteLength) throw new ZipError(`${name}: zip 항목이 깨졌습니다.`);
  const data = new Uint8Array(buf, start, compSize);
  if (method === 0) return data.slice();
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > cap) {
        await reader.cancel();
        throw new ZipError(`${name}: 푼 크기가 너무 큽니다.`);
      }
      parts.push(value);
    }
  } catch (err) {
    if (err instanceof ZipError) throw err;
    throw new ZipError(`${name}: 압축을 풀지 못했습니다.`);
  }
  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}
