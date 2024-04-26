import { waitForXPathOrTimeout, skipBanner } from "./helpers.js"

export async function getJsSolutions(browser) {
    const solutionUrl = "https://leetcode.com/problems/two-sum/solutions/";
    // await skipBanner(browser, problemUrl) // TODO add when fetching first solution

    const solutionPage = await loadNextSolution(browser, null);

    await switchToJavascriptCodeBlocks(solutionPage)


    const solutionText = await getTextExcludingNonJsSections(solutionPage)
    const solutionLink = await solutionPage.url();

    console.log("here4", solutionText.length, solutionLink.length)
    await solutionPage.close();

    console.log("before crash");
    //    return await fetchSolutions(browser, solutionUrl);
}

// TOOD test
async function fetchSolutions(browser, solutionsUrl) {
    const page = await browser.newPage();
    await page.goto(solutionsUrl, { waitUntil: 'domcontentloaded' });

    // wait for tag select svg arrow.
        await page.waitForSelector('svg path[d="M20 8l-8 8-8-8"]');
    const svgParentDiv = await page.$('div.absolute.right-4.top-0 svg path[d="M20 8l-8 8-8-8"]');
    await svgParentDiv.click();

    // wait for select js solutions tag only
    const jsFound = await waitForXPathOrTimeout(page, "//span[contains(., 'JavaScript')]", 2000);
    if (!jsFound) {
        console.error(`JS Solution not found: ${solutionsUrl}`);
        page.close();
        return { solutions: [], solutionsUrls: [] }
    }

    // select js only unless already selected
    await selectJavascriptSolutions(page)

    // minimize tag select
    await svgParentDiv.click();
    await sortByVotes(page);

    const { solutions, solutionsUrls } =  await fetchSixSolutions(browser, page);
    console.log(solutions.length, solutionsUrls.length);

    return { solutions, solutionsUrls }
}

async function selectJavascriptSolutions(page) {
    let [javascriptButton] = await page.$x("//span[contains(., 'JavaScript')]");

    const notJavascript = await page.evaluate(element => {
        return element.classList.contains('bg-lc-fill-02') && element.classList.contains('text-lc-text-secondary');
    }, javascriptButton);
    await page.waitForTimeout(20);
    if (notJavascript) {
        await javascriptButton.click();
    }
}

async function sortByVotes(page) {
    const votesButtonXPath = "//button[contains(text(), 'Votes')]";
    const votesButton = await page.$x(votesButtonXPath);

    if (votesButton.length === 0) {
        await page.waitForXPath("//button[contains(text(), 'Sort by')]", { visible: true });
        let [sortByButton] = await page.$x("//button[contains(text(), 'Sort by')]");

        await page.evaluate(element => {
            element.style.border = "2px solid red"; // Add your desired border style
        }, sortByButton);

        const contentSelector = 'div.group.flex.w-full.cursor-pointer.flex-col';
        await page.waitForSelector(contentSelector, { visible: true });

        const mostVotesXPath = "//div[contains(text(), 'Most Votes')]";

        // Wait for dropdown to appear and content to load
        await clickUntilElementLoads(page, sortByButton, mostVotesXPath);

        // After waiting, find and click the 'Most Votes' option
        const mostVotesOption = await page.$x(mostVotesXPath);
        await mostVotesOption[0].click();

        const solutionsSelector = 'div.relative.flex.w-full.flex-col > div.flex.w-full.flex-col';
        await waitForElementChange(page, solutionsSelector, 4000);
    }
    // Wait for content to load appropriate order
    await page.waitForSelector('div.group:first-of-type');
}

async function waitForElementChange(page, selector, timeout = 10000) { // default timeout 10 seconds
    return await page.evaluate((selector, timeout) => {
        return Promise.race([
            new Promise((resolve) => {
                const targetNode = document.querySelector(selector);
                if (!targetNode) {
                    resolve(false);
                    return;
                }

                const observerOptions = {
                    childList: true,
                    subtree: true,
                };

                const observer = new MutationObserver((_, observer) => {
                    resolve(true);
                    observer.disconnect();
                });

                observer.observe(targetNode, observerOptions);
            }),
            new Promise((resolve) => {
                setTimeout(() => resolve(false), timeout); // resolve as false after the timeout
            })
        ]);
    }, selector, timeout);
}

