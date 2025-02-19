import { getSubtitles } from 'youtube-captions-scraper'
import { existsSync, readFileSync, writeFileSync } from "fs"
import { scrapeYoutubeVideoUrls, } from './main.js'
import { scrapeProblem, } from './leetcodeScraper.js'
import { ensureDirectoryExists, gptRequest, parseSections, } from './fileUtils.js'
import { modifyImagesInPlace } from "./prepareFlashcard.js"
import { addTopicToList, saveList } from './memkeyApi.js'

const TAG = process.argv.find(arg => arg.startsWith('--tag='))?.split('=')[1] || "neetcode150"

const LANGUAGE = 'PYTHON';
const DATA_ROOT = `./data/${LANGUAGE}`;
const DATA_PATH = `${DATA_ROOT}/${TAG}`
const SCRAPED_PATH = `${DATA_PATH}/scraped`
const PROCESSED_PATH = 'data/youtubeProcessedNeetcode150.js'

const TIME_WINDOW = 5
const BATCH_SIZE = 10

const LANGUAGE_OPTIONS = ["JavaScript", "C++", "Java", "Python3", "Python", "C", "C#", "Ruby", "Swift",
    "Go", "Scala", "Kotlin", "Rust", "MySQL", "Bash", "TypeScript", "Dart",
    "Erlang", "Elixir", "PHP", "Racket"]

const COURSE_ID = ""
const AUTH_TOKEN = ""

async function main() {
    if (!LANGUAGE_OPTIONS.includes(LANGUAGE)) throw new Error(`${LANGUAGE} not found in ${LANGUAGE_OPTIONS}`)

    const { problemUrls, premiumProblemUrls: _ } =
        readCachedUrls(`data`, TAG)
    if (!problemUrls)
        throw new Error("No urls file found. Function for fetching problem urls not yet implemented")

    console.log(problemUrls.length)

    const currentProblemIndex = getCurrentIndex(problemUrls)

    const endOfBatchIndex = currentProblemIndex + BATCH_SIZE
    const arrayLength = problemUrls.length
    const lastBatchIndex = endOfBatchIndex < arrayLength ?
        endOfBatchIndex : arrayLength

    const problemUrlsSlice = problemUrls.slice(currentProblemIndex, lastBatchIndex)
    objLog({ currentProblemIndex, lastBatchIndex })

    if (currentProblemIndex === 0) {
        const topics = [
            "Brute Force Solution",
            "Intermediate Solution",
            "Intermediate Solution 2",
            "Intermediate Solution 3",
            "Intermediate Solution 4",
            "Optimal Solution",
            "Solution Tick",
            "Common Mistakes",
            "Time Complexity",
        ]
        await Promise.all(
            topics.map(label => addTopicToCourse(label, label, COURSE_ID, AUTH_TOKEN))
        );
    }

    const browser = await puppeteer.launch({ headless: "new" })
    const language = LANGUAGE
    for (const problemUrl of problemUrlsSlice) {
        if (isProcessed(PROCESSED_PATH, problemUrl)) continue // Necessary: dup urls might exist in other tags

        const { title, descriptionSections } = await scrapeProblem(SCRAPED_PATH, browser, problemUrl)
        const { solutionUrls } = scrapeSolutions(SCRAPED_PATH, browser, language, `${problemUrl}/solutions/`)

        const youtubeUrls = await scrapeYoutubeVideoUrls(browser, SCRAPED_PATH, title, language)
        const { youtubeUrl } = youtubeUrls
        const youtubeCaptions = await fetchYouTubeCaptions(youtubeUrl);

        const systemPrompt = readFileSync(`data/youtubePrompt.txt`, 'utf-8')
        const gptResponse = await gptRequest({
            title, systemPrompt, userMessage: youtubeCaptions, dataPath: `${DATA_PATH}/gptYoutubeResponse.js`
        })

        const {
            summary, description, bruteForceDetails,
            optimalDetails, trickDetails, commonMistakesDetails,
        } = extractYoutubeResponseDetails(gptResponse)
        const intermediateSolutions = extractIntermediateSolutions(gptResponse)

        const { statementImages, ioExamples, constraints } = extractSectionsFromDescription(descriptionSections)

        const front = constructProblemFront({ solutionUrls, statementImages, youtubeUrl, constraints })
        const listImage = statementImages[0] ?? ""
        const listFlashcards = createListFlashcards({
            front, youtubeUrl,
            intermediateSolutions,
            bruteForceDetails, optimalDetails, trickDetails,
            commonMistakesDetails,
        })
        console.log({ listFlashcards })
        const list = {
            listTitle: title,
            listImageUrl: listImage,
            listThumbUrl: listImage,
            flashcards: listFlashcards
        }

        console.log({
            listTitle: title,
            listImageUrl: listImage,
            listThumbUrl: listImage,
        })
        process.exit(0)

        const listId = await saveList(list, title, COURSE_ID, AUTH_TOKEN)
        console.log({ listId })

        await addTopicToList("Examples", ioExamples, listId, COURSE_ID, AUTH_TOKEN)
        await addTopicToList("Description Summary", summary, listId, COURSE_ID, AUTH_TOKEN)
        await addTopicToList("Description", description, listId, COURSE_ID, AUTH_TOKEN)
    }
}

