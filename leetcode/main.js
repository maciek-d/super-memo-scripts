import puppeteer from 'puppeteer';
import { appendObjectToFile, appendToProcessedUrls, isProcessed, gptPrompt, readCachedUrls, writeCachedUrls, extractFirstNumber, fetchGptImage, extractDataFromGptResponse, saveProblemHtml, readByObjectKey, readCurrentIndex, safeReadFile }
    from './fileUtils';
import { scrapeProblem, scrapeProblemUrls, scrapeSolutions } from './leetcodeScraper';
import { readFileSync } from 'fs';
import { createUserMessage } from './gptApi';
import { uploadImagesToS3 } from './s3Api';
import { extractAnswer, extractQuestion } from './prepareFlashcard';
import { postNewCard, refreshToken, updateCard } from './supermemoApi';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '.env')
config({ path: envPath })

const TAG = process.argv.find(arg => arg.startsWith('--tag='))?.split('=')[1] || "array"
const LANGUAGE = process.argv.find(arg => arg.startsWith('--lang='))?.split('=')[1] || "Python"
const BATCH_SIZE = process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1] || 20

const LANGUAGE_OPTIONS = ["JavaScript", "C++", "Java", "Python3", "Python", "C", "C#", "Ruby", "Swift",
    "Go", "Scala", "Kotlin", "Rust", "MySQL", "Bash", "TypeScript", "Dart",
    "Erlang", "Elixir", "PHP", "Racket"]

const DATA_ROOT = `./data/${LANGUAGE}`
const DATA_PATH = `${DATA_ROOT}/${TAG}`
const IMAGE_PATH = `data/ai-imgages`
const SUPERMEMO_PATH = `data/supermemo`
const SCRAPED_PATH = `${DATA_PATH}/scraped`

async function setup() {
    if (!LANGUAGE_OPTIONS.includes(LANGUAGE)) throw new Error(`${LANGUAGE} not found in ${LANGUAGE_OPTIONS}`)
    await mkdir(DATA_ROOT, { recursive: true })
    await mkdir(DATA_PATH, { recursive: true })
    await mkdir(IMAGE_PATH, { recursive: true })
    await mkdir(SUPERMEMO_PATH, { recursive: true })
    await mkdir(SCRAPED_PATH, { recursive: true })
}

async function main() {
    await setup()

    // const browser = await puppeteer.launch({ headless: "new" })
    const browser = await puppeteer.launch({ headless: false })

    // TODO this might only read some of the urls either fetch all of them
    // or allow to fetch a certain number at at time and save all of the new ones
    const { problemUrls, premiumProblemUrls } =
        readCachedUrls(DATA_PATH) ?? await scrapeProblemUrls(browser, TAG)
    writeCachedUrls(problemUrls, premiumProblemUrls, DATA_PATH)

    const currentProblemIndex = readCurrentIndex(DATA_PATH)

    const endOfBatchIndex = currentProblemIndex + BATCH_SIZE
    const lastProblemIndex = problemUrls.length - 1
    const lastBatchIndex = endOfBatchIndex < lastProblemIndex ?
        endOfBatchIndex : lastProblemIndex
    const problemUrlsSlice = problemUrls.slice(currentProblemIndex, lastBatchIndex)

    for (const problemUrl of problemUrlsSlice) {
        if (isProcessed(problemUrls)) continue
        await processProblem(browser, problemUrl, LANGUAGE, courseId, targetParentNumber)
        appendToProcessedUrls(problemUrls)
    }
}

// check if used and delete if not
// fetchProblems.js
// TODO test with problem with images and solution with images

async function processProblem(browser, problemUrl, language) {
    const { title, statement, ioExamples } = await scrapeProblem(SCRAPED_PATH, browser, problemUrl)
    const solutions = await scrapeSolutions(SCRAPED_PATH, browser, language, `${problemUrl}/solutions/`)
    const { youtubeUrl, youtubeUrlLang } = await scrapeYoutubeVideoUrls(SCRAPED_PATH, browser, title, language)

    const { question, answer } = await generateFlashcard({
        title, statement, solutions, ioExamples, youtubeUrl, youtubeUrlLang
    })

    await updateSupermemoCard(question, answer, problemUrl)
}

