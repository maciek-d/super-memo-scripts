import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

// Add stealth plugin and use it
puppeteer.use(StealthPlugin());

import gptPkg from 'gpt3-tokenizer';
const GPT3Tokenizer = gptPkg.default

import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { postNewCard } from "./uploadFlashcard.js"
import { extractQuestion, extractAnswer, extractFirstNumber, extractSection, extractAlgoAnswer, extractSolutionImages, stripCodeBlocks } from "./extractQA.js"
import { createImage, getChatGPTResponse } from './gptApi.js';
import { createFotkiAlbum, createFotkiFolder, uploadToFotki } from './fotkiApi.js';
import { downloadImage } from './imageProcessing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fetchProblemsPath = join(__dirname, './leetcode-site/fetchProblems.js');
const problemPath = join(__dirname, '../../data/CS/leetcode/new/array_problems_data.js');
const { fetchSolutions } = await import(fetchProblemsPath);

const promptPath = join(__dirname, './data/prompt.txt');
const imageDir = join(__dirname, './data/images')

const courseId = process.env.COURSE_ID
const targetParentNumber = process.env.TARGET_PARENT_NUMBER
const easyCourseId = process.env.EASY_COURSE_ID
const easyTargetParentNumber = process.env.EASY_TARGET_PARENT_NUMBER

const fotkiSid = process.env.FOTKI_SID
const fotkiUsername = process.env.FOTKI_USERNAME

function addObjectToFile(title, object, path) {
    const filePath = join(__dirname, path);

    const rawString = existsSync(filePath) ?
        readFileSync(filePath, 'utf8') : "{}"
    const objects = JSON.parse(rawString)
    objects[title] = object
    writeFileSync(filePath, JSON.stringify(objects, null, 2))
}

function titleCompleted(title) {
    try {
        const responseFilePath = join(__dirname, './data/completed.js');
        return JSON.parse(readFileSync(responseFilePath, 'utf8')).includes(title)
    } catch (e) {
        if (e.code === 'ENOENT') { // File not found
            return false;
        }
        throw e
    }
}

function saveCompleted(title, path) {
    const filePath = join(__dirname, path);

    const rawString = existsSync(filePath) ?
        readFileSync(filePath, 'utf8') : "[]"
    const array = JSON.parse(rawString)

    if (!array.includes(title)) {
        array.push(title)
    }
    writeFileSync(filePath, JSON.stringify(array, null, 2))
}

async function main() {

    //    await createFotkiFolder(fotkiSid, fotkiUsername, "Leetcode")
    //    await createFotkiAlbum(fotkiSid, fotkiUsername, "Leetcode", "images")
    //    await createFotkiAlbum(fotkiSid, fotkiUsername, "Leetcode", "thumbs")

    // const browser = await puppeteer.launch({ headless: false });

    let browser = null
    const problems = JSON.parse(readFileSync(problemPath, 'utf8'));

    for (const problem of problems) {
        if (titleCompleted(problem.title)) continue
        browser = await puppeteer.launch({
            headless: "new",
            protocolTimeout: 120000
        });
        await processProblem({
            ...problem,
            ioExamples: problem.examples,
            browser,
        })
        browser.close()
    }
}

async function processProblem({
    title,
    problem,
    problemLink,
    ioExamples,
    constraints,
    solutionsUrl,
    youtubeUrl,
    youtubeUrlJs,
    browser,
}) {
    console.log(title)
    const { solutions, solutionsUrls } = readSolutions(title) ??
        await fetchSolutions(browser, solutionsUrl)
    addObjectToFile(title, { solutions, solutionsUrls }, './data/solutions.js')

    const savedResponse = readGptResponse(title)
    const prompt = readFileSync(promptPath, 'utf8');
    const userMessage = createUserMessage({ prompt, problem, solutions, ioExamples })

    const response = savedResponse ?? await getChatGPTResponse(prompt, userMessage)
    addObjectToFile(title, response, './data/gptResponses.js')

    const imageTag = await flashcardImageTag(title, response)

    const [gptSolutionIndex, gptSolutionIndex2] = extractProblemIndex(response)
    const solutionsUrl1 = solutionsUrls[gptSolutionIndex]
    const solutionsUrl2 = solutionsUrls[gptSolutionIndex2]

    if (!solutionsUrl1 || !solutionsUrl2) {
        throw new Error(
            `Failed to get solutionsUrls ${solutionsUrl1} ${solutionsUrl2}`
        )
    }

    const [solutionImages, solutionImages2] = extractSolutionImages(
        solutions, gptSolutionIndex, gptSolutionIndex2
    )

    const cleanedResponse = response
        .replaceAll("&lt;", "＜")
        .replaceAll("&gt;", "＞")
        .replace(/<(?!img|\/img)/gi, '＜')

    const { question, shortQuestion } = extractQuestion({
        response: cleanedResponse,
        title,
        youtubeUrl, youtubeUrlJs,
        solutionsUrl1, solutionsUrl2,
        constraints, ioExamples, problem,
        problemLink, imageTag
    })

    const shortAnswer = extractAlgoAnswer({
        response: cleanedResponse, solutionsUrl1, imageTag
    })

    const answer = extractAnswer({
        response: cleanedResponse, solutionsUrl1, solutionsUrl2,
        solutionImages, solutionImages2
    })

    await postNewCard(question, answer, courseId, targetParentNumber);
    await postNewCard(shortQuestion, shortAnswer, easyCourseId, easyTargetParentNumber);
    saveCompleted(title, './data/completed.js')

    await browser.close();
}

