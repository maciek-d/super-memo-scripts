import fs from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readFilePath = path.join(__dirname, 'data.txt');
const writeFilePath = path.join(__dirname, 'output.txt');
const problemsDataFilePath = path.join(__dirname, '../../data/CS/leetcode/array_problems_data.js');
const processedFilePath = path.join(__dirname, './processed.js');

async function main() {
    try {
        const data = await fs.readFile(processedFilePath, 'utf8');
        await processFile(data);
    } catch (err) {
        console.error('Error reading processed titles file:', err);
        await processFile();
    }
}

main().then();

async function processFile(processedTitlesData = '[]') {
    let data, problemsDataString, problemsData, summariesData, descriptionsData;
    let sections, summaries, descriptions, mergedData, formattedMergedData;

    const processedTitles = eval(processedTitlesData);

    try {
        data = await fs.readFile(readFilePath, 'utf8');
        sections = data.split('\n\n').filter(section => section.includes('|'));
        summariesData = sections[0];
        descriptionsData = sections[1];

        problemsDataString = await fs.readFile(problemsDataFilePath, 'utf8');
        problemsData = JSON.parse(problemsDataString);

        summaries = parseMarkdownTable(summariesData);
        descriptions = parseMarkdownTable(descriptionsData);

        mergedData = mergeData(summaries, descriptions, problemsData);
        formattedMergedData = formatAsSimpleText(mergedData);

        await fs.writeFile(writeFilePath, formattedMergedData, 'utf8');
        console.log('Data successfully written to output.txt');

        await fs.writeFile(processedFilePath, `${JSON.stringify(processedTitles, null, 4)};`, 'utf8');
        console.log('Processed titles updated in processed.js');
    } catch (err) {
        console.error('Error:', err);
    }
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
        return description.substring(summaryTitle.length).replace(" - ", "");
    }
    return description;
}

function mergeData(summaries, descriptions, problemsData) {
    return summaries.map((summary, index) => {
        const title = extractTitle(summary.question);
        if (processedTitles.includes(title)) {
            console.log(`Skipping already processed title: ${title}`);
            return null;
        }

        const description = descriptions[index];

        const problemData = problemsData.find((data) => {
            return data.title === title;
        });
        if (!problemData) {
            console.error(`Couldnt find title: ${title}`);
            return null;
        }
        const linkedTitle = linkifyTitle(summary.question, problemData.problemLink);
        const linkedAnswer = linkifyAnswer(summary.answer, problemData.solutionLink);
        const cleanedDescription = removeDuplicateTitle(summary.question, description.question.trim());

        const question = `${linkedTitle} — ${cleanedDescription} — <div><a href="${problemData.solutionsUrl}" target="_blank">[1]</a></div>`;
        const { algorithm, detailedDescription } = extractAlgorithmData(description.answer.trim());

        const answerShort = linkedAnswer.split("</a>").slice(1).join("</a>");
        const answerLink = linkedAnswer.split("</a>")[0] + "</a>";
        const answer = `${answerLink} — ${algorithm}${answerShort} — ${detailedDescription}`;

        console.log("Processed Question:", question);
        console.log("Processed Answer:", answer);

        processedTitles.push(title);
        return { question, answer };
    }).filter(item => item !== null);
}

function extractAlgorithmData(detailedAnswer) {
    const algorithm = replaceMarkdownBoldWithHTML(detailedAnswer.split(' — ')[0]);
    const detailedDescription = detailedAnswer.split(' — ').slice(1).join(" — ");
    return { algorithm, detailedDescription };
}

function extractTitle(question) {
    const title = question.split(' — ')[0].replace(/\*\*/g, '').trim();
    return title;
}

function formatAsSimpleText(data) {
    let text = '';
    data.forEach(item => {
        if (item) {
            text += `${item.question}\n\n${item.answer}\n\n--\n`;
        }
    });
    return text;
}
