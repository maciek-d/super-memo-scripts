import readline from 'readline'
import { readByObjectKey, appendObjectToFile, extractFirstNumber } from "./fileUtils.js"

export async function scrapeYoutubeVideoUrls(browser, scrapedPath, title, language) {
    const youtubeUrlsPath = `${scrapedPath}/youtubeUrls.js`;
    const urls = readByObjectKey(youtubeUrlsPath, title);

    if (urls) {
        const url = new URL(urls.youtubeUrl);
        url.searchParams.delete('pp'); // Ensure 'pp' is removed properly
        return { youtubeUrl: url.toString() }
    }

    const youtubeUrls = await scrapeYoutubeVideoUrl(browser, `Leetcode ${title} @neetcode`, 3);
    const youtubeUrlLangs = await scrapeYoutubeVideoUrl(browser, `Leetcode ${extractFirstNumber(title)} ${title} ${language}`, 3);

    const youtubeUrlLang = youtubeUrlLangs[0]?.url; // Extract only URL
    const youtubeUrl = await askUserToChooseUrl(youtubeUrls);


    if (!youtubeUrl || !youtubeUrlLang) {
        throw new Error(
            `Failed to scrapeYoutubeVideoUrl ${JSON.stringify(
                { youtubeUrl, youtubeUrlLang }, null, 2)}`
        );
    }

    appendObjectToFile(title, { youtubeUrl, youtubeUrlLang }, youtubeUrlsPath);
    return { youtubeUrl }
}

async function askUserToChooseUrl(options) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log("\nSelect a YouTube URL:");
        options.forEach((video, index) =>
            console.log(`${index + 1}: ${video.title} - ${video.url}`)
        );

        rl.question("Enter the number of your choice (or paste a URL): ", (answer) => {
            const trimmed = answer.trim();

            // If the user enters a direct URL, use it
            if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                resolve(trimmed);
            } else {
                const index = Number(trimmed) - 1;
                if (index >= 0 && index < options.length) {
                    resolve(options[index].url);
                } else {
                    console.log("Invalid selection. Defaulting to the first URL.");
                    resolve(options[0].url);
                }
            }
            rl.close();
        });
    });
}

async function scrapeYoutubeVideoUrl(browser, queryString, amount = 1) {
    const page = await browser.newPage();
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryString)}&sp=EgIQAQ%253D%253D`;

    try {
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        const videoData = await page.evaluate((amount) => {
            const videoElements = Array.from(document.querySelectorAll('a#video-title')).slice(0, amount)
            const results = [];

            for (const video of videoElements) {
                const href = video.href.startsWith("http") ? video.href : window.location.origin + video.href;
                const url = new URL(href);
                url.searchParams.delete('pp');

                results.push({
                    title: video.innerText.trim(),
                    url: url.toString(),
                });
            }
            return results;
        }, amount);

        await page.close();
        return videoData
    } catch (error) {
        await page.close();
        console.error(`Error fetching YouTube video URL for query: ${queryString}`, error);
        return [];
    }
}

