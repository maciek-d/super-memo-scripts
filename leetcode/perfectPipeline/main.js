import puppeteer from 'puppeteer';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const fetchProblemsPath = join(__dirname, './leetcode-site/fetchProblems.js');
const { getJsSolutions } = await import(fetchProblemsPath);

import { existsSync, writeFileSync, readFileSync } from 'fs';
import { getGptResponse, loginToGpt } from './gpt.js';
import { postNewCard } from "./uploadFlashcard.js"
import { extractQuestion, extractAnswer } from "./extractQA.js"

const promptPath = join(__dirname, './data/prompt.txt');

const TAG = "array";

// TODO make the script download the image and upload it to fotki and then also copy the link to supermemo
// this is not a priority but start collecting the images

async function main() {
    const browser = await puppeteer.launch({ headless: false });
    // const browser = await puppeteer.launch({ headless: "new" });
    // const gptPage = await loginToGpt(browser);

    // TODO fix imports for all functions make sure await is called properly
    // TITLE should already exist
    //
    // todo this will fetch all the problems in a loop
    // todo get the code that gets the titles and loops
    const { solutions, solutionsUrls } = await getJsSolutions(browser);
    saveSolutions(title, solutions, solutionsUrls)

    return; // TODO MOve while testing

    // const prompt =  readFileSync(promptPath, 'utf8');
    const prompt = "testing please say some random words"


    // TODO merge problemData into prompt

    const response = await getGptResponse(prompt, gptPage)
    saveGptResponse(title, response)

    // TODO response should state which solution it has picked the number of
    // this way we can use it as an index to solutionUrl

    const solutionsUrl1 = solutionsUrls[Number(gptSolutionIndex) - 1]
    const solutionsUrl2 = solutionsUrls[Number(gptSolutionIndex2) - 1]

    const cleanedResponse = response
        .replaceAll("&lt;", "＜")
        .replaceAll("&gt;", "＞")
        .replace(/<(?!img|\/img)/gi, '＜')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')

    const question = extractQuestion({
        response: cleanedResponse, title,
        youtubeUrl, youtubeUrlJs,
        solutionsUrl1, solutionsUrl2,
        constraints, examples, problem
    })

    const answer = extractAnswer({
        response: cleanedResponse, solutionLink, solutionLink2
    })

    await postNewCard(question, answer);

    await browser.close();
}

function awaitKeyPress() {
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        resolve();
    });
  });
}

// possible abstraction
function saveSolutions(title, solutions, solutionsUrls) {
    const solutionsFilePath = join(__dirname, './data/solutions.js');

    const rawResponses = existsSync(solutionsFilePath) ?
        readFileSync(solutionsFilePath) : "[]"
    const responses = JSON.parse(rawResponses)
    responses.push({
        [title]: {
            solutions,
            solutionsUrls
        }
    })
    writeFileSync(solutionsFilePath, JSON.stringify(responses))
}

function saveGptResponse(title, response) {
    const responseFilePath = join(__dirname, './data/gptResponses.js');

    const rawResponses = existsSync(responseFilePath) ?
        readFileSync(responseFilePath) : "[]"
    const responses = JSON.parse(rawResponses)
    responses.push({
        [title]: response
    })
    writeFileSync(responseFilePath, JSON.stringify(responses))
}

main().then(() => {
    console.log("done");
})