main();

function extractSectionsFromDescription({ statement, ioExamples, constraints }) {
    ioExamples = modifyImagesInPlace(ioExamples)
    const statementImages = extractImages(statement)
    const exampleImages = extractImages(ioExamples)
    if (statementImages.length === 0 && exampleImages.length > 0)
        statementImages.push(exampleImages[0])
    ioExamples = addHiddenTag(ioExamples, "Examples")
    constraints = addHiddenTag(constraints, "Constraints")
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

function addHiddenTag(content, title) {
    return `<div class='memkey-hidden' data-title='${title}'>${content}</div>`
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
        console.log(`Captions saved to ${filePath}`);

        return formattedCaptions;
    } catch (error) {
        console.error('Error fetching captions:', error);
        return null;
    }
}

function extractVideoId(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('v');
    } catch (error) {
        console.error('Invalid URL:', error);
        return null;
    }
}

function extractYoutubeResponseDetails(response) {
    const headings = [
        "Description Summary",
        "Description",
        "Brute Force Solution",
        "Optimal Solution",
        "Solution Trick",
        "Common Mistakes"
    ];

    const [
        summaryDetails,
        descriptionDetails,
        bruteForceDetails,
        optimalDetails,
        trickDetails,
        commonMistakesDetails
    ] = parseSections(response, headings, "");

    return {
        summary: extractSection(summaryDetails),
        description: extractSection(descriptionDetails),
        bruteForceDetails: extractAdditionalDetails(bruteForceDetails),
        optimalDetails: extractAdditionalDetails(optimalDetails),
        trickDetails: extractAdditionalDetails(trickDetails),
        commonMistakesDetails: extractAdditionalDetails(commonMistakesDetails),
    };
}

function extractSection(text) {
    // Remove extracted values from the section text
    const section = text
        .replace(/Timestamp:\s*\([^)]+\)/, "")
        .replace(/Time Complexity:\s*[OΘΩ][\(\)0-9mn\^\s×]+/, "")
        .trim();

    // If section contains "Not Found", return empty string for section
    if (section.includes("Not Found")) {
        return ""
    }
    return section
}

function extractAdditionalDetails(text) {
    if (!text) return { section: "", timestamp: "", timeComplexity: "" };

    // Extract timestamp and time complexity first
    const timestampMatch = text.match(/Timestamp:\s*\(([^)]+)\)/);
    const complexityMatch = text.match(/Time Complexity:\s*([OΘΩ][\(\)0-9mn\^\s×]+)/);

    const timestamp = timestampMatch ? timestampMatch[1] : "";
    const timeComplexity = complexityMatch ? complexityMatch[1] : "";


    const section = extractSection(text)

    function extractSteps(text) {
        const stepRegex = /\n(\d+\..*?)(?=\n\d+\.|$)/gs;
        const matches = [...text.matchAll(stepRegex)].map(match => match[1].trim());

        return matches.length > 0 ? matches : [text];
    }
    const steps = extractSteps(section)
    return {
        steps,
        timestamp: timestamp.includes("Not Found.") ? "" : timestamp,
        timeComplexity: timeComplexity.includes("Not Found.") ? "" : timeComplexity
    };
}

