import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "healthcare-ai-records";

export class S3Service {
  /**
   * Uploads a file buffer to S3 with AES256 Server-Side Encryption
   * Path format: records/{userId}/{timestamp}-{filename}
   */
  static async uploadFile(
    userId: string,
    filename: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const timestamp = Date.now();
    // Sanitize filename to remove spaces
    const safeFilename = filename.replace(/\s+/g, '_');
    const key = `records/${userId}/${timestamp}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
    });

    await s3Client.send(command);
    return key;
  }

  /**
   * Streams an object back into memory. Used by the storage abstraction so the
   * AI pipeline can re-read a file it did not keep a copy of.
   */
  static async getObjectBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const response = await s3Client.send(command);
    const body = response.Body as any;
    if (!body) throw new Error(`S3 object ${key} returned no body`);

    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Generates a pre-signed URL to securely access a file.
   * Expiry default is 15 minutes (900 seconds).
   */
  static async getPresignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    // Create the presigned URL
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  }
}