async function updateSupermemoCard(question, answer, problemUrl) {
    const token = await refreshToken(SUPERMEMO_PATH, process.env.SM_USERNAME, process.env.SM_PASSWORD)

    const superMemoCredentials = {
        token,
        userId: process.env.SM_USER_ID,
        courseId: process.env.LEETCODE_COURSE_ID,
        targetParentNumber: process.env.LEETCODE_TARGET_PARENT_NUMBER
    }

    const updateIdPath = `${SUPERMEMO_PATH}/update_ids.js`
    const pageNumber = readByObjectKey(updateIdPath, problemUrl)
    if (pageNumber) {
        await updateCard(superMemoCredentials, pageNumber, question, answer)
    } else {
        const newPageNumber = await postNewCard(superMemoCredentials, question, answer)
        appendObjectToFile(problemUrl, newPageNumber, updateIdPath)
    }
}

async function generateFlashcard({
    title, statement, solutions, ioExamples, youtubeUrl, youtubeUrlLang
}) {

    const prompt = safeReadFile(`${DATA_ROOT}/promptTemplate.txt`)
        const userMessage = createUserMessage({ prompt, statement, solutions, ioExamples })
    const gptResponse = await gptPrompt(title, prompt, userMessage)

    return extractQA(gptResponse, solutions, ioExamples, youtubeUrl, youtubeUrlLang)
}

async function extractQA(gptResponse, solutions, ioExamples, youtubeUrl, youtubeUrlLang) {

    const language = LANGUAGE
    const {
        imageDescription, solutionsUrl1, solutionsUrl2,
        summary, description, bestIoExample,
        algorithm, datastructure, code, code2, steps, steps2,
        solution, solution2, complexity
    } = extractDataFromGptResponse(gptResponse, solutions, language)

    const imageHtml = await getImageHtml(title, imageDescription, IMAGE_PATH)
    const question = extractQuestion({
        summary, description, bestIoExample,
        title, youtubeUrl, youtubeUrlLang,
        solutionsUrl1, solutionsUrl2,
        constraints, ioExamples,
        problemUrl, imageHtml
    })

    const answer = extractAnswer({
        algorithm, datastructure, code, code2, steps, steps2,
        solution, solution2, complexity,
        solutionsUrl1, solutionsUrl2,
    })

    return { question, answer }
}

async function getImageHtml(title, imageDescription, imagePath) {
    const imageName = `${extractFirstNumber(title)}.jpg`
    const imageData = await fetchGptImage(imageDescription, `${imagePath}/${imageName}`)

    const { imageSrc, thumbSrc } = await uploadImagesToS3(imageData, imageName, `leetcode/ai-generated`)

    const imageHtml = `<div><a href="${imageSrc}" target="_blank">
        <img src="${thumbSrc}" style="resize-img" /></a></div>`

    return imageHtml
}

main().then(() => {
    console.log("done");
})


async function scrapeYoutubeVideoUrl(queryString, browser) {
    const page = await browser.newPage();
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryString)}&sp=EgIQAQ%253D%253D`;

    try {
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        const videoUrl = await page.evaluate(() => {
            const videoElements = Array.from(document.querySelectorAll('a#video-title'));
            for (const video of videoElements) {
                if (/\d+\./.test(video.textContent)) { // Check if the title contains a number followed by a dot
                    return video.href;
                }
            }
            return null;
        });
        await page.close();
        return videoUrl;
    } catch (error) {
        await page.close();
        console.error(`Error fetching YouTube video URL for query: ${queryString}`, error);
        return null;
    }
}

async function scrapeYoutubeVideoUrls(scrapedPath, browser, title, language) {

    const youtubeUrlsPath = `${scrapedPath}/youtubeUrls.js`
    const urls = readByObjectKey(youtubeUrlsPath, title)
    if (urls) return urls

    const youtubeUrl = scrapeYoutubeVideoUrl(browser, title)
    const youtubeUrlLang = scrapeYoutubeVideoUrl(browser, `${title} ${language}`)

    appendObjectToFile(title, { youtubeUrl, youtubeUrlLang }, youtubeUrlsPath)
    return { youtubeUrl, youtubeUrlLang }
}