export function extractIntermediateSolutions(text) {
    function findHeadingIndex(source, startIndex, headingPattern) {
        let foundIndex = -1;
        const idx = source.toLowerCase().indexOf(headingPattern.toLowerCase(), startIndex);
        if (idx !== -1) {
            foundIndex = idx;
        }
        return foundIndex;
    }

    function skipHeadingPattern(source, headingIndex, headingPattern) {
        let i = headingIndex + headingPattern.length;
        while (i < source.length && /[:*\s]/.test(source[i])) {
            i++;
        }
        return i;
    }

    let searchStart = 0;
    const results = [];
    let count = 1;

    while (true) {
        const headingName = `Intermediate Solution (${count})`;
        const headingPatterns = [`**${headingName}**`, `## ${headingName}`, `##${headingName}`];

        let headingIndex = -1;
        for (const pattern of headingPatterns) {
            headingIndex = findHeadingIndex(text, searchStart, pattern);
            if (headingIndex !== -1) break;
        }

        if (headingIndex === -1) break; // No more intermediate solutions found

        const afterHeadingIndex = skipHeadingPattern(text, headingIndex, headingName);

        let nextHeadingIndex = -1;
        for (let nextCount = count + 1; ; nextCount++) {
            const nextHeadingName = `Intermediate Solution (${nextCount})`;
            for (const pattern of [`**${nextHeadingName}**`, `## ${nextHeadingName}`, `##${nextHeadingName}`]) {
                nextHeadingIndex = findHeadingIndex(text, afterHeadingIndex, pattern);
                if (nextHeadingIndex !== -1) break;
            }
            if (nextHeadingIndex !== -1) break;
        }

        const contentEnd = nextHeadingIndex === -1 ? text.length : nextHeadingIndex;
        let content = text.slice(afterHeadingIndex, contentEnd).trim();

        if (content) {
            results.push(extractAdditionalDetails(content));
        }

        searchStart = contentEnd;
        count++;
    }

    return results;
}

function createListFlashcards(flashcardData) {
    const {
        front,
        bruteForceDetails, intermediateSolutions,
        optimalDetails, trickDetails,
        commonMistakesDetails,
    } = flashcardData
    // TODO figure out how to deal with timestamps
    const topics = [
        "Brute Force Solution",
        "Intermediate Solution",
        "Optimal Solution",
        "Solution Trick",
        // "Common Mistakes"
    ]

    const labelsForTopic = {
        "Brute Force Solution": ["Description Summary", "Description", "Brute Force Solution", "Examples"],
        "Intermediate Solution": ["Description Summary", "Description", "Examples"], // Append Intermediate Solution in loop
        "Optimal Solution": ["Description Summary", "Description", "Optimal Solution"],
        "Solution Trick": ["Description Summary", "Description", "Solution Trick"],
        "Common Mistakes": ["Description Summary", "Description", "Common Mistakes"],
    }

    const stepsForTopic = {
        "Brute Force Solution": bruteForceDetails.steps,
        "Optimal Solution": optimalDetails.steps,
        "Solution Trick": trickDetails.steps,
        "Common Mistakes": commonMistakesDetails.steps,
    }

    let firstFlashcardFront = front
    const listFlashcards = []
    for (const topic of topics) {
        const labels = labelsForTopic[topic]

        if (topic === "Intermediate Solution") {
            for (const [intermediateDetails, index] of intermediateSolutions.entries()) {
                const newLabels = [...labels]
                newLabels.push(`Intermediate Solution ${index + 1}`)
                loopOverSteps({ labels: newLabels, ...intermediateDetails })
            }
            continue
        }

        const { steps, timeComplexity, timestamp } = stepsForTopic[topic]
        const stepFlashcards = loopOverSteps({ labels, firstFlashcardFront, timeComplexity, timestamp, steps })
        firstFlashcardFront = ""
        listFlashcards.push(...stepFlashcards)
    }

    return listFlashcards
}

// listImage
function loopOverSteps(data) {
    const {
        labels, firstFlashcardFront,
        timeComplexity, timestamp, steps,
    } = data

    const flashcards = steps.map((step, index) => {
        const back = step
        return {
            topicLabels: labels,
            front: index === 0 ? firstFlashcardFront : "",
            back,
            source: `${youtubeUrl}&t=${timestamp}`
        }
    })

    if (timeComplexity) {
        flashcards.push({
            topicLabels: [...labels, "Time Complexity"],
            back: timeComplexity,
            source: `${youtubeUrl}&t=${timestamp}`
        })
    }
    return flashcards
}


function constructProblemFront(data) {

    const { statementImages, youtubeUrl, solutionUrls, constraints } = data

    const imageTags = statementImages.length > 1
        ? statementImages.slice(1).map(src => `<img src="${src}" class="memkey-leetcode-image"/>`).join("")
        : ""

    const youtubeTag = `<div class="memkey-align-left">
    <a href="${youtubeUrl}" >
        <img src="https://memkey.s3.us-west-1.amazonaws.com/media/images/youtube_32.png"/>
    </a>
</div>`

    const solutionUrl = solutionUrls[0]
    const solutionUrlTag = !solutionUrl ? "" :
        `<div>
    Solutions:
    <a href="${solutionUrl}" class="memkey-link">[1]</a>
</div>`

    const front = `${imageTags}${youtubeTag}${solutionUrlTag}${constraints}`

    return front
}
