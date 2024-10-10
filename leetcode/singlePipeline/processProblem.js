import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import path, { dirname } from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
const NUMBER_TO_PROCESS = 50;

const TAG = "string";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dataPath = path.join(__dirname, `../../data/CS/leetcode/${TAG}_problems_data.js`);
const newPath = path.join(__dirname, `../../data/CS/leetcode/new/${TAG}_problems_data.js`);

const htmlPath = path.join(__dirname, '../../data/CS/leetcode/html');




const htmlDataPath = path.join(htmlPath, 'all_problems_html.json');
let allHtmlData = existsSync(htmlDataPath) ? JSON.parse(readFileSync(htmlDataPath, 'utf8')) : [];

const newDataDirectory = path.join(__dirname, '../../data/CS/leetcode/new');
const newDataPath = path.join(newDataDirectory, `${TAG}_problems_data.js`);
let newProblemsData = existsSync(newDataPath) ? JSON.parse(readFileSync(newDataPath, 'utf8')) : [];

const processHtmlContent = (htmlContent) => {

    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    const images = document.querySelectorAll('img');
    images.forEach(img => {
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt');
        const newImg = document.createElement('img');
        newImg.setAttribute('src', src);
        newImg.setAttribute('alt', alt);
        newImg.className = 'resize-img'; // Add the custom class
        img.replaceWith(newImg); // Replace the original img tag with the new one
    });
    // Extract the content inside the <body> tag
    const bodyContent = document.body.innerHTML;

    // Remove all HTML tags except <img>, keep the content of the tags
    const cleanedContent = bodyContent.replace(/<img[^>]*>|<\/?[^img][^>]*>/gi, (match) => {
        // If the tag is an <img> tag, keep it, else remove it
        return match.startsWith('<img') ? match : '';
    });


    return cleanedContent; // Serialize the document to get the updated HTML content
};


const saveHtmlData = (title, problemHtml, solutionHtml) => {
    if (!existsSync(htmlPath)) {
        mkdirSync(htmlPath);
    }
    allHtmlData.push({
        title,
        problemHtml,
        solutionHtml
    });
};

const saveAllHtmlDataToFile = () => {
    const filePath = path.join(htmlPath, 'all_problems_html.json');
    writeFileSync(filePath, JSON.stringify(allHtmlData, null, 2));
};


export const main = async () => {
    // const browser = await puppeteer.launch({ headless: "new" });
    const browser = await puppeteer.launch({ headless: false });
    let problemsData;

    try {
        const fileContent = readFileSync(dataPath, 'utf8');
        problemsData = JSON.parse(fileContent);
    } catch (error) {
        console.error('Error reading problems file:', error);
        return;
    }

    let count = 0;
    for (const problem of problemsData.slice(20, problemsData.length - 1)) {
        if (newProblemsData.some(p => p.title === problem.title)) continue;
        if (count++ === NUMBER_TO_PROCESS) break;

        console.log(problem.title)
        const { title, htmlDescription: problemHtml } = await fetchTitleAndDescription(problem.problemLink, browser);
        const processedProblem = processHtmlContent(problemHtml);
        const processedSolution = processHtmlContent(problem.htmlSolution);
        saveHtmlData(problem.title, problemHtml, problem.htmlSolution);
        const youtubeUrlJs = await fetchYoutubeVideoUrlJS(title, browser);
        const youtubeUrl = await fetchYoutubeVideoUrl(title, browser);

        delete problem.htmlSolution;
        newProblemsData.push({
            ...problem,
            youtubeUrlJs,
            youtubeUrl,
            problem: processedProblem,
            textSolution: processedSolution
        });
    }

    await browser.close();
    saveAllHtmlDataToFile();
    if (!existsSync(newDataDirectory)) {
        mkdirSync(newDataDirectory);
    }
    writeFileSync(newPath, JSON.stringify(newProblemsData, null, 2));
    console.log("done fetching");
};


async function fetchTitleAndDescription(url, browser) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('div[data-track-load="description_content"]', { timeout: 10000 });

    // Extract the part of the URL to match with the href attribute
    const urlPart = url.split('/problems/')[1].split('/')[0];

    const titleAndDescription = await page.evaluate((urlPart) => {
        // Find the <a> tag with the matching href for the title
        const titleElement = document.querySelector(`a[href="/problems/${urlPart}/"]`);
        const title = titleElement ? titleElement.innerText.trim() : '';

        // Find the description
        const descriptionElement = document.querySelector('div[data-track-load="description_content"]');
        const description = descriptionElement ? descriptionElement.innerText.trim() : '';
        const htmlDescription = descriptionElement ? descriptionElement.innerHTML : '';

        return { title, description, htmlDescription };
    }, urlPart);

    await page.close();
    return titleAndDescription;
}


async function fetchYoutubeVideoUrlJS(queryString, browser) {
    const page = await browser.newPage();
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryString + "javascript")}&sp=EgIQAQ%253D%253D`;

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

async function fetchYoutubeVideoUrl(queryString, browser) {
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

main().catch(error => {
    console.error(error);
    console.log(`still saved ${newProblemsData.length} problems`);
    writeFileSync(newPath, JSON.stringify(newProblemsData, null, 2));
}).then(() => { console.log("done"); });
