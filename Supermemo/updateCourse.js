import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import jsdom from 'jsdom';
import path from 'path';
import { getCourse } from "../helpers/course.js";
import config from "../helpers/import_env.js";
config();

// DONT FORGET TO UPDATE
const env_user_prefix = "";
const env_prefix = "GEO_IMG_"; //NUMBERS_
const userId = process.env?.[`${env_user_prefix}USER_ID`];
const token = process.env?.[`${env_user_prefix}SUPER_MEMO_TOKEN`];
const courseId = process.env?.[`${env_prefix}COURSE_ID`];

// Update next consts then run
const COURSE_FILENAME = "./data/geogussr/courses/GeoImages.json";
const USE_CACHE = true;
const MAP_FILENAME = "./data/learning and memory/cache/numbers.json";
const BASE_URL = 'https://public.fotki.com/GeogussrLearning/numbers-small/?show=all';

const updateCourse = async (userId, courseId, token, courseName) => {
    const course = await getCourse(userId, courseId, token, courseName, USE_CACHE);
    console.log("course should be object", typeof course);

    const filePath = path.resolve(`${courseName}`);
    // const mapFilePath = path.resolve(`${MAP_FILENAME}`);
    writeFileSync(filePath, JSON.stringify(course, null, 4));

    // const updateList = await getMapImageUrlAndTitles(BASE_URL, mapFilePath);
    // writeFileSync(mapFilePath, JSON.stringify(updateList, null, 4));


    const updateList = [... new Set([
        "https://images15.fotki.com/v1685/photos/5/4180775/16588561/botswana2-th.jpg",
        "https://images49.fotki.com/v1679/photos/5/4180775/16588561/canada8-th.jpg",
        "https://images12.fotki.com/v1686/photos/5/4180775/16588561/united_states-th.jpg",
        "https://images12.fotki.com/v1686/photos/5/4180775/16588561/lesotho-th.jpg",
        "https://images12.fotki.com/v1681/photos/5/4180775/16588561/italy4-th.jpg",
        "https://images12.fotki.com/v1686/photos/5/4180775/16588561/canada9-th.jpg",
        "https://images49.fotki.com/v1680/photos/5/4180775/16588561/greece2-th.jpg",
        "https://images14.fotki.com/v1689/photos/5/4180775/16588561/czech_republic2-th.jpg",
        "https://images49.fotki.com/v1680/photos/5/4180775/16588561/chile-th.jpg",
        "https://images12.fotki.com/v1686/photos/5/4180775/16588561/ghana-th.jpg",
        "https://images34.fotki.com/v1690/photos/5/4180775/16588561/monaco-th.jpg",
        "https://images20.fotki.com/v1684/photos/5/4180775/16588561/united_states2-th.jpg",
        "https://images49.fotki.com/v1679/photos/5/4180775/16588561/sweden4-th.jpg",
        "https://images20.fotki.com/v1684/photos/5/4180775/16588561/canada10-th.jpg",
        "https://images49.fotki.com/v1679/photos/5/4180775/16588561/israel4-th.jpg",
        "https://images34.fotki.com/v1690/photos/5/4180775/16588561/ukraine2-th.jpg",
        "https://images12.fotki.com/v1686/photos/5/4180775/16588561/malaysia3-th.jpg",
        "https://images15.fotki.com/v1685/photos/5/4180775/16588561/botswana2-th.jpg",
        "https://images49.fotki.com/v1679/photos/5/4180775/16588561/canada8-th.jpg",
        "https://images12.fotki.com/v1686/photos/5/4180775/16588561/united_states-th.jpg",
        "https://images12.fotki.com/v1686/photos/5/4180775/16588561/lesotho-th.jpg",
        "https://images12.fotki.com/v1681/photos/5/4180775/16588561/italy4-th.jpg",
        "https://images12.fotki.com/v1686/photos/5/4180775/16588561/canada9-th.jpg",
        "https://images49.fotki.com/v1680/photos/5/4180775/16588561/greece2-th.jpg",
        "https://images14.fotki.com/v1689/photos/5/4180775/16588561/czech_republic2-th.jpg",
        "https://images49.fotki.com/v1680/photos/5/4180775/16588561/chile-th.jpg",
        "https://images12.fotki.com/v1686/photos/5/4180775/16588561/ghana-th.jpg",
        "https://images34.fotki.com/v1690/photos/5/4180775/16588561/monaco-th.jpg",
        "https://images20.fotki.com/v1684/photos/5/4180775/16588561/united_states2-th.jpg",
        "https://images49.fotki.com/v1679/photos/5/4180775/16588561/sweden4-th.jpg",
        "https://images20.fotki.com/v1684/photos/5/4180775/16588561/canada10-th.jpg",
        "https://images49.fotki.com/v1679/photos/5/4180775/16588561/israel4-th.jpg",
        "https://images34.fotki.com/v1690/photos/5/4180775/16588561/ukraine2-th.jpg",
    ])];


    console.log(`updating ${updateList.length}`);
    let count = 0;

    let updated = [];
    for (const card of course) {
        const pageId = card.number;
        const question = card.content.question;
        const answer = card.content.answer;

        let questionContent = JSON.parse(question)?.content;
        let answerContent = JSON.parse(answer)?.content;

        // const foundUpdate = questionContent.includes('https://images20.fotki.com/v1684/photos/5/4180775/16588561/Indonesia2-vi.png');

        // console.log(Number(questionContent));


        const foundUpdate = updateList.find(update => {
            if (questionContent.includes(update)) updated.push(update);
            return questionContent.includes(update);
        });
        // const foundUpdate = updateList.find(update => Number(update[0]) === Number(questionContent));

        if (foundUpdate) {
            count++;
            const mapUrl = foundUpdate[1];

            // console.log(mapUrl);
            // answerContent = `<a href="${mapUrl}" target="_blank"><img src="${mapUrl}" style="max-height:450px;display:block;margin:auto;" alt="${foundUpdate[0]}" /></a><div>${answerContent}</div>`;

            // console.log(questionContent);
            // console.log(answerContent);
            // await updateCard({
            //     userId,
            //     courseId,
            //     pageId,
            //     questionContent,
            //     answerContent,
            //     token
            // });
        }
        // if (questionObj.content.includes('Sources/Signs/Pedestrian')
        //     && (questionObj.content.includes('guam') || questionObj.content.includes('guatemala.svg'))
        // ) {
        //     let questionContent = questionObj.content;
        //     let answerContent = JSON.parse(answer).content;
        //     console.log(questionObj.content);
        //     await updateCard({
        //         userId,
        //         courseId,
        //         pageId,
        //         questionContent,
        //         answerContent,
        //         token
        //     });
        // }

        // if (questionObj.content.includes('Sources/Signs/Pedestrian') &&
        //     !questionObj.content.includes('style="max-height:450px;min-width:350px;margin:auto;"')
        // ) {
        //     const imgRegex = /(\<img[^>]+src="[^"]+")/g;

        //     questionObj.content = questionObj.content.replace(
        //         imgRegex,
        //         `$1 style="max-height:450px;min-width:350px;margin:auto;"`
        //     );

        //     // Serialize the object back to a JSON string
        //     let questionContent = questionObj.content;
        //     let answerContent = JSON.parse(answer).content;
        //     console.log(questionContent);


        //     // Uncomment the following to perform the update
        //     // await updateCard({
        //     //     userId,
        //     //     courseId,
        //     //     pageId,
        //     //     questionContent,
        //     //     answerContent,
        //     //     token
        //     // });
        // }
    }
    console.log(`Didnt Update`, updateList.filter(x => !updated.includes(x)));
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

async function getMapImageUrlAndTitles(url, mapFilePath) {
    try {
        const fetchedData = readFileSync(mapFilePath);
        if (fetchedData) return JSON.parse(fetchedData);
    } catch (readError) {
        // If the file does not exist, proceed to fetch from the API
        if (readError.code !== 'ENOENT') {
            throw readError; // Rethrow error if it's not 'File not found'
        }
    }
    try {

        const { JSDOM } = jsdom;
        const response = await axios.get(url);
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        // Select all <a> tags with a title attribute
        const aTagsWithTitle = document.querySelectorAll('a[title]');

        // Extract the title and src attribute of all <img> tags within those <a> tags
        const titlesAndSources = Array.from(aTagsWithTitle).map(aTag => {
            const imgTag = aTag.querySelector('img');
            if (!imgTag) return null;

            const imgUrl = imgTag.src;
            // filter out common images
            if (imgUrl.endsWith('icon-premium-small.gif') || imgUrl.endsWith('bigavatar.jpg')) {
                return null;
            }

            return imgTag ? [aTag.title, imgTag.src] : null;
        }).filter(item => item !== null); // Filter out any null values

        return titlesAndSources;
    } catch (error) {
        console.error('Error occurred while fetching titles and image sources:', error);
        return [];
    }
}


updateCourse(userId, courseId, token, COURSE_FILENAME).then(() => {
    console.log("done");
});
