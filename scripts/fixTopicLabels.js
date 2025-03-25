import fs from 'fs'
import path from 'path'
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'

// Config
const region = 'us-west-1'
const courseId = '114316818461884883239-1740023062738'
const fixedDataPath = path.resolve('../leetcode/data/memkey/fixedFlashcards.js')

// Load fixed flashcards
const fixedFlashcards = JSON.parse(fs.readFileSync(fixedDataPath, 'utf-8'))

const client = new DynamoDBClient({ region })

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

async function updateTopicLabels(flashcard, topicLabels) {
    const cmd = new UpdateItemCommand({
        TableName: 'Flashcards',
        Key: {
            courseId: { S: flashcard.courseId },
            flashcardId: { S: flashcard.flashcardId }
        },
        UpdateExpression: 'SET topicLabels = :labels',
        ExpressionAttributeValues: {
            ':labels': { L: topicLabels.map(label => ({ S: label })) }
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
        if (!fixedEntries) {
            console.log(`❌ No fixed entries found for list "${listTitle}"`)
            continue
        }

        const flashcards = await fetchFlashcardsForList(courseId, listId)

        console.log(`🔍 Matching list "${listTitle}" with ${flashcards.length} flashcards`)

        for (let i = 0; i < flashcards.length; i++) {
            const fc = flashcards[i]
            const fixed = fixedEntries[i]
            if (!fixed || !fixed.topicLabels) {
                console.log(`⚠️ No topicLabels for "${fc.front?.slice(0, 30)}..."`)
                continue
            }

            console.log({ id: fc.flashcardId, back: fc.back, topicLabels: fixed.topicLabels })

            //await updateTopicLabels(fc, fixed.topicLabels)
            console.log(`✅ Updated flashcard ${fc.flashcardId} with ${fixed.topicLabels.length} topics`)
        }
    }

    console.log('✅ Done.')
}

main().catch(console.error)

