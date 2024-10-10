import { readFile } from 'fs/promises';

import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getProblems() {
    const data = await readFile(path.join(__dirname, '../../data/CS/leetcode/array_problems_data.js'), 'utf8');
    return JSON.parse(data);
}

// Function to parse and update your data
async function updateProblemData(yourDataString) {
    const dataBlocks = yourDataString.split('--');
    const problems = await getProblems();

    const updatedBlocksPromises = dataBlocks.map(async block => {
        // Extract the title
        const titleMatch = block.match(/<a href="[^"]+"[^>]+>([^<]+)<\/a>/);
        const title = titleMatch ? titleMatch[1].trim() : '';

        // Find the corresponding problem
        const problem = problems.find(p => p.title.includes(title));

        if (problem) {
            // Replace the problem link
            block = block.replace(/<a href="https:\/\/leetcode\.com\/problems\/[^"]+"/, `<a href="${problem.problemLink}"`);

            // Replace the generic solution link (second link)
            const genericSolutionRegex = /<div><a href="https:\/\/leetcode\.com\/problems\/[^\/]+\/solutions\/"/;
            block = block.replace(genericSolutionRegex, `<div><a href="${problem.solutionsUrl}"`);

            // Replace the specific solution link (third link)
            const solutionMatches = block.match(/<a href="https:\/\/leetcode\.com\/problems\/[^\/]+\/solutions\/[^"]+"/g);
            if (solutionMatches && solutionMatches.length > 0) {
                // Target the last match for the specific solution link
                const lastSolutionMatch = solutionMatches[solutionMatches.length - 1];
                const specificSolutionRegex = new RegExp(lastSolutionMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                block = block.replace(specificSolutionRegex, `href="${problem.solutionLink}"`);
            }
        }

        return block;
    });

    const updatedBlocks = await Promise.all(updatedBlocksPromises);
    return updatedBlocks.join('--');
}

// Assuming yourDataString is a string containing your data
const yourDataString = `
<b><a href="https://leetcode.com/problems/concatenation-of-array" target="_blank">1470.</a> Shuffle the Array<b> - Interleave two halves of an array - [2,5,1,3,4,7] => [2,3,5,4,1,7] - Rearrange a given array by alternating elements from its two halves. - <div><a href="https://leetcode.com/problems/concatenation-of-array/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/concatenation-of-array/solutions/1369400/javascript-one-liner/" target="_blank"><b>In-place Shuffle</b></a> - \`var shuffle = function(nums, n) { /* Bitwise shuffling logic */ return nums; };\` Implement an in-place shuffle using bitwise operations to store two elements in one slot temporarily. - Merge elements using bitwise operations for space efficiency. -
--
<b><a href="https://leetcode.com/problems/number-of-good-pairs" target="_blank">1476.</a> Subrectangle Queries<b> - Update and retrieve values in a 2D subrectangle - getValue after updateSubrectangle - Implement a class to update values in a subrectangle and retrieve individual values. - <div><a href="https://leetcode.com/problems/number-of-good-pairs/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/number-of-good-pairs/solutions/911686/clean-javascript-solution/" target="_blank"><b>Matrix Manipulation</b></a> - \`var SubrectangleQueries = function(rectangle) { /* updateSubrectangle and getValue methods */ };\` Use a 2D array, directly modifying and accessing elements as requested. - Directly modify and access elements in the 2D array. -
--
<b><a href="https://leetcode.com/problems/widest-vertical-area-between-two-points-containing-no-points" target="_blank">2942.</a> Find Words Containing Character<b> - Find indices of words containing a specific character - ["leet", "code"], 'e' => [0, 1] - Identify which words in an array contain a specified character and return their indices. - <div><a href="https://leetcode.com/problems/widest-vertical-area-between-two-points-containing-no-points/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/widest-vertical-area-between-two-points-containing-no-points/solutions/1728684/beginner-friendly-javascript-solution/" target="_blank"><b>Filter and Index</b></a> - \`var findWordsContaining = function(words, x) { return words.reduce((acc, curr, i) => /* filtering logic */); };\` Use \`reduce\` to create an array of indices for words containing the character. - Use \`reduce\` to filter words containing the character and store indices. -
--

<b><a href="https://leetcode.com/problems/final-value-of-variable-after-performing-operations" target="_blank">1282.</a> Group the People Given the Group Size They Belong To<b> - Organize people into groups based on group sizes - [3,3,3,3,3,1,3] => [[5],[0,1,2],[3,4,6]] - Group individuals based on their group size preference, ensuring each group is of the correct size. - <div><a href="https://leetcode.com/problems/final-value-of-variable-after-performing-operations/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/final-value-of-variable-after-performing-operations/solutions/1520355/javascript-one-line-solution-time-81-mem-92-w-documentation/" target="_blank"><b>Hashing and Grouping</b></a> - \`var groupThePeople = function(groupSizes) { /* Hashing and organizing logic */ return result; };\` Use a hash table to track members of each group size and form groups accordingly. - Use a hash table to group people by sizes. -
--
<b><a href="https://leetcode.com/problems/find-the-original-array-of-prefix-xor" target="_blank">1672.</a> Richest Customer Wealth<b> - Find the maximum sum of money held across all banks - [[1,2,3],[3,2,1]] => 6 - Calculate the maximum wealth across all customers, where wealth is the sum of money in different banks. - <div><a href="https://leetcode.com/problems/find-the-original-array-of-prefix-xor/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/find-the-original-array-of-prefix-xor/solutions/2682898/easy/" target="_blank"><b>Sum and Max</b></a> - \`return Math.max(...accounts.map(customer => customer.reduce((a, b) => a + b)));\` Map each customer's wealth to an array and find the maximum value. - Calculate each customer's total wealth and find the max. -
--
<b><a href="https://leetcode.com/problems/build-array-from-permutation" target="_blank">2114.</a> Maximum Number of Words in Sentences<b> - Find sentence with most words - ["this is great thanks very much"] => 6 - Identify the sentence with the highest word count in an array of sentences. - <div><a href="https://leetcode.com/problems/build-array-from-permutation/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/build-array-from-permutation/solutions/1362485/javascript-easy-solution/" target="_blank"><b>String Splitting</b></a> - \`let max = 0; for (let sentence of sentences) { max = Math.max(max, sentence.split(" ").length); } return max;\` Split each sentence by space and count the words, maintaining the max count. - Split each sentence into words and count. -
--
<b><a href="https://leetcode.com/problems/concatenation-of-array" target="_blank">1828.</a> Queries on Number of Points Inside a Circle<b> - Count points within each query circle - ([[1,3],[3,3],[5,3]], [[2,3,1]]) => [3] - For each query circle, count the number of points that lie inside it. - <div><a href="https://leetcode.com/problems/concatenation-of-array/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/concatenation-of-array/solutions/1369400/javascript-one-liner/" target="_blank"><b>Distance Calculation</b></a> - \`let result = []; for (let [x,y,r] of queries) { let count = 0; for (let [a,b] of points) { if ((x - Check if each point lies within the circle's radius. - a) * (x - a) + (y - b) * (y - b) <= r * r) count++; } result.push(count); } return result;\` Calculate the distance from each point to the circle's center and compare with the radius.
--
<b><a href="https://leetcode.com/problems/number-of-good-pairs" target="_blank">2391.</a> Minimum Time to Collect Garbage<b> - Calculate time to collect all types of garbage - (["G","P","GP","GG"], [2,4,3]) => 21 - Determine the minimum time required to collect all garbage types, considering travel time between houses. - <div><a href="https://leetcode.com/problems/number-of-good-pairs/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/number-of-good-pairs/solutions/911686/clean-javascript-solution/" target="_blank"><b>Traversal and Summation</b></a> - \`let totalTime = 0; /* iterate through garbage types and calculate total time including travel */ return totalTime;\` For each garbage type, calculate the time to collect and add the travel time to the last house with that type of garbage. - Sum the time to collect each type and travel time. -
--
<b><a href="https://leetcode.com/problems/widest-vertical-area-between-two-points-containing-no-points" target="_blank">2859.</a> Sum of Values at Indices With K Set Bits<b> - Sum elements whose index has k set bits - ([5,10,1,5,2], 1) => 13 - Sum the values of the array whose indices have exactly k set bits. - <div><a href="https://leetcode.com/problems/widest-vertical-area-between-two-points-containing-no-points/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/widest-vertical-area-between-two-points-containing-no-points/solutions/1728684/beginner-friendly-javascript-solution/" target="_blank"><b>Binary Representation</b></a> - \`let sum = 0; for (let i = 0; i < nums.length; i++) { if (i.toString(2).replace(/0/g, '').length === k) sum += nums[i]; } return sum;\` Convert index to binary, count set bits, and sum values where set bits count equals k. - Check the binary representation of indices and sum accordingly. -
--
<b><a href="https://leetcode.com/problems/final-value-of-variable-after-performing-operations" target="_blank">807.</a> Max Increase to Keep City Skyline<b> - Maximize building heights without changing skyline - [[3,0,8,4],[2,4,5,7],[9,2,6,3],[0,3,1,0]] => 35 - Optimize the heights of buildings in a grid to increase their height as much as possible without altering the skyline. - <div><a href="https://leetcode.com/problems/final-value-of-variable-after-performing-operations/solutions/" target="_blank">[1]</a></div>

<a href="https://leetcode.com/problems/final-value-of-variable-after-performing-operations/solutions/1520355/javascript-one-line-solution-time-81-mem-92-w-documentation/" target="_blank"><b>Height Adjustment</b></a> - \`/* Calculate max height for each row and column. Increase each building's height to the minimum of its row and column max while keeping the skyline. */ return totalIncrease;\` Determine the max height for each row and column, then increase each building's height up to the minimum of its row and column max without altering the skyline. - Increase building heights while maintaining skyline. -
`; // Replace this with your actual data string
updateProblemData(yourDataString).then(updatedData => {
    console.log(updatedData); // This will log the updated data
});