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

    await skipBanner(browser, hrefs[0]); // new page banner for dynamic view

    for (const href of hrefs) {
        if (existingData.some(item => {
            return item.problemLink === href;
        })) {
            continue;
        }

        const { description, title, htmlDescription } = await fetchTitleAndDescription(href, browser);

        const { problem, examples, constraints } = splitDescription(description);
        const solutionsUrl = href + '/solutions/';
        const { solutionLink, htmlSolution, textSolution } = await fetchSolution(browser, solutionsUrl);
        if (!solutionLink) {
            continue;
        }
        const formattedCode = await prettier.format(textSolution, {
            semi: false,
            parser: "babel"
        });


        const escapedSolution = encodeBrakets(formattedCode);
        const inlineSolution = await highlightWithInlineStyles(escapedSolution);

        // await saveReadableData({
        //     title,
        //     problem,
        //     textSolution,
        // }, previousProblems);

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

async function waitForXPathOrTimeout(page, xpath, timeout) {
    let timeoutHandle;
    const timeoutPromise = new Promise(resolve => {
        timeoutHandle = setTimeout(() => resolve(false), timeout); // resolve false on timeout
    });

    const xpathFound = await Promise.race([
        page.waitForXPath(xpath).then(() => true), // resolve true if found
        timeoutPromise
    ]);

    clearTimeout(timeoutHandle);
    return xpathFound;
}

async function skipBanner(browser, solutionUrl) {
    const page = await browser.newPage();
    await page.goto(solutionUrl, { waitUntil: 'domcontentloaded' });

    const accept = await page.$('button.font-medium.items-center.whitespace-nowrap.inline-flex.bg-fill-3.rounded-full.text-xl.text-white');
    await accept.click();

    await page.waitForSelector('button[title="Skip"]', { visible: true });
    const closeTutorial = await page.$('button[title="Skip"]');
    await closeTutorial.click();

    page.close();
}

async function scrapeSolutions(browser, solutionUrl) {

    const page = await browser.newPage();
    await page.goto(solutionUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('svg path[d="M20 8l-8 8-8-8"]');

    // Once the SVG element is available, select its parent div and click
    const svgParentDiv = await page.$('div.absolute.right-4.top-0 svg path[d="M20 8l-8 8-8-8"]');
    await svgParentDiv.click();

    const jsFound = await waitForXPathOrTimeout(page, "//span[contains(., 'JavaScript')]", 2000);
    if (!jsFound) {
        console.error(`JS Solution not found: ${solutionUrl}`);
        page.close();
        return { solutionLink: "", htmlSolution: "", textSolution: "" };
    }

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

    const solutionBlocks = await page.$$('.group.flex.w-full.cursor-pointer.flex-col');

    for (const block of solutionBlocks) {
        const languages = await block.$$eval('.whitespace-nowrap', nodes => nodes.map(n => n.textContent.trim()));

        const otherLanguages = [
            "C++", "Java", "Python3", "Python", "C", "C#", "Ruby", "Swift",
            "Go", "Scala", "Kotlin", "Rust", "MySQL", "Bash", "TypeScript", "Dart",
            "Erlang", "Elixir", "PHP", "Racket"
        ];

        if (!otherLanguages.some(lang => languages.includes(lang))) {
            const solutionLinkElement = await block.$('a[href*="/problems/"]');

            if (solutionLinkElement) {
                // Ensure the link opens in the same tab
                await page.evaluate(el => el.target = '_self', solutionLinkElement);

                // Click on the solution link
                await Promise.allSettled([
                    page.waitForNavigation({ waitUntil: 'networkidle0' }),
                    solutionLinkElement.click()
                ]);
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
                        console.error(`Skipping solution find it manually: ${solutionUrl}`);
                        return { solutionLink, htmlSolution, textSolution };
                    }
                }
                if (textSolution) {
                    await page.close();
                    console.log(`Solution found for: ${solutionUrl}`);
                    return { solutionLink, htmlSolution, textSolution };
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
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 5000 });
    } catch (error) { }
    await page.goto(url,);

    await page.waitForSelector('tbody.reactable-data', { timeout: 10000 });

    await page.click('th.reactable-th-acceptance');
    await page.waitForTimeout(20);
    await page.click('th.reactable-th-acceptance');
    await page.waitForTimeout(2000);

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
