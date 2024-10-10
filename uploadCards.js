import axios from "axios";
import { readFile } from 'fs/promises';
import config from "./helpers/import_env.js";
config();

console.log("userId", process.env.USER_ID);

const BASE_PATH = "./data";
const FILE_PATH = `${BASE_PATH}/leetcode/newFlashcards.js`; // DONT FORGET TO UPDATE
// const env_prefix = "GEO_IMG_";
const env_prefix = "LEETCODE_"; // When adding a new course dont forget to get CourseId and TargetParentId
const env_user_prefix = "";
const SHUFFLE = false; // shuffle the cards prior to upload?

const courseId = process.env?.[`${env_prefix}COURSE_ID`];
const targetParentNumber = process.env?.[`${env_prefix}TARGET_PARENT_NUMBER`];

const userId = process.env?.[`${env_user_prefix}USER_ID`];
const token = process.env?.[`${env_user_prefix}SUPER_MEMO_TOKEN`];

async function readDataFromFile(filePath) {
    try {
        const data = await readFile(filePath, 'utf-8');
        if (filePath.endsWith('.json')) {
            // Handle JSON files
            return JSON.parse(data);
        } else if (filePath.endsWith('.js')) {
            // Handle JavaScript files
            try {
                // Attempt to import the module
                const module = await import(`file://${filePath}`);
                return module.default || []; // Use exported array, if available
            } catch (importErr) {
                // If import fails, try to parse it as an array
                try {
                    return eval(data); // Use eval as a fallback for non-module JS files
                } catch (evalErr) {
                    console.error("Error parsing JS file:", evalErr);
                }
            }
        }
    } catch (err) {
        console.error("Error reading file:", err);
    }
    return []; // Default return value in case of failure
}

const run = async (filePath = null) => {
    filePath = filePath ? filePath : FILE_PATH;
    // TODO check if the token is outdated. 
    // Possibly simply mock the login and fetch a newer token.
    const cards = await readDataFromFile(filePath);
    if (SHUFFLE) shuffle(cards); // possibly a better way to separate reoccuring values could be needed
    const jsdom = await import('jsdom');
    const { JSDOM } = jsdom;

    // console.log(...cards.map((data) => {
    //     const dom = new JSDOM(data.answer);
    //     const document = dom.window.document;
    //     return document.querySelector('a').textContent.trim() + "\n";
    // }));
    const newCardUrl = `https://learn.supermemo.com/api/users/${userId}/courses/${courseId}/pages?contentType=json&targetParentNumber=${targetParentNumber}`;

    console.log(newCardUrl);
    console.log("number of cards", cards.length);
    console.log("Example Card");
    console.log("question:", cards?.[0].question.slice(0, 20));
    console.log("answer:", cards?.[0].answer.slice(0, 20));

    for (const card of cards) {
        const response = await postNewCard(newCardUrl, card.question, card.answer);
        if (response?.status !== 200) console.log(response);
    }
};

const postNewCard = async (newCardUrl, question, answer) => {

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

function shuffle(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex > 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

const filePathFromMeta = decodeURIComponent(new URL(import.meta.url).pathname);
const isMain = filePathFromMeta === process.argv[1];

if (isMain) { // doesn't run on import
    run().then(() => {
        console.log("done");
    });
}