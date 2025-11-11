import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// Validate required environment variables
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !BUCKET_NAME || !R2_PUBLIC_URL) {
  console.error('Missing required R2/S3 environment variables:');
  if (!R2_ENDPOINT) console.error('  - R2_ENDPOINT');
  if (!R2_ACCESS_KEY_ID) console.error('  - R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) console.error('  - R2_SECRET_ACCESS_KEY');
  if (!BUCKET_NAME) console.error('  - R2_BUCKET_NAME');
  if (!R2_PUBLIC_URL) console.error('  - R2_PUBLIC_URL');
  throw new Error('Missing required R2/S3 environment variables. Please check your .env file.');
}

// Cloudflare R2 S3-compatible configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Log configuration on startup (without exposing secrets)
console.log('R2 S3 Configuration:');
console.log('  Endpoint:', R2_ENDPOINT);
console.log('  Bucket:', BUCKET_NAME);
console.log('  Public URL:', R2_PUBLIC_URL);
console.log('  Access Key ID:', R2_ACCESS_KEY_ID ? '***configured***' : 'MISSING');

/**
 * Upload a file to S3 (Cloudflare R2)
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - The desired file name or full key path (e.g., 'welcome/image.jpg' or 'image.jpg')
 * @param {string} contentType - The MIME type of the file
 * @returns {Promise<string>} The URL of the uploaded file
 */
export const uploadToS3 = async (fileBuffer, fileName, contentType) => {
  try {
    // Generate unique file name
    const uniqueFileName = `${crypto.randomUUID()}-${fileName.split('/').pop()}`;
    
    // Determine the key path
    // If fileName contains a path (e.g., 'welcome/image.jpg'), use it
    // Otherwise, default to 'profile-images/'
    let key;
    if (fileName.includes('/')) {
      // Extract the directory path and append unique filename
      const pathParts = fileName.split('/');
      const directory = pathParts.slice(0, -1).join('/');
      key = `${directory}/${uniqueFileName}`;
    } else {
      // Default to profile-images directory
      key = `profile-images/${uniqueFileName}`;
    }

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      // Make the file publicly accessible (adjust based on your needs)
      // ACL: 'public-read', // R2 may not support ACL, use public URL instead
    });

    console.log(`Uploading to S3 - Bucket: ${BUCKET_NAME}, Key: ${key}, ContentType: ${contentType}`);
    await s3Client.send(command);
    console.log('Upload successful to S3');

    // Construct the public URL using the Public Development URL
    // This ensures images are accessible through the public R2.dev endpoint
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    
    console.log(`Public URL: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.Code || error.code,
      requestId: error.$metadata?.requestId,
      httpStatusCode: error.$metadata?.httpStatusCode,
      bucket: BUCKET_NAME,
      endpoint: R2_ENDPOINT,
    });
    
    // Provide more specific error messages
    if (error.name === 'NoSuchBucket') {
      throw new Error(`Bucket "${BUCKET_NAME}" does not exist. Please create the bucket in Cloudflare R2.`);
    } else if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
      throw new Error('Invalid R2 credentials. Please check your access key and secret key.');
    } else if (error.message) {
      throw new Error(`S3 upload failed: ${error.message}`);
    } else {
      throw new Error('Failed to upload image to storage');
    }
  }
};

/**
 * Convert an old R2 URL to the new public URL format
 * @param {string} oldUrl - The old URL that might use the direct endpoint
 * @returns {string} The converted URL using the public development URL
 */
export const convertToPublicUrl = (oldUrl) => {
  if (!oldUrl) return oldUrl;
  
  // If already using public URL, return as is
  if (oldUrl.includes(R2_PUBLIC_URL)) {
    return oldUrl;
  }
  
  // Extract key from old URL format
  // Old format: https://endpoint/bucket/key
  // New format: https://pub-xxx.r2.dev/key
  const urlParts = oldUrl.split('/');
  const bucketIndex = urlParts.findIndex(part => part === BUCKET_NAME);
  
  if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
    const key = urlParts.slice(bucketIndex + 1).join('/');
    return `${R2_PUBLIC_URL}/${key}`;
  }
  
  // Fallback: try to extract profile-images or welcome path
  const profileImagesIndex = oldUrl.indexOf('profile-images/');
  const welcomeIndex = oldUrl.indexOf('welcome/');
  if (profileImagesIndex !== -1) {
    const key = oldUrl.substring(profileImagesIndex);
    return `${R2_PUBLIC_URL}/${key}`;
  } else if (welcomeIndex !== -1) {
    const key = oldUrl.substring(welcomeIndex);
    return `${R2_PUBLIC_URL}/${key}`;
  }
  
  // If we can't convert, return original
  return oldUrl;
};

/**
 * Delete a file from S3 (Cloudflare R2)
 * @param {string} fileUrl - The URL of the file to delete
 * @returns {Promise<void>}
 */
export const deleteFromS3 = async (fileUrl) => {
  if (!fileUrl) {
    console.log('No file URL provided for deletion');
    return;
  }

  try {
    // Extract key from URL
    // URL format: https://endpoint/bucket/key or https://pub-xxx.r2.dev/key
    const urlParts = fileUrl.split('/');
    let key;
    
    if (fileUrl.includes(R2_PUBLIC_URL)) {
      // Public URL: extract everything after the domain
      key = fileUrl.replace(R2_PUBLIC_URL + '/', '').replace(R2_PUBLIC_URL, '');
      // Remove leading slash if present
      if (key.startsWith('/')) {
        key = key.substring(1);
      }
    } else {
      // Standard R2 URL: extract after bucket name
      const bucketIndex = urlParts.findIndex(part => part === BUCKET_NAME);
      if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
        key = urlParts.slice(bucketIndex + 1).join('/');
      } else {
        // Fallback: try to extract profile-images or welcome path directly
        const profileImagesIndex = fileUrl.indexOf('profile-images/');
        const welcomeIndex = fileUrl.indexOf('welcome/');
        if (profileImagesIndex !== -1) {
          key = fileUrl.substring(profileImagesIndex);
        } else if (welcomeIndex !== -1) {
          key = fileUrl.substring(welcomeIndex);
        } else {
          // Last resort: try to get last two parts
          key = urlParts.slice(-2).join('/');
        }
      }
    }

    if (!key) {
      console.error('Could not extract key from URL:', fileUrl);
      return;
    }

    console.log(`Deleting from S3 - Bucket: ${BUCKET_NAME}, Key: ${key}`);
    
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`Successfully deleted from S3: ${key}`);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.Code || error.code,
      requestId: error.$metadata?.requestId,
      httpStatusCode: error.$metadata?.httpStatusCode,
      fileUrl: fileUrl,
    });
    // Don't throw error, just log it - we don't want to fail the upload if deletion fails
  }
};

export default { uploadToS3, deleteFromS3, convertToPublicUrl };

