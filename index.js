const arraySort = require('array-sort')
const core = require('@actions/core')
const github = require('@actions/github')
const stringify = require('csv-stringify/lib/sync')
const {GitHub} = require('@actions/github/lib/utils')
const {retry} = require('@octokit/plugin-retry')
const {throttling} = require('@octokit/plugin-throttling')

const MyOctokit = GitHub.plugin(throttling, retry)
const eventPayload = require(process.env.GITHUB_EVENT_PATH)
const org = core.getInput('org', {required: false}) || eventPayload.organization.login
const token = core.getInput('token', {required: true})

///////////////// added by nadeem ///////////////////
const fs = require('fs');
const readline = require('readline');
const repofilepath = core.getInput('pathOfImpRepFile', {required: false})
/////////////////////////////////////////////////////


// API throttling
const octokit = new MyOctokit({
  auth: token,
  request: {
    retries: 3,
    retryAfter: 180
  },
  throttle: {
    onRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)

      if (options.request.retryCount === 0) {
        // only retries once
        octokit.log.info(`Retrying after ${retryAfter} seconds!`)
        return true
      }
    },
    onAbuseLimit: (retryAfter, options, octokit) => {
      // does not retry, only logs a warning
      oktokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`)
    }
  }
})

///////////////// added by nadeem ///////////////////////////
// Query all Repos of org
async function getAllRepos(org,allReposArray) {
  let paginationMember = null
  const query = `query ($org: String!, $after: String) {
    organization(login: $org) {
      repositories(first: 100, after: $after) {
        nodes {
          name
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }`
  try {
    let hasNextPageMember = false
    let getRepoResult = null

    do {
      getRepoResult = await octokit.graphql({
        query,
        org,
        after: paginationMember
      })

      const RepoObj = getRepoResult.organization.repositories.nodes
      hasNextPageMember = getRepoResult.organization.repositories.pageInfo.hasNextPage

      for (const repo of RepoObj) {
        if (hasNextPageMember) {
          paginationMember = getRepoResult.organization.repositories.pageInfo.endCursor
        } else {
          paginationMember = null
        }

        const repoName = repo.name
        // Push all repo from query to array
        allReposArray.push({repoName})
        console.log(repoName)
      }
    } while (hasNextPageMember)
  } catch (error) {
    core.setFailed(error.message)
  }

  // Create a readable stream from the file
  const fileStream = fs.createReadStream(repofilepath);

  // Create a readline interface
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity // Recognize all types of line breaks
  })
  // Event listener for reading lines
  rl.on('line', (line) => {
    console.log(line); // Print each line
  });

  // Event listener for when reading is complete
  rl.on('close', () => {
    console.log('File reading completed.');
  });


}

/////////////////////////////////////////////////////////////

// Query all org member contributions
async function getMemberActivity(orgid, from, to, contribArray,userIDbArray) {
  let paginationMember = null
  const query = `query ($org: String! $orgid: ID $cursorID: String $from: DateTime, $to: DateTime) {
    organization(login: $org ) {
      membersWithRole(first: 25, after: $cursorID) {
        nodes {
          login
          contributionsCollection (organizationID: $orgid, from: $from, to: $to) {
            hasAnyContributions
            totalCommitContributions
            totalIssueContributions
            totalPullRequestContributions
            totalPullRequestReviewContributions
            totalRepositoriesWithContributedIssues
            totalRepositoriesWithContributedCommits
            totalRepositoriesWithContributedPullRequests
            totalRepositoriesWithContributedPullRequestReviews
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }`
  try {
    let hasNextPageMember = false
    let getMemberResult = null    
    let getUserIdResult = null //// added by nadeem

    do {
      getMemberResult = await octokit.graphql({
        query,
        org,
        orgid,
        from,
        to,
        cursorID: paginationMember
      })

      const membersObj = getMemberResult.organization.membersWithRole.nodes
      hasNextPageMember = getMemberResult.organization.membersWithRole.pageInfo.hasNextPage

      for (const member of membersObj) {
        if (hasNextPageMember) {
          paginationMember = getMemberResult.organization.membersWithRole.pageInfo.endCursor
        } else {
          paginationMember = null
        }

        const userName = member.login
        const activeContrib = member.contributionsCollection.hasAnyContributions
//////////////////////// added by nadeem  ////////////////////////////////////////////
        if (activeContrib) {
          try {
            // Find user id for member
            const idquery = `query ($username: String!) {
              user(login: $username) {
                id
              }
            }`
            getUserIdResult = await octokit.graphql({
              query: idquery,      // Use 'query' instead of 'idquery'
              username: userName   // Pass the variables as 'variables' property
            })
          } catch (error) {
            core.setFailed(error.message)
          }
          const id = getUserIdResult.user.id
          userIDbArray.push({userName,id})
        }
//////////////////////////////////////////////////////////////////////////
        const commitContrib = member.contributionsCollection.totalCommitContributions
        const issueContrib = member.contributionsCollection.totalIssueContributions
        const prContrib = member.contributionsCollection.totalPullRequestContributions
        const prreviewContrib = member.contributionsCollection.totalPullRequestReviewContributions
        const repoIssueContrib = member.contributionsCollection.totalRepositoriesWithContributedIssues
        const repoCommitContrib = member.contributionsCollection.totalRepositoriesWithContributedCommits
        const repoPullRequestContrib = member.contributionsCollection.totalRepositoriesWithContributedPullRequests
        const repoPullRequestReviewContrib = member.contributionsCollection.totalRepositoriesWithContributedPullRequestReviews

        // Push all member contributions from query to array
        contribArray.push({userName, activeContrib, commitContrib, issueContrib, prContrib, prreviewContrib, repoIssueContrib, repoCommitContrib, repoPullRequestContrib, repoPullRequestReviewContrib})
        console.log(userName)
      }
    } while (hasNextPageMember)
  } catch (error) {
    core.setFailed(error.message)
  }
}

;(async () => {
  try {
    // Find orgid for organization
    const query = `query ($org: String!) {
      organization(login: $org) {
        id
      }
    }`
    getOrgIdResult = await octokit.graphql({
      query,
      org
    })

    // Detect if input is day amount or historic interval and set date variables
    const fromdate = core.getInput('fromdate', {required: false}) || ''
    const todate = core.getInput('todate', {required: false}) || ''
    const orgid = getOrgIdResult.organization.id

    let to
    let from
    let days
    let columnDate
    let fileDate
    let logDate

    const regex = '([0-9]{4}-[0-9]{2}-[0-9]{2})'
    const flags = 'i'
    const re = new RegExp(regex, flags)

    if (re.test(fromdate, todate) !== true) {
      days = core.getInput('days', {required: false}) || '30'
      to = new Date()
      from = new Date()
      from.setDate(to.getDate() - days)
      columnDate = `<${days} days`
      fileDate = `${days}-days`
      logDate = `${days} days`
    } else {
      to = new Date(todate).toISOString()
      from = new Date(fromdate).toISOString()
      days = `${from.substr(0, 10)} to ${to.substr(0, 10)}`
      columnDate = days
      fileDate = `${from.substr(0, 10)}-to-${to.substr(0, 10)}`
      logDate = days
    }

    // Take time, orgid parameters and init array to get all member contributions
    const contribArray = []
    const userIDbArray = []
    const allReposArray = []
    console.log(`Retrieving ${logDate} of member contribution data for the ${org} organization:`)
    await getMemberActivity(orgid, from, to, contribArray,userIDbArray)

    //////////////////////////////// added by nadeem //////////////////////////////////
    console.log(userIDbArray) 
    await getAllRepos(org,allReposArray)
    ///////////////////////////// ////////////////////////////////////////////////

    // Set sorting settings and add header to array
    const columns = {
      userName: 'Member',
      activeContrib: `Has active contributions (${columnDate})`,
      commitContrib: `Commits created (${columnDate})`,
      issueContrib: `Issues opened (${columnDate})`,
      prContrib: `PRs opened (${columnDate})`,
      prreviewContrib: `PR reviews (${columnDate})`,
      repoIssueContrib: `Issue spread (${columnDate})`,
      repoCommitContrib: `Commit spread (${columnDate})`,
      repoPullRequestContrib: `PR spread (${columnDate})`,
      repoPullRequestReviewContrib: `PR review spread (${columnDate})`
    }
    const sortColumn = core.getInput('sort', {required: false}) || 'commitContrib'
    const sortArray = arraySort(contribArray, sortColumn, {reverse: true})
    sortArray.unshift(columns)

    // Convert array to csv
    const csv = stringify(sortArray, {
      cast: {
        boolean: function (value) {
          return value ? 'TRUE' : 'FALSE'
        }
      }
    })

    // Prepare path/filename, repo/org context and commit name/email variables
    //const reportPath = `reports/${org}-${new Date().toISOString().substring(0, 19) + 'Z'}-${fileDate}.csv`
    const reportPath = `/tmp/${org}-${new Date().toISOString().substring(0, 19) + 'Z'}-${fileDate}.csv`    
    //const committerName = core.getInput('committer-name', {required: false}) || 'github-actions'
    //const committerEmail = core.getInput('committer-email', {required: false}) || 'github-actions@github.com'
    //const {owner, repo} = github.context.repo

    // Push csv to repo
    /*const opts = {
      owner,
      repo,
      path: reportPath,
      message: `${new Date().toISOString().slice(0, 10)} Member contribution report`,
      content: Buffer.from(csv).toString('base64'),
      committer: {
        name: committerName,
        email: committerEmail
      }
    }*/

    fs.writeFileSync(reportPath, csv);    
    console.log(`Pushing final CSV report to repository path: ${reportPath}`)

    //await octokit.rest.repos.createOrUpdateFileContents(opts)
  } catch (error) {
    core.setFailed(error.message)
  }
})()

