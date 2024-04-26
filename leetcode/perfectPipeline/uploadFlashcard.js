// TODO
// possibly add login function

import axios from "axios";
import { config } from 'dotenv';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
config({ path: envPath });

const courseId = process.env.COURSE_ID
const targetParentNumber = process.env.TARGET_PARENT_NUMBER

const userId = process.env.USER_ID
const token = process.env.SUPER_MEMO_TOKEN

export async function postNewCard(question, answer) {

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
        return response;
    } catch (error) {
        console.log(error);
    }
    return "";
};
