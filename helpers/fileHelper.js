
import { access, mkdir, readFile } from 'fs/promises';


export async function readFileDataFullPath(filename) {
    try {
        if (filename.includes("json")) {
            const data = await readFile(`${filename}`, 'utf-8');
            return JSON.parse(data);
        }
        const module = await import(`${filename}`);
        return module.default;
    } catch (err) {
        return [];
    }
}

export async function readFileInDataFolder(filename) {
    try {
        if (filename.includes("json")) {
            const data = await readFile(`./data/${filename}`, 'utf-8');
            return JSON.parse(data);
        }
        const module = await import(`./data/${filename}`);
        return module.default;
    } catch (err) {
        return [];
    }
}

export async function createDirectoryIfNotExists(directoryPath) {
    try {
        await access(directoryPath);
    } catch (error) {
        // If the directory does not exist, an error is thrown
        if (error.code === 'ENOENT') {
            await mkdir(directoryPath);
        } else {
            throw error;
        }
    }
}