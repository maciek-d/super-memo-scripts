import prettier from 'prettier';

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

export async function scrapeProblem(browser, problemUrl) {
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
        const description = descriptionElement ? descriptionElement.innerText.trim() : '';
        const htmlDescription = descriptionElement ? descriptionElement.innerHTML : '';

        return { title, description, htmlDescription };
    }, urlPart);

    await page.close();
    const { statement, examples, constraints } = splitDescription(description)
    // TODO this might be the right place to extract image html while keeping them in correct order

    return { statement, examples, constraints }
}

function splitDescription(description) {
    const exampleIndex = description.indexOf('Example');
    const constraintsIndex = description.indexOf('Constraints:');

    let statement = description;
    let examples = '';
    let constraints = '';

    if (exampleIndex !== -1) {
        statement = description.substring(0, exampleIndex);
        examples = constraintsIndex === -1 ? description.substring(exampleIndex)
            : description.substring(exampleIndex, constraintsIndex);
    }

    if (constraintsIndex !== -1) {
        constraints = description.substring(constraintsIndex + 'Constraints:'.length);
    }

    return {
        statement,
        examples,
        constraints
    };
}

export async function scrapeSolution(browser, solutionUrl, language) {
    const page = await browser.newPage();
    await page.goto(solutionUrl, { waitUntil: 'domcontentloaded' });

    await selectLanguage(page)
    await selectByVotes(page)

    // Extract the solution in HTML and text format
    const { htmlSolution, textSolution } = await extractSolutionFromBlocks(page, language, solutionUrl)
    await page.close();
    return { htmlSolution, textSolution };
}

async function selectLanguage(page) {
    await page.waitForSelector('svg path[d="M20 8l-8 8-8-8"]');

    // Once the SVG element is available, select its parent div and click
    const svgParentDiv = await page.$('div.absolute.right-4.top-0 svg path[d="M20 8l-8 8-8-8"]');
    await svgParentDiv.click();

    const languageFound = await waitForXPathOrTimeout(page, `//span[contains(., '${language}')]`, 2000);
    if (!languageFound) {
        console.error(`${language} Solution not found: ${solutionUrl}`);
        page.close();
        return { solutionLink: "", htmlSolution: "", textSolution: "" };
    }

    let [languageButton] = await page.$x(`//span[contains(., '${language}')]`);

    const languageNotSelected = await page.evaluate(element => {
        return element.classList.contains('bg-lc-fill-02') && element.classList.contains('text-lc-text-secondary');
    }, languageButton);
    await page.waitForTimeout(20);
    if (languageNotSelected) {
        await languageButton.click();
    }
    await svgParentDiv.click();
}

async function selectByVotes(page) {
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
}

async function extractSolutionFromBlocks(page, language, solutionUrl) {
    const allLanguages = [
        "JavaScript", "C++", "Java", "Python3", "Python", "C", "C#", "Ruby", "Swift",
        "Go", "Scala", "Kotlin", "Rust", "MySQL", "Bash", "TypeScript", "Dart",
        "Erlang", "Elixir", "PHP", "Racket"
    ]

    const otherLanguages = allLanguages.filter(lang => lang != language)
    const solutionBlocks = await page.$$('.group.flex.w-full.cursor-pointer.flex-col');

    for (const block of solutionBlocks) {
        const languages = await block.$$eval('.whitespace-nowrap', nodes => nodes.map(n => n.textContent.trim()));

        if (!otherLanguages.some(lang => languages.includes(lang))) {
            const solutionUrlElement = await block.$('a[href*="/problems/"]');

            if (solutionUrlElement) {
                // Ensure the link opens in the same tab
                await page.evaluate(el => el.target = '_self', solutionUrlElement);

                // Click on the solution link
                await Promise.allSettled([
                    page.waitForNavigation({ waitUntil: 'networkidle0' }),
                    solutionUrlElement.click()
                ]);
                await page.waitForSelector('div.break-words'); // Wait for the solution content to load
                await page.waitForFunction('document.readyState === "complete"');

                // Extract the solution URL, HTML and text content
                const solutionUrl = await page.url();
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
                        return { htmlSolution, textSolution };
                    }
                }
                if (textSolution) {
                    await page.close();
                    console.log(`Solution found for: ${solutionUrl}`);
                    return { htmlSolution, textSolution };
                }

            }
        }
    }
    console.error(`No solution found for: ${solutionUrl}`);
    return { htmlSolution: '', textSolution: '' };
}

export async function scrapeSolutions(browser, language, solutionsUrl) {
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
    const languageFound = await waitForXPathOrTimeout(page, `//span[contains(., '${language}')]`, 2000);
    if (!languageFound) {
        console.error(`${language} Solution not found: ${solutionsUrl}`);
        page.close();
        return { solutions: [], solutionsUrls: [] }
    }

    // select js only unless already selected
    await selectJavascriptSolutions(page)
    await page.screenshot({ path: `data/debug/select${language}.png` });

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
