const debug = require('debug')('kcapp-announcer');

const axios = require('axios');
const schedule = require("node-schedule");
const _ = require("underscore");

const API_URL = process.env.API_URL || "http://localhost:8001";
const GUI_URL = process.env.GUI_URL || "http://localhost:3000";

const KCAPP_HOST = process.env.KCAPP_HOST || "localhost";
const KCAPP_PORT = process.env.KCAPP_PORT || 3000;
const KCAPP_PROTO = process.env.KCAPP_PROTO || "http";

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * 1-5';

const token = process.env.SLACK_KEY || "<slack_key_goes_here>";
const channel = process.env.SLACK_CHANNEL || "<channel_id_goes_here>";
const doAnnounce = (process.env.ANNOUNCE || false) === "true";
if (doAnnounce) {
    debug(`Posting messages to Slack is enabled!`);
}

const { WebClient } = require('@slack/web-api');
const web = new WebClient(token);

const message = require('./slack-message')(GUI_URL, channel);
const threads = {};

if (process.argv[2] === "verify") {
    debug(`Posting a test message to verify integration`);
    postToSlack(null, message.testMessage());
    debug("Done. If you can see the post in Slack, your integration work, if not look for any error above.");
    return;
}
const officeId = parseInt(process.argv[2]) || 1;

function postToSlack(matchId, msg) {
    debug(`Posting message ${JSON.stringify(msg)}`);
    if (doAnnounce) {
        (async () => {
            try {
                const response = await web.chat.postMessage(msg);
                if (matchId && !threads[matchId]) {
                    threads[matchId] = response.ts;
                    debug(`Thread for match ${matchId} is ${threads[matchId]}`)
                }
            } catch (error) {
                console.log(JSON.stringify(error));
                debug(`Error when posting to slack: ${JSON.stringify(error.data)}`);
            }
        })();
    }
}

function getReactionsPromise(matchId) {
    try {
        const thread = threads[matchId];
        debug(`Getting reactions from message ${thread}`);
        return web.reactions.get({ channel: channel, timestamp: thread });
    } catch (error) {
        console.log(JSON.stringify(error));
        debug(`Error when sending DM: ${JSON.stringify(error.data)}`);
    }
}

function editMessage(matchId, msg) {
    if (threads[matchId]) {
        msg.ts = threads[matchId];
        debug(`Editing message ${JSON.stringify(msg)}`);
        if (doAnnounce) {
            (async () => {
                try {
                    await web.chat.update(msg);
                } catch (error) {
                    debug(`Error when posting to slack: ${JSON.stringify(error.data)}`);
                }
            })();
        }
    } else {
        debug(`Cannot edit message for ${matchId}. Missing thread_ts`);
    }
}

// Post schedule of overdue matches based on a given schedule
debug(`Scheduling posting of overdue matches: "${CRON_SCHEDULE}"`)
schedule.scheduleJob(CRON_SCHEDULE, () => {
    axios.all([
        axios.get(`${API_URL}/player`),
        axios.get(`${API_URL}/tournament/groups`),
        axios.get(`${API_URL}/tournament/current/${officeId}`)
    ]).then(axios.spread((playersResponse, groupResponse, tournamentResponse) => {
        const players = playersResponse.data;
        const groups = groupResponse.data;
        const tournament = tournamentResponse.data;
        if (tournament.is_season) {
            axios.get(`${API_URL}/tournament/${tournament.id}/matches`)
                .then(response => {
                    const matches = response.data;
                    const msg = message.tournamentMatches(tournament, matches, players, groups)
                    if (msg.attachments.length > 0) {
                        postToSlack(undefined, msg);
                    }
                })
                .catch(error => {
                    debug(error);
                });
        }
    })).catch(error => {
        debug(error);
    });
});

const kcapp = require('kcapp-sio-client/kcapp')(KCAPP_HOST, KCAPP_PORT, "kcapp-announcer", KCAPP_PROTO);
kcapp.connect(() => {
    kcapp.on('order_changed', function (data) {
        const legId = data.leg_id;
        axios.get(`${API_URL}/leg/${legId}`).then(response => {
                const leg = response.data;
                axios.get(`${API_URL}/leg/${legId}/players`).then(response => {
                        const players = response.data;
                        axios.get(`${API_URL}/match/${leg.match_id}`).then(response => {
                                const match = response.data;
                                const matchId = match.id;
                                if (match.tournament_id !== null && match.tournament.office_id === officeId) {
                                    if (matchId && threads[matchId]) {
                                        debug(`Not posing about match already started: ${matchId}`);
                                        return;
                                    }
                                    postToSlack(leg.match_id, message.matchStarted(match, players));
                                } else {
                                    debug("Skipping announcement of unofficial match...");
                                }
                            }).catch(error => {
                                debug(error);
                            });
                    }).catch(error => {
                        debug(error);
                    });
            }).catch(error => {
                debug(error);
            });
    });

    kcapp.on('leg_finished', function (data) {
        const match = data.match;
        const leg = data.leg;

        if (match.tournament_id !== null && match.tournament.office_id === officeId) {
            axios.get(`${API_URL}/leg/${match.legs[0].id}/players`).then(response => {
                const players = response.data;
                const thread = threads[match.id];
                postToSlack(match.id, message.legFinished(thread, players, match, leg, data.throw));
                if (match.is_finished) {
                    editMessage(match.id, message.matchEnded(match, players));

                    // Notify watching players that match is finished
                    getReactionsPromise(match.id).then((response) => {
                        const reactions = response.message.reactions;
                        if (reactions) {
                            const eyes = _.filter(reactions, (reaction) => reaction.name === "eyes");
                            if (eyes) {
                                const watching = eyes[0].users;
                                for (const watcher of watching) {
                                    debug(`Sending DM to ${watcher}`);
                                    postToSlack(null, message.matchEndedDM(watcher, match, players));
                                }
                            }
                        } else {
                            debug(`No eyes-reactions found`)
                        }
                    });
                }
            })
            .catch(error => {
                debug(error);
            });
        }
    });
});

debug(`Waiting for events to announce for office id ${officeId}...`);
