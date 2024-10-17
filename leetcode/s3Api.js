import sharp from 'sharp';

export async function uploadImagesToS3(imageData, imageName, s3Path) {
    // Resize and upload the answer full-size image
    const resizedAnswerImageData = await resizeImage(imageData, 1200, 1200); // Resize for full-size answer
    imageSrc = await uploadImageToS3({
        imageData: resizedAnswerImageData,
        imageName: `${s3Path}/full/${imageName}`,
    });

    // Resize and upload the answer thumbnail image
    const resizedAnswerThumbData = await resizeImage(imageData, 350, 450); // Resize for thumbnail answer
    thumbSrc = await uploadImageToS3({
        imageData: resizedAnswerThumbData,
        imageName: `${s3Path}/thumbs/${imageName}`,
    });

    return { imageSrc, thumbSrc }
}

async function uploadImageToS3({ imageData, imageName }) {
    // Fetch the presigned URL from your API Gateway endpoint
    const presignedUrlWebhook = process.env.PRESIGNED_URL_WEBHOOK;
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

    // Return the final S3 object URL
    return `https://yt-flashcards.s3.us-west-1.amazonaws.com/${imageName}`;
}

async function resizeImage(imageData, maxWidth, maxHeight) {
    try {
        const resizedImageBuffer = await sharp(imageData)
            .resize({
                width: maxWidth,
                height: maxHeight,
                fit: 'inside', // Keeps aspect ratio within max dimensions
            })
            .jpeg({ quality: 90 }) // Similar quality setting as canvas
            .toBuffer();

        // Convert the buffer to a base64 Data URL for inline usage
        return `data:image/jpeg;base64,${resizedImageBuffer.toString('base64')}`;
    } catch (error) {
        throw new Error('Error resizing image: ' + error.message);
    }
}
