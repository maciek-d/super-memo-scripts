// SAVE TO FAKE COURSE AND CHECK IF EVERYTHING LOOKS RIGTH AFTER FIRST FLASHCARD
// Checklist!!:
// Same line Leetcode Solution | Youtube Solution
// No " at the end of examples constraints or any of the steps
// Topic values displayed correctly: Look at topics in script and compare for each

//TODO Do not add flashcard to processed before you make sure it works

// TODO not working.
// Merge Examples and Description for Solution Trick

import readline from 'readline'
import { getSubtitles } from 'youtube-captions-scraper'
import { existsSync, readFileSync, writeFileSync } from "fs"
import { scrapeYoutubeVideoUrls, } from './youtubeScraper.js'
import { scrapeProblem, scrapeSolutions } from './leetcodeScraper.js'
import {
    appendToProcessedUrls, ensureDirectoryExists, gptRequest,
    readCachedUrls, isProcessed,
    objLog,
    readArrayFromFile,
    appendObjectToFile,
    writeArrayToFile,
} from './fileUtils.js'
import { modifyImagesInPlace } from "./prepareFlashcard.js"
import { saveList } from './memkeyApi.js'

import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import puppeteer from 'puppeteer-extra';
// Add stealth plugin and use it
puppeteer.use(StealthPlugin());

import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { config } from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '../.env')
config({ path: envPath })

const TAG = process.argv.find(arg => arg.startsWith('--tag='))?.split('=')[1] || "neetcode150"

const LANGUAGE = 'Python';
const DATA_ROOT = `./data/${LANGUAGE}`;
const DATA_PATH = `${DATA_ROOT}/${TAG}`
const SCRAPED_PATH = `${DATA_PATH}/scraped`
const PROCESSED_PATH = 'data/youtubeProcessedNeetcode150.js'

const TIME_WINDOW = 5
const BATCH_SIZE = 10

const LANGUAGE_OPTIONS = ["JavaScript", "C++", "Java", "Python3", "Python", "C", "C#", "Ruby", "Swift",
    "Go", "Scala", "Kotlin", "Rust", "MySQL", "Bash", "TypeScript", "Dart",
    "Erlang", "Elixir", "PHP", "Racket"]

//const COURSE_ID = "114316818461884883239-1740023062738"
const COURSE_ID = "114316818461884883239-1746662610467"
const MEMKEY_TOKEN = process.env.MEMKEY_TOKEN

async function main() {
    if (!LANGUAGE_OPTIONS.includes(LANGUAGE)) throw new Error(`${LANGUAGE} not found in ${LANGUAGE_OPTIONS}`)

    const { problemUrls, premiumProblemUrls: _ } =
        readCachedUrls(`data`, TAG)
    if (!problemUrls)
        throw new Error("No urls file found. Function for fetching problem urls not yet implemented")

    console.log("problems total", problemUrls.length)

    const currentProblemIndex = getCurrentIndex(problemUrls)

    const endOfBatchIndex = currentProblemIndex + BATCH_SIZE
    const arrayLength = problemUrls.length
    const lastBatchIndex = endOfBatchIndex < arrayLength ?
        endOfBatchIndex : arrayLength

    const problemUrlsSlice = problemUrls.slice(currentProblemIndex, lastBatchIndex)
    objLog({ currentProblemIndex, lastBatchIndex })

    const browser = await puppeteer.launch({ headless: "new" })

    const language = LANGUAGE

    let count = currentProblemIndex
    for (const problemUrl of problemUrlsSlice) {

        if (isProcessed(PROCESSED_PATH, problemUrl)) continue // Necessary: dup urls might exist in other tags

        const { title, descriptionSections } = await scrapeProblem(SCRAPED_PATH, browser, problemUrl)
        console.log({ title }, { currentProblem: ++count })
        const solutionsByUrl = await scrapeSolutions(SCRAPED_PATH, browser, language, `${problemUrl}/solutions/`)
        const solutionUrl = Object.keys(solutionsByUrl)?.[0] ?? ""

        const { youtubeUrl } = await scrapeYoutubeVideoUrls(browser, SCRAPED_PATH, title, language)
        console.log({ youtubeUrl })
        const youtubeCaptions = await fetchYouTubeCaptions(youtubeUrl)

        const systemPrompt = readFileSync(`data/youtubePrompt.txt`, 'utf-8')
        const gptResponse = await gptRequest({
            title, systemPrompt, userMessage: youtubeCaptions, dataPath: `${DATA_PATH}/gptYoutubeResponse.js`
        })

        const {
            summary, description, bruteForceDetails,
            optimalDetails, trickDetails, commonMistakesDetails,
        } = extractYoutubeResponseDetails(gptResponse)


        const { statementImages, ioExamples, constraints } = extractSectionsFromDescription(descriptionSections)
        const front = constructProblemFront({ summary, description, ioExamples, statementImages, solutionUrl, youtubeUrl, constraints })
        const listImage = statementImages[0] ?? ""

        const listFlashcards = await createListFlashcards({
            front, youtubeUrl,
            bruteForceDetails, optimalDetails, trickDetails,
            commonMistakesDetails,
            summary, description,
            ioExamples,
        })

        await waitForEnterKey("Override currentListFlashcards.js")

        const currentFlashcardsPath = `data/memkey/currentListFlashcards.js`
        const modelListFlashcardsPath = `data/memkey/4oFlashcards.js`
        appendObjectToFile(title, listFlashcards, modelListFlashcardsPath)
        writeArrayToFile(listFlashcards, currentFlashcardsPath)

        // Temporary solution to stop pages from buildig up
        const pages = await browser.pages()
        for (const page of pages) {
            if (!page.isClosed()) {
                await page.close();
            }
        }

        await fixAndUploadFlashcard({
            currentFlashcardsPath,
            title,
            listImage,
            ioExamples, summary, description,
            problemUrl, gptResponse
        });
    }
    await browser.close()
}

