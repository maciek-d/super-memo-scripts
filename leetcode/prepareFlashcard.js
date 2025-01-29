import { extractAnswerSections } from "./fileUtils.js";

function replaceNewLinesWithBrTags(sections) {

}

export function extractAnswer({
    solutionUrls,
    gptResponse,
    language
}) {
    const { solutionsUrl1, solutionsUrl2 } = solutionUrls
    const sections = extractAnswerSections(gptResponse, language)

    replaceNewLinesWithBrTags(sections)
    // Format the answer string
    const answer =
        `<b><a href="${solutionsUrl1}" class="memkey-link" >${sections.trick}</a></b>
<div class="memkey-hide"><br/>${sections.solution}<br/><br/></div>
<div>${sections.code}</div>
<div>${sections.steps}</div>
<div class="memkey-hide">
    <div>${sections.code2}</div>
    <div>${sections.steps2}</div>
    <a href="${solutionsUrl2}" class="memkey-link" ><div>[1]</div></a>
    <div>${sections.solution2}</div>
</div>
<div><br/>${sections.DAS}<br/><br/></div>
<div class="memkey-hide"><br/>${sections.complexity}</div>`

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
    questionSections,
    language
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
<div class="memkey-hide"><br/>${description}<br/><br/></div>
<div>${bestIoExample}</div>
<div class="memkey-hide"><br/>${ioExamples}<br/></div>
<div class="memkey-hide"><br/>${constraints}<br/></div>
<span>
  <span>
    <a href="${youtubeUrl}" >
    <img src="https://memkey.s3.us-west-1.amazonaws.com/media/images/youtube_32.png"/>
    </a>
    ${language}: <a href="${youtubeUrlLang}" >
    <img src="https://memkey.s3.us-west-1.amazonaws.com/media/images/youtube_32.png"/>
    </a>
  </span>
  <span>
    Solutions:
    <a href="${solutionsUrl1}" class="memkey-link">[1]</a><br/>
    <a href="${solutionsUrl2}" class="memkey-link">[2]</a>
  </span>
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

