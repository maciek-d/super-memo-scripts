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

function getLabelText(labels, topicsMap, fallbackOptions) {
    if (topicsMap) {
        return labels.map(l => topicsMap[l] ?? '').join('\n').trim()
    }

    const map = Object.fromEntries(fallbackOptions.map(opt => [opt.label, opt.value]))
    return labels.map(l => map[l] ?? '').join('\n').trim()
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
    const course = await fetchCourse(courseId, courseId.split('-')[0])
    const fallbackTopics = course?.topicsOptions ?? []
    const lists = await fetchListsForCourse(courseId)

    for (const list of lists) {
        const listTitle = list.title
        const listId = list.listId
        const fixedEntries = fixedFlashcards[listTitle]
        if (!fixedEntries) continue

        const flashcards = await fetchFlashcardsForList(courseId, listId)
        let lastLabels = []

        for (let i = 0; i < flashcards.length; i++) {
            const fc = flashcards[i]
            const fixed = fixedEntries[i]
            const labels = fixed?.topicLabels ?? []

            if (!labels.length) continue

            const topicsText = getLabelText(labels, list.topicsMap, fallbackTopics)

            const isTransition = lastLabels.length &&
                labels[labels.length - 1] !== lastLabels[lastLabels.length - 1]

            const newFront = isTransition
                ? topicsText
                : `${topicsText}\n${fc.front}`

            const showPreviousBack = !isTransition

            console.log({ labels, front, newFront, })
            // await updateFlashcard(fc, newFront, showPreviousBack)
            console.log(`✅ Would update ${fc.flashcardId} | transition=${isTransition} | showPreviousBack=${showPreviousBack}`)
            await waitForEnter()

            lastLabels = labels
        }
    }

    console.log('✅ Done.')
}

main().catch(console.error)