async function loadNextSolution(browser, block) {
    // TODO add after testing
    //    const solutionLinkElement = await block.$('a[href*="/problems/"]');
    //    if (!solutionLinkElement) return null;

    // Create a new page
    const solutionPage = await browser.newPage();

    // Extract the href attribute from the solution link element
    // const solutionUrl = await solutionLinkElement.evaluate(el => el.getAttribute('href'));
    const solutionUrl = "https://leetcode.com/problems/two-sum/solutions/234005/neat-javascript-map-o-n/"

    // Ensure the URL is absolute (not just a path)
    const baseUrl = 'https://leetcode.com'; // Adjust this if needed
    const fullUrl = solutionUrl.startsWith('http') ? solutionUrl : baseUrl + solutionUrl;

    //    await Promise.allSettled([
        //        solutionPage.waitForNavigation({ waitUntil: 'networkidle0' }),
        //    ]);

    // Navigate to the solution URL in the new page
    await solutionPage.goto(fullUrl)

    // Wait for the desired selector to load on the new page
    await solutionPage.waitForSelector('div.break-words');
    //    await solutionPage.waitForFunction('document.readyState === "complete"');

    return solutionPage;
}

function awaitKeyPress() {
    return new Promise(resolve => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            resolve();
        });
    });
}

async function clickUntilElementLoads(page, clickElement, xpathToWaitFor, timeoutDuration = 200) {
    let elementFound = false;
    while (!elementFound) {
        await clickElement.click();

        const waitForElement = page.waitForXPath(xpathToWaitFor);
        const timeout = new Promise(resolve => setTimeout(resolve, timeoutDuration));
        const result = await Promise.race([waitForElement, timeout]);

        elementFound = Boolean(result);
    }
}

// Todo test
async function switchToJavascriptCodeBlocks(page) {
    const jsOptionXPath = "//div[contains(@class, 'flex') and contains(@class, 'select-none')]/div[contains(text(), 'JavaScript')]"

    const jsOptions = await page.$x(jsOptionXPath);

    for (const option of jsOptions) {
        try {
            // Ensure the element is visible before clicking
            await page.evaluate((el) => {
                if (!el.offsetParent) {
                    el.scrollIntoView();
                }
            }, option);

            // TODO remove after testing
            // border reminder to remove after testing
            await page.evaluate(element => {
                element.style.border = "2px solid red"; // Add your desired border style
            }, option);

            // TODO remove after testing
            await page.waitForTimeout(2000);
            const textContent = await page.evaluate(el => el.textContent, option);
            console.log("Attempting to click on element with text:", textContent);

            await option.click();
        } catch (error) {
            console.error("Error clicking on JavascriptOption option:", error);
        }
    }
}

function shouldRemoveLanguage(text, languages) {
    const javascriptPresent = /javascript/i.test(text);
    return languages.some(lang => {
        if (lang === 'C' || lang === 'Go' || lang === 'Swift') {
            // Use more specific regex for these languages
            const regex = new RegExp(`\\b${lang}\\b`, 'i');
            return regex.test(text);
        } else {
            // For other languages, simple inclusion check with JavaScript exclusion
            return text.includes(lang) && !javascriptPresent;
        }
    });
}

function addCodeMarkdown(element) {
    const codeElements = element.querySelectorAll('code.language');
    codeElements.forEach(code => {
        const language = code.className.match(/language-(\w+)/)?.[1]; // Extract language from class
        if (language) {
            // Wrap code content with markdown-style code blocks
            const formattedCode = `\`\`\`${language}\n${code.textContent}\n\`\`\``;
            code.textContent = formattedCode;
        }
    });
}

