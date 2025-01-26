const COURSE_ID = process.env.MEMKEY_COURSE_ID
const MEMKEY_TOKEN = process.env.MEMKEY_TOKEN
const MEMKEY_BACKEND_URL = process.env.MEMKEY_BACKEND_URL

export async function uploadFlashcard({
    title, front, back, problemUrl
}) {
    const courseId = COURSE_ID
    const authToken = MEMKEY_TOKEN
    if (!courseId || !authToken) {
        console.error('Course ID or authentication token is missing.');
        return;
    }
    const backendUrl = MEMKEY_BACKEND_URL
    const endpoint = `${backendUrl}/courses/${courseId}/lists`
    const method = 'POST'

    const payload = {
        listId: list.id ?? null,
        title: `<a href=${problemUrl} class="memkey-link">${title}</a>`,
        items: [{
            front, back
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
    const { flashcardId } = data?.successful?.[0]?.flashcards ?? {}
    return flashcardId
}



