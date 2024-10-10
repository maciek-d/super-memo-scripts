import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const TAG = "array";
const __dirname = dirname(fileURLToPath(import.meta.url));

const addResponse = async (title) => {
    const filePath = path.join(__dirname, 'gpt_responses.json');

    try {
        let responses = [];

        try {
            // Try reading the existing file
            const data = await fs.readFile(filePath, 'utf8');
            responses = JSON.parse(data);
        } catch (error) {
            // If the file doesn't exist, initialize an empty array
            if (error.code === 'ENOENT') {
                console.log('File not found. A new file will be created.');
            } else {
                throw error; // Re-throw other errors
            }
        }

        // Check if the array contains an object with the same title
        if (!responses.some(res => res.title === title)) {
            // Append the new object
            const response = await fs.readFile(path.join(__dirname, 'response.txt'), 'utf8');
            const responseAlreadyExists = responses.some(res => res.response === response);
            if (!response || responseAlreadyExists) {
                return "";
            }

            responses.push({ title, response });

            // Write the updated array back to the file
            await fs.writeFile(filePath, JSON.stringify(responses, null, 2));
            return response;
        } else {
            console.log(`A response with the same title already exists.`);
            return responses.find(response => response.title === title)?.response;
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
};

export async function createFlashcard(leetcodeId = null) {
    // Read the latest title from processedTitles.json
    const processedTitles = JSON.parse(await fs.readFile(path.join(__dirname, './processedTitles.json'), 'utf8'));
    const foundTitle = processedTitles.findLast(title => title.includes(leetcodeId));
    const titleToProcess = leetcodeId ? foundTitle : processedTitles[processedTitles.length - 1];

    // Read the problems data to get additional information
    const problems = JSON.parse(await fs.readFile(path.join(__dirname, `../../data/CS/leetcode/new/${TAG}_problems_data.js`), 'utf8'));
    const problemData = problems.find(p => p.title === titleToProcess);

    // Read the response from response.txt

    const response = await addResponse(titleToProcess);
    if (!response) {
        console.log("Couldnt process flashcard, same response exists or empty response");
        return { question: "", answer: "" };
    }
    const cleanedResponse = response
        .replaceAll("&lt;", "＜")
        .replaceAll("&gt;", "＞")
        .replace(/<(?!img|\/img)/gi, '＜');


    // Extract information from response and problem data
    const question = (await createQuestionString(cleanedResponse, problemData)).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');;
    const answer = createAnswerString(cleanedResponse, problemData, leetcodeId).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');;

    const flashcard = { title: titleToProcess, question, answer };

    // Append to flashcards.js
    let flashcards = [];
    try {
        flashcards = JSON.parse(await fs.readFile(path.join(__dirname, 'flashcards.js'), 'utf8'));
        const existingIndex = flashcards.findLastIndex(f => f.title === flashcard.title);

        if (existingIndex !== -1) {
            // Replace existing flashcard
            flashcards[existingIndex] = flashcard;
        } else {
            // Add new flashcard
            flashcards.push(flashcard);
        }
    } catch (error) {
        // File might not exist yet, it's okay
        flashcards.push(flashcard);
    }

    await fs.writeFile(path.join(__dirname, 'flashcards.js'), JSON.stringify(flashcards, null, 2));

    // Manual Processing
    // if (flashCardId) {
    //     console.log(`${flashcard.question}\n\n${flashcard.answer}`);
    // }
    return { question: flashcard.question, answer: flashcard.answer };
}


const extractFirstNumber = (str) => {
    const result = str.match(/\d+/); // Regular expression to find numbers
    return result ? parseInt(result[0]) : null; // Parse the first found number
};

async function createQuestionString(response, problemData) {
    // Extract sections from response
    const summaryMatch = extractSection(response, "Summary");
    const description = extractSection(response, "Description");
    const ioMatch = extractSection(response, "I\/O");


    const summary = appendImages(problemData.problem, summaryMatch);
    const io = ioMatch ? ioMatch.replace("Example:", "").replaceAll("\\[", "[").replaceAll("\n", "<br/>") : '';

    // Get additional data from problemData
    const problemLink = problemData.problemLink;
    const solutionsUrl = problemData.solutionsUrl;

    const examples = problemData.examples.trim().replaceAll("\n", "<br/>");
    const constraints = problemData.constraints.trim().replaceAll("\n", "<br/>");

    const problemNumber = extractFirstNumber(problemData.title);
    // Format the question string
    const question = `<style>
    /* ${problemNumber}. */
    .text-container {
      cursor: pointer;
      max-width: 20px;
      white-space: normal; /* Allow the text to wrap */
      overflow: hidden;
      position: relative;
      line-height: 1.4; /* Adjust for better readability */
      transition: max-width 0.3s ease-in-out, max-height 0.3s ease-in-out; /* Smooth transition for expanding */
      max-height: 1.4em; /* Set to line height to show only the first line */
    }
    .text-container::after {
      content: '  ...  ';
      position: absolute;
      right: 0;
      bottom: 0;
      color: #d5d5d5;
      background:  #f0f0f0;
      width: 100%;
      text-align: right;
    }
    .text-container:hover {
      max-width: 350px; /* Adjust as needed for hover */
      max-height: none; /* Allow it to expand to fit content */
    }
    .text-container:hover::after {
      display: none; /* Hide the ellipsis on hover */
    }
    a:link, a:visited {
        color: black;
    }
    resize-img. {
        max-height:450px;
        min-width:350px;
        width:auto;
        display:block;
        margin:auto;
        background-color: #131516;
    }
  </style>
<span><b><a href="${problemLink}">${problemData.title}</a></b></span>
<div>${summary}</div>
<div class="text-container"><br/>${description}<br/><br/></div>
<div>${io}</div>
<div class="text-container"><br/>${examples}<br/></div>
<div class="text-container"><br/>${constraints}<br/></div>
<span>
<a href="${problemData.youtubeUrl}"><svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="25" viewBox="0 0 48 48">
<path fill="#FF3D00" d="M43.2,33.9c-0.4,2.1-2.1,3.7-4.2,4c-3.3,0.5-8.8,1.1-15,1.1c-6.1,0-11.6-0.6-15-1.1c-2.1-0.3-3.8-1.9-4.2-4C4.4,31.6,4,28.2,4,24c0-4.2,0.4-7.6,0.8-9.9c0.4-2.1,2.1-3.7,4.2-4C12.3,9.6,17.8,9,24,9c6.2,0,11.6,0.6,15,1.1c2.1,0.3,3.8,1.9,4.2,4c0.4,2.3,0.9,5.7,0.9,9.9C44,28.2,43.6,31.6,43.2,33.9z"></path><path fill="#FFF" d="M20 31L20 17 32 24z"></path>
</svg></a>
JS: <a href="${problemData.youtubeUrlJs}"><svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="25" viewBox="0 0 48 48">
<path fill="#FF3D00" d="M43.2,33.9c-0.4,2.1-2.1,3.7-4.2,4c-3.3,0.5-8.8,1.1-15,1.1c-6.1,0-11.6-0.6-15-1.1c-2.1-0.3-3.8-1.9-4.2-4C4.4,31.6,4,28.2,4,24c0-4.2,0.4-7.6,0.8-9.9c0.4-2.1,2.1-3.7,4.2-4C12.3,9.6,17.8,9,24,9c6.2,0,11.6,0.6,15,1.1c2.1,0.3,3.8,1.9,4.2,4c0.4,2.3,0.9,5.7,0.9,9.9C44,28.2,43.6,31.6,43.2,33.9z"></path><path fill="#FFF" d="M20 31L20 17 32 24z"></path>
</svg></a>
Solutions:<a href="${solutionsUrl}">[1]</a></span>`;

    return question;
}

function createAnswerString(response, problemData, leetcodeId) {
    // Extract sections from response
    const algo = extractSection(response, "Algo\/Datastructure");
    const steps = extractSection(response, "Enumerated Steps");
    const solution = extractSection(response, "Solution");
    const complexity = extractSection(response, "Time Complexity");


    const altCode = extractSection(response, "Alternative Code") || extractSection(response, "Alternative Solution") || extractSection(response, "Generated Code");
    const code = extractSection(response, "Code");
    if (!altCode) console.log(`count find alt code for ${leetcodeId}`);

    const solutionLink = problemData.solutionLink;
    // Format the answer string
    const answer = `<b><a href="${solutionLink}">${algo}</a></b>
<div class="text-container"><br/>${solution}<br/><br/></div>
<div>${code}</div>
<div>${steps}</div>
<div class="text-container"><br/>${altCode}<br/><br/></div>
<div class="text-container"><br/>${complexity}</div>`;

    return answer;
}

function stripCodeBlocks(text) {
    return text.replace(/```javascript\n([\s\S]*?)\n```/g, (_match, p1) => {
        // Replace spaces at the start of each line within the code block
        const replaced = p1.replace(/^ +/gm, (spaces) => spaces.replace(/ /g, '&nbsp;'));
        return replaced;
    });
}

function extractSection(text, sectionTitle) {
    const lines = text.split('\n');
    let capturing = false;
    let section = [];
    const headerRegexHash = new RegExp(`^#+ ${sectionTitle}`, 'i');
    const headerRegexAsterisks = new RegExp(`^\\*\\*${sectionTitle}.?\\*\\*`, 'i');

    const hashTitleExists = lines.some(line => headerRegexHash.test(line.trim()));

    const sectionHeaderRegex = hashTitleExists ? headerRegexHash : headerRegexAsterisks;
    for (const line of lines) {
        // Check for start of the section
        if (sectionHeaderRegex.test(line.trim())) {
            capturing = true;
            continue;
        }

        // Check for end of the section (next header starting with ##)
        if (section.length !== 0 && capturing && line.trim().startsWith('##')) {
            break;
        }

        if (capturing) {
            section.push(line);
        }
    }
    const DO_NOT_LOG = ["Alternative Solution", "Alternative Code", "Generated Code"];

    if (section.length === 0 && !DO_NOT_LOG.includes(sectionTitle)) {
        console.log("couldnt find blocks for section", sectionTitle);
    }
    return stripCodeBlocks(section.join('\n').trim()).replaceAll("\n", "<br/>");
}

function appendImages(sourceText, targetText) {
    const imgTagRegex = /<img [^>]*src="[^"]*"[^>]*>/g;
    const imgTags = sourceText.match(imgTagRegex);

    if (imgTags) {
        return targetText + imgTags.join('');
    }
    return targetText;
}

const filePathFromMeta = decodeURIComponent(new URL(import.meta.url).pathname);
const isMain = filePathFromMeta === process.argv[1];

if (isMain) {
    // createFlashcard(980).catch(console.error);
}
