import {
    appendObjectToFile, appendToProcessedUrls, isProcessed,
    gptRequest, readCachedUrls, writeCachedUrls, extractFirstNumber,
    fetchGptImage, readByObjectKey,
    extractSection,
    extractSolutions,
    extractQuestionSections,
    objLog,
    safeReadFile,
} from './fileUtils.js';

import { readFileSync, writeFileSync } from "fs"

import { scrapeAcceptanceRate, scrapeDifficulty, scrapeProblem, scrapeSolutions } from './leetcodeScraper.js';
import { createUserAnswerMessage, createUserQuestionMessage } from './gptApi.js';
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
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '../.env')
config({ path: envPath })

const TAG = process.argv.find(arg => arg.startsWith('--tag='))?.split('=')[1] || "neetcode150"
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

const PROCESSED_PATH = 'data/processedUrls.js'

// TODO Testing:
// Important before you run. Split into two prompts for question and answer
// Move unused sections and add them into hard questions only ... Figure out how to determine if question is hard
// 1. Test that
// how about in solutions ?? include in solutions
// 2. Test the comments from different languages are removed but not from the language that is being processed
// 3. Look through code again and see if anything else could be busted.

async function main() {
    if (!LANGUAGE_OPTIONS.includes(LANGUAGE)) throw new Error(`${LANGUAGE} not found in ${LANGUAGE_OPTIONS}`)
    await setupDirs()
    const browser = await puppeteer.launch({ headless: "new" })

    // const browser = await puppeteer.launch({ headless: false })

    const { problemUrls, premiumProblemUrls } =
        readCachedUrls(`data`, TAG)
    if (!problemUrls)
        throw new Error("No urls file found. Function for fetching problem urls not yet implemented")

    writeCachedUrls(problemUrls, premiumProblemUrls, `data`, TAG)

    const currentProblemIndex = getCurrentIndex(problemUrls)

    const endOfBatchIndex = currentProblemIndex + BATCH_SIZE
    const arrayLength = problemUrls.length
    // const lastBatchIndex = endOfBatchIndex < arrayLength ?
    //     endOfBatchIndex : arrayLength
    const lastBatchIndex = 40
    const problemUrlsSlice = problemUrls.slice(currentProblemIndex, lastBatchIndex)
    objLog({ currentProblemIndex, lastBatchIndex })

    for (const problemUrl of problemUrlsSlice) {
        if (isProcessed(PROCESSED_PATH, problemUrl)) continue // Necessary: dup urls might exist in other tags

        const { question, answer } =
            await generateFlashcard({ browser, problemUrl, LANGUAGE })
        await updateSupermemoCard(SUPERMEMO_PATH, question, answer, problemUrl)

        appendToProcessedUrls(PROCESSED_PATH, problemUrl)
        // Temporary solution to stop pages from buildig up
        const pages = await browser.pages()
        for (const page of pages) {
            await page.close()
        }
    }
    browser.close()

}

// check if used and delete if not
// fetchProblems.js
// TODO test with problem with images and solution with images

async function generateFlashcard({ browser, problemUrl, language }) {
    const { title, descriptionSections, problemDifficulty } = await scrapeProblem(SCRAPED_PATH, browser, problemUrl)
    objLog({ title })

    const solutions = await scrapeSolutions(SCRAPED_PATH, browser, language, `${problemUrl}/solutions/`)

    const questionResponse = await questionPrompt({ title, descriptionSections })
    const answerResponse = await answerPrompt({ problemDifficulty, solutions, language })

    const imageDescription = extractSection(questionResponse, "Image Description", language)
    const imageHtml = await getImageHtml(title, imageDescription, IMAGE_PATH)
    const youtubeUrls = await scrapeYoutubeVideoUrls(browser, SCRAPED_PATH, title, language)

    const solutionUrls = extractSolutions(answerResponse, solutions)
    const questionSections = extractQuestionSections(questionResponse, language)
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
        gptResponse: answerResponse,
        language
    })

    return { question, answer }
}

async function questionPrompt({ title, descriptionSections }) {
    const { statement, ioExamples } = descriptionSections

    const systemPrompt = readFileSync(`data/questionPrompt.txt`, 'utf-8')
    const questionMessage = createUserQuestionMessage({ statement, ioExamples })
    const questionResponse = await gptRequest({ title, systemPrompt, questionMessage, dataPath: `${DATA_PATH}/gptQuestionResponses.js` })

    return questionResponse
}

async function answerPrompt({ title, problemDifficulty, solutions, language }) {
    const prompt = readFileSync(`data/answerPrompt.txt`, 'utf-8') + `\nIMPORTANT SELECT only solutions USING ${language}`
    const hardAnswerPrompt = readFileSync(`data/hardAnswerPrompt.txt`, 'utf-8')
    // systemPrompt is used to calculate remaining characters
    const isHard = problemDifficulty == "Hard"
    const systemPrompt = isHard ? prompt + hardAnswerPrompt : prompt

    const answerMessage = createUserAnswerMessage({ systemPrompt, solutions })
    const answerResponse = await gptRequest({ title, systemPrompt: prompt, answerMessage, dataPath: `${DATA_PATH}/gptAnswerResponses.js` })
    return answerResponse
}

async function getImageHtml(title, imageDescription, imagePath) {
    const imageName = `${extractFirstNumber(title)}.png`

    if (!imageDescription) throw new Error(`Missing image description ${imageDescription}`)

    const imageData = await fetchGptImage(imageDescription, `${imagePath}/${imageName}`)

    const { imageSrc, thumbSrc } = await uploadImagesToS3(imageData, imageName, `leetcode/ai-generated`)

    if (!imageSrc || !thumbSrc) {
        throw new Error(`Failed to uploadImagesToS3 ${JSON.stringify
            ({ imageName, imageData: imageData.subarray(0, 20) }, null, 2)}`
        )
    }
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

    if (!youtubeUrl || !youtubeUrlLang) {
        throw new Error(
            `Failed to scrapeYoutubeVideoUrl ${JSON.stringify
                ({ youtubeUrl, youtubeUrlLang }, null, 2)}`
        )
    }
    appendObjectToFile(title, { youtubeUrl, youtubeUrlLang }, youtubeUrlsPath)
    return { youtubeUrl, youtubeUrlLang }
}

main().then(() => {
    console.log("done");
})

async function setupDirs() {
    await mkdir(DATA_ROOT, { recursive: true })
    await mkdir(DATA_PATH, { recursive: true })
    await mkdir(IMAGE_PATH, { recursive: true })
    await mkdir(SUPERMEMO_PATH, { recursive: true })
    await mkdir(SCRAPED_PATH, { recursive: true })

    const DEBUG_PATH = `data/puppeteer_debug`
    await mkdir(DEBUG_PATH, { recursive: true })
}

function getCurrentIndex(problemUrls) {
    let count = 0
    for (const problemUrl of problemUrls) {
        if (!isProcessed(`data`, problemUrl)) break
        count++
    }
    return count
}

