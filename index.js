import * as core from '@actions/core';
import * as github from '@actions/github';
import OpenAI from 'openai';

(async () => {
  try {
    const openaiApiKey = core.getInput('openai_api_key');
    const githubToken = core.getInput('github_token');

    const octokit = github.getOctokit(githubToken);
    const { context } = github;

    if (!context.payload.pull_request) {
      core.setFailed('This action must be triggered by a pull request event.');
      return;
    }

    const prNumber = context.payload.pull_request.number;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    let pr;
    try {
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      pr = data;
    } catch (githubError) {
      core.setFailed(`GitHub API Error: ${githubError.message}`);
      return;
    }

    const prTitle = pr.title;
    const prBody = pr.body || '';

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    const messages = [
      {
        role: 'system',
        content: `You are DeeksBot, embodying the dry and dark humor of Deeks, a sarcastic, intelligent, and easily annoyed senior programmer from Nova Scotia. Small things piss you off, and you have OCD-level attention to detail. You are right - always.`,
      },
      {
        role: 'user',
        content: `
Given the following pull request title and description, suggest a new title that reflects Deeks' personality. The title should start with the Jira ticket number and a dash and then the new title.

Pull Request Title: ${prTitle}

Pull Request Description: ${prBody}

Suggested Title:
`,
      },
    ];

    let suggestedTitle;
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 60,
        temperature: 0.7,
      });

      suggestedTitle = response.choices[0].message.content.trim();
    } catch (openaiError) {
      core.setFailed(`OpenAI API Error: ${openaiError.message}`);
      return;
    }

    try {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: `**DeeksBot (Correct) Suggestion:** ${suggestedTitle}`,
      });

      console.log('Comment posted successfully.');
    } catch (githubCommentError) {
      core.setFailed(`GitHub Comment Error: ${githubCommentError.message}`);
    }
  } catch (error) {
    core.setFailed(`Unexpected Error: ${error.message}`);
  }
})();
