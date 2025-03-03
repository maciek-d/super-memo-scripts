import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { spawn } from "child_process";
import { promptChatGpt } from "./gptApi.js"

export function readCachedUrls(dataPath, tag) {
    const problemUrlCachePath = `${dataPath}/problemUrls/${tag}.js`
    const premiumProblemUrlCachePath = `${dataPath}/premiumProblemUrls/${tag}.js`

    const problemUrls = existsSync(problemUrlCachePath) ?
        JSON.parse(safeReadFile(problemUrlCachePath)) : null

    const premiumProblemUrls = existsSync(premiumProblemUrlCachePath) ?
        JSON.parse(safeReadFile(premiumProblemUrlCachePath)) : []

    if (problemUrls)
        return { problemUrls, premiumProblemUrls }

    return null
}

export function writeCachedUrls(problemUrls, premiumProblemUrls, dataPath, tag) {
    const problemUrlCachePath = `${dataPath}/problemUrls/${tag}.js`
    const premiumProblemUrlCachePath = `${dataPath}/premiumProblemUrls/${tag}.js`

    writeFileSync(problemUrlCachePath, JSON.stringify(problemUrls));
    writeFileSync(premiumProblemUrlCachePath, JSON.stringify(premiumProblemUrls));
}

export function isProcessed(dataPath, url) {
    const processedUrlsArray = existsSync(dataPath) ?
        JSON.parse(safeReadFile(dataPath)) : null
    return (new Set(processedUrlsArray ?? [])).has(url)
}

