import { existsSync, readFileSync, writeFileSync } from "fs"

export function readCachedUrls(dataPath) {
    const problemUrlCachePath = `${dataPath}/cache/problemUrl.js`
    const premiumProblemUrlCachePath = `${dataPath}/cache/premiumProblemUrl.js`

    const problemUrls = existsSync(problemUrlCachePath) ?
        JSON.parse(readFileSync(problemUrlCachePath, 'utf8')) : null

    const premiumProblemUrls = existsSync(premiumProblemUrlCachePath) ?
        JSON.parse(readFileSync(premiumProblemUrlCachePath, 'utf8')) : null

    if (problemUrls && premiumProblemUrls)
        return { problemUrls, premiumProblemUrls }

    return null
}

export function writeCachedUrls(problemUrls, premiumProblemUrls, dataPath) {
    const problemUrlCachePath = `${dataPath}/cache/problemUrl.js`
    const premiumProblemUrlCachePath = `${dataPath}/cache/premiumProblemUrl.js`

    writeFileSync(problemUrlCachePath, JSON.stringify(problemUrls), 'utf8');
    writeFileSync(premiumProblemUrlCachePath, JSON.stringify(premiumProblemUrls), 'utf8');
}

export function isProcessed(dataPath, url) {
    const processedUrlsPath = `${dataPath}/processedUrls.js`
    const processedUrlsArray = existsSync(processedUrlsPath) ?
        JSON.parse(readFileSync(processedUrlsPath, 'utf8')) : null
    return (new Set(processedUrlsArray?? [])).contains(url)
}

export function appendToProcessedUrls(dataPath, newUrl) {
    const processedUrlsPath = `${dataPath}/processedUrls.js`
    const processedUrlsArray = existsSync(processedUrlsPath) ?
        JSON.parse(readFileSync(processedUrlsPath, 'utf8')) : null
    const newProcessedUrlsArray = Array.from((new Set(processedUrlsArray)).add(newUrl))
    writeFileSync(processedUrlsPath, JSON.stringify(newProcessedUrlsArray), 'utf8');
}

export function readCurrentIndex(dataPath) {
    const problemIndexPath = `${dataPath}/cache/problemIndex.js`
    if(!existsSync(problemIndexPath)  ) return null
    return Number(readFileSync(problemIndexPath, "utf8"))
}

export function readSolutions(dataPath, url) {
    try {
        const solutionsPath = `${dataPath}/solutions.js`
        return JSON.parse(readFileSync(solutionsPath, 'utf8'))?.[url]
    } catch (e) {
        if (e.code === 'ENOENT') { // File not found
            return null
        }
        throw e
    }
}
