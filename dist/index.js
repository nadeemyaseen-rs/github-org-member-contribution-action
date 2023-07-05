/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 856:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 119:
/***/ ((module) => {

module.exports = eval("require")("@actions/github");


/***/ }),

/***/ 448:
/***/ ((module) => {

module.exports = eval("require")("@actions/github/lib/utils");


/***/ }),

/***/ 426:
/***/ ((module) => {

module.exports = eval("require")("@octokit/plugin-retry");


/***/ }),

/***/ 356:
/***/ ((module) => {

module.exports = eval("require")("@octokit/plugin-throttling");


/***/ }),

/***/ 155:
/***/ ((module) => {

module.exports = eval("require")("array-sort");


/***/ }),

/***/ 439:
/***/ ((module) => {

module.exports = eval("require")("csv-stringify/lib/sync");


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const arraySort = __nccwpck_require__(155)
const core = __nccwpck_require__(856)
const github = __nccwpck_require__(119)
const stringify = __nccwpck_require__(439)
const {GitHub} = __nccwpck_require__(448)
const {retry} = __nccwpck_require__(426)
const {throttling} = __nccwpck_require__(356)

const MyOctokit = GitHub.plugin(throttling, retry)
const eventPayload = require(process.env.GITHUB_EVENT_PATH)
const org = core.getInput('org', {required: false}) || eventPayload.organization.login
const token = core.getInput('token', {required: true})

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

// Query all org member contributions
async function getMemberActivity(orgid, from, to, contribArray) {
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
            commitContributionsByRepository(maxRepositories:100) {
            contributions (first: 100) {
              totalCount
            }
            repository {
              nameWithOwner
            }
          }
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
        const commitContrib = member.contributionsCollection.totalCommitContributions
        const issueContrib = member.contributionsCollection.totalIssueContributions
        const prContrib = member.contributionsCollection.totalPullRequestContributions
        const prreviewContrib = member.contributionsCollection.totalPullRequestReviewContributions
        const repoIssueContrib = member.contributionsCollection.totalRepositoriesWithContributedIssues
        const repoCommitContrib = member.contributionsCollection.totalRepositoriesWithContributedCommits
        const repoPullRequestContrib = member.contributionsCollection.totalRepositoriesWithContributedPullRequests
        const repoPullRequestReviewContrib = member.contributionsCollection.totalRepositoriesWithContributedPullRequestReviews
        const allBranchesCommits = member.contributionsCollection.commitContributionsByRepository

        // Push all member contributions from query to array
        contribArray.push({userName, activeContrib, commitContrib, issueContrib, prContrib, prreviewContrib, repoIssueContrib, repoCommitContrib, repoPullRequestContrib, repoPullRequestReviewContrib,allBranchesCommits})
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
    console.log(`Retrieving ${logDate} of member contribution data for the ${org} organization:`)
    await getMemberActivity(orgid, from, to, contribArray)

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
      repoPullRequestReviewContrib: `PR review spread (${columnDate})`,
      allBranchesCommits: `All Repo All Branches (${columnDate})`   
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
    const reportPath = `reports/${org}-${new Date().toISOString().substring(0, 19) + 'Z'}-${fileDate}.csv`
    //const reportPath = `/tmp/${org}-${new Date().toISOString().substring(0, 19) + 'Z'}-${fileDate}.csv`
    const committerName = core.getInput('committer-name', {required: false}) || 'github-actions'
    const committerEmail = core.getInput('committer-email', {required: false}) || 'github-actions@github.com'
    const {owner, repo} = github.context.repo

    // Push csv to repo
    const opts = {
      owner,
      repo,
      path: reportPath,
      message: `${new Date().toISOString().slice(0, 10)} Member contribution report`,
      content: Buffer.from(csv).toString('base64'),
      committer: {
        name: committerName,
        email: committerEmail
      }
    }

      //fs.writeFileSync(reportPath, csv);
    console.log(`Pushing final CSV report to repository path: ${reportPath}`)

    await octokit.rest.repos.createOrUpdateFileContents(opts)
  } catch (error) {
    core.setFailed(error.message)
  }
})()

})();

module.exports = __webpack_exports__;
/******/ })()
;