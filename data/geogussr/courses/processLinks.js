import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function replaceLinks() {
    const jsonFilePath = path.join(__dirname, 'GeoImages_new.json');
    const correctFilePath = path.join(__dirname, 'correct.txt');
    const outputFilePath = path.join(__dirname, 'processed.json');
    const fotkiLinksFilePath = path.join(__dirname, 'fotkiLinks.js');

    let fotkiLinks = [];

    try {
        // Read and parse the JSON file
        const jsonData = JSON.parse(await fs.readFile(jsonFilePath, 'utf8'));
        // Read the correct.txt file
        const correctData = await fs.readFile(correctFilePath, 'utf8');
        // Split the data into lines and process in pairs
        const lines = correctData.trim().split('\n');
        for (let i = 0; i < lines.length; i += 5) {
            const fotkiLink = lines[i + 2].trim();
            const geohintsLink = lines[i + 3].trim();
            // Replace links in the jsonData
            jsonData.forEach(item => {
                if (item.content && item.content.question && item.content.question.includes(geohintsLink)) {
                    item.content.question = item.content.question.replaceAll(geohintsLink, fotkiLink);
                    if (!fotkiLinks.includes(fotkiLink)) {
                        fotkiLinks.push(fotkiLink);
                    }
                }
            });
        }
        // Save the modified JSON to a new file
        await fs.writeFile(outputFilePath, JSON.stringify(jsonData, null, 2));

        // Write the Fotki links to a JavaScript file
        const fotkiLinksContent = `export const fotkiLinks = ${JSON.stringify(fotkiLinks, null, 2)};`;
        await fs.writeFile(fotkiLinksFilePath, fotkiLinksContent);

        console.log('Links replaced and saved to processed.json and fotkiLinks.js');
    } catch (error) {
        console.error('Error processing files:', error);
    }
}

replaceLinks();

