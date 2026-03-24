/**
 * Probe: past tournaments + StepManiaX events. Run from api/: node -r dotenv/config scripts/probe-tournaments-past-stepmaniax.js
 * Uses videogame id 33834 (StepmaniaX from seed JSON); override with env STEP_MANIA_X_PROBE_ID
 */
require('dotenv').config();
const { executeGraphQL } = require('../services/startGgClient');

const VIDEOGAME_ID = Number(process.env.STEP_MANIA_X_PROBE_ID || 33834);

const q = `
  query Probe($page: Int!, $perPage: Int!, $videogameIds: [ID]!) {
    tournaments(query: {
      page: $page
      perPage: $perPage
      sortBy: "startAt desc"
      filter: {
        past: true
        videogameIds: $videogameIds
      }
    }) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        id
        name
        slug
        startAt
        state
        events(filter: { videogameId: $videogameIds }) {
          id
          name
          slug
          startAt
          numEntrants
        }
      }
    }
  }
`;

(async () => {
  const data = await executeGraphQL({
    query: q,
    variables: { page: 1, perPage: 5, videogameIds: [String(VIDEOGAME_ID)] },
    operationName: 'Probe',
  });
  console.log(JSON.stringify(data, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
