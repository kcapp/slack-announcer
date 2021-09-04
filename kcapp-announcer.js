const debug = require('debug')('kcapp-announcer');

const axios = require('axios');
const moment = require('moment');
const schedule = require("node-schedule");
const _ = require("underscore");

const officeId = parseInt(process.argv[2]) || 1;

const API_URL = "http://localhost:8001";
const GUI_URL = process.env.GUI_URL || "http://localhost:3000";

const token = process.env.SLACK_KEY || "<slack_key_goes_here>";
const channel = process.env.SLACK_CHANNEL || "<channel_id_goes_here>";
const doAnnounce = (process.env.ANNOUNCE || false) === "true";
if (doAnnounce) {
    debug(`Posting messages to Slack is enabled`);
}

const { WebClient } = require('@slack/web-api');
const web = new WebClient(token);

const message = require('./slack-message')(GUI_URL, channel);
const threads = {};

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
                debug(`Error when posting to slack: ${JSON.stringify(error.data)}`);
            }
        })();
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

// Post schedule of overdue matches every weekday at 09:00 CEST
schedule.scheduleJob('0 8 * * 1-5', () => {
    axios.all([
        axios.get(`${API_URL}/player`),
        axios.get(`${API_URL}/tournament/groups`),
        axios.get(`${API_URL}/tournament/current/${officeId}`)
    ]).then(axios.spread((playersResponse, groupResponse, tournamentResponse) => {
        const players = playersResponse.data;
        const groups = groupResponse.data;
        const tournament = tournamentResponse.data;
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
    })).catch(error => {
        debug(error);
    });
});

const kcapp = require('kcapp-sio-client/kcapp')("localhost", 3000, "kcapp-announcer", "http");
kcapp.connect(() => {
    kcapp.on('order_changed', function (data) {
        const legId = data.leg_id;
        axios.get(`${API_URL}/leg/${legId}`).then(response => {
                const leg = response.data;
                axios.get(`${API_URL}/leg/${legId}/players`).then(response => {
                        const players = response.data;
                        axios.get(`${API_URL}/match/${leg.match_id}`).then(response => {
                                const match = response.data;
                                if (match.tournament_id !== null && match.tournament.office_id === officeId) {
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
                    postToSlack(match.id, message.legFinished(threads[match.id], players, match, leg, data.throw));
                    if (match.is_finished) {
                        editMessage(match.id, message.matchEnded(match, players));
                    }
                })
                .catch(error => {
                    debug(error);
                });
        }
    });
});

debug(`Waiting for events to announce for office id ${officeId}...`);
