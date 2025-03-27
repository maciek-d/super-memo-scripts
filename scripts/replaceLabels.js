import fs from 'fs'
import path from 'path'
import {
    DynamoDBClient,
    QueryCommand,
    UpdateItemCommand,
    GetItemCommand
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import readline from 'readline'
// Figure out what flashcard is broken and place above to run
// Check if this script will double anythign before running
// GO TO TODO to continue

function removePreviousBackOnce(text, backContent) {
    if (!backContent?.trim()) return text

    const trimmedBack = backContent.trim()
    const lastIndex = text.lastIndexOf(trimmedBack)

    if (lastIndex === -1) return text

    return text.slice(0, lastIndex) + text.slice(lastIndex + trimmedBack.length)
}

function waitForEnter(promptText = 'Press Enter to continue...') {
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        rl.question(promptText, () => {
            rl.close()
            resolve()
        })
    })
}

const region = 'us-west-1'
const courseId = '114316818461884883239-1740023062738'
const fixedDataPath = path.resolve('../leetcode/data/memkey/fixedFlashcards.js')
const client = new DynamoDBClient({ region })
const fixedFlashcards = JSON.parse(fs.readFileSync(fixedDataPath, 'utf-8'))

async function fetchCourse(courseId, userId) {
    const cmd = new GetItemCommand({
        TableName: 'Courses',
        Key: {
            userId: { S: userId },
            courseId: { S: courseId }
        }
    })
    const res = await client.send(cmd)
    return res.Item ? unmarshall(res.Item) : null
}

async function fetchListsForCourse(courseId) {
    const cmd = new QueryCommand({
        TableName: 'Lists',
        KeyConditionExpression: 'courseId = :cid',
        ExpressionAttributeValues: {
            ':cid': { S: courseId }
        }
    })
    const res = await client.send(cmd)
    return res.Items.map(unmarshall)
}

async function fetchFlashcardsForList(courseId, listId) {
    const cmd = new QueryCommand({
        TableName: 'Flashcards',
        KeyConditionExpression: 'courseId = :cid',
        FilterExpression: 'listId = :lid',
        ExpressionAttributeValues: {
            ':cid': { S: courseId },
            ':lid': { N: String(listId) }
        }
    })
    const res = await client.send(cmd)
    return res.Items.map(unmarshall).sort((a, b) => (a.listIndex ?? 0) - (b.listIndex ?? 0))
}

function getLabelText(labels, listTopicsOptions) {
    const map = Object.fromEntries((listTopicsOptions ?? []).map(opt => [opt.label.trim(), opt.value]))

    return labels.map(label => {
        let text = map[label.trim()] ?? label.trim()
        if (text.endsWith('"')) text = text.slice(0, -1)
        return text.trim()
    }).join('\n').trim()
}

async function updateFlashcard(fc, front, showPreviousBack) {
    const cmd = new UpdateItemCommand({
        TableName: 'Flashcards',
        Key: {
            courseId: { S: fc.courseId },
            flashcardId: { S: fc.flashcardId }
        },
        UpdateExpression: 'SET front = :front, showPreviousBack = :spb',
        ExpressionAttributeValues: {
            ':front': { S: front },
            ':spb': { BOOL: showPreviousBack }
        }
    })
    await client.send(cmd)
}

async function main() {
    const lists = await fetchListsForCourse(courseId)

    for (const list of lists) {
        const listTitle = list.title
        const listId = list.listId

        const fixedEntries = fixedFlashcards[listTitle]
        if (!fixedEntries) continue

        const flashcards = await fetchFlashcardsForList(courseId, listId)

        let lastLabels = []
        let lastBack = null
        for (let i = 0; i < flashcards.length; i++) {

            const fc = flashcards[i]
            if (fc.flashcardId !== "") { // TODO ADD BROKEN HERE
                //console.log("Skippng")
                lastBack = fc.back
                continue
            }


            const fixed = fixedEntries[i]

            const labels = fixed?.topicLabels ?? []
            if (!labels.length) continue

            const topicsText = getLabelText(labels, list.topicsOptions)

            let cleanedFront = fc.front.replace(
                /<div class="memkey-align-left">[\s\S]*?<\/div>\s*/g,
                ''
            ).replace(
                /<div>\s*Solutions:\s*<a\s+href="([^"]+)"[^>]*>\[1\]<\/a>/g,
                `<div><a href="$1" class="memkey-link">Leetcode Solutions</a>`
            )

            let youtubeBaseUrl = null
            if (fc.source?.includes('youtube.com')) {
                try {
                    const url = new URL(fc.source)
                    const videoId = url.searchParams.get('v')
                    if (videoId) {
                        youtubeBaseUrl = `https://www.youtube.com/watch?v=${videoId}`
                    }
                } catch (err) {
                    console.warn('Invalid YouTube URL:', fc.source)
                }
            }

            if (youtubeBaseUrl &&
                cleanedFront.match(/<a href="[^"]+"[^>]*>Leetcode Solutions<\/a>/)
            ) {
                cleanedFront = cleanedFront.replace(
                    /(<a href="[^"]+"[^>]*>Leetcode Solutions<\/a>)/,
                    `$1 &nbsp;|&nbsp; <a href="${youtubeBaseUrl}" class="memkey-link">YouTube Solution</a>`
                )
            }

            const newFront = `${topicsText}\n${removePreviousBackOnce(cleanedFront, lastBack)}`

            const isTransition =
                lastLabels.length !== labels.length ||
                labels.some((label, idx) => label !== lastLabels[idx])

            const showPreviousBack = !isTransition

            //console.log({ labels, front: fc.front, newFront, back: fc.back })
            await updateFlashcard(fc, newFront, showPreviousBack)
            console.log(`✅ updated ${fc.flashcardId} | showPreviousBack=${showPreviousBack}`)

            lastBack = fc.back
            lastLabels = labels
        }
    }

    console.log('✅ Done.')
}

main().catch(console.error)