// if the whole solution is long delete code blocks from comments first
// maybe shorten them first and if they are still to long delete them

// TODO if comments are short after deleting comments about langugage
// you can load more comments

// TODO Test
async function getTextExcludingNonJsSections(page) {
    await processCommentsAndSolution(page, solutionSelector); // Ensure this function is correctly adjusting the page content

    const cleanedHTML = await stripNonJsCodeElements()

    const textContent = await page.evaluate((htmlContent) => {
        // Create a new temporary element to insert the HTML content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const element = tempDiv.firstChild;

        function preserveTextAndImages(el) {
            let walker = document.createTreeWalker(
                el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false
            );
            let node;
            let textContent = '';

            while (node = walker.nextNode()) {
                if (node.nodeType === Node.TEXT_NODE) {
                    textContent += node.textContent + ' ';
                } else if (node.tagName === 'IMG') {
                    textContent += node.outerHTML + ' ';
                } else {
                    // If it's not a text node or an <img> tag, consider removing it
                    if (node.parentNode) {
                        node.parentNode.removeChild(node);
                    }
                }
            }
            return textContent.trim();
        }

        return preserveTextAndImages(element); // Process the recreated element
    }, cleanedHTML);

    console.log(`textContent ${textContent}`)
    return textContent;
}

async function stripNonJsCodeElements() {
    const languagesToRemove = [
        'C', 'C++', 'Java', 'Python', 'C#', 'Ruby',
        'Swift', 'Go', 'Kotlin', 'Scala', 'Rust',
        'PHP', 'TypeScript', 'Racket', 'Erlang', 'SQL'
    ];

    const solutionSelector = 'div.relative.flex.w-full.flex-1.flex-col.overflow-y-auto';

    return await page.evaluate((languagesToRemove, solutionSelector) => {
        const element = document.querySelector(solutionSelector);
        if (!element) return '';

        function shouldRemoveLanguage(text, languages) {
            return languages.some(lang => text.includes(lang));
        }

        Array.from(element.querySelectorAll('h1')).forEach(h1 => {
            if (shouldRemoveLanguage(h1.textContent, languagesToRemove)) {
                let next = h1.nextSibling;
                while (next && next.tagName !== 'H1') {
                    let toRemove = next;
                    next = next.nextSibling;
                    toRemove.remove();
                }
                h1.remove();
            }
        });
        return element.outerHTML;  // Return the modified HTML of the element
    }, languagesToRemove, solutionSelector);
}

async function  fetchSixSolutions(browser, page) {
    const solutionBlocks = await page.$$('.group.flex.w-full.cursor-pointer.flex-col');

    const solutions = []
    const solutionsUrls = []

    let solutionCount = 0
    const GET_SOLUTIONS_AMOUNT = 6
    for (const block of solutionBlocks) {

        if(solutionCount++ === GET_SOLUTIONS_AMOUNT) { break; }

        const solutionPage = await loadNextSolution(browser, block);
        if (!solutionPage) continue;

        await switchToJavascriptCodeBlocks(solutionPage)

        console.log("here3")

        const solutionText = await getTextExcludingNonJsSections(solutionPage)
        const solutionLink = await solutionPage.url();

        console.log("here4")
        solutionsUrls.push(solutionLink);
        solutions.push(solutionText)
        await solutionPage.close();
    }

    console.log("here5")
    return { solutions, solutionsUrls }
}

async function processCommentsAndSolution(page, solutionSelector) {
    return await page.evaluate(selector => {
        // Find the solution and comments container
        const solutionAndCommentsContainer = document.querySelector(selector);
        if (!solutionAndCommentsContainer) {
            return "";
        }

        // Find and process each comment within the container
        const comments = solutionAndCommentsContainer.querySelectorAll('div.flex.w-full.flex-col.py-3');
        comments.forEach(commentBlock => {
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
        });

        // Return the HTML of the processed container
        return solutionAndCommentsContainer.innerHTML;
    }, solutionSelector);
}