function extractProblemIndex(response) {
    const sectionTitle = "SelectedSolutions";

    // regex matches titles starting with ##+ or **
    const hashRegex = new RegExp(`#{1,6}\\s*${sectionTitle}\\s*\\[\\s*([\\d,\\s]+)\\s*\\]`, 'i');
    const asteriskRegex = new RegExp(`\\*\\*${sectionTitle}\\*\\*.*?\\[\\s*([\\d,\\s]+)\\s*\\]`, 'i');

    const noCodeBlocks = response.replace(/```javascript\n([\s\S]*?)\n\s*```/g, (_match, p1) => {
        return p1
    });

    const cleanedResponse = noCodeBlocks
        .replaceAll(":", "")
        .replaceAll("\\", "")
        .replaceAll("\n", "")
        .replaceAll(" ", "")

    const hashMatch = hashRegex.exec(cleanedResponse)
    const asteriskMatch = asteriskRegex.exec(cleanedResponse)
    const match = hashMatch ? hashMatch : asteriskMatch

    if (match && match[1]) {
        const indices = match[1].split(',').map(item => Number(item.trim()) - 1);
        return indices;
    }

    throw new Error(`Failed match index regex ${hashRegex} and ${asteriskRegex}`)
}

function createUserMessage({ prompt, problem, solutions, ioExamples }) {
    const paritalPrompt = prompt
        .replace(/(Problem:\n```)(.*?)(```)/s, `$1\n${problem}\n$3`)
        .replace(/(Input Output Examples:\n```)(.*?)(```)/s, `$1\n${ioExamples}\n$3`)

    const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
    const remaining = 4096 - tokenizer.encode(paritalPrompt).bpe.length;

    function getSolutionsLength(solution) {
        return solution.reduce(
            (acc, sol) => acc + tokenizer.encode(sol).bpe.length
        )
    }

    const solutionsTokens = getSolutionsLength(solutions)

    if (solutionsTokens > remaining) {

        solutions = solutions.map(sol => trimAfterFirstComment(sol))
        let lengthFirstComment = getSolutionsLength(solutions)
        while (lengthFirstComment > remaining) {
            solutions.pop()
            lengthFirstComment = getSolutionsLength(solutions)
            if (solutions.length == 1) {
                // Todo  if you ever get here first trim all comments
                // try selecting shorter solutions
                // you can calculate the average or just sort by length
                // you can also look into deleting repeating text from solutions
                console.warn("Solutions was too long", problem);
            }
        }
    }

    const formattedSolutions = solutions.map((solution, index) => `${index + 1}. ${solution}`).join('\n');

    // Replace the placeholder text between the backticks for the Solutions section
    return `Problem:
\`\`\`
${problem}
\`\`\`
Solutions:
\`\`\`
${formattedSolutions}
\`\`\`
Input Output Examples:
\`\`\`
${ioExamples}
\`\`\``
}

function trimAfterFirstComment(text) {
    const pattern = /Comments \(\d+\)\s*.*?(?=\d+\s*(Show \d+ Replies|Reply|$))/s;
    const match = pattern.exec(text);
    return match ? text.slice(0, match.index + match[0].length) : text;
}

function readSolutions(title) {
    try {
        const responseFilePath = join(__dirname, './data/solutions.js');
        return JSON.parse(readFileSync(responseFilePath, 'utf8'))?.[title]
    } catch (e) {
        if (e.code === 'ENOENT') { // File not found
            return {}
        }
        throw e
    }
}

function readGptResponse(title) {
    try {
        const responseFilePath = join(__dirname, './data/gptResponses.js');
        return JSON.parse(readFileSync(responseFilePath, 'utf8'))?.[title]
    } catch (e) {
        if (e.code === 'ENOENT') { // File not found
            return null
        }
        throw e
    }
}

async function flashcardImageTag(title, response) {
    const imageDescription = extractSection(response, "Image Description")
    const imageName = extractFirstNumber(title)

    const imagePath = join(imageDir, `${imageName}.jpg`);
    const imageExists = existsSync(imagePath)
    let image = imageExists ? readImage(imagePath) : null

    if (!imageExists) {
        const url = await createImage(imageDescription)
        image = await downloadImage(url)

        await writeFile(imagePath, image)
    }

    const { imageSrc, thumbSrc } = await uploadToFotki({
        sessionId: fotkiSid,
        username: fotkiUsername,
        name: imageName,
        imageData: image,
        courseName: "Leetcode"
    })

    return `<a href="${imageSrc}" target="_blank">
        <img src="${thumbSrc}" style="resize-img" /></a>`
}

function readImage(imagePath) {
    const data = readFileSync(imagePath);
    return Buffer.from(data);
}

main().then(() => {
    console.log("done");
})

