import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type'

export async function uploadImagesToS3(imageData, imageName, s3Path) {
    // Resize and upload the answer full-size image
    const resizedImageData = await resizeImage(imageData, 1200, 1200); // Resize for full-size answer
    const fullImageUrl = await uploadImageToS3({
        imageData: resizedImageData,
        imageName: `${s3Path}/full/${imageName}`,
    });

    // Resize and upload the answer thumbnail image
    const resizedThumbData = await resizeImage(imageData, 350, 450); // Resize for thumbnail answer
    const thumbImageUrl = await uploadImageToS3({
        imageData: resizedThumbData,
        imageName: `${s3Path}/thumb/${imageName}`,
    });

    return { fullImageUrl, thumbImageUrl }
}

// TODO fix the endpoint for uploading images we need to use memkeyendpoint
// we also need to fix the url returned at the end the endpoint should return the url
async function uploadImageToS3({ imageData, imageName }) {
    // Fetch the presigned URL from your API Gateway endpoint
    const presignedUrlWebhook = process.env.PRESIGNED_URL_WEBHOOK
    const requestUrl = `${presignedUrlWebhook}${imageName}`;
    const response = await fetch(requestUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch presigned URL from ${requestUrl}`);
    }

    // Extract presigned URL from response
    const { url: presignedUrl } = await response.json();

    // Convert base64 image data to binary using Buffer
    const base64ImageContent = imageData.replace(/^data:image\/\w+;base64,/, "");
    const binaryImg = Buffer.from(base64ImageContent, 'base64');

    // Upload the image using the presigned URL
    const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: binaryImg,
        headers: {
            'Content-Type': 'image/jpeg' // Set appropriate content type
        }
    });

    if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
    }

    // TODO return the url here from the response
}

async function resizeImage(imageData, maxWidth, maxHeight) {
    try {
        // Validate the file type to ensure it's a PNG or other supported format
        const fileType = await fileTypeFromBuffer(imageData);

        if (!fileType || !['image/png', 'image/jpeg'].includes(fileType.mime)) {
            throw new Error(`Unsupported image format: ${fileType ? fileType.mime : 'unknown'}`);
        }

        // Resize and convert the image to JPEG
        const resizedImageBuffer = await sharp(imageData)
            .resize({
                width: maxWidth,
                height: maxHeight,
                fit: 'inside', // Keeps aspect ratio within max dimensions
            })
            .jpeg({ quality: 90 }) // Convert to JPEG
            .toBuffer();

        // Return as base64 encoded JPEG
        return `data:image/jpeg;base64,${resizedImageBuffer.toString('base64')}`;
    } catch (error) {
        throw new Error('Error resizing and converting image: ' + error.message);
    }
}

