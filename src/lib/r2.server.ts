import { AwsClient } from "aws4fetch";

export function r2() {
  const accountId = process.env['R2_ACCOUNT_ID']!;
  const bucket = process.env['R2_BUCKET_NAME']!;
  const publicUrl = (process.env['R2_PUBLIC_URL'] ?? "").replace(/\/+$/, "");
  const client = new AwsClient({
    accessKeyId: process.env['R2_ACCESS_KEY_ID']!,
    secretAccessKey: process.env['R2_SECRET_ACCESS_KEY']!,
    service: "s3",
    region: "auto",
  });
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
  return { client, base, publicUrl };
}
