import axios from "axios"
import sharp from "sharp"

export async function downloadImage(url) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
  });

  return Buffer.from(response.data, 'binary');
}

export async function resizeImage(buffer, maxWidth, maxHeight) {
  // Resize the image and convert to JPEG
  return await sharp(buffer)
    .resize(maxWidth, maxHeight, { fit: 'inside' }) // Maintain aspect ratio
    .toFormat('jpeg') // Convert to JPEG if needed
    .toBuffer();
}