main();

function extractSectionsFromDescription({ statement, ioExamples, constraints }) {
    ioExamples = modifyImagesInPlace(ioExamples).trim().replace(/"$/, '').trim()

    const statementImages = extractImages(statement)
    const exampleImages = extractImages(ioExamples)
    if (statementImages.length === 0 && exampleImages.length > 0)
        statementImages.push(exampleImages[0])
    ioExamples = addHideTag(ioExamples, "Examples")
    constraints = addHideTag(constraints.trim().replace(/"$/, '').trim(), "Constraints")
    return { statementImages, ioExamples, constraints, }
}

export function extractImages(html) {
    const excludedPhrases = ["CUTE_CAT"];
    const imgRegex = /<img\s+[^>]*src="([^"]+)"[^>]*>/g;
    let match;
    let extractedImages = [];

    while ((match = imgRegex.exec(html)) !== null) {
        const imgTag = match[0];
        const src = match[1];

        // Check for excluded phrases in the alt attribute
        const altMatch = imgTag.match(/alt="([^"]*)"/);
        const altText = altMatch ? altMatch[1] : "";

        if (!excludedPhrases.some(phrase => altText.includes(phrase))) {
            extractedImages.push(src);
        }
    }

    return extractedImages;
}

function addHideTag(content, title) {
    return `<div class='memkey-hide' data-title='${title}'>${content}</div>`
}

function getCurrentIndex(problemUrls) {
    let count = 0
    for (const problemUrl of problemUrls) {
        if (!isProcessed(PROCESSED_PATH, problemUrl)) break
        count++
    }
    return count
}

async function fetchYouTubeCaptions(videoUrl, lang = 'en') {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
        console.error('Could not extract video ID.');
        return;
    }

    const captionsPath = `${DATA_ROOT}/captions`;
    ensureDirectoryExists(captionsPath);

    const filePath = `${captionsPath}/${videoId}.txt`;

    // Read from cache if file exists
    if (existsSync(filePath)) {
        console.log(`Reading cached captions from ${filePath}`);
        return readFileSync(filePath, 'utf8');
    }

    try {
        const captions = await getSubtitles({ videoID: videoId, lang });

        let groupedCaptions = [];
        let currentTimestamp = 0;
        let currentText = '';

        captions.forEach(({ start, text }) => {
            const startSeconds = Math.floor(parseFloat(start));

            if (startSeconds - currentTimestamp >= TIME_WINDOW) {
                // If new timestamp, save previous and start a new group
                if (currentText) {
                    groupedCaptions.push(`[${currentTimestamp}]: ${currentText}`);
                }
                currentTimestamp = startSeconds;
                currentText = text;
            } else {
                // Append to the current group
                currentText += ` ${text}`;
            }
        });

        // Push the last accumulated text
        if (currentText) {
            groupedCaptions.push(`[${currentTimestamp}]: ${currentText}`);
        }

        const formattedCaptions = groupedCaptions.join('\n');

        // Save captions to file
        writeFileSync(filePath, formattedCaptions);
        console.log(`Captions saved to ${filePath} captions length: ${formattedCaptions.length}`);

        return formattedCaptions;
    } catch (error) {
        console.error('Error fetching captions:', error);
        return null;
    }
}

