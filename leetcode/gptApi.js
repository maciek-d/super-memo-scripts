import axios from 'axios';
import gptPkg from 'gpt3-tokenizer';
const GPT3Tokenizer = gptPkg.default

import OpenAI from "openai"


export async function promptChatGpt(prompt, userMessage) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const systemMessage = {
        role: "system",
        content: prompt
    }

    const messages = [
        systemMessage,
        { role: "user", content: userMessage },
    ]

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 2048, // Max response tokens
    })

    return completion.choices[0].message.content;
}

export async function createImage(prompt) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024"
    });

    return response.data[0].url
}

export function createUserAnswerMessage({ systemPrompt, solutions }) {
    function collapseWhitespace(text) {
        return text.replace(/\n{2,}/g, '\n').trim(); // Replaces 2+ newlines with a single one
    }

    // Calculate remaining characters
    const paritalPrompt = `${systemPrompt}Solutions:\n\`\`\`\n\`\`\``
    const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
    const MAX_TOKENS_FOR_PROMPT = 5000 // 128000 is total max which includes response tokens (2048)
    const remaining = MAX_TOKENS_FOR_PROMPT - tokenizer.encode(paritalPrompt).bpe.length;

    function getSolutionsLength(solutionsObj) {
        return Object.values(solutionsObj).reduce(
            (acc, sol) => acc + tokenizer.encode(sol).bpe.length,
            0
        );
    }
    const solutionsTokens = getSolutionsLength(solutions)

    if (solutionsTokens > remaining) {
        solutions = Object.fromEntries(
            Object.entries(solutions).map(([url, sol]) => [url, trimAfterFirstComment(collapseWhitespace(sol))])
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
                // TIP if you ever see this warning
                // 1. trim all comments
                // 2. try selecting shorter solutions
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
    return `Solutions:\n\`\`\`\n${formattedSolutions}\n\`\`\``
}

export function createUserQuestionMessage({ statement, ioExamples }) {
    return `Problem:\n\`\`\`\n${statement}\n\`\`\`\nInput\nOutput\nExamples:\n\`\`\`\n${ioExamples}\n\`\`\``
}

function trimAfterFirstComment(text) {
    const pattern = /Comments \(\d+\)\s*.*?(?=\d+\s*(Show \d+ Replies|Reply|$))/s;
    const match = pattern.exec(text);
    return match ? text.slice(0, match.index + match[0].length) : text;
}

export async function downloadImage(url) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
    });

    return Buffer.from(response.data, 'binary');
}
