// Imports

import fs from 'fs'
import http from 'http'
import { createNodeMiddleware } from '@octokit/webhooks'

// Environment Variable Config
import dotenv from 'dotenv'
dotenv.config()

// Import App Config
import app from './Config/index.js'

// Import Events
import { installation_events } from './components/on_install.js'
import { pull_request_opened_events } from './components/on_pr_opened.js'

// Shell Commands
import { exec } from 'child_process';

const messageForNewPRs = fs.readFileSync('./comments/load.md', 'utf8')
const messageForInvalidAccess = fs.readFileSync('./unauthorized_access.md', 'utf8')


// Messages
const load = fs.readFileSync('./comments/load.md', 'utf8')
const add_update = fs.readFileSync('./comments/add_update.md', 'utf8')
const run_failed = fs.readFileSync('./comments/run_failed.md', 'utf8')
const permission_denied = fs.readFileSync('./comments/permission_denied.md', 'utf8')
const intro = fs.readFileSync('./comments/intro.md', 'utf8')
const no_dep = fs.readFileSync('./comments/no_dependencies.md', 'utf8')
const no_changes = fs.readFileSync('./comments/no_changes.md', 'utf8')
// Optional: Get & log the authenticated app's name
const { data } = await app.octokit.request('/app')

// Read more about custom logging: https://github.com/octokit/core.js#logging
app.octokit.log.debug(`Authenticated as '${data.name}'`)


// Global

let commentId = null;

// 1. On Install
app.webhooks.on('installation.created', async ({ octokit, payload }) => {
  installation_events(octokit, payload, load, no_dep, add_update, intro, permission_denied, run_failed);
});


// 2. Successful Installation
app.webhooks.on('pull_request.opened', async ({ octokit, payload }) => {
  pull_request_opened_events(octokit, payload, load, no_dep, add_update, intro, permission_denied, run_failed, no_changes);
  const packageJsonChanges = await octokit.rest.pulls.listFiles({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    pull_number: payload.pull_request.number
  });
  const hasPackageJsonChanges = packageJsonChanges.data.some(file => file.filename === 'package.json');
  if (hasPackageJsonChanges) {
    try {
      const commentResponse = await octokit.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.pull_request.number,
        body: `${load}`
      });
      commentId = commentResponse.data.id;
      
      try {
        setTimeout(async () => {
          const commentBody = `${add_update}`;
          await octokit.rest.issues.updateComment({
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            comment_id: commentId,
            body: commentBody
          });
        }, 5000);
        
      } catch (error) {
        await octokit.rest.issues.updateComment({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          comment_id: commentId,
          body: `${run_failed}`
        });
        if (error.response) {
          console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
        } else {
          console.error(error)
        }
      }
    } catch (error) {
      await octokit.rest.issues.updateComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        comment_id: commentId,
        body: `${permission_denied}`
      });
      if (error.response) {
        console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
      } else {
        console.error(error)
      }
    }
  }
})

app.webhooks.on('pull_request.synchronize', async ({ octokit, payload }) => {
  console.log(`Received a pull request event for #${payload.pull_request.number}`)
  const packageJsonChanges = await octokit.rest.pulls.listFiles({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    pull_number: payload.pull_request.number
  });
  const hasPackageJsonChanges = packageJsonChanges.data.some(file => file.filename === 'package.json');
  if (hasPackageJsonChanges) {
    try {
      if (commentId !== null) {
        const commentResponse = await octokit.rest.issues.updateComment({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          comment_id: commentId,
          body: `${load}`
        });
      } else {
        const commentResponse = await octokit.rest.issues.createComment({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          issue_number: payload.pull_request.number,
          body: `${load}`
        });
        commentId = commentResponse.data.id;
      }
      try {
        setTimeout(async () => {
          const commentBody = `${add_update}`;
          await octokit.rest.issues.updateComment({
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            comment_id: commentId,
            body: commentBody
          });
        }, 5000);
      } catch (error) {
        await octokit.rest.issues.updateComment({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          comment_id: commentId,
          body: `${run_failed}`
        });
        if (error.response) {
          console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
        } else {
          console.error(error)
        }
      }
    } catch (error) {
      await octokit.rest.issues.updateComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        comment_id: commentId,
        body: `${permission_denied}`
      });
      if (error.response) {
        console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
      } else {
        console.error(error)
      }
    }
  }
})

// 3. Checks
// app.webhooks.on('push', async ({ octokit, payload }) => {
//   const branchName = payload.ref.split('/').pop();
//   console.log(`Received a push event for ${branchName}`)
//   const files = await octokit.rest.repos.getContent({
//     owner: payload.repository.owner.login,
//     repo: payload.repository.name,
//     path: '',
//     ref: branchName
//   });
//   console.log(`List of files in ${branchName} branch: ${files.data.map(file => file.name).join(', ')}`)
//   const hasPackageJson = files.data.some(file => file.name === 'package.json');
//   await octokit.rest.checks.create({
//     owner: payload.repository.owner.login,
//     repo: payload.repository.name,
//     name: 'Necessary Files Check',
//     head_sha: payload.after,
//     status: 'completed',
//     conclusion: hasPackageJson ? 'success' : 'failure',
//     output: {
//       title: hasPackageJson ? 'Necessary Files Check Passed' : 'Necessary Files Check Failed',
//       summary: hasPackageJson ? 'All necessary files are present' : 'Some necessary files are missing',
//     }
//   });
// });

// Optional: Handle errors
app.webhooks.onError((error) => {
  if (error.name === 'AggregateError') {
    // Log Secret verification errors
    console.log(`Error processing request: ${error.event}`)
  } else {
    console.log(error)
  }
})

// Launch a web server to listen for GitHub webhooks
const port = process.env.PORT || 3000
const path = '/api/webhook'
const localWebhookUrl = `http://localhost:${port}${path}`

// See https://github.com/octokit/webhooks.js/#createnodemiddleware for all options
const middleware = createNodeMiddleware(app.webhooks, { path })

http.createServer(middleware).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`)
  console.log('Press Ctrl + C to quit.')
})
