# LeetCode and Website Scraping & Flashcard Creation Scripts

## Overview

This repository contains scripts for scraping data from LeetCode and other websites. These scripts automate the creation of educational flashcards, which are then uploaded to Fotki.com and SuperMemo for study and memorization purposes.

### Key Features:
- **Data Scraping:** Automated extraction of problems and solutions from LeetCode and other sources using Puppeteer.
- **Flashcard Creation:** Flashcards are generated using HTML and CSS, following a specific methodology to optimize learning.
- **AI-Assisted Summarization and Image Creation:** ChatGPT is utilized to create images that enhance memorization and to summarize problems and solutions, extracting key tricks for solving them.
- **Flashcard Upload:** The generated flashcards are uploaded to Fotki.com and SuperMemo for easy access and study.

## How It Works

1. **Data Scraping**:
   - The scraping process is handled separately from the flashcard creation. Puppeteer is used to gather problem data and solutions from LeetCode and other websites.

2. **Flashcard Creation**:
   - After scraping, the script generates flashcards by summarizing the problems and extracting the core "trick" or key concept needed to solve the problem.
   - The flashcards are created using HTML and CSS, ensuring a visually appealing and educational format.
   - Each flashcard includes:
     - A summarized version of the problem.
     - A hidden section with detailed steps if the summary isn't sufficient.
     - The extracted trick to help in mastering the solution.
     - The actual solution code.

3. **AI Integration**:
   - ChatGPT is used to summarize the problems and solutions, extract the key trick, and create images that support the learning process.

4. **Uploading Flashcards**:
   - Once created, the flashcards are automatically uploaded to Fotki.com and SuperMemo, making them accessible for review and study.

## Methodology

The flashcard creation process follows a specific methodology designed to enhance learning efficiency:
- **Summarization**: Problems are summarized to keep the flashcards concise, with hidden steps provided for deeper understanding when necessary.
- **Trick Extraction**: Each flashcard highlights a trick or key concept from the solution to aid in memorization and application.
- **Code Inclusion**: The solution code is included on the flashcard for reference and practice.

## Requirements

- Node.js
- Puppeteer
- ChatGPT API (for generating images and summaries)
- HTML/CSS knowledge (for customizing flashcards)

## Setup

1. Clone the repository:
   '''
   git clone https://github.com/yourusername/repository-name.git
   '''
2. Install dependencies:
   '''
   yarn install
   '''
3. Configure the environment (e.g., API keys for ChatGPT, login credentials for Fotki.com, SuperMemo).

4. Run the scraping script:
   '''
   yarn scrape
   '''

5. Run the flashcard creation and upload script:
   '''
   yarn create-flashcards
   '''

## Usage

- Modify the scraping targets or flashcard templates as needed by editing the respective scripts.
- To customize the flashcard creation process, adjust the HTML/CSS templates and the ChatGPT prompt configurations.

