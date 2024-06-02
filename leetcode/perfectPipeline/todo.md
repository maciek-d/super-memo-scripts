Fix getting images for solutions extractSolutionImages
Retest if switching solutions worked
Make sure switching to js works
Make sure you remove all references to python and other scripts
Rename problemLink to problemUrl
Update gpt prompt to include image tags in correct places. Then update the image tags to include resize-image class and anchor.
Add video links from comments to Q
Load more comments and replies from leetcode @getTextExcludingNonJsSections
Add login to supermemo to get token
Fetch problems in perfect pipeline instead of other script
Add a retry mechanism for when prompt is changed and solutions were already fetched. This might me a bad idea
