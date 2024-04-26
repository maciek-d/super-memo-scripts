export async function waitForXPathOrTimeout(page, xpath, timeout) {
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

export async function skipBanner(browser, solutionUrl) {
    const page = await browser.newPage();
    await page.goto(solutionUrl, { waitUntil: 'domcontentloaded' });

    const accept = await page.$('button.font-medium.items-center.whitespace-nowrap.inline-flex.bg-fill-3.rounded-full.text-xl.text-white');
    await accept.click();

    await page.waitForSelector('button[title="Skip"]', { visible: true });
    const closeTutorial = await page.$('button[title="Skip"]');
    await closeTutorial.click();

    page.close();
}