export function appendToProcessedUrls(dataPath, newUrl) {
    const processedUrlsArray = existsSync(dataPath) ?
        JSON.parse(safeReadFile(dataPath)) : null
    const newProcessedUrlsArray = Array.from((new Set(processedUrlsArray)).add(newUrl))
    writeFileSync(dataPath, JSON.stringify(newProcessedUrlsArray));
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

export async function gptRequest({
    title, systemPrompt, userMessage, dataPath
}) {
    const responseFromFile = readByObjectKey(dataPath, title)
    if (responseFromFile) console.log({ responseFromFile: responseFromFile?.slice(0, 200) })
    const response = responseFromFile ??
        (await promptChatGpt(systemPrompt, userMessage))

    appendObjectToFile(title, response, dataPath)
    return response
}

export function extractSolutionsFromIndexes(response, solutions) {
    const [gptSolutionIndex, gptSolutionIndex2] = extractProblemIndex(response)
    const keys = Object.keys(solutions)
    const modifier = gptSolutionIndex == 0 ? 0 : 1
    const solutionsUrl1 = keys[gptSolutionIndex - modifier]
    const solutionsUrl2 = keys[gptSolutionIndex2 - modifier]

    if (!solutionsUrl1 || !solutionsUrl2) {
        throw new Error(
            `Failed to get solutionsUrls ${solutionsUrl1} ${solutionsUrl2}`
        )
    }
    return { solutionsUrl1, solutionsUrl2 }
}

export function parseSections(text, headingsToExtract, language) {
    /************************************************
     * 1) Minimal code-block stripper (unchanged)
     ************************************************/
    function stripCodeBlocks(input, lang) {
        const lowerLang = (lang || '').toLowerCase();
        const re = new RegExp('```' + lowerLang + '\\n([\\s\\S]*?)\\n\\s*```', 'g');
        return input.replace(re, (_match, codeInner) => {
            return codeInner.replace(/^ +/gm, spaces => spaces.replace(/ /g, '&nbsp;'));
        });
    }

    /************************************************
     * 2) Helper to find the earliest index of
     *    heading patterns for "headingName"
     ************************************************/
    function findHeadingIndex(source, startIndex, headingName) {
        const patterns = [];

        // Up to 6 # signs, plus a space, plus headingName
        for (let i = 1; i <= 6; i++) {
            patterns.push('#'.repeat(i) + ' ' + headingName);
            patterns.push('#'.repeat(i) + ' ' + headingName + ':');
        }

        // Double-star patterns
        patterns.push(`**${headingName}**`);
        patterns.push(`**${headingName}**:`);

        let foundIndex = -1;
        for (const pat of patterns) {
            const idx = source.toLowerCase().indexOf(pat.toLowerCase(), startIndex);
            if (idx !== -1 && (foundIndex === -1 || idx < foundIndex)) {
                foundIndex = idx;
            }
        }
        return foundIndex;
    }

    /************************************************
     * 3) Skip just the heading pattern text
     *    (plus an optional trailing colon/spaces),
     *    returning the index where content begins.
     ************************************************/
    function skipHeadingPattern(source, headingIndex, headingName) {
        // We'll advance from headingIndex through any # or * or space,
        // then the headingName, then optional ':'.
        let i = headingIndex;

        // 1) Skip leading '#' or '*' or spaces
        while (i < source.length && /[#*\s]/.test(source[i])) {
            i++;
        }

        // 2) Skip exactly headingName.length characters (the heading text)
        //    (since we matched ignoring case, but we'll assume the length is consistent).
        i += headingName.length;
        while (i < source.length && source[i] === '*') {
            i++;
        }

        // 3) If there's a colon, skip it + any following spaces
        if (source[i] === ':') {
            i++;
            while (i < source.length && source[i] === ' ') {
                i++;
            }
        }

        // skip new lines at start
        if (i < source.length && source[i] === '\n') {
            i++;
        }

        // Now i is at the start of the actual content (which might be on the same line!)
        return i;
    }

    /************************************************
     * 4) The main logic
     ************************************************/
    let searchStart = 0;
    const results = [];

    for (let i = 0; i < headingsToExtract.length; i++) {
        const headingName = headingsToExtract[i];
        const lowerHeading = headingName.toLowerCase();

        // A) Find this heading in text
        const headingIndex = findHeadingIndex(text, searchStart, lowerHeading);
        if (headingIndex === -1) {
            throw new Error(`Heading not found: "${headingName}"`);
        }

        // B) Skip the heading pattern (including optional colon/spaces)
        const afterHeadingIndex = skipHeadingPattern(text, headingIndex, lowerHeading);

        // C) Find the next heading (if any)
        let nextHeadingIndex = -1;
        if (i < headingsToExtract.length - 1) {
            const nextHeadingName = headingsToExtract[i + 1].toLowerCase();
            nextHeadingIndex = findHeadingIndex(text, afterHeadingIndex, nextHeadingName);
        }

        const contentEnd = (nextHeadingIndex === -1) ? text.length : nextHeadingIndex;

        // D) Extract substring as the content
        let content = text.slice(afterHeadingIndex, contentEnd);

        // Remove trailing number
        content = content.replace(/\d+\.\s*$/, '');

        // Trim trailing whitespace and extra <br/>
        content = content.replace(/(<br\/>\s*)+$/, '').trim();
        console.log({ [headingName]: content })
        // E) Cleanup
        content = stripCodeBlocks(content, language)
            .replace(/\n/g, '<br/>')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

        if (!content.trim()) {
            throw new Error(`Section "${headingName}" is empty`);
        }

        results.push(content);

        // Move searchStart so we don't find the same heading again
        searchStart = contentEnd;
    }

    return results;
}


export function extractQuestionSections(response, language) {
    response = response
        .replaceAll("&lt;", "＜")
        .replaceAll("&gt;", "＞")
        .replace(/<(?!img|\/img)/gi, '＜')

    const headings = ["Summary", "Description", "I\/O"]
    const [summary, description, bestIoExample] = parseSections(response, headings, language);
    return {
        summary, description, bestIoExample,
    }
}

export function extractAnswerSections(response, language) {
    response = response
        .replaceAll("&lt;", "＜")
        .replaceAll("&gt;", "＞")
        .replace(/<(?!img|\/img)/gi, '＜')

    const headings = [
        "Problem Algorithm", "Problem Datastructure", "Solution Trick",
        "Pseudocode/Algorithm Steps",
        "Primary Solution Code", "Enumerated Steps 1", "Solution 1",
        "Secondary Solution Code", "Enumerated Steps 2", "Solution 2",
        "Time Complexity", "Selected Solutions"
    ];

    const [
        algorithm, datastructure, trick,
        _pseudocode,
        code, steps, solution,
        code2, steps2, solution2,
        complexity
    ] = parseSections(response, headings, language);

    const DAS = algorithm + " - " + datastructure

    return {
        DAS, code, code2, steps, steps2,
        solution, solution2, complexity,
        trick,
    }
}

function extractProblemIndex(response) {
    const sectionTitle = "SelectedSolutions";

    // Remove all whitespace
    const noWhiteSpaces = response.replace(/\s+/g, '');

    // Match up to 5 characters before sectionTitle, then extract [numbers]
    const hashRegex = new RegExp(`#{1,6}.{0,5}${sectionTitle}.*?(\\[[^\\]]+\\])`, 'i');
    const asteriskRegex = new RegExp(`\\*\\*.{0,5}${sectionTitle}.*?(\\[[^\\]]+\\])`, 'i');

    // Run the regex on the whitespace-free response
    const hashMatch = hashRegex.exec(noWhiteSpaces);
    const asteriskMatch = asteriskRegex.exec(noWhiteSpaces);
    const match = hashMatch || asteriskMatch;

    if (match && match[1]) {
        const cleanedNumbers = match[1].replace(/[^0-9,]/g, '');
        return JSON.parse(`[${cleanedNumbers}]`) // Return the extracted [*,*] array
    }

    objLog({ noWhiteSpaces })
    throw new Error(`Failed to match index regex: ${hashRegex} and ${asteriskRegex}`);
}

export const extractFirstNumber = (str) => {
    const result = str.match(/\d+/); // Regular expression to find numbers
    return result ? parseInt(result[0]) : null; // Parse the first found number
}

export function readImage(imagePath) {
    let imageData = null
    try {
        imageData = readFileSync(imagePath)
    } catch (e) {
        if (e.code === 'ENOENT') { // File not found
            return null
        }
        throw e
    }
    return Buffer.from(imageData);
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

export function splitDescription(description) {
    const exampleIndex = description.indexOf('Example');
    const constraintsIndex = description.indexOf('Constraints:');

    let statement = description;
    let ioExamples = '';
    let constraints = '';

    if (exampleIndex !== -1) {
        statement = description.substring(0, exampleIndex);
        ioExamples = constraintsIndex === -1 ? description.substring(exampleIndex)
            : description.substring(exampleIndex, constraintsIndex);
    }

    if (constraintsIndex !== -1) {
        constraints = description.substring(constraintsIndex + 'Constraints:'.length);
    }

    return {
        statement,
        ioExamples,
        constraints
    };
}

export function objLog(obj) {
    console.log(JSON.stringify(obj))
}

export function ensureDirectoryExists(dirPath) {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
}

export function writeArrayToFile(array, filePath) {
    const formattedData = `export default ${JSON.stringify(array, null, 2)}\n`;
    writeFileSync(filePath, formattedData, "utf8");
}

export function readArrayFromFile(filePath) {
    if (!existsSync(filePath)) return null;

    const fileContent = readFileSync(filePath, "utf8");
    const jsonString = fileContent.replace(/^export default /, '').trim();

    return JSON.parse(jsonString);
}

export async function openVimAndWait(filePath) {
    // Pause stdin to prevent Node from processing input
    process.stdin.pause();

    return new Promise((resolve) => {
        const vim = spawn("vim", [filePath], {
            stdio: "inherit"
        });

        vim.on("exit", (code) => {
            // Resume stdin after Vim exits
            process.stdin.resume();
            resolve(code);
        });
    });
}
