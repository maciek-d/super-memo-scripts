import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const TAG = "array";

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadProcessedTitles() {
    const processedTitlesFilePath = path.join(__dirname, './processedTitles.json');
    try {
        const processedTitlesData = await fs.readFile(processedTitlesFilePath, 'utf8');
        return JSON.parse(processedTitlesData);
    } catch (error) {
        // File might not exist yet, it's okay
    }
    return [];
}

export async function processNext(tag) {
    const processedTitles = await loadProcessedTitles();

    const problemsFilePath = path.join(__dirname, `../../data/CS/leetcode/new/${tag}_problems_data.js`);
    const problemsData = await fs.readFile(problemsFilePath, 'utf8');
    const problems = JSON.parse(problemsData);

    const problemToProcess = problems.find(p => !processedTitles.includes(p.title));

    if (!problemToProcess) {
        console.log('No new problems to process.');
        return false;
    }

    await processProblem(problemToProcess, processedTitles);
    return true;
}

async function processProblem(problem, processedTitles) {
    const templatePath = path.join(__dirname, './promptTemplate.txt');
    const template = await fs.readFile(templatePath, 'utf8');

    const filledTemplate = template
        .replace(/Problem:\n```/, `Problem:\n\`\`\`\n${problem.problem.trim()}`)
        .replace(/Extracted Solution:\n```/, `Extracted Solution:\n\`\`\`\n${problem.textSolution.trim()}`)
        .replace(/Input Output Examples:\n```/, `Input Output Examples:\n\`\`\`\n${problem.examples.trim()}`);

    // console.log(filledTemplate);
    await fs.writeFile(path.join(__dirname, 'prompt.txt'), filledTemplate);

    const processedTitlesFilePath = path.join(__dirname, './processedTitles.json');
    if (!processedTitles.includes(problem.title))
        processedTitles.push(problem.title);
    await fs.writeFile(processedTitlesFilePath, JSON.stringify(processedTitles, null, 2));
}

async function processProblemByNumber(tag, number) {
    const problemsFilePath = path.join(__dirname, `../../data/CS/leetcode/${tag}_problems_data.js`);
    const problemsData = await fs.readFile(problemsFilePath, 'utf8');
    const problems = JSON.parse(problemsData);  // Assuming problemsData is a JSON string

    const specificProblem = problems.find(p => p.title.includes(number.toString()));

    if (!specificProblem) {
        console.log(`Problem with number ${number} not found.`);
        return;
    }

    let processedTitles = await loadProcessedTitles();  // Use the loadProcessedTitles function

    // Check if the problem has already been processed and alert the user
    if (processedTitles.includes(specificProblem.title)) {
        console.log(`Regenerating prompt for title "${specificProblem.title}" which was previously processed.`);
    }

    // Process the problem
    await processProblem(specificProblem, processedTitles);
}


// Process the next unprocessed problem
// processNext(TAG).catch(console.error);

const filePathFromMeta = decodeURIComponent(new URL(import.meta.url).pathname);
const isMain = filePathFromMeta === process.argv[1];

if (isMain) { // doesn't run on import
    processProblemByNumber(TAG, 1431).catch(console.error);
}