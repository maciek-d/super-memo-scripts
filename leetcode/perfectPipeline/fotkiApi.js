import { resizeImage } from "./imageProcessing.js";

async function uploadImageToFotki({ imageData, name, username, sessionId, path }) {
    const blob = new Blob([imageData], { type: 'image/jpeg' });

    // Prepare form data
    let formData = new FormData();
    formData.append("cmd", "ajax_upload_file");
    formData.append("photo", blob, `${name}.jpg`);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.5',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://public.fotki.com',
        'Referer': `https://public.fotki.com/GeogussrLearning/${path}/`,
        'Cookie': `regional_settings=us; lang=en; s_id=${sessionId}; username=${username}; f_hide_tree=1`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-GPC': '1',
        'TE': 'trailers'
    };

    // Make the POST request
    const uploadResponse = await fetch(`https://public.fotki.com/${username}/${path}/`, {
        method: 'POST',
        headers: headers,
        body: formData,
        redirect: "follow"
    });

    if (!uploadResponse.ok) throw new Error(`HTTP error! status: ${uploadResponse.status}`);

    return uploadResponse;
}

export async function uploadToFotki(
    { sessionId, username, name, imageData, courseName }
) {
    const path = `flashcards/${courseName}/images`;
    const fotkiThumbFolder = `flashcards/${courseName}/thumbs`;

    const fotkiData = {
        sessionId,
        imageData: await resizeImage(imageData, 1024, 1024),
        path, username, name,
    }

    const uploadImage = uploadImageToFotki(fotkiData);

    const thumbImage = await resizeImage(imageData, 350, 450);
    fotkiData.imageData = thumbImage;
    fotkiData.path = fotkiThumbFolder;

    const uploadThumb = uploadImageToFotki(fotkiData);

    const [imageResponse, thumbResponse] =
        (await Promise.allSettled([uploadImage, uploadThumb]))
            .flatMap(settled => {
                if (settled.status !== "fulfilled") {
                    console.error(settled.reason);
                    return []
                }
                return [settled.value];
            });
    if (!imageResponse || !thumbResponse) {
        throw new Error("uploadToFotki failed")
    }
    const imageSrc = (await imageResponse?.json())?.th_src?.replace(/-th(?=[^-]*\.jpg$)/, '-vi');
    const thumbSrc = (await thumbResponse?.json())?.th_src?.replace(/-th(?=[^-]*\.jpg$)/, '-vi');

    return { imageSrc, thumbSrc }
}

export async function createFotkiAlbum(fotkiSid, username, folderName, albumName) {
    const formData = new URLSearchParams();
    formData.append('cmd', 'neweditalbum1');
    formData.append('name', albumName);
    formData.append('password', '');
    formData.append('url_p', albumName);

    try {
        const response = await fetch(`https://public.fotki.com/${username}/flashcards/${folderName.toLowerCase()}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': `s_id=${fotkiSid}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('Error creating Fotki album:', error);
    }
}

export async function createFotkiFolder(fotkiSid, username, folderName) {
    const formData = new URLSearchParams();
    formData.append('cmd', 'newfolder1');
    formData.append('fid', '');
    formData.append('current', '0');
    formData.append('name', folderName);
    formData.append('desc', '');
    formData.append('password', '');
    formData.append('url_p', folderName.toLowerCase());

    try {
        const response = await fetch(`https://public.fotki.com/${username}/flashcards/?`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': `s_id=${fotkiSid}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('Error creating Fotki folder:', error);
    }
}


