export interface ParsedS3Uri {
  bucket: string;
  key: string;
}

/**
 * Parse S3 URI into bucket and key
 * @param uri - S3 URI in format "s3://bucket-name/path/to/file"
 * @returns Parsed bucket and key, or null if invalid format
 */
export function parseS3Uri(uri: string): ParsedS3Uri | null {
  const match = uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (!match) {
    return null;
  }

  return {
    bucket: match[1],
    key: match[2],
  };
}
