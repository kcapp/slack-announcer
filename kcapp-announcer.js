var debug = require('debug')('kcapp-announcer');

var axios = require('axios');
var moment = require('moment');
var schedule = require("node-schedule");
var _ = require("underscore");

var officeId = process.argv[2] || 1;

var API_URL = "http://localhost:8001";
var GUI_URL = "http://localhost:3000";

var token = process.env.SLACK_KEY || "<slack_key_goes_here>";
var channel = process.env.SLACK_CHANNEL || "<channel_id_goes_here>";
var doAnnounce = process.env.ANNOUNCE || false;

const { WebClient } = require('@slack/web-api');
const web = new WebClient(token);

var message = require('./slack-message')(GUI_URL, channel);

var threads = {};

function postToSlack(matchId, msg) {
    debug(`Posting message ${JSON.stringify(msg)}`);
    if (doAnnounce) {
        (async () => {
            try {
                const response = await web.chat.postMessage(msg);
                if (!threads[matchId]) {
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
    msg.ts = threads[matchId];
    debug(`Editing message ${JSON.stringify(msg)}`);
    if (doAnnounce) {
        (async () => {
            try {
                const response = await web.chat.update(msg);
            } catch (error) {
                debug(`Error when posting to slack: ${JSON.stringify(error.data)}`);
            }
        })();
    }
}

// Post schedule of overdue matches every weekday at 09:00 CEST
schedule.scheduleJob('0 8 * * 1-5', () => {
    axios.all([
        axios.get(API_URL + "/player"),
        axios.get(API_URL + "/tournament/groups"),
        axios.get(API_URL + "/tournament/current/" + officeId)
    ]).then(axios.spread((playersResponse, groupResponse, tournamentResponse) => {
        var players = playersResponse.data;
        var groups = groupResponse.data;
        var tournament = tournamentResponse.data;
        axios.get(API_URL + "/tournament/" + tournament.id + "/matches")
            .then(response => {
                var matches = response.data;

                var text = `{ "text": "Pending Official Matches :trophy:", "attachments": [`
                for (var groupId in matches) {
                    var group = matches[groupId];

                    var newMatches = _.filter(group, (match) => {
                        return !match.is_finished && moment(match.created_at).isSameOrBefore(moment(), 'day');
                    });
                    if (newMatches.length === 0) {
                        continue;
                    }

                    var groupMatches = "";
                    for (var i = newMatches.length - 1; i >= 0; i--) {
                        var match = newMatches[i];

                        var home = players[match.players[0]];
                        var homePlayerName = home.slack_handle ? `<${home.slack_handle}>` : home.name;
                        var away = players[match.players[1]];
                        var awayPlayerName = away.slack_handle ? `<${away.slack_handle}>` : away.name;
                        var week = moment(match.created_at).diff(moment(tournament.start_time), "weeks") + 1;
                        groupMatches += `Week ${week}: ${homePlayerName} - ${awayPlayerName}\n`;
                    }

                    text += `{
                            "fallback": "${groups[groupId].name} Pending Matches",
                            "author_name": "",
                            "title": "${groups[groupId].name}",
                            "text": "${groupMatches}",
                            "mrkdwn_in": [ "text" ]
                        },`
                }
                text = text.substring(0, text.length - 1);
                text += `] }`;

                if (text !== `{ "text": "Pending Official Matches :trophy:", "attachments": ] }`) {
                    postToSlack(text);
                }
            })
            .catch(error => {
                debug(error);
            });
    })).catch(error => {
        debug(error);
    });
});

var kcapp = require('kcapp-sio-client/kcapp')("localhost", 3000);
kcapp.connect(() => {
    kcapp.on('order_changed', function (data) {
        var legId = data.leg_id;
        axios.get(API_URL + "/leg/" + legId).then(response => {
                var leg = response.data;
                axios.get(API_URL + "/leg/" + legId + "/players").then(response => {
                        var players = response.data;
                        axios.get(API_URL + "/match/" + leg.match_id).then(response => {
                                var match = response.data;
                                if (match.tournament_id !== null /*&& match.tournament.office_id == officeId*/) {
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
        var match = data.match;
        var leg = data.leg;

        axios.get(API_URL + "/leg/" + match.legs[0].id + "/players").then(response => {
                var players = response.data;
                postToSlack(match.id, message.legFinished(threads[match.id], players, match, leg, data.throw));
                if (match.is_finished && match.tournament_id !== null /*&& match.tournament.office_id == officeId*/) {
                    editMessage(match.id, message.matchEnded(match, players));
                }
            })
            .catch(error => {
                debug(error);
            });
    });
});

debug(`Waiting for events to announce for office id ${officeId}...`);