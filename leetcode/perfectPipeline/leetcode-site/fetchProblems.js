import { waitForXPathOrTimeout } from "./helpers.js"

export async function fetchSolutions(browser, solutionsUrl) {
    const page = await browser.newPage();
    await page.goto(solutionsUrl, { waitUntil: 'domcontentloaded' });

    await page.setViewport({ width: 1280, height: 2000, deviceScaleFactor: 1 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0');

    // wait for tag select svg arrow.
    await page.waitForSelector('div.absolute.right-4.top-0 svg path[d="M20 8l-8 8-8-8"]', { visible: true });
    await page.screenshot({ path: 'data/debug/svg_arrow.png' });
    const svgArrow = await page.$('div.absolute.right-4.top-0 svg path[d="M20 8l-8 8-8-8"]');

    const svgParentDiv = await svgArrow.evaluateHandle(el => el.closest('div.cursor-pointer'))

    await page.screenshot({ path: 'data/debug/firstTimeout.png' });
    await svgParentDiv.evaluate(el => el.click());
    await page.screenshot({ path: 'data/debug/clickLanguageArrow.png' });

    // wait for select js solutions tag only
    const jsFound = await waitForXPathOrTimeout(page, "//span[contains(., 'JavaScript')]", 2000);
    if (!jsFound) {
        console.error(`JS Solution not found: ${solutionsUrl}`);
        page.close();
        return { solutions: [], solutionsUrls: [] }
    }

    // select js only unless already selected
    await selectJavascriptSolutions(page)
    await page.screenshot({ path: 'data/debug/selectJs.png' });

    // minimize tag select
    await svgParentDiv.evaluate(el => el.click());
    await page.screenshot({ path: 'data/debug/hideSelection.png' });
    await sortByVotes(page);

    const { solutions, solutionsUrls } = await fetchSolutionsHtml(browser, page)
    if (!solutions || !solutionsUrls ||
        solutions.length < 2 || solutionsUrls.length < 2
    ) {
        throw new Error(
            `Failed to fetch leetcode solutions ${solutions} ${solutionsUrls}`
        )
    }
    return { solutions, solutionsUrls }
}

async function selectJavascriptSolutions(page) {
    let [javascriptButton] = await page.$x("//span[contains(., 'JavaScript')]");

    const notJavascript = await page.evaluate(element => {
        return element.classList.contains('bg-lc-fill-02') && element.classList.contains('text-lc-text-secondary');
    }, javascriptButton);
    await page.waitForTimeout(500);
    if (notJavascript) {
        await javascriptButton.evaluate(el => el.click());
        await page.waitForTimeout(4000)
    }
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
        await page.screenshot({ path: 'data/debug/redVotesHighlight.png' });

        const contentSelector = 'div.group.flex.w-full.cursor-pointer.flex-col'
        await page.waitForSelector(contentSelector, { visible: true })

        const mostVotesXPath = "//div[contains(text(), 'Most Votes')]"

        // Wait for dropdown to appear and content to load
        await clickUntilElementLoads(page, sortByButton, mostVotesXPath)

        // After waiting, find and click the 'Most Votes' option
        const mostVotesOption = await page.$x(mostVotesXPath)
        await mostVotesOption[0].evaluate(el => el.click());
        await page.screenshot({ path: `data/debug/mostVotesOption.png` });

        const solutionsSelector = 'div.relative.flex.w-full.flex-col > div.flex.w-full.flex-col'
        await waitForElementChange(page, solutionsSelector, 4000)
        await page.screenshot({ path: `data/debug/solutionsLoaded.png` });
    }
    // Wait for content to load appropriate order
    await page.waitForSelector('div.group:first-of-type')
}

async function waitForElementChange(page, selector, timeout = 10000) { // default timeout 10 seconds
    return await page.evaluate((selector, timeout) => {
        return Promise.race([
            new Promise((resolve) => {
                const targetNode = document.querySelector(selector)
                if (!targetNode) {
                    resolve(false)
                    return
                }

                const observerOptions = {
                    childList: true,
                    subtree: true,
                }

                const observer = new MutationObserver((_, observer) => {
                    resolve(true)
                    observer.disconnect()
                })

                observer.observe(targetNode, observerOptions)
            }),
            new Promise((resolve) => {
                setTimeout(() => resolve(false), timeout) // resolve as false after the timeout
            })
        ])
    }, selector, timeout)
}

async function loadNextSolution(browser, block) {

    const solutionLinkElement = await block.$('a[href*="/problems/"]')
    if (!solutionLinkElement) return null
    // Extract the href attribute from the solution link element
    const solutionUrl = await solutionLinkElement.evaluate(el => el.getAttribute('href'))
    // Ensure the URL is absolute (not just a path)
    const baseUrl = 'https://leetcode.com' // Adjust this if needed
    const fullUrl = solutionUrl.startsWith('http') ? solutionUrl : baseUrl + solutionUrl

    // Navigate to the solution URL in the new page
    const solutionPage = await browser.newPage()
    await solutionPage.setCacheEnabled(false)
    await solutionPage.goto(fullUrl)

    // Wait for the desired selector to load on the new page
    await solutionPage.waitForSelector('div.break-words')
    await solutionPage.waitForTimeout(4000)

    return solutionPage
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

async function switchToJavascriptCodeBlocks(page) {
    const jsOptionXPath = "//div[contains(@class, 'flex') and contains(@class, 'select-none')]/div[contains(text(), 'JavaScript')]"
    const jsOptions = await page.$x(jsOptionXPath)

    for (const [i, option] of jsOptions.entries()) {
        try {
            // Ensure the element is visible before clicking
            await page.evaluate((el) => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, option)

            await page.evaluate(element => {
                element.style.border = "2px solid red" // Add your desired border style
            }, option)

            await page.screenshot({ path: `data/debug/jsOption${i}.png` });
            await option.evaluate(el => el.click())
            await page.waitForTimeout(500)
            await page.screenshot({ path: `data/debug/jsOptionSelected${i}.png` });
        } catch (error) {
            console.error("Error clicking on JavascriptOption option:", error);
        }
    }
}

async function getTextExcludingNonJsSections(page) {
    const commentsAndSolutionHtml = await processCommentsAndSolution(page);
    const cleanedHTML = await stripNonJsCodeElements(commentsAndSolutionHtml, [
        'C', 'C++', 'Java', 'Python', 'C#', 'Ruby',
        'Swift', 'Go', 'Kotlin', 'Scala', 'Rust',
        'PHP', 'TypeScript', 'Racket', 'Erlang', 'SQL'
    ]);

    const textContent = await preserveTextAndImages(cleanedHTML)

    return textContent;
}

async function preserveTextAndImages(cleanedHTML) {
    const jsdom = await import('jsdom');
    const { JSDOM } = jsdom;
    const dom = new JSDOM(cleanedHTML);
    const document = dom.window.document;

    let textContent = '';

    // Function to handle nodes recursively
    function processNode(node) {
        if (node.nodeType === 3) { // Node.TEXT_NODE
            textContent += node.textContent + ' ';
        } else if (
            node.tagName === 'IMG' &&
            !["avatar", "badges", "static_assets"].some(val => node.src.includes(val))
        ) {
            textContent += node.outerHTML + ' ';
        } else if (node.childNodes.length > 0) {
            node.childNodes.forEach(child => processNode(child));
        }
    }

    processNode(document.body);

    return textContent
        .replace(/\/\*\*([\s\S]*?)(@param|@return)([\s\S]*?)\*\//g, '')
        .trim();
}

async function stripNonJsCodeElements(htmlContent, languagesToRemove) {
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

async function fetchSolutionsHtml(browser, page) {
    const solutionBlocks = await page.$$('.group.flex.w-full.cursor-pointer.flex-col');

    const solutions = []
    const solutionsUrls = []

    const GET_SOLUTIONS_AMOUNT = 5
    for (const [index, block] of solutionBlocks.entries()) {

        if (index === GET_SOLUTIONS_AMOUNT) { break }

        const solutionPage = await loadNextSolution(browser, block);
        if (!solutionPage) continue;

        await switchToJavascriptCodeBlocks(solutionPage)

        const solutionText = await getTextExcludingNonJsSections(solutionPage)
        const solutionLink = await solutionPage.url();

        solutionsUrls.push(solutionLink);
        solutions.push(solutionText)
        await solutionPage.close();
    }

    return { solutions, solutionsUrls }
}

async function processCommentsAndSolution(page) {

    page.on('console', msg => console.log(msg.text()));

    await page.waitForSelector(
        'div.relative.flex.w-full.flex-1.flex-col.overflow-y-auto > div.mx-auto.w-full'
    );

    try {
        await page.waitForSelector('div.mt-2.flex > div.opacity-1', { timeout: 5000 });
    } catch (e) {
        console.log("No comments for", page.url())
        return await page.evaluate(() => document.body.outerHTML)
    }

    const commentsAndSolutionHtml = await page.evaluate(async () => {

        const solutionSelector =
            'div.relative.flex.w-full.flex-1.flex-col.overflow-y-auto > div.mx-auto.w-full'

        const solutionAndCommentsContainer = document.querySelector(solutionSelector);
        if (!solutionAndCommentsContainer) {
            console.log("Solution selector not found");
            return "";
        }

        // Find and process each comment within the container
        const comments = solutionAndCommentsContainer.querySelectorAll(
            'div.mt-2.flex > div.opacity-1'
        )

        for (const commentBlock of comments) {
            const codeBlocks = commentBlock.querySelectorAll('code.language');
            let containsJavaScript = false;

            codeBlocks.forEach(code => {
                if (code.classList.contains('language-javascript')) {
                    containsJavaScript = true;
                }
            });
            // If the comment contains a code block that is not JavaScript, remove the entire comment block
            if (codeBlocks.length > 0 && !containsJavaScript) {
                commentBlock.remove();
            }
        }

        // Return the HTML of the processed container
        return solutionAndCommentsContainer.outerHTML
    });

    return commentsAndSolutionHtml
}

