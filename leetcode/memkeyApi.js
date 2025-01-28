
export async function uploadFlashcard({
    title, front, back, problemUrl
}) {
    const courseId = process.env.MEMKEY_COURSE_ID
    const authToken = process.env.MEMKEY_TOKEN
    const backendUrl = process.env.MEMKEY_BACKEND_URL
    console.log({ courseId, authToken, backendUrl })
    if (!courseId || !authToken) {
        console.error('Course ID or authentication token is missing.');
        return;
    }
    const endpoint = `${backendUrl}/courses/${courseId}/lists`
    const method = 'POST'

    const payload = {
        title,
        items: [{
            front, back, source: problemUrl
        }]
    };

    const response = await fetch(endpoint, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify([payload]),
    });

    if (!response.ok) {
        throw new Error(`Failed to save list. Status code: ${response.status}`);
    }

    const data = await response.json();
    const { flashcardId } = data?.successful?.[0]?.flashcards?.[0] ?? {}
    return flashcardId
}



