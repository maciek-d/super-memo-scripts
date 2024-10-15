import puppeteer from 'puppeteer';
import { appendToProcessedUrls, isProcessed, readCachedUrls, writeCachedUrls } from './fileUtils';
import { scrapeProblem, scrapeProblemUrls, scrapeSolutions } from './leetcodeScraper';


const TAG = process.argv.find(arg => arg.startsWith('--tag='))?.split('=')[1] || "array"
const LANGUAGE = process.argv.find(arg => arg.startsWith('--lang='))?.split('=')[1] || "Python"
const BATCH_SIZE = process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1] || 20

const LANGUAGE_OPTIONS = ["JavaScript", "C++", "Java", "Python3", "Python", "C", "C#", "Ruby", "Swift",
    "Go", "Scala", "Kotlin", "Rust", "MySQL", "Bash", "TypeScript", "Dart",
    "Erlang", "Elixir", "PHP", "Racket"]

const DATA_ROOT = `./data/${LANGUAGE}`
const DATA_PATH = `${DATA_ROOT}/${TAG}`

async function main() {
    if (!LANGUAGE_OPTIONS.includes(LANGUAGE)) throw new Error(`${LANGUAGE} not found in ${LANGUAGE_OPTIONS}`)

    // const browser = await puppeteer.launch({ headless: "new" });
    const browser = await puppeteer.launch({ headless: false });

    const { problemUrls, premiumProblemUrls } =
        readCachedUrls(DATA_PATH) ?? await scrapeProblemUrls(browser, TAG)
    writeCachedUrls(problemUrls, premiumProblemUrls, DATA_PATH)

    const currentProblemIndex = readCurrentIndex(DATA_PATH) ?? 0

    const endOfBatchIndex = currentProblemIndex + BATCH_SIZE
    const lastProblemIndex = problemUrls.length - 1
    const lastBatchIndex = endOfBatchIndex < lastProblemIndex ?
        endOfBatchIndex : lastProblemIndex
    const problemUrlsSlice = problemUrls.slice(currentProblemIndex, lastBatchIndex)

    for (const problemUrl of problemUrlsSlice) {
        if (isProcessed(problemUrls)) continue
        await processProblem(problemUrl)

        appendToProcessedUrls(problemUrls)
    }
}

// check if used and delete if not
// fetchProblems

async function processProblem(problemUrl) {
    const { title, description, htmlDescription } = await scrapeProblem(browser, problemUrl)
    const solutionsUrl = problemUrl + '/solutions/';
    readSolutions(DATA_ROOT, url)
    // TODO fetch multiple urls instead
    //
    // and extract images right away
    await scrapeSolutions(browser, solutionsUrl)
}

main().then(() => {
    console.log("done");
})
