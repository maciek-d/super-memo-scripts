import { existsSync, readFileSync, writeFileSync } from "fs"
import { createImage, promptChatGpt } from "./gptApi.js"

export function readCachedUrls(dataPath) {
    const problemUrlCachePath = `${dataPath}/cache/problemUrl.js`
    const premiumProblemUrlCachePath = `${dataPath}/cache/premiumProblemUrl.js`

    const problemUrls = existsSync(problemUrlCachePath) ?
        JSON.parse(safeReadFile(problemUrlCachePath)) : null

    const premiumProblemUrls = existsSync(premiumProblemUrlCachePath) ?
        JSON.parse(safeReadFile(premiumProblemUrlCachePath)) : null

    if (problemUrls)
        return { problemUrls, premiumProblemUrls }

    return null
}

export function writeCachedUrls(problemUrls, premiumProblemUrls, dataPath) {
    const problemUrlCachePath = `${dataPath}/cache/problemUrl.js`
    const premiumProblemUrlCachePath = `${dataPath}/cache/premiumProblemUrl.js`

    writeFileSync(problemUrlCachePath, JSON.stringify(problemUrls));
    writeFileSync(premiumProblemUrlCachePath, JSON.stringify(premiumProblemUrls));
}

export function isProcessed(dataPath, url) {
    const processedUrlsPath = `${dataPath}/processedUrls.js`
    const processedUrlsArray = existsSync(processedUrlsPath) ?
        JSON.parse(safeReadFile(processedUrlsPath)) : null
    return (new Set(processedUrlsArray ?? [])).has(url)
}

export function appendToProcessedUrls(dataPath, newUrl) {
    const processedUrlsPath = `${dataPath}/processedUrls.js`
    const processedUrlsArray = existsSync(processedUrlsPath) ?
        JSON.parse(safeReadFile(processedUrlsPath)) : null
    const newProcessedUrlsArray = Array.from((new Set(processedUrlsArray)).add(newUrl))
    writeFileSync(processedUrlsPath, JSON.stringify(newProcessedUrlsArray));
}

export function readCurrentIndex(dataPath) {
    const problemIndexPath = `${dataPath}/cache/problemIndex.js`
    if (!existsSync(problemIndexPath)) return 0
    return Number(safeReadFile(problemIndexPath))
}

export function readByObjectKey(path, key) {
        return JSON.parse(safeReadFile(path))?.[key]
}

export function appendObjectToFile(key, object, path) {
    const rawString = existsSync(path) ?
        safeReadFile(path) : "{}"
    const objects = JSON.parse(rawString)
    objects[key] = object
    writeFileSync(path, JSON.stringify(objects, null, 2))
}

export async function gptPrompt({
    title, prompt, userMessage,
}) {
    const response = readByObjectKey(`${DATA_PATH}/gptResponses.js`, title) ??
        await promptChatGpt(prompt, userMessage)

    appendObjectToFile(title, response, `${DATA_PATH}/gptResponses.js`)

    return response
}

export function extractDataFromGptResponse(response, solutions, language) {
    const imageDescription = extractSection(response, "Image Description")
    const [gptSolutionIndex, gptSolutionIndex2] = extractProblemIndex(response)
    const keys = Object.keys(solutions);
    const solutionsUrl1 = solutions[keys[gptSolutionIndex]];
    const solutionsUrl2 = solutions[keys[gptSolutionIndex2]];

    if (!solutionsUrl1 || !solutionsUrl2) {
        throw new Error(
            `Failed to get solutionsUrls ${solutionsUrl1} ${solutionsUrl2}`
        )
    }

    response = response
        .replaceAll("&lt;", "＜")
        .replaceAll("&gt;", "＞")
        .replace(/<(?!img|\/img)/gi, '＜')

    const summary = extractSection(response, "Summary", language)
    const description = extractSection(response, "Description", language)
    const bestIoExample = extractSection(response, "I\/O", language)

    const algorithm = extractSection(response, "Problem Algorithm", language)
    const datastructure = extractSection(response, "Problem Datastructure", language)
    const code = extractSection(response, "Primary Solution Code", language);
    const code2 = extractSection(response, "Secondary Solution Code", language);
    const steps = extractSection(response, "Enumerated Steps 1", language);
    const steps2 = extractSection(response, "Enumerated Steps 2", language);
    const solution = extractSection(response, "Solution 1", language);
    const solution2 = extractSection(response, "Solution 2", language);
    const complexity = extractSection(response, "Time Complexity", language);

    return {
        imageDescription, solutionsUrl1, solutionsUrl2,
        solutionImages, solutionImages2,
        summary, description, bestIoExample,
        algorithm, datastructure, code, code2, steps, steps2,
        solution, solution2, complexity
    }
}

