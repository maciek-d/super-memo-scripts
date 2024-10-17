export function extractQuestion({
    response, title,
    youtubeUrl, youtubeUrlJs,
    solutionsUrl1, solutionsUrl2,
    constraints, ioExamples, problem,
    imageTag, problemLink
}) {

    const summary = extractSection(response, "Summary")
    const description = extractSection(response, "Description")
    const bestIoExample = extractSection(response, "I\/O")

    ioExamples = modifyImagesInPlace(ioExamples)
    const problemNumber = extractFirstNumber(title);
    const question = questionTemplate({
        problemNumber, title, youtubeUrl, youtubeUrlJs,
        problemLink,
        solutionsUrl1, solutionsUrl2,
        ioExamples, constraints, description, bestIoExample,
        summary: summary + extractImageTags(problem),
        imageTag: `<div>${imageTag}</div>`
    })

    const shortQuestion = questionTemplate({
        problemNumber, title, youtubeUrl, youtubeUrlJs,
        problemLink,
        solutionsUrl1, solutionsUrl2,
        ioExamples, constraints, description, bestIoExample,
        summary: summary + extractImageTags(problem),
        imageTag: ""
    })
    return { question, shortQuestion }
}

export function extractAlgoAnswer({
    response, solutionsUrl1, imageTag
}) {
    const trick = extractSection(response, "Solution Trick")
    const algorithm = extractSection(response, "Problem Algorithm")
    const datastructure = extractSection(response, "Problem Datastructure")
    const DAS = algorithm + " - " + datastructure
    const pitfalls = extractSection(response, "Common Mistakes")
    const edgeCases = extractSection(response, "Edge Cases")
    const intuition = extractSection(response, "Key Intuition")
    const code = extractSection(response, "Primary Solution Code")

    const answer =
        `<b><a href="${solutionsUrl1}">${trick}</a></b>
         <div>${imageTag}</div>
         <div>code</div>
         <div class="text-container"><br/>${code}<br/><br/></div>
         <div>DAS</div>
         <div class="text-container"><br/>${DAS}<br/><br/></div>
         <div>pitfalls</div>
         <div class="text-container"><br/>${pitfalls}<br/><br/></div>
         <div>edge cases</div>
         <div class="text-container"><br/>${edgeCases}<br/><br/></div>
         <div>intuition</div>
         <div class="text-container"><br/>${intuition}<br/><br/></div>
        `

    return answer
}

export function extractAnswer({
    response, solutionsUrl1, solutionsUrl2, solutionImages, solutionImages2
}) {

    // Extract sections from response
    const algorithm = extractSection(response, "Problem Algorithm")
    const datastructure = extractSection(response, "Problem Datastructure")
    const DAS = algorithm + " - " + datastructure
    const code = extractSection(response, "Primary Solution Code");
    const code2 = extractSection(response, "Secondary Solution Code");
    const steps = extractSection(response, "Enumerated Steps 1");
    const steps2 = extractSection(response, "Enumerated Steps 2");
    const solution = extractSection(response, "Solution 1");
    const solution2 = extractSection(response, "Solution 2");
    const complexity = extractSection(response, "Time Complexity");

    // Format the answer string
    const answer =
        `<b><a href="${solutionsUrl1}">${DAS}</a></b>
<div class="text-container"><br/>${solution + solutionImages}<br/><br/></div>
<div>${code}</div>
<div>${steps}</div>
<div class="text-container">
    <div>${code2}</div>
    <div>${steps2}</div>
    <a href="${solutionsUrl2}"><div>[1]</div></a>
    <div>${solution2 + solutionImages2}</div>
</div>
<div class="text-container"><br/>${complexity}</div>`;

    return answer;
}

export function extractSection(text, sectionTitle) {
    const lines = text.split('\n');
    let capturing = false;
    let section = [];
    const headerRegexHash = new RegExp(`^.*#+ ${sectionTitle}`, 'i');
    const headerRegexAsterisks = new RegExp(`^.*\\*\\*${sectionTitle}.?\\*\\*`, 'i');

    const hashTitleExists = lines.some(line => headerRegexHash.test(line.trim()));

    const sectionHeaderRegex = hashTitleExists ? headerRegexHash : headerRegexAsterisks;
    for (const line of lines) {
        // Check for start of the section
        if (sectionHeaderRegex.test(line.trim())) {
            // Account for section text on the same line
            const content = line
                .trim()
                .replace(sectionHeaderRegex, '')
                .trim()
                .replace(/^\s*:\s*/, '')
            if (content) {
                section.push(content)
            }
            capturing = true;
            continue;
        }

        // Check for end of the section (next header starting with ##)
        if (section.length !== 0 && capturing &&
            (
                line.trim().startsWith('##') ||
                (!hashTitleExists && /.*\*\*/.test(line.trim()))
            )
        ) {
            break;
        }

        if (capturing) {
            section.push(line);
        }
    }

    if (section.length === 0) {
        throw new Error(`couldnt find blocks for section ${sectionTitle}`)
    }
    return stripCodeBlocks(section.join('\n').trim())
        .replaceAll("\n", "<br/>")
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
}

