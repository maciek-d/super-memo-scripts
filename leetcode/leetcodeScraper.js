import { appendObjectToFile } from './fileUtils.js'

const DEBUG_PATH = `data/puppeteer_debug`

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

async function clickUntilElementLoads(page, clickElement, xpathToWaitFor, timeoutDuration = 200) {
    let elementFound = false
    while (!elementFound) {
        await clickElement.evaluate(el => el.click());

        const waitForElement = page.waitForXPath(xpathToWaitFor)
        const timeout = new Promise(resolve => setTimeout(resolve, timeoutDuration))
        const result = await Promise.race([waitForElement, timeout])

        elementFound = Boolean(result)
    }
}

export async function scrapeProblemUrls(browser, tag) {
    const url = `https://leetcode.com/tag/${tag}/`;

    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 5000 })
    } catch (error) {
        // Intentionally suppressing error, retrying immediately
    }

    await page.goto(url);

    await page.waitForSelector('tbody.reactable-data', { timeout: 10000 });

    await page.click('th.reactable-th-acceptance');
    await page.waitForTimeout(20);
    await page.click('th.reactable-th-acceptance');
    await page.waitForTimeout(2000);

    // Scrape the problem urls and identify premium problems
    const { problemUrls, premiumProblemUrls } = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tbody.reactable-data tr'))

        return rows.reduce(
            (acc, row) => {
                const linkElement = row.querySelector('a')
                const url = linkElement ? linkElement.href : ''
                const isPremium = row.querySelector('i.fa-lock') !== null

                if (url) { // push to the respective url array
                    acc[isPremium ? 'premiumProblemUrls' : 'problemUrls'].push(url)
                }
                return acc;
            },
            { problemUrls: [], premiumProblemUrls: [] }
        );
    });


    await page.close()
    return { problemUrls, premiumProblemUrls }
}