function extractVideoId(url) {
    try {
        const urlObj = new URL(url);

        // Handle standard YouTube URLs (e.g., https://www.youtube.com/watch?v=VIDEO_ID)
        if (urlObj.searchParams.has('v')) {
            return urlObj.searchParams.get('v');
        }

        // Handle YouTube Shorts URLs (e.g., https://www.youtube.com/shorts/VIDEO_ID)
        if (urlObj.pathname.startsWith('/shorts/')) {
            return urlObj.pathname.split('/')[2]; // Extract the ID from "/shorts/VIDEO_ID"
        }

        return null; // No valid video ID found
    } catch (error) {
        console.error('Invalid URL:', error);
        return null;
    }
}

export function parseSections(text, headingsToExtract) {
    let results = [];
    let searchStart = 0;

    function findHeadingIndex(source, startIndex, patterns) {
        for (const pattern of patterns) {
            const match = source.slice(startIndex).match(pattern);
            if (match) {
                return startIndex + match.index; // Return correct position in original text
            }
        }
        return -1;
    }

    for (let i = 0; i < headingsToExtract.length; i++) {
        const heading = headingsToExtract[i];

        // Match both `(1)` and `1` formats for Intermediate Solution headings
        const headingPatterns = [
            new RegExp(`\\*\\*${heading.replace(/\((\d+)\)/, '\\($1\\)')}\\*\\*`, "i"),  // **Intermediate Solution (1)**
            new RegExp(`\\*\\*${heading.replace(/\((\d+)\)/, '$1')}\\*\\*`, "i"),        // **Intermediate Solution 1**
            new RegExp(`## ${heading.replace(/\((\d+)\)/, '\\($1\\)')}`, "i"),           // ## Intermediate Solution (1)
            new RegExp(`## ${heading.replace(/\((\d+)\)/, '$1')}`, "i")                  // ## Intermediate Solution 1
        ];

        const headingIndex = findHeadingIndex(text, searchStart, headingPatterns);
        if (headingIndex === -1) {
            throw new Error(`Heading not found: "${heading}"`);
        }

        // Determine where the heading's content starts.
        const newlineIndex = text.indexOf("\n", headingIndex);
        const colonIndex = text.indexOf(":", headingIndex);
        let contentStart;
        if (colonIndex !== -1 && (newlineIndex === -1 || colonIndex < newlineIndex)) {
            contentStart = colonIndex + 1;
        } else if (newlineIndex !== -1) {
            contentStart = newlineIndex + 1;
        } else {
            contentStart = headingIndex + heading.length;
        }

        // Find the next heading (if any) starting from contentStart.
        let nextHeadingIndex = -1;
        if (i < headingsToExtract.length - 1) {
            const nextHeading = headingsToExtract[i + 1];
            const nextHeadingPatterns = [
                new RegExp(`\\*\\*${nextHeading.replace(/\((\d+)\)/, '\\($1\\)')}\\*\\*`, "i"),
                new RegExp(`\\*\\*${nextHeading.replace(/\((\d+)\)/, '$1')}\\*\\*`, "i"),
                new RegExp(`## ${nextHeading.replace(/\((\d+)\)/, '\\($1\\)')}`, "i"),
                new RegExp(`## ${nextHeading.replace(/\((\d+)\)/, '$1')}`, "i")
            ];
            nextHeadingIndex = findHeadingIndex(text, contentStart, nextHeadingPatterns);
        }

        let contentEnd;
        if (nextHeadingIndex !== -1) {
            const newlineBefore = text.lastIndexOf("\n", nextHeadingIndex);
            contentEnd = newlineBefore !== -1 && newlineBefore > contentStart
                ? newlineBefore
                : nextHeadingIndex;
        } else {
            contentEnd = text.length;
        }

        let content = text.substring(contentStart, contentEnd).trim();
        if (content.toLowerCase() === "not found") {
            content = "";
        }

        results.push(content);
        searchStart = contentEnd;
    }
    return results;
}

function removeLineWith(text, marker) {
    // Remove the entire line that contains the marker.
    const idx = text.indexOf(marker);
    if (idx !== -1) {
        const newlineIdx = text.indexOf("\n", idx);
        return newlineIdx !== -1 ? text.slice(0, idx) + text.slice(newlineIdx) : text.slice(0, idx);
    }
    return text;
}

