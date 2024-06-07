import axios from "axios";
import { config } from 'dotenv';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
config({ path: envPath });


const userId = process.env.SUPERMEMO_USER_ID
const token = process.env.SUPERMEMO_TOKEN

export async function postNewCard(question, answer, courseId, targetParentNumber) {

    const newCardUrl = `https://learn.supermemo.com/api/users/${userId}/courses/${courseId}/pages?contentType=json&targetParentNumber=${targetParentNumber}`;

    const questionObject = {
        content: question
    };

    const answerObject = {
        content: answer
    };

    const json = {
        question: JSON.stringify(questionObject),
        answer: JSON.stringify(answerObject)
    };

    try {

        const response = await axios.post(newCardUrl, json, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.status !== 200) {
            throw new Error(`Failed to post new card: ${response.statusText} (${response.status}) for ${courseId}`);
        }
        return response;
    } catch (error) {
        if (error.response && error.response.status === 403) {
            throw new Error("Invalid Supermemo token")
        }
        throw error
    }
}
