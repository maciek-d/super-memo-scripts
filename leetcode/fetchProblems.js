import fs from 'fs';
import hljs from 'highlight.js';
import juice from 'juice';
import path, { dirname } from 'path';
import prettier from 'prettier';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const TAG = "array";
const __dirname = dirname(fileURLToPath(import.meta.url));
const problemPath = path.join(__dirname, `../data/cs/leetcode/${TAG}_problems_data.js`);
const readableProblemsPath = path.join(__dirname, `../data/cs/leetcode/${TAG}_readable_data.js`);

async function main() {
    const browser = await puppeteer.launch({ headless: false });

    const cacheFilePath = path.join(__dirname, '../data/CS/cache', `${TAG}_links.js`);
    let hrefs;


    if (fs.existsSync(cacheFilePath)) {
        // Read from cache
        hrefs = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    } else {
        // Scrape and cache hrefs
        const url = `https://leetcode.com/tag/${TAG}/`;
        const fetchedData = await fetchProblemUrls(url, browser);
        hrefs = fetchedData.hrefs;
        const premiumHrefs = fetchedData.premiumHrefs;

        fs.writeFileSync(cacheFilePath, JSON.stringify(hrefs), 'utf8');
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const premiumCacheFilePath = path.join(__dirname, '../data/CS/cache', `${TAG}_premium_links.js`);
        fs.writeFileSync(premiumCacheFilePath, JSON.stringify(premiumHrefs), 'utf8');
    }

    // Process each href
    const existingData = await readDataFromFile(problemPath);

    const previousProblems = await readDataFromFile(readableProblemsPath);

    for (const href of hrefs) {
        // console.log(href);
        if (existingData.some(item => item.problemLink === href)) {
            continue;
        }

        const { description, title, htmlDescription } = await fetchTitleAndDescription(href, browser);

        const { problem, examples, constraints } = splitDescription(description);
        const solutionsUrl = href + '/solutions/';
        const { solutionLink, htmlSolution, textSolution } = await fetchSolution(browser, solutionsUrl);

        const formattedCode = await prettier.format(textSolution, {
            semi: false,
            parser: "babel"
        });


        const escapedSolution = encodeBrakets(formattedCode);
        const inlineSolution = await highlightWithInlineStyles(escapedSolution);

        await saveReadableData({
            title,
            problem,
            textSolution,
        }, previousProblems);

        await saveProblemData({
            title,
            problem,
            examples,
            constraints,
            solutionsUrl,
            solutionLink,
            htmlSolution,
            textSolution,
            problemLink: href,
            inlineSolution
        }, existingData);
    }
    // await browser.close();
}

main().then(() => {
    console.log("done");
}).catch(console.error);