function extractSection(text) {
    // Remove Timestamp and Time Complexity lines.
    let cleaned = removeLineWith(text, "Timestamp:");
    cleaned = removeLineWith(cleaned, "Time Complexity:");
    cleaned = cleaned.trim();
    if (cleaned.toLowerCase() === "not found") {
        return "";
    }
    return cleaned;
}

function extractStepsFromSection(sectionText) {
    const lines = sectionText.split("\n");
    let steps = [];
    let currentStep = "";
    // A line starting with a number and a dot indicates a new step.
    const numberedStepRegex = /^\s*\d+\.\s*/;
    for (let line of lines) {
        if (numberedStepRegex.test(line)) {
            if (currentStep.trim().length > 0) {
                steps.push(currentStep.trim());
            }
            currentStep = line; // Preserve numbering and text.
        } else {
            if (currentStep.trim().length > 0) {
                currentStep += " " + line.trim();
            }
        }
    }
    if (currentStep.trim().length > 0) {
        steps.push(currentStep.trim());
    }
    // If no numbered steps were found, return the entire section as one step.
    if (steps.length === 0 && sectionText.trim().length > 0) {
        steps.push(sectionText.trim());
    }
    return steps;
}

function extractAdditionalDetails(text) {
    if (!text) return { section: "", timestamp: "", timeComplexity: "" };

    let timestamp = "";
    let timeComplexity = "";

    // --- Extract Timestamp ---
    const tsIndex = text.indexOf("Timestamp:");
    if (tsIndex !== -1) {
        const parenOpen = text.indexOf("(", tsIndex);
        if (parenOpen !== -1) {
            let balance = 0;
            let endIndex = -1;
            for (let i = parenOpen; i < text.length; i++) {

                if (text[i] === "(") {
                    balance++;
                } else if (text[i] === ")") {
                    balance--;
                    if (balance === 0) {
                        endIndex = i;
                        break;
                    }
                }
            }
            if (endIndex !== -1) {
                timestamp = text.substring(parenOpen + 1, endIndex).trim();
            }
        }
    }

    // --- Extract Time Complexity ---
    const tcIndex = text.indexOf("Time Complexity:");
    if (tcIndex !== -1) {
        const oIndex = text.indexOf("O(", tcIndex);
        if (oIndex !== -1) {
            let balance = 0;
            let endIndex = -1;
            for (let i = oIndex; i < text.length; i++) {
                if (text[i] === "(") {
                    balance++;
                } else if (text[i] === ")") {
                    balance--;
                    if (balance === 0) {
                        endIndex = i;
                        break;
                    }
                }
            }
            if (endIndex !== -1) {
                timeComplexity = text.substring(oIndex, endIndex + 1).trim();
            }
        }
    }

    // Remove Timestamp and Time Complexity lines.
    let section = removeLineWith(text, "Timestamp:");
    section = removeLineWith(section, "Time Complexity:");
    section = section.trim();

    if (section.toLowerCase().includes("not found.")) {
        section = "";
    }

    // --- Extract Steps ---
    const steps = extractStepsFromSection(section);

    return {
        steps,
        timestamp: timestamp.toLowerCase() === "not found" ? "" : timestamp,
        timeComplexity: timeComplexity.toLowerCase() === "not found" ? "" : timeComplexity
    };
}