export const extractFirstNumber = (str) => {
    const result = str.match(/\d+/); // Regular expression to find numbers
    return result ? parseInt(result[0]) : null; // Parse the first found number
}

function questionTemplate({
    problemNumber,
    title,
    problemLink,
    youtubeUrl, youtubeUrlJs,
    solutionsUrl1, solutionsUrl2,
    ioExamples, constraints, summary, description, bestIoExample,
    imageTag
}) {

    const style = getStyle(problemNumber)
    const question =
        `${style}
<span><b><a href="${problemLink}">${title}</a></b></span>
${imageTag}
<div>${summary}</div>
<div class="text-container"><br/>${description}<br/><br/></div>
<div>${bestIoExample}</div>
<div class="text-container"><br/>${ioExamples}<br/></div>
<div class="text-container"><br/>${constraints}<br/></div>
<span>
    <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="25" viewBox="0 0 48 48">
        <a href="${youtubeUrl}">
        <path fill="#FF3D00" d="M43.2,33.9c-0.4,2.1-2.1,3.7-4.2,4c-3.3,0.5-8.8,1.1-15,1.1c-6.1,0-11.6-0.6-15-1.1c-2.1-0.3-3.8-1.9-4.2-4C4.4,31.6,4,28.2,4,24c0-4.2,0.4-7.6,0.8-9.9c0.4-2.1,2.1-3.7,4.2-4C12.3,9.6,17.8,9,24,9c6.2,0,11.6,0.6,15,1.1c2.1,0.3,3.8,1.9,4.2,4c0.4,2.3,0.9,5.7,0.9,9.9C44,28.2,43.6,31.6,43.2,33.9z"></path><path fill="#FFF" d="M20 31L20 17 32 24z"></path>
    </svg></a>
    JS: <a href="${youtubeUrlJs}">
        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="25" viewBox="0 0 48 48">
        <path fill="#FF3D00" d="M43.2,33.9c-0.4,2.1-2.1,3.7-4.2,4c-3.3,0.5-8.8,1.1-15,1.1c-6.1,0-11.6-0.6-15-1.1c-2.1-0.3-3.8-1.9-4.2-4C4.4,31.6,4,28.2,4,24c0-4.2,0.4-7.6,0.8-9.9c0.4-2.1,2.1-3.7,4.2-4C12.3,9.6,17.8,9,24,9c6.2,0,11.6,0.6,15,1.1c2.1,0.3,3.8,1.9,4.2,4c0.4,2.3,0.9,5.7,0.9,9.9C44,28.2,43.6,31.6,43.2,33.9z"></path><path fill="#FFF" d="M20 31L20 17 32 24z"></path>
    </svg></a>
    Solutions:
        <a href="${solutionsUrl1}">[1]</a><br/>
        <a href="${solutionsUrl2}">[2]</a>
</span>`;
    return question
}

function extractImageTags(sourceText) {
    const imgTagRegex = /<img [^>]*src="([^"]*)"[^>]*>/g;
    const imgTags = sourceText.match(imgTagRegex);

    // surround images with a tag and add resize-image class
    if (imgTags) {
        const modifiedImgTags = imgTags.map(tag => {
            const srcmatch = tag.match(/src="([^"]*)"/);
            if (srcmatch) {
                const src = srcmatch[1];
                return `<a href="${src}" target="_blank"><img class="resize-img" ${tag.slice(4)}</a>`;
            }
            return tag;
        });
        // append image to the end of text
        return modifiedImgTags.join('')
    }
    return ''
}

function modifyImagesInPlace(text) {
    return text.replace(/<img ([^>]*src="[^"]*"[^>]*)>/g, (_match, p1) => {
        const srcMatch = p1.match(/src="([^"]*)"/);
        const src = srcMatch ? srcMatch[1] : '';
        return `<a href="${src}" target="_blank"><img class="resize-img" ${p1}></a>`;
    })
}

export function stripCodeBlocks(text) {
    return text.replace(/```javascript\n([\s\S]*?)\n\s*```/g, (_match, p1) => {
        // Replace spaces at the start of each line within the code block
        const replaced = p1.replace(/^ +/gm, (spaces) => spaces.replace(/ /g, '&nbsp;'));
        return replaced;
    });
}

export function extractSolutionImages(
    solutions, gptSolutionIndex, gptSolutionIndex2
) {
    const solution = solutions[gptSolutionIndex]
    const solution2 = solutions[gptSolutionIndex2]

    const solutionImages = extractImageTags(solution)
    const solutionImages2 = extractImageTags(solution2)

    return [solutionImages, solutionImages2]
}

function getStyle(problemNumber) {
    return `<style>
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
</style>`
}
