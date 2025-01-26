import { extractAnswerSections } from "./fileUtils.js";

export function extractAnswer({
    solutionUrls,
    gptResponse,
    language
}) {
    const { solutionsUrl1, solutionsUrl2 } = solutionUrls
    const sections = extractAnswerSections(gptResponse, language)

    // Format the answer string
    const answer =
        `<b><a href="${solutionsUrl1}" class="memkey-link" >${sections.trick}</a></b>
<div class="text-container"><br/>${sections.solution}<br/><br/></div>
<div>${sections.code}</div>
<div>${sections.steps}</div>
<div class="text-container">
    <div>${sections.code2}</div>
    <div>${sections.steps2}</div>
    <a href="${solutionsUrl2}" class="memkey-link" ><div>[1]</div></a>
    <div>${sections.solution2}</div>
</div>
<div><br/>${sections.DAS}<br/><br/></div>
<div class="text-container"><br/>${sections.complexity}</div>`

    return answer;
}

export const extractFirstNumber = (str) => {
    const result = str.match(/\d+/); // Regular expression to find numbers
    return result ? parseInt(result[0]) : null; // Parse the first found number
}

export function questionTemplate({
    youtubeUrls,
    solutionUrls,
    descriptionSections,
    questionSections
}) {
    const { solutionsUrl1, solutionsUrl2 } = solutionUrls

    let { summary, description, bestIoExample } = questionSections

    const { youtubeUrl, youtubeUrlLang } = youtubeUrls
    let { ioExamples, constraints } = descriptionSections
    ioExamples = modifyImagesInPlace(ioExamples)
    bestIoExample = modifyImagesInPlace(bestIoExample)
    summary = modifyImagesInPlace(summary)
    description = modifyImagesInPlace(description)

    const question =
`<div>${summary}</div>
<div class="text-container"><br/>${description}<br/><br/></div>
<div>${bestIoExample}</div>
<div class="text-container"><br/>${ioExamples}<br/></div>
<div class="text-container"><br/>${constraints}<br/></div>
<span>
    <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="25" viewBox="0 0 48 48">
        <a href="${youtubeUrl}" class="memkey-link">
        <path fill="#FF3D00" d="M43.2,33.9c-0.4,2.1-2.1,3.7-4.2,4c-3.3,0.5-8.8,1.1-15,1.1c-6.1,0-11.6-0.6-15-1.1c-2.1-0.3-3.8-1.9-4.2-4C4.4,31.6,4,28.2,4,24c0-4.2,0.4-7.6,0.8-9.9c0.4-2.1,2.1-3.7,4.2-4C12.3,9.6,17.8,9,24,9c6.2,0,11.6,0.6,15,1.1c2.1,0.3,3.8,1.9,4.2,4c0.4,2.3,0.9,5.7,0.9,9.9C44,28.2,43.6,31.6,43.2,33.9z"></path><path fill="#FFF" d="M20 31L20 17 32 24z"></path>
    </svg></a>
    JS: <a href="${youtubeUrlLang}" class="memkey-link">
        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="25" viewBox="0 0 48 48">
        <path fill="#FF3D00" d="M43.2,33.9c-0.4,2.1-2.1,3.7-4.2,4c-3.3,0.5-8.8,1.1-15,1.1c-6.1,0-11.6-0.6-15-1.1c-2.1-0.3-3.8-1.9-4.2-4C4.4,31.6,4,28.2,4,24c0-4.2,0.4-7.6,0.8-9.9c0.4-2.1,2.1-3.7,4.2-4C12.3,9.6,17.8,9,24,9c6.2,0,11.6,0.6,15,1.1c2.1,0.3,3.8,1.9,4.2,4c0.4,2.3,0.9,5.7,0.9,9.9C44,28.2,43.6,31.6,43.2,33.9z"></path><path fill="#FFF" d="M20 31L20 17 32 24z"></path>
    </svg></a>
    Solutions:
        <a href="${solutionsUrl1}" class="memkey-link">[1]</a><br/>
        <a href="${solutionsUrl2}" class="memkey-link">[2]</a>
</span>`;
    return question
}

function extractImageTags(sourceText) {
    const imgTagRegex = /<img [^>]*src="([^"]*)"[^>]*>/g;
    const imgTags = sourceText.match(imgTagRegex);

    // surround images with a tag and add resize-image class
    if (imgTags) {
        const modifiedImgTags = imgTags.map(tag => {
            const srcMatch = tag.match(/src="([^"]*)"/);
            if (srcMatch) {
                const src = srcMatch[1];
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

export function extractSolutionImages(
    solutions, gptSolutionIndex, gptSolutionIndex2
) {
    const solution = solutions[gptSolutionIndex]
    const solution2 = solutions[gptSolutionIndex2]

    const solutionImages = extractImageTags(solution)
    const solutionImages2 = extractImageTags(solution2)

    return [solutionImages, solutionImages2]
}