export function extractYoutubeResponseDetails(response) {
    const headings = [
        "Description Summary",
        "Description",
        "Brute Force Solution",
        "Optimal Solution Summary",
        "Solution Trick",
        "Common Mistakes"
    ];

    const sections = parseSections(response, headings);
    const [
        summaryDetails,
        descriptionDetails,
        bruteForceDetails,
        optimalDetails,
        trickDetails,
        commonMistakesDetails
    ] = sections;

    function prepareSection(section) {
        return extractSection(section)
            .replaceAll("\n", "<br/>")
            .trim().replace(/"$/, '').trim()
    }

    const description = addHideTag(prepareSection(descriptionDetails), "Description")
    const summary = prepareSection(summaryDetails)

    return {
        summary,
        description,
        bruteForceDetails: extractAdditionalDetails(bruteForceDetails),
        optimalDetails: extractAdditionalDetails(optimalDetails),
        trickDetails: extractAdditionalDetails(trickDetails),
        commonMistakesDetails: extractAdditionalDetails(commonMistakesDetails)
    };
}

async function createListFlashcards(flashcardData) {
    const {
        front,
        bruteForceDetails,
        optimalDetails,
        trickDetails,
        commonMistakesDetails,
        youtubeUrl,
        ioExamples,
        summary,
        description
    } = flashcardData

    // TODO figure out how to deal with timestamps
    const topics = [
        "Brute Force Solution",
        "Optimal Solution",
        "Solution Trick",
        "Common Mistakes"
    ]

    const labelsForTopic = {
        "Brute Force Solution": [summary, description, ioExamples, "Brute Force Solution"],
        "Optimal Solution": [summary, description, ioExamples, "Optimal Solution"],
        "Solution Trick": [summary, description, ioExamples, "Solution Trick"],
        "Common Mistakes": [summary, description, "Common Mistakes"],
    }

    const detailsForTopic = {
        "Brute Force Solution": bruteForceDetails,
        "Optimal Solution": optimalDetails,
        "Solution Trick": trickDetails,
        "Common Mistakes": commonMistakesDetails,
    }

    let firstFlashcardFront = front
    const listFlashcards = []
    for (const topic of topics) {
        const labels = labelsForTopic[topic]

        const { steps, timeComplexity, timestamp } = detailsForTopic[topic]
        const stepFlashcards = loopOverSteps({ labels, firstFlashcardFront, timeComplexity, timestamp, steps, youtubeUrl, topic })

        if (stepFlashcards.length !== 0)
            firstFlashcardFront = ""

        //console.log({ stepFlashcards })
        // Remove " at the end of each step
        const newStepFlashcards = stepFlashcards.map(step =>
        ({
            ...step,
            front: step.front.trim().replace(/"$/, '').trim(),
            back: step.back.trim().replace(/"$/, '').trim()
        })
        )
        listFlashcards.push(...newStepFlashcards)
    }

    return listFlashcards
}

function loopOverSteps(data) {
    const {
        labels, firstFlashcardFront,
        timeComplexity, timestamp, steps,
        youtubeUrl, topic
    } = data

    const flashcards = steps.map((step, index) => {
        return {
            front: (index === 0 && firstFlashcardFront) ? firstFlashcardFront + `\n${topic}` : labels.join("\n"),
            back: step,
            source: timestamp ? `${youtubeUrl}&t=${timestamp}` : youtubeUrl,
            showPreviousBack: index !== 0
        }
    })

    if (flashcards.length > 0 && timeComplexity) {
        flashcards.push({
            front: labels.join("\n") + "\nTime Complexity",
            back: timeComplexity,
            source: timestamp ? `${youtubeUrl}&t=${timestamp}` : youtubeUrl,
            showPreviousBack: false,
        })
    }
    return flashcards
}


function constructProblemFront(data) {

    const {
        summary, description, ioExamples,
        statementImages, solutionUrl, youtubeUrl, constraints
    } = data

    const imageTags = statementImages.length > 1
        ? statementImages.slice(1).map(src => `<img src="${src}" class="memkey-leetcode-image"/>`).join("")
        : ""

    const solutionUrlTag = !solutionUrl && !youtubeUrl ? "" :
        `<div>
<a href="${solutionUrl}" class="memkey-link">Leetcode Solutions</a> &nbsp;|&nbsp;
<a href="${youtubeUrl}" class="memkey-link">Youtube Solution</a>
</div>`

    const front = `${imageTags}${summary}${description}${ioExamples}${solutionUrlTag}${constraints}`

    return front
}


function waitForEnterKey(prompt) {
    prompt = prompt ?? 'Press Enter to continue...'
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(prompt, () => {
            rl.close();
            resolve();
        });
    });
}

async function fixAndUploadFlashcard({
    currentFlashcardsPath,
    title,
    listImage,
    problemUrl, gptResponse
}) {
    //console.log({ gptResponse })
    //console.log({ title })
    //objLog({
    //    listImageUrl: listImage,
    //    listThumbUrl: listImage,
    //})
    await waitForEnterKey("Press enter after fixing the flashcard data")

    const fixedListFlashcardsPath = `data/memkey/fixedFlashcards.js`
    const newListFlashcards = readArrayFromFile(currentFlashcardsPath)
    appendObjectToFile(title, newListFlashcards, fixedListFlashcardsPath)
    const list = {
        title,
        listImageUrl: listImage,
        listThumbUrl: listImage,
        flashcards: newListFlashcards
    }

    console.dir({ list },
        { depth: 4 })
    await waitForEnterKey("Press enter to upload")
    const listId = await saveList(list, COURSE_ID, MEMKEY_TOKEN)
    objLog({ listId })
    if (listId) {
        appendToProcessedUrls(PROCESSED_PATH, problemUrl)
    }
}
