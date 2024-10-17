import { writeFile } from 'fs/promises';
import gptPkg from 'gpt3-tokenizer';
const GPT3Tokenizer = gptPkg.default

import OpenAI from "openai"

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function promptChatGpt(prompt, userMessage) {
    const systemMessage = {
        role: "system",
        content: prompt
    }

    const messages = [
        systemMessage,
        { role: "user", content: userMessage },
    ];

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 2048,
    });

    return completion.choices[0].message.content;
}

export async function createImage(prompt) {
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024"
    });

    return response.data[0].url
}

export function createUserMessage({ prompt, statement, solutions, ioExamples }) {
    const paritalPrompt = prompt
        .replace(/(Problem:\n```)(.*?)(```)/s, `$1\n${statement}\n$3`)
        .replace(/(Input Output Examples:\n```)(.*?)(```)/s, `$1\n${ioExamples}\n$3`)

    const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
    const remaining = 4096 - tokenizer.encode(paritalPrompt).bpe.length;

    function getSolutionsLength(solutionsObj) {
        return Object.values(solutionsObj).reduce(
            (acc, sol) => acc + tokenizer.encode(sol).bpe.length,
            0
        );
    }
    const solutionsTokens = getSolutionsLength(solutions)

    if (solutionsTokens > remaining) {
        solutions = Object.fromEntries(
            Object.entries(solutions).map(([url, sol]) => [url, trimAfterFirstComment(sol)])
        );

        let lengthFirstComment = getSolutionsLength(solutions)
        while (lengthFirstComment > remaining) {
            const longestUrl = Object.keys(solutions).reduce(
                (a, b) =>
                    solutions[a].length > solutions[b].length ? a : b
            )
            delete solutions[longestUrl];

            lengthFirstComment = getSolutionsLength(solutions)
            if (solutions.length == 1) {
                // TIP if you ever get here first trim all comments
                // try selecting shorter solutions
                // you can calculate the average or just sort by length
                // you can also look into deleting repeating text from solutions
                console.warn("Solutions was too long", statement);
            }
        }
    }

    const formattedSolutions = Object.entries(solutions)
        .map(([_url, solution], index) => `${index + 1}. ${solution}`)
        .join('\n');

    // Replace the placeholder text between the backticks for the Solutions section
    return `Problem:
\`\`\`
${statement}
\`\`\`
Solutions:
\`\`\`
${formattedSolutions}
\`\`\`
Input Output Examples:
\`\`\`
${ioExamples}
\`\`\``
}

export async function uploadImage(path, title, imageDescription) {
    const imageName = extractFirstNumber(title)

    const imagePath = join(path, `${imageName}.jpg`);
    const imageExists = existsSync(imagePath)
    let image = imageExists ? readImage(imagePath) : null

    if (!imageExists) {
        const url = await createImage(imageDescription)
        image = await downloadImage(url)

        await writeFile(imagePath, image)
    }

    // uploadImage to s3
    return imageName
}

export async function createImage(prompt) {
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024"
    });

    return response.data[0].url
}