export async function scrapeProblem(scrapedPath, browser, problemUrl) {
    const problemPath = `${scrapedPath}/problem.js`
    const problem = readByObjectKey(problemPath, problemUrl)
    if (problem) return problem

    const page = await browser.newPage();
    await page.goto(problemUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('div[data-track-load="description_content"]', { timeout: 10000 });

    // Extract the part of the URL to match with the href attribute
    const urlPart = problemUrl.split('/problems/')[1].split('/')[0];

    const { title, description, htmlDescription } = await page.evaluate((urlPart) => {
        // Find the <a> tag with the matching href for the title
        const titleElement = document.querySelector(`a[href="/problems/${urlPart}/"]`);
        const title = titleElement ? titleElement.innerText.trim() : '';

        // Find the description
        const descriptionElement = document.querySelector('div[data-track-load="description_content"]');

        const description = descriptionElement ? getTextWithImageTags(descriptionElement) : ''
        const htmlDescription = descriptionElement ? descriptionElement.innerHTML : ''

        return { title, description, htmlDescription };
    }, urlPart);

    await page.close();
    const { statement, ioExamples, constraints } = splitDescription(description)

    appendObjectToFile(problemUrl,
        { title, statement, ioExamples, constraints, htmlDescription }, problemPath)
    return { title, statement, ioExamples, constraints, htmlDescription }
}

function getTextWithImageTags(element) {
    if (!element) return '';

    const TEXT_NODE = 3;
    const ELEMENT_NODE = 1;

    return Array.from(element.childNodes)
        .map(node => {
            if (node.nodeType === TEXT_NODE) {
                return node.textContent.trim();
            }
            if (
                node.nodeType === ELEMENT_NODE &&
                !["avatar", "badges", "static_assets"].some(val => node.src.includes(val))
            ) {
                if (node.tagName === 'IMG') {
                    return node.outerHTML;
                }
                // Recursively process child elements for nested tags
                return getTextWithImageTags(node);
            }
            return ''; // Skip other node types
        })
        .join('');
}


function splitDescription(description) {
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

export async function scrapeSolutions(scrapedPath, browser, language, solutionsUrl) {
    const solutionsPath = `${scrapedPath}/solutions.js`
    const solutionsFromFile = readByObjectKey(
        solutionsPath, solutionsUrl
    )
    if (solutionsFromFile) return solutionsFromFile

    const page = await browser.newPage();
    await page.goto(solutionsUrl, { waitUntil: 'domcontentloaded' });

    await page.setViewport({ width: 1280, height: 2000, deviceScaleFactor: 1 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0');

    // wait for tag select svg arrow.
    await page.waitForSelector('div.absolute.right-4.top-0 svg path[d="M20 8l-8 8-8-8"]', { visible: true });
    await page.screenshot({ path: `${DEBUG_PATH}/svg_arrow.png` });
    const svgArrow = await page.$('div.absolute.right-4.top-0 svg path[d="M20 8l-8 8-8-8"]');

    const svgParentDiv = await svgArrow.evaluateHandle(el => el.closest('div.cursor-pointer'))

    await page.screenshot({ path: `${DEBUG_PATH}/firstTimeout.png` });
    await svgParentDiv.evaluate(el => el.click());
    await page.screenshot({ path: `${DEBUG_PATH}/clickLanguageArrow.png` });

    // wait for select specific language solutions tag only
    const languageFound = await waitForXPathOrTimeout(page, `//span[contains(., '${language}')]`, 2000);
    if (!languageFound) {
        console.error(`${language} Solution not found: ${solutionsUrl}`);
        page.close();
        return {}
    }

    // select specific language only unless already selected
    await selectLanguageSolutions(page)
    await page.screenshot({ path: `${DEBUG_PATH}/select${language}.png` });

    // minimize tag select
    await svgParentDiv.evaluate(el => el.click());
    await page.screenshot({ path: `${DEBUG_PATH}/hideSelection.png` });
    await sortByVotes(page);

    const solutions = await scrapeSolutionsFromPage(browser, page)
    if (!solutions) {
        throw new Error(`Failed to fetch leetcode solutions ${solutionsUrl}`)
    }

    appendObjectToFile(solutionsUrl, solutions, solutionsPath)
    return solutions
}

async function sortByVotes(page) {
    const votesButtonXPath = "//button[contains(text(), 'Votes')]";
    const votesButton = await page.$x(votesButtonXPath);

    if (votesButton.length === 0) {
        await page.waitForXPath("//button[contains(text(), 'Sort by')]", { visible: true })
        let [sortByButton] = await page.$x("//button[contains(text(), 'Sort by')]")

        await page.evaluate(element => {
            element.style.border = "2px solid red" // Add your desired border style
        }, sortByButton)
        await page.screenshot({ path: `${DEBUG_PATH}/redVotesHighlight.png` });

        const contentSelector = 'div.group.flex.w-full.cursor-pointer.flex-col'
        await page.waitForSelector(contentSelector, { visible: true })

        const mostVotesXPath = "//div[contains(text(), 'Most Votes')]"

        // Wait for dropdown to appear and content to load
        await clickUntilElementLoads(page, sortByButton, mostVotesXPath)

        // After waiting, find and click the 'Most Votes' option
        const mostVotesOption = await page.$x(mostVotesXPath)
        await mostVotesOption[0].evaluate(el => el.click());
        await page.screenshot({ path: `${DEBUG_PATH}/mostVotesOption.png` });

        const solutionsSelector = 'div.relative.flex.w-full.flex-col > div.flex.w-full.flex-col'
        await waitForElementChange(page, solutionsSelector, 4000)
        await page.screenshot({ path: `${DEBUG_PATH}/solutionsLoaded.png` });
    }
    // Wait for content to load appropriate order
    await page.waitForSelector('div.group:first-of-type')
}

async function selectLanguageSolutions(page, language) {
    let [languageButton] = await page.$x(`//span[contains(., '${language}')]`);

    const noLanguageFound = await page.evaluate(element => {
        return element.classList.contains('bg-lc-fill-02') && element.classList.contains('text-lc-text-secondary');
    }, languageButton);
    await page.waitForTimeout(500);
    if (noLanguageFound) {
        await languageButton.evaluate(el => el.click());
        await page.waitForTimeout(4000)
    }
}

async function scrapeSolutionsFromPage(browser, page, language) {
    const solutionBlocks = await page.$$('.group.flex.w-full.cursor-pointer.flex-col');

    const solutions = {}

    const GET_SOLUTIONS_AMOUNT = 5
    for (const [index, block] of solutionBlocks.entries()) {

        if (index === GET_SOLUTIONS_AMOUNT) { break }

        const solutionPage = await loadNextSolution(browser, block);
        if (!solutionPage) continue;

        await switchToLangugageCodeBlocks(solutionPage, language)

        const solutionText = await extractTextExludingDifferentLanguages(solutionPage, language)
        const solutionUrl = await solutionPage.url();

        solutions[solutionUrl] = solutionText
        await solutionPage.close();
    }

    return solutions
}

async function extractTextExludingDifferentLanguages(page, language) {
    const commentsAndSolutionHtml = await processCommentsAndSolution(page);
    const allLanguages = [
        'JavaScript', 'C', 'C++', 'Java', 'Python', 'C#', 'Ruby',
        'Swift', 'Go', 'Kotlin', 'Scala', 'Rust',
        'PHP', 'TypeScript', 'Racket', 'Erlang', 'SQL'
    ]
    const allOtherLanguages = allLanguages.filter(lang => lang != language)
    const cleanedHTML = await stripNonLanguageCodeElements(commentsAndSolutionHtml, allOtherLanguages);
    const textContent = await preserveTextAndImages(cleanedHTML)

    return textContent;
}

// Note if this fails look at extractImageTags in old_main.js
async function preserveTextAndImages(cleanedHTML) {
    const jsdom = await import('jsdom');
    const { JSDOM } = jsdom;
    const dom = new JSDOM(cleanedHTML);
    const document = dom.window.document;

    const textContent = getTextWithImageTags(document.body)

    const endOfUsefulTextRegex = new RegExp(`Saved Ln 1, Col 1 You need to.*`, 's');
    return textContent
        .replace(/\/\*\*([\s\S]*?)(@param|@return)([\s\S]*?)\*\//g, '')
        .replace(endOfUsefulTextRegex, '')
        .trim();
}

async function stripNonLanguageCodeElements(htmlContent, languagesToRemove) {
    const jsdom = await import('jsdom');
    const { JSDOM } = jsdom;
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Remove script button tags
    document.querySelectorAll('script').forEach(script => script.remove());
    document.querySelectorAll('button').forEach(button => button.remove());

    // Remove elements with inline style visibility: hidden or display: none
    document.querySelectorAll('[style*="visibility: hidden"], [style*="display: none"]').forEach(element => element.remove());

    // Remove next and previous solution elements
    document.querySelectorAll('.flex.justify-between.gap-4').forEach(element => element.remove());

    // Remove elements with specific class names
    document.querySelectorAll(
        '.code_tabbar_outer, .testcase_tabbar_outer, .z-nav-1, .flexlayout__tabset_tabbar_outer_top, #ide-top-btns, .hidden'
    ).forEach(element => element.remove());

    // removes only from comments
    document.querySelectorAll('.mt-4.flex-1 code').forEach(code => {
        // Check if the code block's language should lead to removal
        if (languagesToRemove.some(lang => code.className.includes(`language-${lang.toLowerCase()}`))) {
            let commentDiv = code // up 4 levels
                .parentNode.parentNode.parentNode.parentNode
            if (commentDiv) {
                commentDiv.remove(); // Remove the great-grandparent div of the code element
            }
        }
    });

    return document.body.innerHTML; // Return the modified HTML of the element
}

async function switchToLangugageCodeBlocks(page, language) {
    const langOptionXPath = `//div[contains(@class, 'flex') and contains(@class, 'select-none')]/div[contains(text(), '${language}')]`
    const langOptions = await page.$x(langOptionXPath)

    for (const [i, option] of langOptions.entries()) {
        try {
            // Ensure the element is visible before clicking
            await page.evaluate((el) => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, option)

            await page.evaluate(element => {
                element.style.border = "2px solid red" // Add your desired border style
            }, option)

            await page.screenshot({ path: `${DEBUG_PATH}/langOption${i}.png` });
            await option.evaluate(el => el.click())
            await page.waitForTimeout(500)
            await page.screenshot({ path: `${DEBUG_PATH}/langOptionSelected${i}.png` });
        } catch (error) {
            console.error(`Error clicking on ${language}Option option:`, error);
        }
    }
}

