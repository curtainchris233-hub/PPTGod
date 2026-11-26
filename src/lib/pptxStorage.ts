import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const PPTX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const PPTX_CACHE_PREFIX = "pptx-cache/v1";
const MAX_CACHE_BYTES = 12 * 1024 * 1024;

let storage: { client: S3Client; bucket: string } | undefined;

function getStorage() {
  if (storage) return storage;
  const account = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!account || !bucket || !accessKeyId || !secretAccessKey) return undefined;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 2,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  storage = { client, bucket };
  return storage;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function savedPptxCacheKey(ownerId: string, deckId: string, content: object) {
  return `${PPTX_CACHE_PREFIX}/${hash(ownerId)}/${hash(deckId)}/${hash(JSON.stringify(content))}.pptx`;
}

export async function readSavedPptx(key: string) {
  const storage = getStorage();
  if (!storage) return null;
  const abortSignal = AbortSignal.timeout(3000);
  try {
    const result = await storage.client.send(
      new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
      { abortSignal }
    );
    const body = result.Body;
    if (!(body instanceof Readable)) return null;
    if (!result.ContentLength || result.ContentLength > MAX_CACHE_BYTES || abortSignal.aborted) {
      body.destroy();
      return null;
    }
    const abort = () => body.destroy(new Error("PPTX storage read timed out"));
    abortSignal.addEventListener("abort", abort, { once: true });
    try {
      return new Uint8Array(await body.transformToByteArray());
    } finally {
      abortSignal.removeEventListener("abort", abort);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") return null;
    console.error("Could not read a cached PPTX export");
    return null;
  }
}

export async function storeSavedPptx(key: string, bytes: Buffer) {
  const storage = getStorage();
  if (!storage || bytes.byteLength > MAX_CACHE_BYTES) return;
  try {
    await storage.client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: bytes,
        ContentType: PPTX_CONTENT_TYPE,
        CacheControl: "private, no-store",
      }),
      { abortSignal: AbortSignal.timeout(4000) }
    );
  } catch {
    console.error("Could not cache a PPTX export");
  }
}
