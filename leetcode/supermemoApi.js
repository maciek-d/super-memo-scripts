import axios from "axios";
import { existsSync, readFileSync, writeFileSync } from "fs";

export async function refreshToken(tokenPath, username, password) {
    tokenPath = `${tokenPath}/token.txt`
    token = existsSync(tokenPath) ? readFileSync(tokenPath, 'utf8') : null
    if (!token || isTokenExpired(token)) {
        token = await loginToSuperMemo(username, password)
        writeFileSync(tokenPath, token)
    }

    if (!token) {
        return false
    }

    await browser.storage.sync.set({
        "superMemoUserId": extractUserIdFromJwt(token)
    });
    return true
}

function isTokenExpired(token) {
    try {
        const payloadBase64 = token.split('.')[1]; // Get the payload part of the JWT
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString()); // Decode and parse payload

        if (!payload.exp) {
            throw new Error('Token does not contain an expiration claim');
        }

        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        return payload.exp < currentTime;  // true if expired, false if valid
    } catch (error) {
        console.error('Error checking token expiration:', error);
        return true; // If any error occurs, treat the token as expired
    }
}

async function loginToSuperMemo(username, password) {
    const url = 'https://learn.supermemo.com/authapi/login';
    const body = JSON.stringify({ username, password });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://learn.supermemo.com/en/authorization/v2/login?returnUrl=https:%2F%2Flearn.supermemo.com%2F'
            },
            body,
        });

        const data = await response.json();
        if (response.ok && data.jwtToken) {
            return data.jwtToken;
        } else {
            console.error('Login failed:', data);
            return null;
        }
    } catch (error) {
        console.error('Error during login:', error);
        return null;
    }
}

export async function postNewCard({ token, userId, courseId, targetParentNumber }, question, answer) {
    const newCardUrl = `https://learn.supermemo.com/api/users/${userId}/courses/${courseId}/pages?contentType=json&targetParentNumber=${targetParentNumber}`

    const questionObject = {
        content: question
    }

    const answerObject = {
        content: answer
    }

    const json = {
        question: JSON.stringify(questionObject),
        answer: JSON.stringify(answerObject)
    }

    try {
        const response = await axios.post(newCardUrl, json, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        if (response.status !== 200) {
            throw new Error(`Failed to post new card: ${response.statusText} (${response.status}) for ${courseId}`)
        }
        return response.data.pageNumber
    } catch (error) {
        if (error.response && error.response.status === 403) {
            throw new Error("Invalid Supermemo token")
        }
        throw error
    }
}

export async function updateCard({
    userId,
    courseId,
    token,
}, pageNumber, question, answer) {


    const url = `https://learn.supermemo.com/api/users/${userId}/courses/${courseId}/pages/${pageNumber}?contentType=json`;

    const payload = {
        question: JSON.stringify({ content: question }),
        answer: JSON.stringify({ content: answer })
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Referer': `https://learn.supermemo.com/en/app/my-learning/editor/${courseId}`,
        'Origin': 'https://learn.supermemo.com'
    };

    const response = await fetch(url, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update page: ${errorText}`);
    }

    const data = await response.json();
    return data;
}
