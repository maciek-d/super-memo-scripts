import fs from 'fs/promises';
import path from 'path';

const __dirname = decodeURIComponent(path.dirname(new URL(import.meta.url).pathname));

const moveFiles = async (srcDir, dataPath) => {
  try {
    // Read all files in source directory
    const files = await fs.readdir(srcDir);

    for (const file of files) {
      // Check if file ends with '_links.js'
      if (file.endsWith('_links.js')) {
        const srcPath = path.join(srcDir, file);

        // Extract the prefix and determine if it's premium
        const [tag] = file.split('_');
        const isPremium = file.includes('premium');

        // Define destination paths based on premium status
        const problemUrlCachePath = `${dataPath}/problemUrls/${tag}.js`;
        const premiumProblemUrlCachePath = `${dataPath}/premiumProblemUrls/${tag}.js`;
        const destPath = isPremium ? premiumProblemUrlCachePath : problemUrlCachePath;

        // Ensure destination directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });

        // Copy the file to the appropriate destination
        console.log(`Copying file: ${file} - Prefix: ${tag} - Destination: ${destPath}`);
        await fs.copyFile(srcPath, destPath);
      }
    }
    console.log('File copy completed.');
  } catch (err) {
    console.error('Error:', err);
  }
};

// Set your source path and data path
const srcPath = "/Users/maciek/Development/personal projects/SuperMemo/script/data/CS/cache";
const dataPath = path.join(__dirname, 'data');

// Call the moveFiles function
moveFiles(srcPath, dataPath);

