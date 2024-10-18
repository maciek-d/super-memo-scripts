import {
    appendObjectToFile, appendToProcessedUrls, isProcessed,
    gptRequest, readCachedUrls, writeCachedUrls, extractFirstNumber,
    fetchGptImage, readByObjectKey,
    extractSection,
    extractSolutions,
    extractQuestionSections,
} from './fileUtils.js';

import { scrapeProblem, scrapeSolutions } from './leetcodeScraper.js';
import { createUserMessage } from './gptApi.js';
import { uploadImagesToS3 } from './s3Api.js';
import { extractAnswer, questionTemplate, } from './prepareFlashcard.js';
import { updateSupermemoCard } from './supermemoApi.js';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import puppeteer from 'puppeteer-extra';
// Add stealth plugin and use it
puppeteer.use(StealthPlugin());

import { config } from 'dotenv';
import { readFileSync } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '../.env')
config({ path: envPath })

const TAG = process.argv.find(arg => arg.startsWith('--tag='))?.split('=')[1] || "array"
const LANGUAGE = process.argv.find(arg => arg.startsWith('--lang='))?.split('=')[1] || "Python"
const BATCH_SIZE = process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1] || 20

const LANGUAGE_OPTIONS = ["JavaScript", "C++", "Java", "Python3", "Python", "C", "C#", "Ruby", "Swift",
    "Go", "Scala", "Kotlin", "Rust", "MySQL", "Bash", "TypeScript", "Dart",
    "Erlang", "Elixir", "PHP", "Racket"]

const DATA_ROOT = `./data/${LANGUAGE}`
const DATA_PATH = `${DATA_ROOT}/${TAG}`
const IMAGE_PATH = `data/ai-images`
const SUPERMEMO_PATH = `data/supermemo`
const SCRAPED_PATH = `${DATA_PATH}/scraped`

async function setup() {
    if (!LANGUAGE_OPTIONS.includes(LANGUAGE)) throw new Error(`${LANGUAGE} not found in ${LANGUAGE_OPTIONS}`)
    await mkdir(DATA_ROOT, { recursive: true })
    await mkdir(DATA_PATH, { recursive: true })
    await mkdir(IMAGE_PATH, { recursive: true })
    await mkdir(SUPERMEMO_PATH, { recursive: true })
    await mkdir(SCRAPED_PATH, { recursive: true })

    const DEBUG_PATH = `data/puppeteer_debug`
    await mkdir(DEBUG_PATH, { recursive: true })
}

// TODO Testing:
// 1. Test that images get scraped and are included in the flashcards
// 2. Test the comments from different languages are removed but not from the language that is being processed
// 3. Look through code again and see if anything else could be busted.

async function main() {
    await setup()

    // const browser = await puppeteer.launch({ headless: "new" })
    const browser = await puppeteer.launch({ headless: false })

    const { problemUrls, premiumProblemUrls } =
        readCachedUrls(`data`, TAG)
    if (!problemUrls)
        throw new Error("No urls file found. Function for fetching problem urls not yet implemented")

    writeCachedUrls(problemUrls, premiumProblemUrls, `data`, TAG)

    const currentProblemIndex = getCurrentIndex(problemUrls)

    const endOfBatchIndex = currentProblemIndex + BATCH_SIZE
    const lastProblemIndex = problemUrls.length - 1
    const lastBatchIndex = endOfBatchIndex < lastProblemIndex ?
        endOfBatchIndex : lastProblemIndex
    const problemUrlsSlice = problemUrls.slice(currentProblemIndex, lastBatchIndex)

    let count = 0
    for (const problemUrl of problemUrlsSlice) {
        if (isProcessed(`data`, problemUrl)) continue // have to check again as urls might exist in other tags
        if (count++ > 0) break // TODO REMOVE
        await processProblem(browser, problemUrl, LANGUAGE)
        appendToProcessedUrls(`data`, problemUrl)
    }
    browser.close()
}

function getCurrentIndex(problemUrls) {
    let count = 0
    for (const problemUrl of problemUrls) {
        if (!isProcessed(DATA_PATH, problemUrl)) break
        count++
    }
    return count
}

// check if used and delete if not
// fetchProblems.js
// TODO test with problem with images and solution with images

async function processProblem(browser, problemUrl, language) {
    const { question, answer } =
        await generateFlashcard({ browser, problemUrl, language })
    await updateSupermemoCard(SUPERMEMO_PATH, question + "updated", answer, problemUrl)
}

async function generateFlashcard({ browser, problemUrl, language }) {
    const { title, descriptionSections } = await scrapeProblem(SCRAPED_PATH, browser, problemUrl)
    const solutions = await scrapeSolutions(SCRAPED_PATH, browser, language, `${problemUrl}/solutions/`)

    // TODO split prompts into parts, image description etc
    const gptResponse = await promptGpt({ title, descriptionSections, solutions })

    const imageDescription = extractSection(gptResponse, "Image Description", language)
    const imageHtml = await getImageHtml(title, imageDescription, IMAGE_PATH)
    const youtubeUrls = await scrapeYoutubeVideoUrls(browser, SCRAPED_PATH, title, language)

    const solutionUrls = extractSolutions(gptResponse, solutions)
    const questionSections =  extractQuestionSections(gptResponse, language)
    const question = questionTemplate({
        title,
        problemUrl,
        youtubeUrls,
        solutionUrls,
        imageHtml,
        descriptionSections,
        questionSections,
    })

    const answer = extractAnswer({
        solutionUrls,
        gptResponse,
        language
    })

    return { question, answer }
}

async function promptGpt({ title, descriptionSections, solutions }) {
    const systemPrompt = readFileSync(`data/systemPrompt.txt`, 'utf-8')
    const { statement, ioExamples } = descriptionSections

    // systemPrompt is used to calculate remaining characters
    const userMessage = createUserMessage({ systemPrompt, statement, ioExamples, solutions })
    const gptResponse = await gptRequest({ title, systemPrompt, userMessage, dataPath: DATA_PATH })
    return gptResponse
}

async function getImageHtml(title, imageDescription, imagePath) {
    const imageName = `${extractFirstNumber(title)}.png`
    const imageData = await fetchGptImage(imageDescription, `${imagePath}/${imageName}`)

    const { imageSrc, thumbSrc } = await uploadImagesToS3(imageData, imageName, `leetcode/ai-generated`)

    const imageHtml = `<div><a href="${imageSrc}" target="_blank">
        <img src="${thumbSrc}" style="resize-img" /></a></div>`

    return imageHtml
}

async function scrapeYoutubeVideoUrl(browser, queryString) {
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

async function scrapeYoutubeVideoUrls(browser, scrapedPath, title, language) {

    const youtubeUrlsPath = `${scrapedPath}/youtubeUrls.js`
    const urls = readByObjectKey(youtubeUrlsPath, title)
    if (urls) return urls

    const youtubeUrl = await scrapeYoutubeVideoUrl(browser, title)
    const youtubeUrlLang = await scrapeYoutubeVideoUrl(browser, `${title} ${language}`)

    appendObjectToFile(title, { youtubeUrl, youtubeUrlLang }, youtubeUrlsPath)
    return { youtubeUrl, youtubeUrlLang }
}

main().then(() => {
    console.log("done");
})