async function fetchSolution(browser, solutionUrl) {

    const page = await browser.newPage();
    await page.goto(solutionUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('svg path[d="M20 8l-8 8-8-8"]');

    // Once the SVG element is available, select its parent div and click
    const svgParentDiv = await page.$('div.absolute.right-4.top-0 svg path[d="M20 8l-8 8-8-8"]');
    await svgParentDiv.click();

    await page.waitForXPath("//span[contains(., 'JavaScript')]");
    let [javascriptButton] = await page.$x("//span[contains(., 'JavaScript')]");


    const notJavascript = await page.evaluate(element => {
        return element.classList.contains('bg-lc-fill-02') && element.classList.contains('text-lc-text-secondary');
    }, javascriptButton);
    await page.waitForTimeout(20);
    if (notJavascript) {
        await javascriptButton.click();
    }

    await svgParentDiv.click();

    const votesButtonXPath = "//button[contains(text(), 'Votes')]";
    const votesButton = await page.$x(votesButtonXPath);

    if (votesButton.length === 0) {
        await page.waitForXPath("//button[contains(text(), 'Sort by')]", { visible: true });
        let [sortByButton] = await page.$x("//button[contains(text(), 'Sort by')]");
        await page.evaluate(element => {
            element.style.border = "2px solid red"; // Add your desired border style
        }, sortByButton);
        await page.waitForTimeout(2000);
        await sortByButton.click();

        // // Wait for dropdown to appear and content to load
        const mostVotesXPath = "//div[contains(text(), 'Most Votes')]";
        await page.waitForXPath(mostVotesXPath);

        // After waiting, find and click the 'Most Votes' option
        const mostVotesOption = await page.$x(mostVotesXPath);
        await mostVotesOption[0].click();

    }
    await page.waitForTimeout(2000);
    await page.waitForSelector('div.group:first-of-type');

    // Extract the solution in HTML and text format
    const solutionBlocks = await page.$$('div.group');
    for (const block of solutionBlocks) {
        const dateAndlanguages = await block.$$eval('.text-xs', nodes => nodes.map(n => n.textContent.trim()));

        const otherLanguages = [
            "C++", "Java", "Python3", "Python", "C", "C#", "Ruby", "Swift",
            "Go", "Scala", "Kotlin", "Rust", "MySQL", "Bash", "TypeScript", "Dart",
            "Erlang", "Elixir", "PHP", "Racket"
        ];

        if (!otherLanguages.some(lang => dateAndlanguages.includes(lang))) {
            const date = new Date(dateAndlanguages[0]);
            const es6ReleasePlusYear = new Date('June 17, 2016');
            if (date >= es6ReleasePlusYear) {
                const solutionLinkElement = await block.$('a[href*="/problems/"]');

                if (solutionLinkElement) {
                    // Ensure the link opens in the same tab
                    await page.evaluate(el => el.target = '_self', solutionLinkElement);

                    // Click on the solution link
                    await solutionLinkElement.click();
                    await page.waitForSelector('div.break-words'); // Wait for the solution content to load
                    await page.waitForFunction('document.readyState === "complete"');

                    // Extract the solution URL, HTML and text content
                    const solutionLink = await page.url();
                    const htmlSolution = await page.$eval('div.break-words', div => div.innerHTML);
                    const { lastDivSolutionText, firstDivSolutionText } = await page.$eval('div.break-words', div => {
                        // Function to recursively find the last element with a class starting with 'language-'
                        const findLastLanguageElement = (element) => {
                            const children = Array.from(element.children);
                            let lastLanguageElement = null;

                            for (const child of children) {
                                if (typeof child.className === 'string' && child.className.startsWith('language-')) {
                                    lastLanguageElement = child; // Update if a new match is found
                                }
                                // Recursively check child elements
                                const nestedLanguageElement = findLastLanguageElement(child);
                                if (nestedLanguageElement) {
                                    lastLanguageElement = nestedLanguageElement;
                                }
                            }

                            return lastLanguageElement;
                        };

                        // Start the recursive search from 'div.break-words'
                        const lastJsCodeElement = findLastLanguageElement(div);
                        const lastDivSolutionText = lastJsCodeElement?.innerText ?? "";
                        const firstDiv = div.querySelector('[class^="language-"]');
                        const firstDivSolutionText = firstDiv?.innerText ?? "";

                        // Return the inner text of the found element or empty string if not found
                        return { lastDivSolutionText, firstDivSolutionText };
                    });

                    let textSolution = '';
                    try {
                        await prettier.format(lastDivSolutionText, {
                            semi: false,
                            parser: "babel"
                        });
                        textSolution = lastDivSolutionText;
                    } catch (error) {
                        try {
                            await prettier.format(firstDivSolutionText, {
                                semi: false,
                                parser: "babel"
                            });
                            textSolution = firstDivSolutionText;
                        } catch (error) {
                            console.log(`Skipping solution find it manually: ${solutionUrl}`);
                        }
                    }
                    if (textSolution) {
                        console.log(`Solution found for: ${solutionUrl}`);
                        return { solutionLink, htmlSolution, textSolution };
                    }
                    await page.close();
                }
            }
        }
    }
    console.error(`No solution found for: ${solutionUrl}`);
    await page.close();
    return { solutionLink: solutionUrl, htmlSolution: '', textSolution: '' };
}


async function saveProblemData(newData, existingData) {
    existingData.push(newData);
    await fs.promises.writeFile(problemPath, JSON.stringify(existingData, null, 2));
}

async function saveReadableData(newData, existingData) {
    existingData.push(newData);
    await fs.promises.writeFile(readableProblemsPath, JSON.stringify(existingData, null, 2));
}


async function readDataFromFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const data = await fs.promises.readFile(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading file:', error);
    }
    return [];
}

async function fetchProblemUrls(url, browser) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    await page.waitForSelector('tbody.reactable-data', { timeout: 10000 });

    await page.click('th.reactable-th-acceptance');
    await page.waitForTimeout(20);
    await page.click('th.reactable-th-acceptance');
    await page.waitForTimeout(20);

    // Scrape the hrefs and identify premium problems
    const { hrefs, premiumHrefs } = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tbody.reactable-data tr'));
        const hrefs = [];
        const premiumHrefs = [];

        rows.forEach(row => {
            const linkElement = row.querySelector('a');
            const isPremium = row.querySelector('i.fa-lock') !== null;
            const href = linkElement ? linkElement.href : '';

            if (href) {
                if (isPremium) {
                    premiumHrefs.push(href);
                } else {
                    hrefs.push(href);
                }
            }
        });

        return { hrefs, premiumHrefs };
    });

    await page.close();
    return { hrefs, premiumHrefs };
}

function splitDescription(description) {
    const exampleIndex = description.indexOf('Example');
    const constraintsIndex = description.indexOf('Constraints:');

    let problem = description;
    let examples = '';
    let constraints = '';

    if (exampleIndex !== -1) {
        problem = description.substring(0, exampleIndex);
        examples = constraintsIndex === -1 ? description.substring(exampleIndex)
            : description.substring(exampleIndex, constraintsIndex);
    }

    if (constraintsIndex !== -1) {
        constraints = description.substring(constraintsIndex + 'Constraints:'.length);
    }

    return {
        problem,
        examples,
        constraints
    };
}

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

function encodeBrakets(text) {
    return text.replace(/</g, '⟨').replace(/>/g, '&gt;');
}


async function getHighlightJsStyles() {
    const response = await fetch('https://raw.githubusercontent.com/highlightjs/highlight.js/main/src/styles/dark.css');
    return await response.text();
}

async function highlightWithInlineStyles(code) {
    const css = await getHighlightJsStyles();
    const highlightedCode = hljs.highlightAuto(code).value;

    // Embed the CSS into a style tag
    const htmlWithCss = `<style>${css}</style><div style="display:block;background-color: #131516;"><pre><code>${highlightedCode}</code></pre></div>`;

    // Apply inline styles using Juice
    return juice(htmlWithCss);
}