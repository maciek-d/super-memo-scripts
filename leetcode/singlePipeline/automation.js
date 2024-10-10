import clipboardy from 'clipboardy';
import { writeFileSync } from 'fs';
import fs from 'fs/promises';
import readline from 'readline';

import robot from 'robotjs';

import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { run as uploadFlashcards } from '../../uploadCards.js';
import { createFlashcard } from './extractFlashcard.js';
import { processNext } from './generatePrompt.js';
// import { main as fetchNextBatch } from './processProblem.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAG = "array";

// Function to read file and copy content to clipboard
async function copyFileToClipboard(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        clipboardy.writeSync(data);
        // console.log('File content copied to clipboard');
    } catch (error) {
        console.error('Error reading file:', error);
    }
}

async function saveClipboardToFile() {
    try {
        // Read from clipboard
        const clipboardContent = clipboardy.readSync();

        // Define the file path
        const filePath = path.join(__dirname, 'response.txt');

        // Write to the file
        await fs.writeFile(filePath, clipboardContent, 'utf8');
        // console.log('Clipboard content saved to response.txt');
    } catch (error) {
        console.error('Error saving clipboard content:', error);
    }
}

async function debug() {
    function waitForEnter() {
        return new Promise((resolve, reject) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.on('line', (input) => {
                if (input === 'q') {
                    rl.close();
                    reject(new Error('Program exited by user'));
                } else if (input.length === 0) {
                    rl.close();
                    resolve();
                }
            });
        });
    }
    robot.keyTap('tab', 'command');
    robot.keyTap('enter');
    await waitForEnter();
    robot.keyTap('tab', 'command');
    robot.keyTap('enter');
}

async function copyResponse() {
    await sleep("300");
    robot.keyTap("escape");
    await sleep("300");

    robot.keyTap('g');
    await sleep("50");
    robot.keyTap('i');

    await sleep("300");
    robot.keyTap('tab', 'shift');
    await sleep("300");
    robot.keyTap('tab', 'shift');
    await sleep("300");
    robot.keyTap('tab', 'shift');
    await sleep("300");
    robot.keyTap("enter");
    await sleep("300");
}

// Function to perform mouse and keyboard operations
async function automateGPTResponse() {
    await sleep("300");
    robot.keyTap('g');
    await sleep("50");
    robot.keyTap('i');

    await sleep("300");
    robot.keyTap('v', 'command');
    await sleep("300");
    robot.keyTap('enter');
    // await sleep("120000");
    await sleep("80000");

    await continueGenerating();

    robot.keyTap("escape");
    await sleep("300");
    robot.keyTap("r");
    await sleep("5000");
    await copyResponse();
    await saveClipboardToFile();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function continueGenerating() {
    // search for continue generating 
    robot.keyTap("escape");
    await sleep("300");
    robot.keyTap("/");
    await sleep("300");
    robot.typeString("Continue generating");
    await sleep("500");
    robot.keyTap('enter');
    await sleep("1000");

    // yank Continue generating if found 
    robot.keyTap("v");
    await sleep("300");
    robot.keyTap("y");
    await sleep("300");
    if (clipboardy.readSync().length < "25") {
        console.log(`copied ${clipboardy.readSync()}`);
    }

    if (clipboardy.readSync().includes("Continue generating") && clipboardy.readSync().length < "25") {
        // TODO debug before usage
        await sleep("300");
        robot.keyTap('enter');
        await sleep("300");
        robot.keyTap('tab', 'shift');

        console.log("attempting to continue generating");
        await sleep("300");
        robot.keyTap('enter');
        await sleep("300");
        robot.keyTap('enter');
        await sleep("30000");
    }
}

const flashcards = [];

async function main() {
    // Example file path
    const filePath = path.join(__dirname, 'prompt.txt');

    // TODO check if the supermemo token is outdated.
    robot.keyTap('tab', 'command');
    robot.keyTap('enter');
    while (await processNext(TAG)) {
        await copyFileToClipboard(filePath);
        await sleep(100);
        // TODO automation could be done in background with puppeteer
        // Althought that requires loggin in and possibly captcha
        await automateGPTResponse();

        const flashcard = await createFlashcard();
        flashcards.push(flashcard);
    }

    const flashcardsPath = path.join(__dirname, './data/newFlashcards.js');
    await fs.writeFile(flashcardsPath, JSON.stringify(flashcards, null, 2));
    robot.keyTap('tab', 'command');
    robot.keyTap('enter');

    uploadFlashcards(flashcardsPath);
    // fetch next batch for processing
    console.log(`Fetching next batch for ${TAG} but manually switch tag for now`);
    // fetchNextBatch();
}


function handleSigint() {
    console.log('\nSIGINT received. Writting and Exiting...');
    writeFileSync(path.join(__dirname, './data/newFlashcards.js'), JSON.stringify(flashcards, null, 2));
    process.exit(0);
}

// Set up SIGINT listener
process.on('SIGINT', handleSigint);

main().then(() => {
    console.log("done");
}).catch(error => {
    console.error(error);
    writeFileSync(path.join(__dirname, './data/newFlashcards.js'), JSON.stringify(flashcards, null, 2));
});
