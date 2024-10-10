import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const TAG = "array"; // Replace this with the desired tag

// Helper function to get the __dirname in ES6 module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function combineAndSaveData(tag) {
    // Paths to the input files
    const problemsDataPath = path.join(__dirname, `../data/CS/leetcode/${tag}_problems_data.js`);
    const readableDataPath = path.join(__dirname, `../data/CS/leetcode/${tag}_readable_data.js`);

    // Read and parse the files
    const problemsData = JSON.parse(fs.readFileSync(problemsDataPath, 'utf8'));
    const readableData = JSON.parse(fs.readFileSync(readableDataPath, 'utf8'));

    // Combine the data
    let combinedData = '';
    readableData.forEach(readableProblem => {
        const problem = problemsData.find(p => p.title === readableProblem.title);
        combinedData += `Title: ${readableProblem.title.trim()}\nQ: "${readableProblem.problem.trim()}"\n`;
        if (problem) {
            combinedData += `A: "${readableProblem.textSolution.trim()}"\n`;
            if (problem.examples) {
                combinedData += `Examples: "${problem.examples.trim()}"`;
            }
        }
        combinedData += '\n--\n\n'; // Add an extra line for separation
    });

    // Path for the output file
    const outputPath = path.join(__dirname, `./zipped/${tag}.txt`);

    // Write the combined data to the output file
    fs.writeFileSync(outputPath, combinedData, 'utf8');
    console.log(`Data saved to ${outputPath}`);
}

// Call the function with the desired tag
combineAndSaveData(TAG);
