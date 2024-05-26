import OpenAI from "openai"

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function getChatGPTResponse(prompt, userMessage) {
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

