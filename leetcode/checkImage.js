import { readdirSync, renameSync, readFileSync } from 'fs';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';

// Directory where images are stored
const dirPath = 'data/ai-images';

function renameFilesToPng(directory) {
    const files = readdirSync(directory);

    files.forEach(async (file) => {
        const filePath = path.join(directory, file);
        const imageBuffer = readFileSync(filePath);

        const fileType = await fileTypeFromBuffer(imageBuffer);
        if (fileType && fileType.ext === 'png') {
            const newFilePath = path.join(directory, path.parse(file).name + '.png');
            renameSync(filePath, newFilePath);
            console.log(`Renamed ${file} to ${path.parse(file).name}.png`);
        }
    });
}

// Call the function
renameFilesToPng(dirPath);

