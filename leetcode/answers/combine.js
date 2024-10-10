
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readFilePath = path.join(__dirname, 'data.txt');
const writeFilePath = path.join(__dirname, 'output.json');
const problemsDataFilePath = path.join(__dirname, '../../data/CS/leetcode/array_problems_data.js');

function formatAsJSON(data) {
    return JSON.stringify(data, null, 2);
}

function parseMarkdownTable(data) {
    const rows = data.split('\n').filter(row => row.includes('|') && !row.includes('---'));
    return rows.map(row => {
        const cells = row.split('|').map(cell => cell.trim());
        return {
            question: cells[1],
            answer: cells[2]
        };
    }).slice(1);
}

function replaceMarkdownBoldWithHTML(data) {
    let isBold = false;
    return data.replace(/\*\*/g, () => {
        isBold = !isBold;
        return isBold ? '<b>' : '</b>';
    });
}


function linkifyAnswer(data, link) {
    const index = data.indexOf(" - ");
    if (index === -1) {
        return `<a href="${link}" target="_blank">${replaceMarkdownBoldWithHTML(data)}</a>`;
    } else {
        const partBeforeHyphen = data.substring(0, index);
        const rest = data.substring(index);
        return `<a href="${link}" target="_blank">${replaceMarkdownBoldWithHTML(partBeforeHyphen)}</a>${replaceMarkdownBoldWithHTML(rest)}`;
    }
}

function linkifyTitle(data, link) {
    const boldedData = replaceMarkdownBoldWithHTML(data);
    const index = boldedData.indexOf(".");
    if (index === -1) {
        return `<a href="${link}" target="_blank">${boldedData}</a>`;
    } else {
        const partBeforeSeparator = replaceMarkdownBoldWithHTML(data.substring(0, index));
        const rest = data.substring(index);
        const formattedLink = partBeforeSeparator.replace("<b>", `<b><a href="${link}" target="_blank">`);
        return `${formattedLink}</a>${replaceMarkdownBoldWithHTML(rest)}`;
    }
}

function removeDuplicateTitle(summary, description) {
    const summaryTitle = summary.split(' - ')[0];
    if (description.startsWith(summaryTitle)) {
        // Remove duplicate title from description
        return description.substring(summaryTitle.length).replace(" - ", "");
    }
    return description;
}

function mergeData(summaries, descriptions, problemsData) {
    return summaries.map((summary, index) => {
        const description = descriptions[index];
        const problemData = problemsData[index];

        const linkedTitle = linkifyTitle(summary.question, problemData.problemLink,);
        const linkedAnswer = linkifyAnswer(summary.answer, problemData.solutionLink,);

        const cleanedDescription = removeDuplicateTitle(summary.question, description.question.trim());

        const question = `${linkedTitle} - ${cleanedDescription} - <div><a href="${problemData.solutionsUrl}" target="_blank">[1]</a></div>`;
        const { algorithm, detailedDescription } = extractAlgorithmData(description.answer.trim());

        const answerShort = linkedAnswer.split("</a>").slice(1).join("</a>");
        const answerLink = linkedAnswer.split("</a>")[0] + "</a>";
        const answer = `${answerLink} - ${algorithm}${answerShort} - ${detailedDescription}`;

        console.log("Processed Question:", question);
        console.log("Processed Answer:", answer);

        return { question, answer };
    });
}

function extractAlgorithmData(detailedAnswer) {
    const algorithm = replaceMarkdownBoldWithHTML(detailedAnswer.split(' - ')[0]);
    const detailedDescription = detailedAnswer.split(' - ').slice(1).join(" - ");
    return { algorithm, detailedDescription };
}



fs.readFile(readFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    const sections = data.split('\n\n').filter(section => section.includes('|'));
    const summariesData = sections[0];
    const descriptionsData = sections[1];

    fs.readFile(problemsDataFilePath, 'utf8', (err, problemsDataString) => {
        if (err) {
            console.error('Error reading problems data file:', err);
            return;
        }

        const problemsData = JSON.parse(problemsDataString);

        const summaries = parseMarkdownTable(summariesData);
        const descriptions = parseMarkdownTable(descriptionsData);

        const mergedData = mergeData(summaries, descriptions, problemsData);

        const formattedMergedData = formatAsJSON(mergedData);

        fs.writeFile(writeFilePath, formattedMergedData, 'utf8', (err) => {
            if (err) {
                console.error('Error writing file:', err);
                return;
            }
            console.log('Data successfully written to output.txt in JSON format');
        });
    });
});
