
import fs from 'fs';
import path from 'path';
import { getCourse } from "./helpers/course.js";

import config from "./helpers/import_env.js";
config();

const FILENAME = "Leetcode.json"; // DONT FORGET TO UPDATE
const env_prefix = "LEETCODE_"; // DONT FORGET TO UPDATE: GEO_IMG_ LEETCODE_
const env_user_prefix = "";
const userId = process.env?.[`${env_user_prefix}USER_ID`];
const token = process.env?.[`${env_user_prefix}SUPER_MEMO_TOKEN`];
const courseId = process.env?.[`${env_prefix}COURSE_ID`];

async function download(userId, courseId, token, filename) {
    const course = await getCourse(userId, courseId, token);
    // Write data to the file
    const filePath = path.resolve(`./helpers/${filename}`);
    fs.writeFileSync(filePath, JSON.stringify(course, null, 4));
    // console.log(course);

    // const questionJsonString = course.map((qa) => {
    //     return JSON.parse(qa.content.question).content;
    // });
    // question: '{"content":"<a href=\\"http://www.geohints.com/Sources/Signs/Numbers/estonia_4.jpg\\" target=\\"_blank\\"><img src=\\"http://www.geohints.com/Sources/Signs/Numbers/estonia_4.jpg\\" alt=\\"estonia_4.jpg\\" /></a>"}'

    // loop through all files Poles.json, RoadNumbering.json, Bollards.json

    // CODE FOR FINDING MISSING CARDS
    // const files = ["Poles", "RoadNumbering", "Bollards"];
    // const missing = [];

    // for (const file of files) {
    //     const filePath = `./data/${file}.json`;
    //     const contents = readFileSync(filePath);
    //     for (const content of JSON.parse(contents)) {
    //         const exists = questionJsonString.some((str) => str == content.question);
    //         if (!exists) missing.push(content);
    //     }
    // }

    // console.log(missing.length);

    // fs.writeFileSync(`./data/${filename}.json`, JSON.stringify(missing, null, 4));
}


download(userId, courseId, token, FILENAME).then(() => {
    console.log("done");
});