function extractProblemIndex(response) {
    const sectionTitle = "SelectedSolutions";

    // regex matches titles starting with ##+ or **
    const hashRegex = new RegExp(`#{1,6}\\s*${sectionTitle}\\s*\\[\\s*([\\d,\\s]+)\\s*\\]`, 'i');
    const asteriskRegex = new RegExp(`\\*\\*${sectionTitle}\\*\\*.*?\\[\\s*([\\d,\\s]+)\\s*\\]`, 'i');

    const noCodeBlocks = response
        .replace(/```javascript\n([\s\S]*?)\n\s*```/g, (_match, p1) => {
            return p1
        }).replace(/```json\n([\s\S]*?)\n\s*```/g, (_match, p1) => {
            return p1
        }).replace(/```\s*([\s\S]*?)\s*```/g, (_match, p1) => {
            return p1
        })

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

export const extractFirstNumber = (str) => {
    const result = str.match(/\d+/); // Regular expression to find numbers
    return result ? parseInt(result[0]) : null; // Parse the first found number
}

export async function fetchGptImage(imageDescription, filePath) {
    const imageExists = existsSync(filePath)
    let image = imageExists ? readImage(imagePath) : null

    if (!imageExists) {
        const url = await createImage(imageDescription)
        image = await downloadImage(url)

        writeFileSync(imagePath, image)
    }
    return image
}

function readImage(imagePath) {
    const data = safeReadFile(imagePath);
    return Buffer.from(data);
}

function stripCodeBlocks(text, language) {
    const regex = new RegExp(`\`\`\`${language.toLowerCase()}\n([\\s\\S]*?)\n\\s*\`\`\``, 'g');
    return text.replace(regex, (_match, p1) => {
        // Replace spaces at the start of each line within the code block
        const replaced = p1.replace(/^ +/gm, (spaces) => spaces.replace(/ /g, '&nbsp;'));
        return replaced;
    });
}

export function extractSection(text, sectionTitle, language) {
    const lines = text.split('\n');
    let capturing = false;
    let section = [];
    const headerRegexHash = new RegExp(`^.*#+ ${sectionTitle}`, 'i');
    const headerRegexAsterisks = new RegExp(`^.*\\*\\*${sectionTitle}.?\\*\\*`, 'i');

    const hashTitleExists = lines.some(line => headerRegexHash.test(line.trim()));

    const sectionHeaderRegex = hashTitleExists ? headerRegexHash : headerRegexAsterisks;
    for (const line of lines) {
        // Check for start of the section
        if (sectionHeaderRegex.test(line.trim())) {
            // Account for section text on the same line
            const content = line
                .trim()
                .replace(sectionHeaderRegex, '')
                .trim()
                .replace(/^\s*:\s*/, '')
            if (content) {
                section.push(content)
            }
            capturing = true;
            continue;
        }

        // Check for end of the section (next header starting with ##)
        if (section.length !== 0 && capturing &&
            (
                line.trim().startsWith('##') ||
                (!hashTitleExists && /.*\*\*/.test(line.trim()))
            )
        ) {
            break;
        }

        if (capturing) {
            section.push(line);
        }
    }

    if (section.length === 0) {
        throw new Error(`couldnt find blocks for section ${sectionTitle}`)
    }
    return stripCodeBlocks(section.join('\n').trim(), language)
        .replaceAll("\n", "<br/>")
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
}

export function safeReadFile(path) {
    try {
        return readFileSync(path, 'utf8')
    } catch (e) {
        if (e.code === 'ENOENT') { // File not found
            return null
        }
        throw e
    }
}

