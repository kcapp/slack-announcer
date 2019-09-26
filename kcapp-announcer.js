var debug = require('debug')('kcapp-announcer');
var axios = require('axios');
var moment = require('moment');
var io = require("socket.io-client");
var schedule = require("node-schedule");
var _ = require("underscore");

var officeId = process.argv[2] || 1;

var BASE_URL = "http://localhost";
var API_URL = BASE_URL + ":8001";
var GUI_URL = BASE_URL;

var token = process.env.SLACK_KEY || "<slack_key_goes_here>";
var channel = process.env.SLACK_CHANNEL || "<channel_id_goes_here>";
var DO_ANNOUNCE = true;

const { WebClient } = require('@slack/web-api');
const web = new WebClient(token);

var socket = io(BASE_URL + ":3000/active");

var currentThread;

function postToSlack(json) {
    json.channel = channel;
    debug(JSON.stringify(json));
    if (DO_ANNOUNCE) {
        (async () => {
            try {
                const response = await web.chat.postMessage( json );
                debug(response);
                if (!currentThread) {
                    currentThread = response.ts;
                    debug(`Current thread is ${currentThread}`)
                }
            } catch (error) {
                debug(`Error when posting to slack: ${JSON.stringify(error.data)}`);
            }
            })();
    }
}

function editMessage(json) {
    json.channel = channel;
    json.ts = `"${currentThread}"`;
    debug(JSON.stringify(json));
    if (DO_ANNOUNCE) {
        (async () => {
            try {
                const response = await web.chat.update( json );
                debug(response);
            } catch (error) {
                debug(`Error when posting to slack: ${JSON.stringify(error.data)}`);
            }
            })();
    }
}

function getMatchStartText(match, players) {
    var homePlayer = players[0];
    var awayPlayer = players[1];

    return {
            "text": "",
            "attachments": [
                {
                    "fallback": "Official Match",
                    "author_name": "Official Match Started :trophy:",
                    "title": `${match.tournament.tournament_group_name}`,
                    "text": `:dart: <${GUI_URL}/players/${homePlayer.player_id}/statistics|${homePlayer.player_name}> vs. <${GUI_URL}/players/${awayPlayer.player_id}/statistics|${awayPlayer.player_name}> is about to start. <${GUI_URL}/matches/${match.id}/spectate|Spectate>`,
                    "mrkdwn_in": [ "text" ]
                }
            ]
        };
}

function getMatchEndText(match, players) {
    var homePlayer = players[0];
    var awayPlayer = players[1];

    var homePlayerWins = homePlayer.wins ? homePlayer.wins : 0;
    var awayPlayerWins = awayPlayer.wins ? awayPlayer.wins : 0;

    return {
        "text": "",
        "attachments": [
            {
                "fallback": "Official Match",
                "author_name": "Official Match Finished :trophy:",
                "title": `${match.tournament.tournament_group_name}`,
                "text": `:checkered_flag: <${GUI_URL}/players/${homePlayer.player_id}/statistics|${homePlayer.player_name}> ${homePlayerWins} - ${awayPlayerWins} <${GUI_URL}/players/${awayPlayer.player_id}/statistics|${awayPlayer.player_name}>. <${GUI_URL}/matches/${match.id}/result|Result>`,
                "mrkdwn_in": [ "text" ]
            }
        ] };
}

socket.on('order_changed', function (data) {
    var legId = data.leg_id;
    axios.get(API_URL + "/leg/" + legId)
        .then(response => {
            var leg = response.data;
            axios.get(API_URL + "/leg/" + legId + "/players")
                .then(response => {
                    var players = response.data;
                    axios.get(API_URL + "/match/" + leg.match_id)
                        .then(response => {
                            var match = response.data;
                            if (match.tournament_id !== null && match.tournament.office_id == officeId) {
                                postToSlack(getMatchStartText(match, players));
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

socket.on('leg_finished', function (data) {
    var match = data.match;

    axios.get(API_URL + "/leg/" + match.legs[0].id + "/players")
        .then(response => {
            var players = response.data;
            if (match.is_finished && match.tournament_id !== null && match.tournament.office_id == officeId) {
                editMessage(getMatchEndText(match, players));
                currentThread = undefined;
            } else {
                // TODO add message to thread with who won the leg
                postToSlack( {
                     "text": "Leg finished",
                     "thread_ts" : `"${currentThread}"`
                    } );
            }
        })
        .catch(error => {
            debug(error);
        });
});

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

debug(`Waiting for events to announce for office id ${officeId}...`);

