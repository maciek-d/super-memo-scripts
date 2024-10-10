import axios from 'axios';
import { writeFileSync } from 'fs';
import path from 'path';
import { getCourse } from "./helpers/course.js";
import config from "./helpers/import_env.js";
import { createFlashcard } from './leetcode/singlePipeline/extractFlashcard.js';
config();

// DONT FORGET TO UPDATE
const env_user_prefix = "";

const env_prefix = "LEETCODE_";
const userId = process.env?.[`${env_user_prefix}USER_ID`];
const token = process.env?.[`${env_user_prefix}SUPER_MEMO_TOKEN`];
const courseId = process.env?.[`${env_prefix}COURSE_ID`];

// Update next consts then run
const COURSE_FILENAME = "./data/CS/courses/leetcode.js";
const USE_CACHE = true;

const updateCourse = async (userId, courseId, token, courseName) => {
    const course = await getCourse(userId, courseId, token, courseName, USE_CACHE);
    console.log("course should be object", typeof course);

    const filePath = path.resolve(`${courseName}`);
    // const mapFilePath = path.resolve(`${MAP_FILENAME}`);
    writeFileSync(filePath, JSON.stringify(course, null, 4));

    const updateList = [... new Set([
        "/* 2149. */",
        "/* 1769. */",
        "/* 654. */",
        "/* 1662. */",
        "/* 2482. */",
        "/* 2545. */",
        "/* 1773. */",
        "/* 2798. */",
        "/* 1431. */",
        "/* 2824. */",
        "/* 1480. */",
        "/* 1365. */",
        "/* 2161. */",
        "/* 1528. */",
        "/* 1561. */",
        "/* 1656. */",
        "/* 1816. */",
        "/* 1630. */",
        "/* 1409. */",
        "/* 2535. */",
        "/* 2367. */",
        "/* 2610. */",
        "/* 2006. */",
        "/* 1588. */",
        "/* 1329. */",
        "/* 1913. */",
        "/* 2373. */",
        "/* 804. */",
        "/* 1572. */",
        "/* 1684. */",
        "/* 2828. */",
        "/* 1732. */",
        "/* 1266. */",
        "/* 1464. */",
        "/* 2913. */",
        "/* 2149. */",
        "/* 980. */",
        "/* 1008. */",
        "/* 1877. */",
        "/* 2037. */",
        "/* 832. */",
        "/* 2656. */",
    ])];

    console.log(`updating ${updateList.length}`);
    let count = 0;

    const updated = [];

    for (const card of course) {
        const pageId = card.number;
        const question = card.content.question;
        const answer = card.content.answer;

        let questionContent = JSON.parse(question)?.content;
        let answerContent = JSON.parse(answer)?.content;

        const foundUpdate = updateList.find(update => {
            if (questionContent.includes(update)) updated.push(update);
            return questionContent.includes(update);
        });
        if (!foundUpdate) continue;
        const lastUpdated = updated[updated.length - 1];
        const problemNumber = lastUpdated.substring(2, lastUpdated.indexOf(".")).trim();

        console.log("problem number", problemNumber);

        count++;
        const { answer: fixedAnswer } = await createFlashcard(problemNumber);

        if (!fixedAnswer) {
            delete updated[updated.length - 1];  // This is real bad but i dont care
            continue;
        }
        // console.log(questionContent);
        // console.log(answerContent);
        // console.log(fixedAnswer);

        await updateCard({
            userId,
            courseId,
            pageId,
            questionContent,
            answerContent: fixedAnswer,
            token
        });
    };

    const titleHash = new Map();
    const dups = [...new Set(
        updated.filter(update =>
            titleHash.has(update.title) ? true : titleHash.set(update.title) && false
        ))];

    console.log(`Didnt Update`, updateList.filter(x => !updated.includes(x)));
    console.log(`duplicates ${dups}, length: ${dups.length}`);
    console.log(`Updated ${count}`);
};

const updateCard = async ({
    userId,
    courseId,
    pageId,
    questionContent,
    answerContent,
    token,
}) => {
    const cardUrl = `https://learn.supermemo.com/api/users/${userId}/courses/${courseId}/pages/${pageId}`;

    const questionObject = JSON.stringify({ content: questionContent });
    const answerObject = JSON.stringify({ content: answerContent });

    // Construct the payload
    const payload = {
        question: questionObject,
        answer: answerObject
    };
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`
    };

    try {
        const response = await axios.put(`${cardUrl}?contentType=json`, payload, { headers });
        return response.data;
    } catch (error) {
        console.error('Error updating card:', error);
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(error.response.data);
            console.error(error.response.status);
            console.error(error.response.headers);
        } else if (error.request) {
            // The request was made but no response was received
            console.error(error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
        }
        throw error;
    }
};

updateCourse(userId, courseId, token, COURSE_FILENAME).then(() => {
    console.log("done");
});
