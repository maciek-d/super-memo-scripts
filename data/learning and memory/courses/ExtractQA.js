import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

async function extractQuestionsAndAnswers() {
    try {
        // Read the JSON file
        const __dirname = path.dirname(fileURLToPath(import.meta.url));

        // Construct the path to the JSON file
        const jsonFilePath = path.join(__dirname, 'Numbers.json');
        const data = await fs.readFile(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(data);

        // Prepare text content from question and answer
        let textContent = '';
        jsonData.forEach(item => {
            const questionObj = JSON.parse(item.content.question);
            const answerObj = JSON.parse(item.content.answer);

            textContent += `${questionObj.content}\n`;
            textContent += `${answerObj.content}\n\n`;
        });

        // Write the extracted content to a text file
        const textFilePath = path.join(__dirname, 'numbers.txt');

        // Write the extracted content to the text file
        await fs.writeFile(textFilePath, textContent);

        console.log('Questions and answers have been written to numbers.txt');
    } catch (error) {
        console.error('Error:', error);
    }
}

extractQuestionsAndAnswers();