import {
    appendObjectToFile, appendToProcessedUrls, isProcessed,
    gptRequest, readCachedUrls, writeCachedUrls, extractFirstNumber,
    readByObjectKey,
    extractSolutionsFromIndexes,
    extractQuestionSections,
    objLog,
} from './fileUtils.js';
import { scrapeProblem, scrapeSolutions } from './leetcodeScraper.js';
import { createUserAnswerMessage, createUserQuestionMessage } from './gptApi.js';
import { extractAnswer, questionTemplate, } from './prepareFlashcard.js';

import { readFileSync } from "fs"
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import puppeteer from 'puppeteer-extra';
// Add stealth plugin and use it
puppeteer.use(StealthPlugin());

import { uploadFlashcard } from './memkeyApi.js';

import { join, dirname } from 'path';
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
const SCRAPED_PATH = `${DATA_PATH}/scraped`
const MEMKEY_PATH = `data/memkey`
const PROCESSED_PATH = 'data/processedNeetcode150.js'

// TODO Testing:
// Simplify the prompt for gpt
// Important before you run. Split into two prompts for question and answer
// Move unused sections and add them into hard questions only ... Figure out how to determine if question is hard
// 2. Test the comments from different languages are removed but not from the language that is being processed

async function main() {
    if (!LANGUAGE_OPTIONS.includes(LANGUAGE)) throw new Error(`${LANGUAGE} not found in ${LANGUAGE_OPTIONS}`)
    await setupDirs()
    // const browser = await puppeteer.launch({ headless: "new" })

    const browser = await puppeteer.launch({ headless: false })

    const { problemUrls, premiumProblemUrls } =
        readCachedUrls(`data`, TAG)
    if (!problemUrls)
        throw new Error("No urls file found. Function for fetching problem urls not yet implemented")

    writeCachedUrls(problemUrls, premiumProblemUrls, `data`, TAG)


    console.log(problemUrls.length)
    const currentProblemIndex = getCurrentIndex(problemUrls)

    const endOfBatchIndex = currentProblemIndex + BATCH_SIZE
    const arrayLength = problemUrls.length
    // const lastBatchIndex = endOfBatchIndex < arrayLength ?
    //     endOfBatchIndex : arrayLength
    const lastBatchIndex = 20 // keeps redoing the same 20 problems delete to do 20 at a time
    // Create 20 at a time and just keep adding to course as you study
    const problemUrlsSlice = problemUrls.slice(currentProblemIndex, lastBatchIndex)
    objLog({ currentProblemIndex, lastBatchIndex })

    let count = 0
    for (const problemUrl of problemUrlsSlice) {
        if (isProcessed(PROCESSED_PATH, problemUrl)) continue // Necessary: dup urls might exist in other tags
        if (count++ > 0) break // TEsting only
        const { question: front, answer: back, title } =
            await generateFlashcard({ browser, problemUrl, language: LANGUAGE })

        // use memkeyFlashcardId to save the flashcard
        const problemNumber = extractFirstNumber(title);
        const memkeyPath = `${MEMKEY_PATH}/flashcards.js`
        const memkeyFlashcard = { problemNumber, title, front, back, problemUrl }
        const memkeyFlashcardId = await uploadFlashcard(memkeyFlashcard)
        if (!memkeyFlashcardId) throw new Error("No flashcard id returned")
        console.log({
            memkeyFlashcardId, problemUrl,
            front: front.substring(0, 10), back: back.substring(0, 10)
        });

        appendObjectToFile(memkeyFlashcardId, memkeyFlashcard, memkeyPath)
        appendToProcessedUrls(PROCESSED_PATH, problemUrl)
        // Temporary solution to stop pages from buildig up
        const pages = await browser.pages()
        for (const page of pages) {
            await page.close()
        }
    }
    browser.close()
}

async function generateFlashcard({ browser, problemUrl, language }) {
    const { title, descriptionSections } = await scrapeProblem(SCRAPED_PATH, browser, problemUrl)
    objLog({ title })

    const solutions = await scrapeSolutions(SCRAPED_PATH, browser, language, `${problemUrl}/solutions/`)

    const questionResponse = await questionPrompt({ title, descriptionSections })
    const answerResponse = await answerPrompt({ title, solutions, language })

    const youtubeUrls = await scrapeYoutubeVideoUrls(browser, SCRAPED_PATH, title, language)

    const solutionUrls = extractSolutionsFromIndexes(answerResponse, solutions)
    const questionSections = extractQuestionSections(questionResponse, language)
    const question = questionTemplate({
        youtubeUrls,
        solutionUrls,
        descriptionSections,
        questionSections,
        language
    })

    const answer = extractAnswer({
        solutionUrls,
        gptResponse: answerResponse,
        language
    })

    return { question, answer, title }
}

async function questionPrompt({ title, descriptionSections }) {
    const { statement, ioExamples } = descriptionSections

    const systemPrompt = readFileSync(`data/questionPrompt.txt`, 'utf-8')
    const questionMessage = createUserQuestionMessage({ statement, ioExamples })
    const questionResponse = await gptRequest({ title, systemPrompt, userMessage: questionMessage, dataPath: `${DATA_PATH}/gptQuestionResponses.js` })
    return questionResponse
}

async function answerPrompt({ title, solutions, language }) {
    const systemPrompt = readFileSync(`data/answerPrompt.txt`, 'utf-8') + `\nIMPORTANT SELECT only solutions USING ${language}`
    // systemPrompt is used to calculate remaining characters
    const answerMessage = createUserAnswerMessage({ systemPrompt, solutions })
    const answerResponse = await gptRequest({ title, systemPrompt, userMessage: answerMessage, dataPath: `${DATA_PATH}/gptAnswerResponses.js` })
    return answerResponse
}

async function scrapeYoutubeVideoUrl(browser, queryString) {
    const page = await browser.newPage();
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryString)}&sp=EgIQAQ%253D%253D`;

    try {
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        const videoUrl = await page.evaluate(() => {
            const videoElements = Array.from(document.querySelectorAll('a#video-title'));
            for (const video of videoElements) {
                return video.href
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

    // TODO remove neetcode ?
    const youtubeUrl = await scrapeYoutubeVideoUrl(browser, `Leetcode ${extractFirstNumber(title)} neetcode neetcode150`)
    const youtubeUrlLang = await scrapeYoutubeVideoUrl(browser, `Leetcode ${extractFirstNumber(title)} ${title} ${language}`)
    objLog({ youtubeUrl, youtubeUrlLang })

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
    await mkdir(SCRAPED_PATH, { recursive: true })
    await mkdir(MEMKEY_PATH, { recursive: true })

    const DEBUG_PATH = `data/puppeteer_debug`
    await mkdir(DEBUG_PATH, { recursive: true })
}

function getCurrentIndex(problemUrls) {
    let count = 0
    for (const problemUrl of problemUrls) {
        if (!isProcessed(PROCESSED_PATH, problemUrl)) break
        count++
    }
    return count
}

