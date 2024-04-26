import { config } from 'dotenv';
import { existsSync, writeFileSync, readFileSync } from 'fs';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
config({ path: envPath });

export async function loginToGpt(browser) {
    const page = await browser.newPage();

    if(existsSync("gpt_cookies.json")){
        const cookiesString = readFileSync('gpt_cookies.json');
        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);
        await page.goto(
            "https://chat.openai.com/?model=gpt-4", { waitUntil: 'domcontentloaded' }
        );

        await page.waitForTimeout(4000);

        const loginButtons = await page.$x(
            "//button[contains(@class, '_button-login-password') and contains(text(), 'Continue')]",
            {visible: true}
        );

        if(loginButtons.length === 0) {
            return page
        }
    }

    await page.goto("https://chat.openai.com/?model=gpt-4", { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const [loginButton] = await page.$x(
        "//button[contains(@class, 'btn-neutral') and contains(., 'Log in')]"
    );
    await loginButton.click();

    const username = process.env.GPT_USERNAME
    const password = process.env.GPT_PASSWORD

    await page.waitForSelector('input', { timeout: 5000 });
    await page.type('input', username);

    // login
    const [continueButton] = await page.$x("//button[contains(., 'Continue')]");
    await continueButton.click();

    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await page.type('input[type="password"]', password);

    const continueLoginButton = await page.waitForXPath(
        "//button[contains(@class, '_button-login-password') and contains(text(), 'Continue')]",
        {visible: true}
    );
    await page.waitForTimeout(400);
    await continueLoginButton.click();
    await page.waitForTimeout(400);
    await continueLoginButton.click();

    await page.goto(
        "https://chat.openai.com/?model=gpt-4", { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(6000);
    const cookies = await page.cookies();
    writeFileSync('gpt_cookies.json', JSON.stringify(cookies));

    return page
}

export async function getGptResponse(prompt, page) {

    await page.waitForSelector('#prompt-textarea', { timeout: 5000 });
    await page.focus('#prompt-textarea');
    await page.keyboard.type(prompt);

    await page.keyboard.press('Enter');

    const selector = 'svg.icon-md path[d="M12 3.5C10.8954 3.5 10 4.39543 10 5.5H14C14 4.39543 13.1046 3.5 12 3.5ZM8.53513 3.5C9.22675 2.3044 10.5194 1.5 12 1.5C13.4806 1.5 14.7733 2.3044 15.4649 3.5H17.25C18.9069 3.5 20.25 4.84315 20.25 6.5V18.5C20.25 20.1569 19.1569 21.5 17.25 21.5H6.75C5.09315 21.5 3.75 20.1569 3.75 18.5V6.5C3.75 4.84315 5.09315 3.5 6.75 3.5H8.53513ZM8 5.5H6.75C6.19772 5.5 5.75 5.94772 5.75 6.5V18.5C5.75 19.0523 6.19772 19.5 6.75 19.5H17.25C18.0523 19.5 18.25 19.0523 18.25 18.5V6.5C18.25 5.94772 17.8023 5.5 17.25 5.5H16C16 6.60457 15.1046 7.5 14 7.5H10C8.89543 7.5 8 6.60457 8 5.5Z"]'

    // Count the current number of specific buttons before a new one appears
    const initialButtonCount = await page.evaluate(() => {
        return document.querySelectorAll(selector).length;
    });

    // Wait for a new button of the specified type to be added
    await page.waitForFunction(
        (initialCount) => {
            return document.querySelectorAll(selector).length > initialCount;
        },
        {}, // Pass empty options object if no options needed
        initialButtonCount
    );

    // Click the last button of this specific type that includes the SVG
    await page.click(`${selector}:last_child`);

    const clipboardContent = await page.evaluate(() => {
          return navigator.clipboard.readText();
    });

    return clipboardContent;
}

